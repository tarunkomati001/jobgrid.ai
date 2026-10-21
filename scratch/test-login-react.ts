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

async function testLoginWithReact() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  p.on("request", req => {
    if (req.method() === "POST") console.log(">>> POST:", req.url());
  });
  p.on("response", res => {
    if (res.request().method() === "POST") console.log("<<< RESPONSE:", res.status(), res.url());
  });

  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/login?redirect=%2Fen-US%2Fcareers_alcon%2Fjob%2FRueil-Malmaison---Itin%25C3%25A9rant%2FDlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1%2Fapply%2FautofillWithResume%3Fcodes%3DIND");
  await p.waitForTimeout(4000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  console.log("Setting email and password via setReactVal...");
  await setReactVal(p, "input[data-automation-id='email']", "babufakemail@gmail.com");
  await setReactVal(p, "input[data-automation-id='password']", "ClucoAi@2026!Secure");

  console.log("Clicking Sign In filter...");
  const signInBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  await signInBtn.click();

  console.log("Waiting 10s...");
  await p.waitForTimeout(10000);

  console.log("URL after login:", p.url());
  await p.screenshot({ path: "scratch/alcon_after_real_login.png", fullPage: true });

  const text = await p.evaluate(() => document.body?.innerText || "");
  console.log("Page text snippet:", text.slice(0, 400));

  await b.close();
}

testLoginWithReact().catch(console.error);
