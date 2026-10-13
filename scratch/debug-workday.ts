import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function main() {
  const testUrl = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1";
  console.log("Testing WorkdayAdapter on:", testUrl);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  page.on("console", msg => console.log("PAGE LOG:", msg.text()));

  await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    console.log("Clicking apply button...");
    await applyBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Choose Autofill with Resume or Apply Manually
  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
  const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually']").first();
  
  if (await autofillOption.count() > 0 && await autofillOption.isVisible()) {
    console.log("Clicking Autofill with resume...");
    await autofillOption.click({ force: true });
  } else if (await applyManually.count() > 0 && await applyManually.isVisible()) {
    console.log("Clicking Apply Manually...");
    await applyManually.click({ force: true });
  }
  await page.waitForTimeout(3000);

  console.log("Current URL:", page.url());
  await page.screenshot({ path: "scratch/debug_workday_auth.png" });

  const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || "");
  console.log("Page text sample:\n", pageText);

  await browser.close();
}

main().catch(console.error);
