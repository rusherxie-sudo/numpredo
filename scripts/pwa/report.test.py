import unittest,json,copy,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('report',Path(__file__).with_name('report.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fixture=json.loads(Path(__file__).with_name('synthetic-report.json').read_text())
class ReportTests(unittest.TestCase):
 def test_arithmetic(self):
  r=m.report(fixture);self.assertTrue(r['SYNTHETIC']);self.assertEqual(r['outcomes']['return7']['groups']['prompt']['ratio'],.3);self.assertAlmostEqual(r['outcomes']['return7']['prompt_minus_control'],.05)
 def test_rejections(self):
  cases=[]
  def add(fn):
   x=copy.deepcopy(fixture);fn(x);cases.append(x)
  add(lambda x:x.update(retrievedAtUtc='2030-02-01T00:00:00Z'))
  add(lambda x:x['request']['dimensions'].append({'name':'date'}))
  add(lambda x:x['request'].update(property='properties/1'))
  add(lambda x:x['request']['dateRanges'][0].update(startDate='2030-01-02'))
  add(lambda x:x['request']['dateRanges'][0].update(endDate='2030-01-30'))
  add(lambda x:x['response']['metadata'].update(timeZone='UTC'))
  add(lambda x:x['response']['metadata'].update(subjectToThresholding=True))
  add(lambda x:x['response']['metadata'].update(samplingMetadatas=[{}]))
  add(lambda x:x['response']['rows'].pop())
  add(lambda x:x['response']['rows'][2]['metricValues'][0].update(value='101'))
  add(lambda x:x['response']['rows'][2]['metricValues'][1].update(value='31'))
  add(lambda x:x['response']['rows'][0]['metricValues'][0].update(value='-1'))
  add(lambda x:x['request']['dimensionFilter']['andGroup']['expressions'].pop())
  add(lambda x:x['cohort'].update(processingDelayHours=0))
  add(lambda x:x['cohort'].update(verifiedDeploymentSuccessUtc='2030-01-02T00:00:00Z'))
  for x in cases:
   with self.subTest(x=x):
    with self.assertRaises((ValueError,KeyError)):m.report(x)
if __name__=='__main__':unittest.main()
