import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to:", testUrl);
  await page.goto(testUrl, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Apply Manually to see the fields immediately without waiting for resume parsing
  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually'], [role='button']:has-text('Apply Manually')").first();
  if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    console.log("Clicking Apply Manually...");
    await applyManually.click({ force: true });
    await page.waitForTimeout(3000);
  }

  console.log("URL after apply:", page.url());
  await page.screenshot({ path: "scratch/test_clario_after_apply.png" });

  // If on Create Account / Sign In:
  const isCreateAccount = (await page.locator("input[data-automation-id='verifyPassword']").count()) > 0;
  console.log("Is Create Account:", isCreateAccount);

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testEmail = `babufakemail+cl${randomSuffix}@gmail.com`;
  const testPw = "Tarun@2026!Aa";

  if (isCreateAccount) {
    console.log(`Creating fresh account: ${testEmail}`);
    const emailInp = page.locator("input[data-automation-id='email']").first();
    await emailInp.fill(testEmail);
    const pwInp = page.locator("input[data-automation-id='password']").first();
    await pwInp.fill(testPw);
    const vpwInp = page.locator("input[data-automation-id='verifyPassword']").first();
    await vpwInp.fill(testPw);

    const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
    if (await cb.count() > 0 && !await cb.isChecked()) {
      await cb.check({ force: true });
    }

    const createBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
    await createBtn.click({ force: true });
    console.log("Clicked Create Account. Waiting 8s...");
    await page.waitForTimeout(8000);
  }

  console.log("URL after auth attempt:", page.url());
  await page.screenshot({ path: "scratch/test_clario_after_auth.png" });

  // Check what's on the page
  const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || "");
  console.log("Page text sample:\n", pageText);

  await browser.close();
}

main().catch(console.error);
