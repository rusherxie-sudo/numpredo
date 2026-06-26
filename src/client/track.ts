// GA4 自定义事件上报。GA4 经 Partytown 在 web worker 运行，主线程通过 dataLayer.push
// 转发到 worker（astro.config.mjs 已配 forward: ['dataLayer.push']）。
// 上报失败绝不影响功能——分析是锦上添花，不能拖累交互。
declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(name: string, params: Record<string, unknown> = {}): void {
  try {
    (window.dataLayer = window.dataLayer || []).push(['event', name, params]);
  } catch {
    /* 静默：上报失败不影响功能 */
  }
}
