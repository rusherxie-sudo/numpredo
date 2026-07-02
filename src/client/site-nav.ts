// 全站 chrome 的轻量交互：主题切换（亮/暗 + localStorage 记忆）与移动端汉堡菜单。
// 防闪 inline script（Base.astro <head>）已在首屏前设好 data-theme，这里只负责"切换"。
export {}; // 顶层 const 与其他入口脚本同名——标记为模块，隔离作用域让 tsc 通过
const root = document.documentElement;
const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
const burger = document.querySelector<HTMLButtonElement>('[data-burger]');
const mobile = document.querySelector<HTMLElement>('[data-mobile]');

function syncThemeIcon(): void {
  if (toggle) toggle.textContent = root.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
}
syncThemeIcon();

toggle?.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try {
    localStorage.setItem('numpredo_theme', next);
  } catch (e) {
    /* localStorage 不可用时忽略 */
  }
  syncThemeIcon();
});

burger?.addEventListener('click', () => {
  if (!mobile) return;
  const closed = mobile.hasAttribute('hidden');
  if (closed) {
    mobile.removeAttribute('hidden');
    burger.textContent = '✕';
    burger.setAttribute('aria-expanded', 'true');
  } else {
    mobile.setAttribute('hidden', '');
    burger.textContent = '☰';
    burger.setAttribute('aria-expanded', 'false');
  }
});
