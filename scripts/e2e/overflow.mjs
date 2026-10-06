import { chromium } from "/tmp/pw/node_modules/playwright/index.mjs";
const path = process.argv[2] || "/report-pack";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto("http://localhost:5173" + path);
await page.waitForTimeout(800);
const out = await page.evaluate(() => {
  const w = window.innerWidth;
  const bad = [...document.querySelectorAll("html, body, body *")].filter((e) => e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0);
  return { doc: document.documentElement.scrollWidth, w, bad: bad.slice(0, 10).map((e) => `${e.tagName}.${String(e.className).slice(0, 50)} sw${e.scrollWidth} cw${e.clientWidth} pos=${getComputedStyle(e).position}`) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
