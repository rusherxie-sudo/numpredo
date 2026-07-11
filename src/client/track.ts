// GA4 自定义事件上报。gtag.js 直接跑在主线程（Partytown 转发通道实测失效已下线，
// 详见 astro.config.mjs / Base.astro）。上报失败绝不影响功能——分析是锦上添花，不能拖累交互。
declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(name: string, params: Record<string, unknown> = {}): void {
  try {
    const dl = (window.dataLayer = window.dataLayer || []);
    // gtag.js 只处理 gtag() 推入的 Arguments 对象——普通数组 push 会被静默忽略
    // （实测教训：数组写法上线两周 6 个事件全部 0 上报）。必须用真函数拿 arguments。
    function gtag(..._args: unknown[]): void {
      // eslint-disable-next-line prefer-rest-params
      dl.push(arguments);
    }
    gtag('event', name, params);
  } catch {
    /* 静默：上报失败不影响功能 */
  }
}
