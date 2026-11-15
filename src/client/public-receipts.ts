// 撤回凭证只保存在本端，不进入链接、统计或公共题目接口。
export interface Receipt { puzzleId: string; submissionId: string; withdrawToken: string; grid: string }
export const RECEIPT_KEY = 'numpredo.public-submissions.v1';
export function readReceipts(storage: Pick<Storage, 'getItem'>): Receipt[] {
  try { const data = JSON.parse(storage.getItem(RECEIPT_KEY) ?? '[]'); return Array.isArray(data) ? data.filter(r => r && /^[a-f0-9]{64}$/.test(r.puzzleId) && typeof r.submissionId === 'string' && typeof r.withdrawToken === 'string' && /^[0-9]{81}$/.test(r.grid)) : []; } catch { return []; }
}
export function setupReceipts(container: HTMLElement): { has(grid: string): boolean; add(receipt: Receipt): boolean } {
  let storage: Storage | undefined;
  try { storage = localStorage; } catch { /* 禁用本地存储时仍保留当前页的凭证。 */ }
  let records = storage ? readReceipts(storage) : [];
  const save = (): boolean => { try { if (!storage) return false; storage.setItem(RECEIPT_KEY, JSON.stringify(records)); return true; } catch { return false; } };
  const render = (): void => {
    container.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = 'この端末の投稿・取り下げ';
    const info = document.createElement('p'); info.textContent = 'このブラウザに保存した投稿の控えです。取り下げ用の秘密情報は共有しないでください。ブラウザのデータを消すと控えも消えます。'; container.append(heading, info);
    for (const record of records) {
      const row = document.createElement('div'); const label = document.createElement('span'); label.textContent = '投稿 ' + record.puzzleId.slice(0, 8) + ' ';
      const withdraw = document.createElement('button'); withdraw.type = 'button'; withdraw.textContent = 'この投稿を取り下げる';
      const state = document.createElement('span'); state.setAttribute('role', 'status');
      const backup = document.createElement('button'); backup.type = 'button'; backup.textContent = '秘密の撤回控えを保存';
      backup.addEventListener('click', () => { const blob = new Blob([JSON.stringify(record)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'numpredo-withdraw-' + record.puzzleId.slice(0, 8) + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
      withdraw.addEventListener('click', async () => {
        withdraw.disabled = true;
        try { const response = await fetch('/api/public-puzzles/' + encodeURIComponent(record.puzzleId) + '/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId: record.submissionId, withdrawToken: record.withdrawToken }) }); if (!response.ok) throw new Error('withdraw failed'); records = records.filter(r => r.submissionId !== record.submissionId); save(); row.replaceChildren(); row.textContent = '投稿を取り下げました。'; }
        catch { withdraw.disabled = false; state.textContent = '取り下げできませんでした。再試行してください。'; }
      }); row.append(label, withdraw, backup, state); container.append(row);
    }
    if (!records.length) { const empty = document.createElement('p'); empty.textContent = 'この端末に投稿の控えはありません。'; container.append(empty); }
  };
  render();
  return { has: grid => records.some(r => r.grid === grid), add: receipt => { if (!records.some(r => r.submissionId === receipt.submissionId)) records.push(receipt); const persisted = save(); render(); return persisted; } };
}
