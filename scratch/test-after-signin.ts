import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import { WorkdayAdapter } from "../src/ats/workday/workday.adapter";
import * as path from "path";

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
  await page.goto(testUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button:has-text('Accept Cookies'), button:has-text('Accept'), [data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible().catch(() => false)) {
    console.log("Accepting cookies...");
    await cookieBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Click apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  if (await applyBtn.count() > 0 && await applyBtn.isVisible().catch(() => false)) {
    console.log("Clicking apply button...");
    await applyBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Autofill with resume
  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
  if (await autofillOption.count() > 0 && await autofillOption.isVisible().catch(() => false)) {
    console.log("Selecting Autofill with Resume...");
    await autofillOption.click({ force: true });
    await page.waitForTimeout(4000);
  }

  console.log("Waiting for auth container...");
  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName'], button[data-automation-id='signInLink']", { timeout: 15000 }).catch(() => {});
  console.log("URL on auth screen:", page.url());
  await page.screenshot({ path: "scratch/step_auth.png" });

  // Switch to sign in if on Create Account
  const signInTab = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  if (await signInTab.count() > 0 && await signInTab.isVisible().catch(() => false)) {
    console.log("Clicking sign in tab...");
    await signInTab.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Fill email & password
  console.log("Filling login credentials...");
  const userLoc = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
  await userLoc.waitFor({ state: "visible", timeout: 10000 });
  await userLoc.fill("babufakemail+1@gmail.com");
  
  const pwLoc = page.locator("input[data-automation-id='password'], input[name='password']").first();
  await pwLoc.fill("Tarun@2006");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/step_before_submit.png" });

  const signInBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
  console.log("Clicking Sign In button...");
  await signInBtn.click({ force: true });
  await pwLoc.press("Enter").catch(() => {});
  
  for (let i = 1; i <= 8; i++) {
    await page.waitForTimeout(3000);
    console.log(`Waited ${i * 3}s. URL:`, page.url());
    console.log(`Document title: ${await page.title()}`);
    const fileCount = await page.locator("input[type='file'], [data-automation-id='file-upload-drop-zone']").count();
    const wizardCount = await page.locator("[data-automation-id='pageHeader'], [data-automation-id='bottom-navigation-next-button']").count();
    console.log(`fileCount: ${fileCount}, wizardCount: ${wizardCount}`);
    await page.screenshot({ path: `scratch/step_after_signin_${i}.png` });
    if (fileCount > 0 || wizardCount > 0) {
      console.log("Found file upload or wizard!");
      break;
    }
  }

  await browser.close();
}

main().catch(console.error);
