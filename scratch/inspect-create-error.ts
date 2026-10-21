import { chromium } from "playwright";

async function inspectCreateError() {
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
  await p.waitForTimeout(4000);

  // Take screenshot of bottom where create account button is
  await p.screenshot({ path: "scratch/alcon_create_error_full.png", fullPage: true });

  const pageErrors = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("*")).filter(el => {
      const text = el.textContent?.trim() || "";
      return text.includes("already exists") || text.includes("Account") || text.includes("error") || text.includes("Invalid");
    }).map(el => ({ tag: el.tagName, text: el.textContent?.trim().slice(0, 100) })).slice(0, 20);
  });
  console.log("Page errors/text:", pageErrors);

  await b.close();
}

inspectCreateError().catch(console.error);
