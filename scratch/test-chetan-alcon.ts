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

async function testRegisterAndLogin() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  p.on("request", req => {
    if (req.method() === "POST") console.log(">>> POST:", req.url());
  });
  p.on("response", res => {
    if (res.request().method() === "POST") console.log("<<< RESPONSE:", res.status(), res.url());
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

  const testEmail = "chetanmidde1@gmail.com";
  const pw = "ClucoAi@2026!Secure";

  console.log("Filling Create Account fields for", testEmail);
  await setReactVal(p, "input[data-automation-id='email']", testEmail);
  await setReactVal(p, "input[data-automation-id='password']", pw);
  await setReactVal(p, "input[data-automation-id='verifyPassword']", pw);

  // Check agreement checkbox if present
  const cb = p.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
  if (await cb.count() > 0 && await cb.isVisible().catch(() => false)) {
    await cb.check({ force: true });
  }

  const filter = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
  await filter.click();

  console.log("Waiting 10s for registration transition...");
  await p.waitForTimeout(10000);

  console.log("Current URL after register:", p.url());
  await p.screenshot({ path: "scratch/chetan_register_alcon.png", fullPage: true });

  const text = await p.evaluate(() => document.body?.innerText || "");
  console.log("Page text after register:", text.slice(0, 400));

  // If redirected to /login, sign in!
  if (p.url().includes("/login")) {
    console.log("Redirected to /login. Signing in now...");
    await setReactVal(p, "input[data-automation-id='email'], input[data-automation-id='userName']", testEmail);
    await setReactVal(p, "input[data-automation-id='password']", pw);

    const signInBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
    await signInBtn.click();
    await p.waitForTimeout(10000);

    console.log("Current URL after login:", p.url());
    await p.screenshot({ path: "scratch/chetan_login_alcon.png", fullPage: true });

    const postLoginText = await p.evaluate(() => document.body?.innerText || "");
    console.log("Page text after login:", postLoginText.slice(0, 400));
  }

  await b.close();
}

testRegisterAndLogin().catch(console.error);
