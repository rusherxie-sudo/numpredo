// 列表不可用时不影响求解器，也不展示未公开的候选。
export async function showRecentPublic(root: HTMLElement): Promise<void> {
  try {
    const response = await fetch('/api/public-puzzles');
    if (!response.ok) throw new Error('unavailable');
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error('invalid response');
    const items = data.items.filter((item: { status?: unknown; id?: unknown; grid?: unknown }) => item.status === 'public' && typeof item.id === 'string' && /^[a-f0-9]{64}$/.test(item.id) && typeof item.grid === 'string' && /^[0-9]{81}$/.test(item.grid)).slice(0, 3);
    root.replaceChildren();
    if (!items.length) { root.textContent = '公開中の問題はまだありません。'; return; }
    const list = document.createElement('div'); list.className = 'recent-public-list';
    for (const item of items) {
      const link = document.createElement('a'); link.href = '/public-puzzles/?id=' + encodeURIComponent(item.id); link.className = 'recent-public-item';
      const title = document.createElement('span'); title.textContent = (typeof item.createdAt === 'string' ? item.createdAt.slice(0, 10) + ' · ' : '') + item.id.slice(0, 8);
      const board = document.createElement('pre'); board.setAttribute('aria-label', '投稿された問題の盤面');
      board.textContent = Array.from({ length: 9 }, (_, r) => item.grid.slice(r * 9, r * 9 + 9).replace(/0/g, '・').split('').join(' ')).join('\n');
      link.append(title, board); list.append(link);
    } root.append(list);
  } catch { root.textContent = '投稿問題を読み込めませんでした。時間をおいて一覧からお試しください。'; }
}
const root = document.getElementById('sv-recent-public');
if (root) void showRecentPublic(root);
