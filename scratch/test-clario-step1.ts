import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const activeUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300-1";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to active job:", activeUrl);
  await page.goto(activeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply')").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(4000);

  // Click Apply Manually
  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually'], [role='button']:has-text('Apply Manually')").first();
  if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    console.log("Clicking Apply Manually...");
    await applyManually.click({ force: true });
  }

  console.log("Waiting for auth form to mount...");
  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 20000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "scratch/clario_auth_mounted.png" });

  const hasVerifyPw = (await page.locator("input[data-automation-id='verifyPassword']").count()) > 0;
  console.log("Has verify password (is Create Account?):", hasVerifyPw);

  const testEmail = `babufakemail+clario${Date.now()}@gmail.com`;
  const testPw = "Tarun@2026!Aa";

  if (!hasVerifyPw) {
    const createLink = page.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], button:has-text('Create Account'), a:has-text('Create Account')").first();
    if (await createLink.count() > 0) {
      console.log("Clicking Create Account link...");
      await createLink.click({ force: true });
      await page.waitForSelector("input[data-automation-id='verifyPassword']", { timeout: 10000 });
      await page.waitForTimeout(1000);
    }
  }

  console.log(`Filling Create Account details: ${testEmail}...`);
  await page.locator("input[data-automation-id='email']").first().fill(testEmail);
  await page.locator("input[data-automation-id='password']").first().fill(testPw);
  await page.locator("input[data-automation-id='verifyPassword']").first().fill(testPw);

  const cb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
  if (await cb.count() > 0 && !await cb.isChecked()) {
    await cb.check({ force: true });
  }

  const createBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
  await createBtn.click({ force: true });
  console.log("Clicked Create Account button. Waiting for Step 1...");
  await page.waitForTimeout(10000);

  console.log("Current URL after account creation:", page.url());
  await page.screenshot({ path: "scratch/clario_step1_reached.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
