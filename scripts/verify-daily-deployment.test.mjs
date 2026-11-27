import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDailyPages, verifyDailyDeployment } from './verify-daily-deployment.mjs';

const commit = 'b'.repeat(40);
const today = 20780;
const clock = () => today * 86400000 - 9 * 3600000;
const seven = Array.from({ length: 7 }, (_, index) => ({ puzzle: '.'.repeat(81), dailyKey: `slot-${index}` }));
const encoded = JSON.stringify([...seven, ...seven]).replaceAll('"', '&quot;');
const daily = `<div data-sudoku data-daystart="${today - 1}" data-set="${encoded}"></div>`;
const archive = `<div data-daily-cal data-epoch="20618" data-maxday="${today - 1}"></div>`;

test('reads the real daily slot format and rejects stale archive or exhausted days', () => {
  assert.equal(checkDailyPages(daily, archive, today), 1);
  assert.throws(() => checkDailyPages(daily, archive, today + 1), /does not cover today/);
  assert.throws(() => checkDailyPages(daily, archive.replace('20779', '20778'), today), /Archive does not reach/);
});

test('waits for the pushed SHA and confirms it again after checking live pages', async () => {
  let markers = 0;
  const fetchClient = async (address) => {
    const path = new URL(address).pathname;
    if (path === '/deployment-sha.txt') return new Response(++markers === 1 ? 'older' : commit);
    return new Response(path === '/daily/' ? daily : archive);
  };
  const result = await verifyDailyDeployment(commit, { fetchClient, delay: async () => {}, clock });
  assert.equal(result.daysRemaining, 1);
  assert.equal(markers, 3);
  await assert.rejects(verifyDailyDeployment(commit, {
    fetchClient: async () => new Response('different'), attempts: 1, clock,
  }), /SHA is not live/);
});
