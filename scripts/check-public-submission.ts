// 验证公开候选门禁，不依赖浏览器或服务端。
import assert from 'node:assert/strict';
import { eligibleForPublic } from '../src/client/public-submission.ts';
import { SOLVER_SAMPLE } from '../src/data/solver-sample.ts';
const grid = Array(81).fill(0); grid[0] = 5;
assert.equal(eligibleForPublic(grid, 1, 0, true, SOLVER_SAMPLE), true);
for (const [solutions, uncertain, confirmed] of [[2, 0, true], [0, 0, true], [1, 1, true], [1, 0, false]] as const) assert.equal(eligibleForPublic(grid, solutions, uncertain, confirmed, SOLVER_SAMPLE), false);
assert.equal(eligibleForPublic(Array(81).fill(0), 1, 0, true, SOLVER_SAMPLE), false);
assert.equal(eligibleForPublic(Array(81).fill(1), 1, 0, true, SOLVER_SAMPLE), false);
assert.equal(eligibleForPublic([...SOLVER_SAMPLE.replace(/\./g, '0')].map(Number), 1, 0, true, SOLVER_SAMPLE), false);
assert.equal(eligibleForPublic([10, ...grid.slice(1)], 1, 0, true, SOLVER_SAMPLE), false);
console.log('公开候选资格测试通过');
