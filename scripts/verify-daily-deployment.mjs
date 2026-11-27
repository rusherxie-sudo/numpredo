import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';

const origin = 'https://numpredo.com';
const slotsPerDay = 7;

export function checkDailyPages(daily, archive, today) {
  const game = daily.match(/<div\s+data-sudoku\b[^>]*>/)?.[0] ?? '';
  const firstDay = Number(game.match(/\bdata-daystart="(\d+)"/)?.[1]);
  const encodedPuzzles = game.match(/\bdata-set="([^"]+)"/)?.[1];
  assert(encodedPuzzles, 'Daily game puzzle data is missing');
  const puzzles = JSON.parse(encodedPuzzles.replaceAll('&quot;', '"'));
  assert(Array.isArray(puzzles) && puzzles.length % slotsPerDay === 0, 'Daily puzzle data is incomplete');
  const daysRemaining = firstDay + puzzles.length / slotsPerDay - today;
  assert(today >= firstDay && daysRemaining >= 1, 'Daily game does not cover today in Japan');
  const offset = (today - firstDay) * slotsPerDay;
  const todayPuzzles = puzzles.slice(offset, offset + slotsPerDay);
  assert(todayPuzzles.every(({ puzzle }) => /^[.1-9]{81}$/.test(puzzle)), 'Invalid puzzle for today');
  assert(new Set(todayPuzzles.map(({ dailyKey }) => dailyKey)).size === slotsPerDay, 'Seven daily slots were not found');
  const lastArchiveDay = Number(archive.match(/\bdata-daily-cal\b[^>]*\bdata-maxday="(\d+)"/)?.[1]);
  assert.equal(lastArchiveDay, today - 1, 'Archive does not reach yesterday in Japan');
  return daysRemaining;
}

export async function verifyDailyDeployment(commit, { fetchClient = fetch, delay = wait, attempts = 30, clock = Date.now } = {}) {
  assert.match(commit, /^[a-f0-9]{40}$/, 'Expected a full production commit SHA');
  async function read(path) {
    const response = await fetchClient(`${origin}${path}?verify=${commit}`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(12000),
    });
    assert(response.ok, `${path} returned HTTP ${response.status}`);
    return (await response.text()).trim();
  }

  let failure;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      assert.equal(await read('/deployment-sha.txt'), commit, 'Requested Pages SHA is not live');
      const [daily, archive] = await Promise.all([read('/daily/'), read('/daily/archive/')]);
      const today = Math.floor((clock() + 9 * 3600000) / 86400000);
      const daysRemaining = checkDailyPages(daily, archive, today);
      assert.equal(await read('/deployment-sha.txt'), commit, 'Production changed during verification');
      const date = new Date(today * 86400000).toISOString().slice(0, 10);
      return { commit, date, daysRemaining };
    } catch (error) {
      failure = error;
      if (attempt + 1 < attempts) await delay(20000);
    }
  }
  throw new Error(`Daily deployment could not be verified: ${failure?.message}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyDailyDeployment(process.argv[2]);
  console.log(`- Production SHA: \`${result.commit}\``);
  console.log(`- Japan date verified: ${result.date} with seven slots and yesterday in the archive`);
  console.log(`- Live puzzle window: ${result.daysRemaining} days including today`);
}
