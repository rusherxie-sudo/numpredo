// 浮动分享按钮：展开渠道菜单 + 各 SNS 分享 / リンクコピー（当前ページ URL を実行時取得）。
const toggle = document.querySelector<HTMLButtonElement>('[data-fsh-toggle]');
const menu = document.querySelector<HTMLElement>('[data-fsh-menu]');
const shareText = '無料で遊べるナンプレ「numpredo」で毎日数独！';

toggle?.addEventListener('click', () => {
  if (!menu) return;
  const closed = menu.hasAttribute('hidden');
  if (closed) {
    menu.removeAttribute('hidden');
    toggle.setAttribute('aria-expanded', 'true');
  } else {
    menu.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

menu?.querySelectorAll<HTMLButtonElement>('[data-ch]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const u = encodeURIComponent(location.href);
    const t = encodeURIComponent(shareText);
    const ch = btn.dataset.ch;
    if (ch === 'x') window.open(`https://twitter.com/intent/tweet?text=${t}&url=${u}`, '_blank', 'noopener');
    else if (ch === 'line') window.open(`https://social-plugins.line.me/lineit/share?url=${u}`, '_blank', 'noopener');
    else if (ch === 'fb') window.open(`https://www.facebook.com/sharer/sharer.php?u=${u}`, '_blank', 'noopener');
    else if (ch === 'hatena') window.open(`https://b.hatena.ne.jp/add?mode=confirm&url=${u}&title=${t}`, '_blank', 'noopener');
    else if (ch === 'copy') {
      const label = btn.querySelector('.fsh-dot')?.outerHTML ?? '';
      navigator.clipboard?.writeText(location.href).then(() => {
        btn.innerHTML = label + 'コピーしました ✓';
        setTimeout(() => {
          btn.innerHTML = label + 'リンクをコピー';
        }, 1800);
      });
    }
  });
});
