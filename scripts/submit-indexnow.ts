// 将本次真正新增或更新的 URL 通知 IndexNow。
// 默认只预览；明确传 --send 才联网，避免在部署前或构建阶段误提交。
import { readFileSync } from 'node:fs';

const SITE = 'https://numpredo.com';
const HOST = 'numpredo.com';
const KEY_FILE = 'public/104e673ac3a826465d76e8eac8f44708.txt';
const ENDPOINT = 'https://api.indexnow.org/IndexNow';

const args = process.argv.slice(2);
const shouldSend = args.includes('--send');
const inputs = args.filter((arg) => arg !== '--send');

if (inputs.length === 0) {
  console.error('用法: npm run submit:indexnow -- /print/ /print/extreme/ [--send]');
  process.exit(1);
}
if (inputs.length > 10_000) {
  console.error('单次最多提交 10,000 个 URL。');
  process.exit(1);
}

const key = readFileSync(KEY_FILE, 'utf8').trim();
if (!/^[a-f0-9-]{8,128}$/i.test(key)) {
  console.error(`IndexNow key 格式无效: ${KEY_FILE}`);
  process.exit(1);
}

const urls = [...new Set(inputs.map((input) => new URL(input, SITE).href))].map((input) => {
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.hostname !== HOST) {
    throw new Error(`只允许提交 ${SITE} 的 HTTPS URL: ${url.href}`);
  }
  url.hash = '';
  return url.href;
});

const keyLocation = `${SITE}/${key}.txt`;
const payload = {
  host: HOST,
  key,
  keyLocation,
  urlList: urls,
};

console.log(`IndexNow ${shouldSend ? '发送' : '预览'}：${urls.length} 个 URL`);
for (const url of urls) console.log(`  ${url}`);

if (!shouldSend) {
  console.log('\n当前为 dry-run；确认这些 URL 已上线后，加 --send 才会正式通知 IndexNow。');
  process.exit(0);
}

const keyResponse = await fetch(keyLocation);
const remoteKey = (await keyResponse.text()).trim();
if (!keyResponse.ok || remoteKey !== key) {
  console.error(`线上 key 验证失败（HTTP ${keyResponse.status}），请确认新版本已经部署：${keyLocation}`);
  process.exit(1);
}

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`IndexNow 提交失败：HTTP ${response.status}${body ? `\n${body}` : ''}`);
  process.exit(1);
}

console.log(`IndexNow 已接受：HTTP ${response.status}`);
