// How the site loads on a phone (docs/PLAN_PERF.md): each page opened cold in headless Chromium as a
// Pixel 7 with the CPU slowed down, then a tap from the home page to each tab, timed until the next
// page shows something new. Run it before and after a performance change and compare.
//
//   node web/scripts/perf.mjs                                   # http://localhost:3000 (next start)
//   node web/scripts/perf.mjs https://nrl-predictor.vercel.app  # the live site, as a guest
//   node web/scripts/perf.mjs http://localhost:3000 --cpu 6 --pages / /elo --taps /tipping
//   node web/scripts/perf.mjs http://localhost:3000 --latency 150   # a phone on 4G: 150ms round trips
//
// Needs Playwright with Chromium (`npm i -g playwright && npx playwright install chromium`); it isn't
// one of the site's dependencies. Columns: time to first byte, first contentful paint, largest
// contentful paint, total blocking time (main-thread work past 50ms, a stand-in for jank), bytes as
// sent over the network (compressed), DOM elements. Tap: ms from the tap until the page changes (a
// loading skeleton counts) and until the new page's content is in.

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  console.error("Playwright isn't installed: npm i -g playwright && npx playwright install chromium");
  process.exit(1);
}
const { chromium, devices } = playwright;

const args = process.argv.slice(2);
const base = (args[0] && !args[0].startsWith("--") ? args.shift() : "http://localhost:3000").replace(/\/$/, "");
const flag = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const out = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith("--"); j++) out.push(args[j]);
  return out;
};
const cpu = Number(flag("--cpu")?.[0] ?? 4);
/** Extra round-trip time and a 4G-like bandwidth, for a local server that otherwise answers instantly. */
const latency = Number(flag("--latency")?.[0] ?? 0);
const pages = flag("--pages") ?? ["/", "/tipping", "/tipping/ladder", "/dally-m", "/elo", "/players", "/odds", "/model", "/about"];
const taps = flag("--taps") ?? ["/tipping", "/tipping/ladder", "/dally-m"];

const kb = (n) => (n / 1024).toFixed(0);

async function open(browser) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  await ctx.addInitScript(() => {
    window.__perf = { lcp: 0, tbt: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__perf.tbt += Math.max(0, e.duration - 50);
    }).observe({ type: "longtask", buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  if (latency) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8,
    });
  }
  const bytes = {};
  const type = new Map();
  cdp.on("Network.responseReceived", (e) => type.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const t = { Document: "html", Script: "js", Stylesheet: "css", Font: "font", Image: "img" }[type.get(e.requestId)] ?? "other";
    bytes[t] = (bytes[t] ?? 0) + e.encodedDataLength;
  });
  return { ctx, page, bytes };
}

async function loadPage(browser, path) {
  const { ctx, page, bytes } = await open(browser);
  try {
    const res = await page.goto(base + path, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(2000);
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return {
        ttfb: nav.responseStart, fcp: fcp?.startTime ?? 0, lcp: window.__perf.lcp, tbt: window.__perf.tbt,
        dom: document.getElementsByTagName("*").length,
      };
    });
    return { path, status: res?.status(), ...m, bytes };
  } finally {
    await ctx.close();
  }
}

/** From the home page, tap the link to `to` and time the change. */
async function tap(browser, to) {
  const { ctx, page } = await open(browser);
  try {
    await page.goto(base + "/", { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const link = page.locator(`nav a[href="${to}"]:visible`).first();
    if (!(await link.count())) return { to, error: "no visible link" };
    const before = await page.evaluate(() => document.querySelector("main")?.innerHTML ?? "");
    const t0 = Date.now();
    await link.click();
    // Anything new in <main> (a skeleton or the page) is the first response to the tap.
    await page.waitForFunction((b) => (document.querySelector("main")?.innerHTML ?? "") !== b, before, { timeout: 30_000 });
    const changed = Date.now() - t0;
    await page.waitForURL(`**${to}`, { timeout: 30_000 });
    await page.waitForFunction(() => !document.querySelector("[data-loading]"), null, { timeout: 30_000 });
    return { to, changed, done: Date.now() - t0 };
  } catch (e) {
    return { to, error: e.message.split("\n")[0] };
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
console.log(`${base}, Pixel 7, CPU ${cpu}x slower${latency ? `, ${latency}ms added round trip, 9 Mbps` : ""}\n`);
console.log("page".padEnd(20), "status ttfb   fcp   lcp   tbt    html  js   css font img   dom");
for (const p of pages) {
  const r = await loadPage(browser, p).catch((e) => ({ path: p, error: e.message }));
  if (r.error) {
    console.log(p.padEnd(20), "error:", r.error);
    continue;
  }
  const n = (v, w = 5) => String(Math.round(v)).padStart(w);
  const b = r.bytes;
  console.log(
    p.padEnd(20), String(r.status).padStart(6), n(r.ttfb), n(r.fcp), n(r.lcp), n(r.tbt),
    kb(b.html ?? 0).padStart(7), kb(b.js ?? 0).padStart(4), kb(b.css ?? 0).padStart(4), kb(b.font ?? 0).padStart(4),
    kb(b.img ?? 0).padStart(4), n(r.dom, 6),
  );
}
console.log("\ntap from /".padEnd(21), "changed  done");
for (const t of taps) {
  const r = await tap(browser, t);
  console.log(t.padEnd(20), r.error ? `error: ${r.error}` : `${String(r.changed).padStart(7)} ${String(r.done).padStart(5)}`);
}
await browser.close();
