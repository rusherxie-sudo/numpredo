declare global {
  interface Window {
    numpredoAdsAllowed?: () => boolean;
    adsbygoogle?: { push: (value: Record<string, never>) => unknown };
  }
}

const wideScreen = window.matchMedia('(min-width: 1280px) and (min-height: 800px)');
const slots = Array.from(document.querySelectorAll<HTMLElement>('[data-manual-ad]'));
const main = document.querySelector('main');
const primary = main?.querySelector<HTMLElement>('[data-manual-ad="content"]');

// Never put a unit inside a board, keypad, form, or an application's dynamic DOM.
if (main && primary) {
  const application = main.querySelector(
    '#home-game, #level-game, #sv-steps, #print-mount, [data-practice], .pg-tool, ' +
    '[data-candidate-checker], [data-s16], [data-mini4], [data-mini6-lesson], [data-variant-game], [data-sudoku]',
  );
  if (application) {
    application.insertAdjacentElement('afterend', primary);
  } else {
    const headings = Array.from(main.children).filter((node) => node.tagName === 'H2');
    // Leave the introduction and at least one complete section before the ad.
    const nextSection = headings[2] ?? headings[1];
    nextSection?.insertAdjacentElement('beforebegin', primary);
  }
}

function allowed() {
  return document.documentElement.dataset.adsenseAllowed === 'true' &&
    window.numpredoAdsAllowed?.() === true &&
    document.documentElement.dataset.adsenseUnavailable !== 'true' &&
    !window.matchMedia('print').matches;
}

function requestAd(container: HTMLElement) {
  if (!allowed() || container.hidden || !container.getClientRects().length || container.clientWidth < 250) return;
  const unit = container.querySelector<HTMLElement>('ins');
  if (!unit || unit.dataset.manualRequested === 'true' || unit.dataset.adsbygoogleStatus) return;
  unit.dataset.manualRequested = 'true';
  unit.classList.add('adsbygoogle');
  try {
    window.adsbygoogle ??= [] as Record<string, never>[];
    window.adsbygoogle.push({});
  } catch {
    // Do not retry or refresh an ad on a timer.
    container.hidden = true;
  }
}

const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) if (entry.isIntersecting) requestAd(entry.target as HTMLElement);
}, { rootMargin: '200px 0px' }) : undefined;

function updateSlots() {
  for (const container of slots) {
    const placement = container.dataset.manualAd;
    const visible = allowed() && (placement === 'rail' ? wideScreen.matches : placement === 'related' ? !wideScreen.matches : true);
    container.hidden = !visible;
    if (!visible) continue;
    if (observer) observer.observe(container);
    else requestAd(container);
  }
}

updateSlots();
wideScreen.addEventListener('change', updateSlots);
window.addEventListener('beforeprint', () => { for (const container of slots) container.hidden = true; });
window.addEventListener('afterprint', updateSlots);
export {};
