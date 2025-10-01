type RumMetricName = "TTFB" | "FCP" | "LCP" | "CLS" | "FID";

export interface RumMetricEvent {
  name: RumMetricName;
  value: number;
  id: string;
  ts: number; // epoch ms
}

const globalAny = globalThis as any;

function dispatchRum(metric: RumMetricEvent) {
  if (!globalAny.__RUM_METRICS__) globalAny.__RUM_METRICS__ = [] as RumMetricEvent[];
  globalAny.__RUM_METRICS__.push(metric);
  const evt = new CustomEvent<RumMetricEvent>("rum:metric", { detail: metric });
  globalThis.dispatchEvent(evt);
  // best-effort send to server (non-blocking)
  if (navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(metric)], { type: "application/json" });
      navigator.sendBeacon("/api/rum", blob);
      return;
    } catch {}
  }
  // fallback
  fetch("/api/rum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metric) }).catch(() => {});
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function observeFCP() {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as PerformanceEntry & { name?: string }).name === "first-contentful-paint") {
          dispatchRum({ name: "FCP", value: entry.startTime, id: uid(), ts: Date.now() });
          po.disconnect();
        }
      }
    });
    po.observe({ type: "paint", buffered: true as any });
  } catch {}
}

function observeLCP() {
  try {
    let last: number | null = null;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntry[]) {
        const v = (entry as any).renderTime || (entry as any).loadTime || entry.startTime;
        last = Math.max(last ?? 0, v);
      }
    });
    po.observe({ type: "largest-contentful-paint", buffered: true as any });
    // report on visibility change or page hide
    const report = () => {
      if (last != null) dispatchRum({ name: "LCP", value: last, id: uid(), ts: Date.now() });
      po.disconnect();
      removeEventListener("visibilitychange", report);
      removeEventListener("pagehide", report);
    };
    addEventListener("visibilitychange", report);
    addEventListener("pagehide", report);
  } catch {}
}

function observeCLS() {
  try {
    let cls = 0;
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
    });
    po.observe({ type: "layout-shift", buffered: true as any });
    const report = () => {
      dispatchRum({ name: "CLS", value: cls, id: uid(), ts: Date.now() });
      po.disconnect();
      removeEventListener("visibilitychange", report);
      removeEventListener("pagehide", report);
    };
    addEventListener("visibilitychange", report);
    addEventListener("pagehide", report);
  } catch {}
}

function computeTTFB() {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      const ttfb = nav.responseStart;
      dispatchRum({ name: "TTFB", value: ttfb, id: uid(), ts: Date.now() });
    }
  } catch {}
}

function observeFID() {
  try {
    const po = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        const delay = entry.processingStart - entry.startTime;
        dispatchRum({ name: "FID", value: delay, id: uid(), ts: Date.now() });
        po.disconnect();
        break;
      }
    });
    // first-input is deprecated in favor of event-timing but still widely implemented
    po.observe({ type: "first-input", buffered: true as any });
  } catch {}
}

let started = false;
export function initRUM() {
  if (started) return;
  started = true;
  // defer until idle to minimize impact
  if ("requestIdleCallback" in globalThis) {
    (globalThis as any).requestIdleCallback(() => {
      computeTTFB();
      observeFCP();
      observeLCP();
      observeCLS();
      observeFID();
    });
  } else {
    setTimeout(() => {
      computeTTFB();
      observeFCP();
      observeLCP();
      observeCLS();
      observeFID();
    }, 0);
  }
}

export function getRumBuffer(): RumMetricEvent[] {
  return (globalAny.__RUM_METRICS__ ?? []) as RumMetricEvent[];
}
