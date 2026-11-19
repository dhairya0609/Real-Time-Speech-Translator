import config from "./config.js";

export class FixedWindowLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.buckets = new Map();
  }

  bucket(key, now) {
    let b = this.buckets.get(key);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, b);
    }
    return b;
  }

  check(key, now = Date.now()) {
    const b = this.bucket(key, now);
    return {
      ok: b.count < this.limit,
      remaining: Math.max(0, this.limit - b.count),
      retryAfterMs: b.count < this.limit ? 0 : b.resetAt - now,
    };
  }

  hit(key, now = Date.now()) {
    this.bucket(key, now).count += 1;
  }

  sweep(now = Date.now()) {
    for (const [key, b] of this.buckets) if (now >= b.resetAt) this.buckets.delete(key);
  }
}

function msUntilUtcMidnight(now) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) - now;
}

export class DailyCap {
  constructor(limit) {
    this.limit = limit;
    this.count = 0;
    this.resetAt = Date.now() + msUntilUtcMidnight(Date.now());
  }

  roll(now) {
    if (now >= this.resetAt) {
      this.count = 0;
      this.resetAt = now + msUntilUtcMidnight(now);
    }
  }

  check(now = Date.now()) {
    this.roll(now);
    return {
      ok: this.count < this.limit,
      remaining: Math.max(0, this.limit - this.count),
      retryAfterMs: this.count < this.limit ? 0 : this.resetAt - now,
    };
  }

  hit(now = Date.now()) {
    this.roll(now);
    this.count += 1;
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const L = config.limits;

export const limiters = {
  translateMinute: new FixedWindowLimiter({ limit: L.aiTranslatePerMinute, windowMs: MINUTE }),
  translateDay: new FixedWindowLimiter({ limit: L.aiTranslatePerDay, windowMs: DAY }),
  summaryHour: new FixedWindowLimiter({ limit: L.aiSummaryPerHour, windowMs: HOUR }),
  globalMinute: new FixedWindowLimiter({ limit: L.aiGlobalPerMinute, windowMs: MINUTE }),
  globalDay: new DailyCap(L.aiGlobalPerDay),
  httpTranslate: new FixedWindowLimiter({ limit: L.httpTranslatePerMinute, windowMs: MINUTE }),
};

setInterval(() => {
  for (const l of Object.values(limiters)) if (l.sweep) l.sweep();
}, 5 * MINUTE).unref();

/**
 * Reserves one Gemini call for `ip` if every applicable window has room.
 * Returns { ok: true } or { ok: false, reason, retryAfterMs }.
 */
export function reserveAiCall(kind, ip) {
  const perIp =
    kind === "summary"
      ? [limiters.summaryHour]
      : [limiters.translateMinute, limiters.translateDay];

  const globalDay = limiters.globalDay.check();
  if (!globalDay.ok) return { ok: false, reason: "ai_daily_cap", retryAfterMs: globalDay.retryAfterMs };

  for (const l of perIp) {
    const r = l.check(ip);
    if (!r.ok) return { ok: false, reason: "ai_rate_limited", retryAfterMs: r.retryAfterMs };
  }

  const globalMinute = limiters.globalMinute.check("global");
  if (!globalMinute.ok) return { ok: false, reason: "ai_busy", retryAfterMs: globalMinute.retryAfterMs };

  for (const l of perIp) l.hit(ip);
  limiters.globalMinute.hit("global");
  limiters.globalDay.hit();
  return { ok: true };
}

export function clientIp(req) {
  if (config.trustProxy) {
    const xff = String(req.headers["x-forwarded-for"] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (xff.length) return xff[xff.length - 1];
  }
  return req.socket?.remoteAddress || "unknown";
}
