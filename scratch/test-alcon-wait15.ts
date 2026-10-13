import { chromium } from "playwright";

async function inspectPostCreate() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });

  await p.waitForSelector("input[data-automation-id='email']", { timeout: 30000 });

  const email = "babufakemail@gmail.com";
  const pw = "ClucoAi@2026!Secure";

  await p.locator("input[data-automation-id='email']").fill(email);
  await p.locator("input[data-automation-id='password']").fill(pw);
  await p.locator("input[data-automation-id='verifyPassword']").fill(pw);

  const createBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
  await createBtn.click({ force: true });
  console.log("Create button clicked! Waiting 15 seconds...");
  await p.waitForTimeout(15000);

  console.log("URL after 15s:", p.url());
  await p.screenshot({ path: "scratch/alcon_after_15s.png", fullPage: true });

  const text = await p.evaluate(() => document.body?.innerText || "");
  console.log("Page text after 15s:", text.slice(0, 500));

  await b.close();
}

inspectPostCreate().catch(console.error);
