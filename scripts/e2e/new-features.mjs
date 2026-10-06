import { chromium } from "/tmp/pw/node_modules/playwright/index.mjs";
const B = "http://localhost:5173";
const errors = [];
const res = [];
const check = (n, ok, i = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${i ? "  -> " + i : ""}`); };
const browser = await chromium.launch();

async function run(tag, vp, dark) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(`${tag} console: ${m.text()}`));
  await page.goto(B + "/");
  if (dark) await page.click(".theme-toggle");
  const shot = (n) => page.screenshot({ path: `/tmp/pw/n-${tag}-${n}.png` });
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

  // Tools hub
  await page.goto(B + "/tools"); await page.waitForTimeout(400);
  check(`${tag} tools hub shows 10 tiles`, (await page.locator(".tool-tile").count()) === 10);
  await shot("tools");

  // Link Shield
  await page.goto(B + "/links");
  await page.fill("#link-input", "Dear user your KYC expired. Update now http://paytm-kyc-verify.xyz/login or visit https://paytm.com/help");
  await page.click("button:has-text('Check link')");
  await page.waitForTimeout(800);
  const lt = await page.locator("main").innerText();
  check(`${tag} link shield flags phishing + passes official`, /DANGEROUS/i.test(lt) && /SAFE/i.test(lt), (lt.match(/DANGEROUS|SUSPICIOUS|SAFE/gi) || []).join(","));
  check(`${tag} link shield never links to the bad URL`, (await page.locator("a[href*='paytm-kyc-verify']").count()) === 0);
  await shot("links");
  check(`${tag} link no overflow`, !(await overflow()));

  // Call Shield sample
  await page.goto(B + "/call");
  const sel = page.locator("#call-script-select");
  const opts = await sel.locator("option").allInnerTexts();
  await sel.selectOption({ index: 0 });
  await page.click("button:has-text('Play sample')");
  await page.waitForTimeout(16000);
  const ct = await page.locator("main").innerText();
  check(`${tag} call shield reaches scam alert`, /HANG UP|LIKELY SCAM/i.test(ct), opts[0]);
  await shot("call");
  check(`${tag} call no overflow`, !(await overflow()));
  if (!dark && tag === "d") {
    await page.click("button:has-text('Stop sample')").catch(() => {});
    await page.goto(B + "/call");
    await page.locator("#call-script-select").selectOption({ index: opts.length - 1 });
    await page.click("button:has-text('Play sample')");
    await page.waitForTimeout(16000);
    const bt = await page.locator("main").innerText();
    check(`${tag} genuine delivery call is not HANG UP`, !/HANG UP NOW/i.test(bt), opts[opts.length - 1]);
    await shot("call-genuine");
  }

  // Academy
  await page.goto(B + "/academy");
  await page.click("button:has-text('Start daily challenge'), button:has-text('Play again')");
  let answered = 0;
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector("button:has-text('Scam')", { timeout: 5000 }).catch(() => {});
    if (i === 0) await shot("academy-q");
    await page.click(".academy-round__btn-scam");
    answered++;
    if (i === 0) { await page.waitForTimeout(300); await shot("academy-reveal"); }
    await page.click("button:has-text('Next'), button:has-text('See results'), button:has-text('Finish')").catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(500);
  const at = await page.locator("main").innerText();
  check(`${tag} academy round completes with a score`, /\d+\s*\/\s*10/.test(at), (at.match(/\d+\s*\/\s*10/) || [""])[0]);
  await shot("academy-end");
  check(`${tag} academy no overflow`, !(await overflow()));

  // Console
  await page.goto(B + "/console");
  await page.click("[data-testid=seed-btn]");
  await page.waitForTimeout(2500);
  const rows = await page.locator("[data-testid^=case-item-]").count();
  const ct2 = await page.locator("main").innerText();
  check(`${tag} console seeded cases`, rows > 0, `rows=${rows}`);
  if (rows > 0) {
    await page.locator("[data-testid^=case-item-]").first().click().catch(() => {});
    await page.waitForTimeout(400);
    await page.click("[data-testid=confirm-fraud], [data-testid=confirm-btn]").catch(() => {});
    await page.waitForTimeout(800);
  }
  await shot("console");
  check(`${tag} console no overflow`, !(await overflow()));

  // Report pack
  await page.goto(B + "/report-pack");
  await page.waitForTimeout(600);
  const rt = await page.locator("main").innerText();
  check(`${tag} report pack shows 1930 + cybercrime.gov.in`, /1930/.test(rt) && /cybercrime\.gov\.in/i.test(rt));
  await shot("report");
  const wide = await page.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 6).map((e) => `${e.tagName}.${String(e.className).slice(0, 40)} ${Math.round(e.getBoundingClientRect().right)}`));
  check(`${tag} report no overflow`, !(await overflow()), wide.join(" | "));
  await ctx.close();
}
await run("d", { width: 1280, height: 900 }, false);
await run("dk", { width: 1280, height: 900 }, true);
await run("m", { width: 390, height: 844 }, false);
console.log("errors:", errors);
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
await browser.close();
