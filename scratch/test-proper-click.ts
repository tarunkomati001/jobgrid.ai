import { chromium } from "playwright";

async function setReactVal(page: any, selector: string, val: string) {
  const loc = page.locator(selector).first();
  await loc.focus();
  await loc.fill(val);
  await page.evaluate(({ sel, v }: any) => {
    const el = document.querySelector(sel) as HTMLInputElement;
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(el, v);
      else el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, { sel: selector, v: val });
  await loc.blur();
}

async function testProperClick() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  p.on("request", req => {
    if (req.method() === "POST") console.log(">>> POST REQUEST:", req.url());
  });
  p.on("response", async res => {
    if (res.request().method() === "POST") console.log("<<< POST RESPONSE:", res.status(), res.url());
  });

  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });

  await p.waitForSelector("input[data-automation-id='email']", { timeout: 30000 });

  const email = "babufakemail@gmail.com";
  const pw = "ClucoAi@2026!Secure";

  console.log("Setting input values...");
  await setReactVal(p, "input[data-automation-id='email']", email);
  await setReactVal(p, "input[data-automation-id='password']", pw);
  await setReactVal(p, "input[data-automation-id='verifyPassword']", pw);

  await p.waitForTimeout(1000);

  console.log("Clicking div[data-automation-id='click_filter'][aria-label='Create Account'] via Playwright .click()...");
  const filter = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
  await filter.click();

  console.log("Waiting 8 seconds...");
  await p.waitForTimeout(8000);

  console.log("Current URL:", p.url());
  await p.screenshot({ path: "scratch/proper_click_result.png", fullPage: true });

  const bodyText = await p.evaluate(() => document.body?.innerText || "");
  console.log("Page text snippet:", bodyText.slice(0, 400));

  await b.close();
}

testProperClick().catch(console.error);
