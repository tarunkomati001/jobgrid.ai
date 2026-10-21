import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const testUrl = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Associate-I--Instrumentation---Calibration-Technical-Support_R-2026-49466-1?codes=IND";
  console.log("Navigating to Alcon job:", testUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  console.log("Apply button count:", await applyBtn.count(), "visible:", await applyBtn.isVisible().catch(() => false));
  if (await applyBtn.count() > 0) {
    await applyBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  console.log("Current URL after apply click:", page.url());
  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually']").first();
  console.log("autofillOption count:", await autofillOption.count(), "applyManually count:", await applyManually.count());

  await page.screenshot({ path: "scratch/debug_alcon.png" });
  await browser.close();
}

main().catch(console.error);
