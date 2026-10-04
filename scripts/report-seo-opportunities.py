"""Summarize saved GSC exports into an intent-level operating report. No network or credentials.
Usage: python3 scripts/report-seo-opportunities.py INPUT_DIRECTORY OUTPUT_DIRECTORY
INPUT contains current-query, previous-query and current-page-query JSON exports.
All inputs must use matching search type/country and equal mature date windows.
"""
import csv,json,re,sys
from pathlib import Path
from collections import defaultdict
src,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
def rows(name):
 data=json.loads((src/(name+'.json')).read_text())
 if 'error' in data or 'error_status' in data:raise ValueError('Failed source: '+name)
 return data.get('rows',[])
def route(q):
 q=re.sub(r'\s+','',q).lower()
 if re.search(r'ナンプレ7|神域|sudoku\.com|ニコリ',q):return '競合指名・要確認','', 'exclude'
 if re.search(r'新聞|読売|よみほっと',q):return '新聞の解答確認','/guide/newspaper/','maintain'
 if re.search(r'高齢|大きく|見やす',q):return '大字・高齢者プリント','/print/senior/','intent_review'
 if re.search(r'キラー|killer|不等号|16[×x*]|16ナンプレ|6[×x]|4[×x]|対角',q):return '変体','/variants/','specialist'
 if re.search(r'日替|毎日|今日',q):return '日替わり','/daily/','grow'
 if re.search(r'印刷|プリント|pdf',q):return '印刷・PDF','/print/','grow'
 if re.search(r'答え|解答|ソルバー|解析|カメラ|画像',q):return '求解ツール','/tools/solver/','grow'
 if re.search(r'行き詰|詰ま|解けな|進ま',q):return '行き詰まり','/guide/when-stuck/','grow'
 if re.search(r'解き方|コツ|テクニック|wing|同盟|候補',q):return '解法・手筋','/guide/tips/','grow'
 if re.search(r'由来|違い|発祥|とは|効果|脳に|歴史|何歳',q):return '知識・定義','/guide/','maintain'
 if re.search(r'超難|最高級|最上級|エキスパート|超上級',q):return '超難問ゲーム','/play/extreme/','grow'
 if '難問' in q:return '難問ゲーム','/play/hard/','grow'
 if '上級' in q:return '上級ゲーム','/play/advanced/','grow'
 if '中級' in q:return '中級ゲーム','/play/intermediate/','grow'
 if re.search(r'初級|簡単|やさしい',q):return '初級ゲーム','/play/beginner/','grow'
 if re.search(r'問題集|問題',q):return '問題集を選ぶ','/play/','grow'
 if re.search(r'numpredo|ナンプレdo',q):return '自社指名','/','maintain'
 if re.search(r'数独|ナンプレ|sudoku',q):return '一般ゲーム・要確認','/','intent_review'
 return '未分類','', 'intent_review'
previous={r['keys'][0]:r for r in rows('previous-query')};page_queries=defaultdict(list)
for r in rows('current-page-query'):page_queries[r['keys'][1]].append(r)
groups=defaultdict(lambda:{'clicks':0,'impressions':0,'weighted_position':0,'previous_clicks_same_queries':0,'queries':0})
opportunities=[]
for r in rows('current-query'):
 q=r['keys'][0];cluster,target,action=route(q);g=groups[cluster]
 g['clicks']+=r['clicks'];g['impressions']+=r['impressions'];g['weighted_position']+=r['position']*r['impressions'];g['queries']+=1;g['previous_clicks_same_queries']+=previous.get(q,{}).get('clicks',0)
 if action not in ['exclude','maintain'] and r['impressions']>=130 and 4<=r['position']<=20:
  pages=sorted(page_queries[q],key=lambda x:-x['impressions'])
  eligible=[p for p in pages if p['impressions']>=max(30,r['impressions']*.15)]
  opportunities.append({'cluster':cluster,'query':q,'clicks':r['clicks'],'impressions':r['impressions'],'ctr_percent':round(r['ctr']*100,2),'position':round(r['position'],2),'previous_clicks':previous.get(q,{}).get('clicks',0),'suggested_owner':target,'observed_pages':' | '.join(p['keys'][0].replace('https://numpredo.com','') for p in pages[:3]),'multi_page_review':len(eligible)>1,'decision':action})
with (out/'opportunities.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=list(opportunities[0]));w.writeheader();w.writerows(sorted(opportunities,key=lambda r:-r['impressions']))
with (out/'clusters.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['intent','visible_queries','clicks','impressions','ctr_percent','weighted_position','previous_clicks_for_current_visible_queries'])
 for name,g in sorted(groups.items(),key=lambda kv:-kv[1]['impressions']):w.writerow([name,g['queries'],g['clicks'],g['impressions'],round(g['clicks']/g['impressions']*100,2),round(g['weighted_position']/g['impressions'],2),g['previous_clicks_same_queries']])
print(f'{len(opportunities)} prioritized query candidates; {len(groups)} mutually exclusive intent groups. Suggested owners require editorial review; multiple pages do not prove cannibalization.')
