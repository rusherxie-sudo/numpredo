#!/usr/bin/env python3
"""Offline validator/report. No OAuth, network, registration or enable operation."""
import argparse, datetime as dt, json, math, re
from pathlib import Path
UTC=dt.timezone.utc
JST=dt.timezone(dt.timedelta(hours=9))
FAMILIES=('enrolled','return7','return28','played7','installed14')
EVENTS=tuple(f'pwa_v2_{f}_{g}' for f in FAMILIES for g in ('prompt','control'))

def need(condition, message):
    if not condition: raise ValueError(message)

def instant(value):
    need(isinstance(value,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z',value), 'absolute UTC required')
    return dt.datetime.fromisoformat(value.replace('Z','+00:00'))

def number(value):
    need(isinstance(value,str) and re.fullmatch(r'0|[1-9]\d*',value) is not None,'nonnegative integer metric string required')
    n=int(value);need(n<=2**53-1,'count exceeds exact integer range');return n

def wilson(x,n):
    p=x/n;z=1.96;d=1+z*z/n;c=(p+z*z/(2*n))/d;h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
    return [c-h,c+h]

def report(data, window=28):
    need(type(data.get('synthetic')) is bool,'synthetic provenance flag required');need(window in (7,28),'invalid maturity window')
    need(set(data)=={'cohort','request','response','retrievedAtUtc','synthetic'},'unexpected envelope fields')
    c=data['cohort'];need(set(c)=={'enrollmentStartUtc','enrollmentEndUtc','verifiedDeploymentSuccessUtc','processingDelayHours'},'cohort scope fields required')
    t0,t1=instant(c['enrollmentStartUtc']),instant(c['enrollmentEndUtc'])
    need(t1-t0==dt.timedelta(days=7),'cohort must be exactly one fixed week')
    need(instant(c['verifiedDeploymentSuccessUtc'])<=t0,'recruitment starts before verified effective deployment')
    delay=c['processingDelayHours'];need(type(delay) is int and 48<=delay<=336,'processing delay must be explicit, at least 48 hours')
    maturity=t1+dt.timedelta(days=14 if window==7 else 35)
    retrieved=instant(data['retrievedAtUtc']);need(retrieved>=maturity+dt.timedelta(hours=delay),'whole cohort not mature plus processing delay')
    q=data['request'];need(set(q)=={'property','dateRanges','dimensions','metrics','dimensionFilter','limit','keepEmptyRows'},'only one whole-interval eventName query allowed; no pagination/date breakdown/segments')
    need(q['property']=='properties/539597439','wrong property')
    need(q['dimensions']==[{'name':'eventName'}],'whole-interval DISTINCT users only, never sum daily users')
    need(q['metrics']==[{'name':'totalUsers'},{'name':'eventCount'}],'metrics/order mismatch')
    need(q['limit']==100 and q['keepEmptyRows'] is True,'bounded complete result required')
    need(q['dimensionFilter']=={'andGroup':{'expressions':[
        {'filter':{'fieldName':'hostName','inListFilter':{'values':['numpredo.com','www.numpredo.com'],'caseSensitive':True}}},
        {'filter':{'fieldName':'eventName','inListFilter':{'values':list(EVENTS),'caseSensitive':True}}}
    ]}},'exact main/www AND fixed event whitelist scope required')
    ranges=q['dateRanges'];need(len(ranges)==1 and set(ranges[0])=={'startDate','endDate'},'one absolute full interval required')
    start,end=(dt.date.fromisoformat(ranges[0][k]) for k in ('startDate','endDate'))
    need(start<=t0.astimezone(JST).date() and end>=maturity.astimezone(JST).date(),'query omits cohort recruitment or complete outcome window')
    end_exclusive=dt.datetime.combine(end+dt.timedelta(days=1),dt.time(),JST)
    need(retrieved>=end_exclusive+dt.timedelta(hours=delay),'query includes unprocessed day(s)')
    r=data['response'];need(set(r)<={'dimensionHeaders','metricHeaders','rows','rowCount','metadata','kind'},'unexpected response fields; use whitelisted Data API export')
    need(r.get('dimensionHeaders')==[{'name':'eventName'}],'response dimension mismatch')
    need(r.get('metricHeaders')==[{'name':'totalUsers','type':'TYPE_INTEGER'},{'name':'eventCount','type':'TYPE_INTEGER'}],'response metric mismatch')
    meta=r.get('metadata',{});need(meta.get('timeZone')=='Asia/Tokyo','response time zone must be Asia/Tokyo')
    need(not meta.get('subjectToThresholding') and not meta.get('dataLossFromOtherRow') and not meta.get('samplingMetadatas') and not meta.get('schemaRestrictionResponse',{}).get('activeMetricRestrictions'),'thresholded, sampled or restricted result rejected')
    rows=r.get('rows');need(isinstance(rows,list) and r.get('rowCount')==len(rows),'incomplete/paginated result')
    counts={}
    for row in rows:
        need(set(row)=={'dimensionValues','metricValues'} and len(row['dimensionValues'])==1 and len(row['metricValues'])==2,'invalid row shape')
        name=row['dimensionValues'][0]['value'];need(name in EVENTS and name not in counts,'unknown/duplicate event')
        u,e=(number(x['value']) for x in row['metricValues']);need(e==u,'eventCount differs from distinct users: duplicate/identity anomaly')
        counts[name]={'totalUsers':u,'eventCount':e}
    for name,values in counts.items():
        group=name.rsplit('_',1)[1]
        if 'enrolled' not in name:
            denominator=counts.get('pwa_v2_enrolled_'+group)
            need(denominator is not None and values['totalUsers']<=denominator['totalUsers'],'numerator exceeds or lacks enrolled denominator')
    required=[f for f in FAMILIES if window==28 or f!='return28']
    need(all(f'pwa_v2_{f}_{g}' in counts for f in required for g in ('prompt','control')),'missing event row is ambiguous; never silently fill zero')
    n={g:counts[f'pwa_v2_enrolled_{g}']['totalUsers'] for g in ('prompt','control')}
    need(min(n.values())>0,'empty ITT denominator')
    chi=(n['prompt']-n['control'])**2/sum(n.values());need(chi<=10.828,'50/50 allocation anomaly (chi-square p<0.001)')
    results={}
    for f in required[1:]:
        groups={}
        for g in n:
            x=counts[f'pwa_v2_{f}_{g}']['totalUsers'];need(x<=n[g],'numerator exceeds enrolled denominator')
            groups[g]={'users':x,'ITT_denominator':n[g],'ratio':x/n[g],'wilson95':wilson(x,n[g])}
        diff=groups['prompt']['ratio']-groups['control']['ratio']
        # Conservative difference interval from Wilson group bounds (Newcombe).
        p,co=groups['prompt'],groups['control']
        ci=[diff-math.sqrt((p['ratio']-p['wilson95'][0])**2+(co['wilson95'][1]-co['ratio'])**2),diff+math.sqrt((p['wilson95'][1]-p['ratio'])**2+(co['ratio']-co['wilson95'][0])**2)]
        results[f]={'groups':groups,'prompt_minus_control':diff,'difference95':ci}
    return {'SYNTHETIC':data['synthetic'] is True,'property':q['property'],'timeZone':'Asia/Tokyo','cohortUtc':[c['enrollmentStartUtc'],c['enrollmentEndUtc']],'queryDates':ranges,'matureAfterUtc':maturity.isoformat(),'processingDelayHours':delay,'counts':counts,'outcomes':results,'allocationChiSquare':chi,'interpretation':'Observed GA identities, ITT prompt/control; not true humans or cross-device retention. Control can actively install. No natural effect or causal winner established. Missing/blocked analytics and container/identity changes remain.'}

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('input',type=Path);ap.add_argument('--window',type=int,choices=[7,28],default=28);a=ap.parse_args()
    try: print(json.dumps(report(json.loads(a.input.read_text()),a.window),ensure_ascii=False,indent=2))
    except (ValueError,KeyError,TypeError,OverflowError) as e: ap.exit(1,f'INVALID / NO RATE: {e}\n')
