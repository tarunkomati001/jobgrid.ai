import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to Clario Careers...");
  await page.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers", { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Find first job link
  const firstJob = page.locator("a[data-automation-id='jobTitle']").first();
  console.log("First job count:", await firstJob.count());
  const jobTitle = await firstJob.innerText();
  const jobHref = await firstJob.getAttribute("href");
  console.log("First job title:", jobTitle, "href:", jobHref);

  await firstJob.click();
  await page.waitForTimeout(4000);
  console.log("Navigated to job URL:", page.url());

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  console.log("Apply button count on active job:", await applyBtn.count(), "visible:", await applyBtn.isVisible().catch(() => false));

  await browser.close();
}

main().catch(console.error);
