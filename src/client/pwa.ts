export {};

declare global {
  interface Window {
    numpredoInstallPrompt?: Event;
    numpredoPwaReady?: boolean;
  }
}

interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface PwaState {
  visits: number;
  lastSeen: number;
  session: number;
  completed: number;
  group?: 'prompt' | 'control';
  enrolledAt?: number;
  cohortSession?: number;
  dismissedUntil?: number;
  shownAt?: number;
  installed?: boolean;
  returned7?: boolean;
  returned28?: boolean;
}
const KEY = 'numpredo.pwa.v1';
const DAY = 86_400_000;
const SESSION = 30 * 60_000;
const card = document.querySelector<HTMLElement>('[data-pwa-card]')!;
const install = card.querySelector<HTMLButtonElement>('[data-pwa-install]')!;
const dismiss = card.querySelector<HTMLButtonElement>('[data-pwa-dismiss]')!;
const help = card.querySelector<HTMLElement>('[data-pwa-help]')!;
const manual = document.querySelector<HTMLButtonElement>('[data-pwa-manual]')!;
const standalone = (): boolean => matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
let pending = (window.numpredoInstallPrompt ?? null) as InstallPrompt | null;
let storageWorks = true;
let state: PwaState = { visits: 0, lastSeen: 0, session: 0, completed: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && typeof saved === 'object' && Number.isFinite(saved.visits) && Number.isFinite(saved.lastSeen) && Number.isFinite(saved.completed)) state = saved;
} catch { storageWorks = false; }
function save(): void {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { storageWorks = false; }
}
function emit(name: string, extra: Record<string, unknown> = {}): void {
  try {
    // Base creates the GA queue before this optional module is loaded.
    window.gtag?.('event', name, { pwa_group: state.group ?? 'unassigned', display_mode: standalone() ? 'standalone' : 'browser', ...extra });
  } catch { /* Analytics must never interrupt installation. */ }
}
function visit(): void {
  const now = Date.now();
  if (!state.session || now - state.lastSeen >= SESSION) {
    state.visits++;
    state.session = now;
  }
  state.lastSeen = now;
  save();
}
visit();
window.numpredoPwaReady = true;

// Inline after the board, never an overlay on the keypad or a first-visit popup.
const game = document.querySelector('[data-sudoku]');
if (game) game.after(card);

function eligible(): boolean { return state.visits >= 2 || state.completed >= 2; }
function measureCohort(): void {
  if (!storageWorks || !state.group || !state.enrolledAt) return;
  const age = Math.floor((Date.now() - state.enrolledAt) / DAY);
  if (state.cohortSession !== state.session) {
    state.cohortSession = state.session;
    emit('pwa_cohort_visit', { cohort_day: age });
  }
  // Fixed return windows, once per browser; event names allow basic GA reporting
  // without configuring new account-level custom dimensions.
  if (age >= 7 && age < 14 && !state.returned7) {
    state.returned7 = true;
    emit(`pwa_return_7d_${state.group}`);
  }
  if (age >= 28 && age < 35 && !state.returned28) {
    state.returned28 = true;
    emit(`pwa_return_28d_${state.group}`);
  }
  save();
}
function update(): void {
  if (standalone() || state.installed) {
    card.hidden = manual.hidden = true;
    return;
  }
  const supported = !!pending || ios;
  manual.hidden = !supported;
  if (!storageWorks || !game || !supported || !eligible()) return;
  if (!state.group) {
    state.group = crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0 ? 'prompt' : 'control';
    state.enrolledAt = Date.now();
    save();
    if (!storageWorks) return;
    emit(`pwa_enrolled_${state.group}`);
    measureCohort();
  }
  if (state.group === 'control' || Date.now() < (state.dismissedUntil ?? 0) ||
    Date.now() - (state.shownAt ?? 0) < 7 * DAY) return;
  card.hidden = false;
}
let entry: 'automatic' | 'footer' = 'automatic';
let impression = false;
const observer = new IntersectionObserver(entries => {
  if (impression || !entries.some(e => e.isIntersecting) || card.hidden) return;
  impression = true;
  state.shownAt = Date.now();
  save();
  emit('pwa_prompt_view', { install_entry: entry });
}, { threshold: 0.5 });
observer.observe(card);

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pending = event as InstallPrompt;
  update();
});
window.addEventListener('appinstalled', () => {
  state.installed = true;
  save();
  pending = null;
  emit('pwa_installed');
  card.hidden = manual.hidden = true;
});
function suppress(): void {
  state.dismissedUntil = Date.now() + 30 * DAY;
  save();
  card.hidden = true;
}
dismiss.addEventListener('click', () => {
  emit('pwa_prompt_dismiss', { install_entry: entry });
  suppress();
  manual.focus({ preventScroll: true });
});
manual.addEventListener('click', () => {
  entry = 'footer';
  card.hidden = false;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  install.focus({ preventScroll: true });
  emit('pwa_install_open', { install_entry: entry });
});
install.addEventListener('click', async () => {
  emit('pwa_install_click', { install_entry: entry, install_method: pending ? 'native' : 'ios_instructions' });
  if (!pending) {
    if (ios) { help.hidden = false; emit('pwa_install_help'); }
    return;
  }
  const prompt = pending;
  pending = null;
  install.disabled = true;
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    emit('pwa_install_choice', { outcome: choice.outcome });
    suppress();
    manual.hidden = true;
  } catch {
    help.textContent = '追加画面を開けませんでした。ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。';
    help.hidden = false;
    emit('pwa_install_error');
    manual.hidden = true;
  } finally { install.disabled = !pending && !ios; }
});
window.addEventListener('numpredo:game-complete', () => {
  state.completed++;
  save();
  emit('pwa_game_complete');
  update();
});
// Update inactivity on actual interaction, not a timer that invents visits.
function activity(): void {
  if (Date.now() - state.lastSeen < 60_000) return;
  visit();
  measureCohort();
  update();
}
window.addEventListener('pointerdown', activity, { passive: true });
window.addEventListener('keydown', activity);
document.addEventListener('visibilitychange', () => { if (!document.hidden) activity(); });

if (standalone()) {
  state.installed = true;
  save();
  try {
    const previous = Number(sessionStorage.getItem('numpredo.pwa.launch') || 0);
    if (Date.now() - previous >= SESSION) emit('pwa_launch');
    sessionStorage.setItem('numpredo.pwa.launch', String(Date.now()));
  } catch { /* No reliable launch deduplication when storage is blocked. */ }
}
measureCohort();
update();

// Keep only a known game path; never store arbitrary URLs.
try {
  if (/^\/play\/(beginner|intermediate|advanced|hard|extreme)\/$/.test(location.pathname)) {
    localStorage.setItem('numpredo.pwa.last-level', location.pathname);
  }
  const last = localStorage.getItem('numpredo.pwa.last-level');
  if (standalone() && location.pathname === '/play/' && last && /^\/play\/(beginner|intermediate|advanced|hard|extreme)\/$/.test(last)) {
    const resume = document.querySelector<HTMLElement>('[data-pwa-resume]')!;
    resume.querySelector('a')!.href = last;
    resume.hidden = false;
    document.querySelector('main h1')?.after(resume);
  }
} catch { /* Existing game storage also degrades gracefully. */ }
