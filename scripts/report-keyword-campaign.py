"""Compare a fixed query/owner/device cohort from saved Japan GSC Web exports.

Usage: python3 scripts/report-keyword-campaign.py INPUT CAMPAIGN OUTPUT.csv
INPUT: current-query.json, previous-query.json, current-page-query-device.json,
previous-page-query-device.json. Windows/filters are recorded in CAMPAIGN.
Only reads exports: no credentials, network, indexing or publication actions.
"""
import csv
import json
import sys
from pathlib import Path

source, campaign_path, destination = map(Path, sys.argv[1:])
campaign = json.loads(campaign_path.read_text())


def rows(name):
    data = json.loads((source / (name + '.json')).read_text())
    if 'error' in data or 'error_status' in data or 'rows' not in data:
        raise ValueError('Missing or failed export: ' + name)
    return data['rows']


queries = {period: {r['keys'][0]: r for r in rows(period + '-query')}
           for period in ['previous', 'current']}
details = {period: {tuple(r['keys']): r for r in rows(period + '-page-query-device')}
           for period in ['previous', 'current']}
output = []
for item in campaign['keywords']:
    for device in ['MOBILE', 'DESKTOP', 'TABLET']:
        record = {'query': item['query'], 'owner': item['owner'], 'action': item['action'], 'device': device}
        for period in ['previous', 'current']:
            window = campaign['windows'][period]
            record[period + '_window'] = window['start'] + '/' + window['end']
            row = details[period].get(('https://numpredo.com' + item['owner'], item['query'], device))
            record[period + '_status'] = 'observed' if row else 'not_in_export'
            for metric in ['clicks', 'impressions', 'position', 'ctr']:
                record[period + '_' + metric] = round(row[metric], 6) if row else ''
            site_row = queries[period].get(item['query'])
            # Site query total is independently queried, never summed from URLs.
            record[period + '_site_query_clicks'] = site_row['clicks'] if site_row else ''
        old, new = record['previous_position'], record['current_position']
        record['position_improvement'] = round(old - new, 3) if old != '' and new != '' else ''
        output.append(record)

destination.parent.mkdir(parents=True, exist_ok=True)
with destination.open('w') as f:
    writer = csv.DictWriter(f, fieldnames=list(output[0]))
    writer.writeheader()
    writer.writerows(output)
print(f'{len(campaign["keywords"])} fixed queries × 3 devices. Missing rows are blank, not zero. Site-query totals repeat across devices: do not sum them.')
