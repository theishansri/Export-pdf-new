import { RequestHandler } from "express";

interface RumMetricEvent {
  name: "TTFB" | "FCP" | "LCP" | "CLS" | "FID";
  value: number;
  id: string;
  ts: number;
}

const buffer: RumMetricEvent[] = [];

export const postRum: RequestHandler = (req, res) => {
  const evt = req.body as RumMetricEvent | undefined;
  if (!evt || typeof evt.name !== "string" || typeof evt.value !== "number") {
    res.status(400).json({ ok: false });
    return;
  }
  buffer.push(evt);
  // cap at 5000 events
  if (buffer.length > 5000) buffer.splice(0, buffer.length - 5000);
  res.json({ ok: true });
};

export const getRum: RequestHandler = (_req, res) => {
  res.json({ events: buffer });
};

export const getRumSummary: RequestHandler = (_req, res) => {
  const map = new Map<string, { count: number; sum: number; min: number; max: number }>();
  for (const e of buffer) {
    const m = map.get(e.name) ?? { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: 0 };
    m.count++;
    m.sum += e.value;
    m.min = Math.min(m.min, e.value);
    m.max = Math.max(m.max, e.value);
    map.set(e.name, m);
  }
  const summary = Array.from(map.entries()).map(([name, s]) => ({
    name,
    count: s.count,
    avg: s.sum / s.count,
    min: s.min,
    max: s.max,
  }));
  res.json({ summary });
};
