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
  cohort?: 'v2';
  v2Enrolled?: boolean;
  v2Return7?: boolean;
  v2Return28?: boolean;
  v2Played7?: boolean;
  v2Installed14?: boolean;
}
// One explicitly authorized absolute UTC week; never derive dates from a build.
export const PWA_COHORT_V2: { enabled: boolean; enrollmentStartUtc: string | null; enrollmentEndUtc: string | null } = {
  enabled: true,
  enrollmentStartUtc: '2026-11-09T00:00:00Z',
  enrollmentEndUtc: '2026-11-16T00:00:00Z',
};
const V2_EVENTS = {
  enrolled: { prompt: 'pwa_v2_enrolled_prompt', control: 'pwa_v2_enrolled_control' },
  return7: { prompt: 'pwa_v2_return7_prompt', control: 'pwa_v2_return7_control' },
  return28: { prompt: 'pwa_v2_return28_prompt', control: 'pwa_v2_return28_control' },
  played7: { prompt: 'pwa_v2_played7_prompt', control: 'pwa_v2_played7_control' },
  installed14: { prompt: 'pwa_v2_installed14_prompt', control: 'pwa_v2_installed14_control' },
} as const;
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
function read(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved === null) return;
    if (typeof saved !== 'object' || !Number.isFinite(saved.visits) || !Number.isFinite(saved.lastSeen) || !Number.isFinite(saved.completed)) {
      storageWorks = false;
      return;
    }
    state = saved;
  } catch { storageWorks = false; }
}
function save(): boolean {
  if (!storageWorks) return false;
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch { storageWorks = false; return false; }
}
// The original module had no cross-tab transaction. Native Web Locks serializes
// only storage read/modify/write; never installation UI, game or network.
function transaction(change: () => void): void {
  const run = (): void => { read(); change(); };
  try {
    if (navigator.locks) void navigator.locks.request(KEY, run).catch(() => { storageWorks = false; });
    else run(); // Best effort only: localStorage has no atomic compare-and-swap.
  } catch { storageWorks = false; }
}
function v2Window(): { start: number; end: number } | null {
  const c = PWA_COHORT_V2;
  const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
  if (!c.enabled || !c.enrollmentStartUtc || !c.enrollmentEndUtc ||
    !utc.test(c.enrollmentStartUtc) || !utc.test(c.enrollmentEndUtc)) return null;
  const start = Date.parse(c.enrollmentStartUtc), end = Date.parse(c.enrollmentEndUtc);
  const canonical = (value: string): string => value.replace(/Z$/, '.000Z').replace(/(\.\d{3})\.000Z$/, '$1Z');
  return Number.isFinite(start) && Number.isFinite(end) &&
    new Date(start).toISOString() === canonical(c.enrollmentStartUtc) &&
    new Date(end).toISOString() === canonical(c.enrollmentEndUtc) && end - start === 7 * DAY ? { start, end } : null;
}
function v2(family: keyof typeof V2_EVENTS, marker: 'v2Enrolled' | 'v2Return7' | 'v2Return28' | 'v2Played7' | 'v2Installed14'): void {
  if (!v2Window() || !storageWorks || state.cohort !== 'v2' ||
    (state.group !== 'prompt' && state.group !== 'control') || state[marker]) return;
  state[marker] = true;
  // Drop rather than retry: persistence must succeed BEFORE an emit attempt.
  if (save()) emit(V2_EVENTS[family][state.group]);
}
function v2Outcome(kind: 'played7' | 'installed14', now: number): void {
  if (!Number.isFinite(now) || now < state.lastSeen || !Number.isFinite(state.enrolledAt)) return;
  const age = Math.floor((now - state.enrolledAt!) / DAY);
  if (age >= 0 && age < (kind === 'played7' ? 7 : 14))
    v2(kind, kind === 'played7' ? 'v2Played7' : 'v2Installed14');
}
function emit(name: string, extra: Record<string, unknown> = {}): void {
  try {
    // Base creates the GA queue before this optional module is loaded.
    window.gtag?.('event', name, { pwa_group: state.group ?? 'unassigned', display_mode: standalone() ? 'standalone' : 'browser', ...extra });
  } catch { /* Analytics must never interrupt installation. */ }
}
function visit(): void {
  const now = Date.now();
  if (!Number.isFinite(now) || now < state.lastSeen) return;
  if (!state.session || now - state.lastSeen >= SESSION) {
    state.visits++;
    state.session = now;
  }
  state.lastSeen = now;
  save();
}
window.numpredoPwaReady = true;

// Inline after the board, never an overlay on the keypad or a first-visit popup.
const game = document.querySelector('[data-sudoku]');
if (game) game.after(card);

function eligible(): boolean { return state.visits >= 2 || state.completed >= 2; }
function measureCohort(): void {
  if (!storageWorks || !state.group || !state.enrolledAt) return;
  const now = Date.now();
  if (!Number.isFinite(now) || now < state.lastSeen || now < state.enrolledAt) return;
  const age = Math.floor((now - state.enrolledAt) / DAY);
  if (age >= 7 && age < 14) v2('return7', 'v2Return7');
  if (age >= 28 && age < 35) v2('return28', 'v2Return28');
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
  const now = Date.now();
  if (!Number.isFinite(now) || now < state.lastSeen) return;
  if (!state.group && state.enrolledAt === undefined) {
    try { state.group = crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0 ? 'prompt' : 'control'; }
    catch { return; }
    state.enrolledAt = now;
    const window = v2Window();
    if (window && now >= window.start && now < window.end) state.cohort = 'v2';
    save();
    if (!storageWorks) return;
    v2('enrolled', 'v2Enrolled');
    emit(`pwa_enrolled_${state.group}`);
    measureCohort();
  }
  if (!state.group || state.group === 'control' || Date.now() < (state.dismissedUntil ?? 0) ||
    Date.now() - (state.shownAt ?? 0) < 7 * DAY) return;
  card.hidden = false;
}
let entry: 'automatic' | 'footer' = 'automatic';
let impression = false;
const observer = new IntersectionObserver(entries => {
  if (impression || !entries.some(e => e.isIntersecting) || card.hidden) return;
  impression = true;
  transaction(() => { state.shownAt = Date.now(); save(); emit('pwa_prompt_view', { install_entry: entry }); });
}, { threshold: 0.5 });
observer.observe(card);

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pending = event as InstallPrompt;
  transaction(update);
});
window.addEventListener('appinstalled', () => {
  const now = Date.now();
  pending = null;
  card.hidden = manual.hidden = true;
  transaction(() => { v2Outcome('installed14', now); state.installed = true; save(); emit('pwa_installed'); });
});
function suppress(): void {
  transaction(() => {
    const now = Date.now();
    const base = Math.max(Number.isFinite(now) ? now : state.lastSeen, state.lastSeen);
    state.dismissedUntil = Math.max(state.dismissedUntil ?? 0, base + 30 * DAY);
    save();
  });
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
  const now = Date.now();
  transaction(() => {
    v2Outcome('played7', now); // Before eligibility update: qualifying completion is excluded.
    state.completed++;
    save();
    emit('pwa_game_complete');
    update();
  });
});
// Update inactivity on actual interaction, not a timer that invents visits.
function activity(): void {
  transaction(() => {
    if (Date.now() - state.lastSeen < 60_000) return;
    visit();
    measureCohort();
    update();
  });
}
window.addEventListener('pointerdown', activity, { passive: true });
window.addEventListener('keydown', activity);
document.addEventListener('visibilitychange', () => { if (!document.hidden) activity(); });

if (standalone()) {
  transaction(() => { state.installed = true; save(); });
  try {
    const previous = Number(sessionStorage.getItem('numpredo.pwa.launch') || 0);
    if (Date.now() - previous >= SESSION) emit('pwa_launch');
    sessionStorage.setItem('numpredo.pwa.launch', String(Date.now()));
  } catch { /* No reliable launch deduplication when storage is blocked. */ }
}
transaction(() => { visit(); measureCohort(); update(); });

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
