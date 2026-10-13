import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspectAlconAuth() {
  const testUrl = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 850 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Click Apply
    const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
    await applyBtn.click();
    await page.waitForTimeout(3000);

    // Click autofill with resume
    const autofill = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [data-automation-id*='autofill']").first();
    await autofill.click();
    await page.waitForTimeout(3000);

    // Switch to Sign In
    const signInTab = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
    if (await signInTab.count() > 0) {
      await signInTab.click();
      await page.waitForTimeout(2000);
    }

    // Fill credentials
    const emailInput = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
    await emailInput.fill("babufakemail@gmail.com");

    const pwInput = page.locator("input[data-automation-id='password'], input[name='password']").first();
    await pwInput.fill("BabuFake123!");

    // Click Sign In
    const signInBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
    await signInBtn.click();
    await page.waitForTimeout(4000);

    // Take screenshot
    await page.screenshot({ path: "scratch/alcon_auth_status.png", fullPage: true });

    // Print body text
    const text = await page.evaluate(() => document.body.innerText);
    console.log("ALCON BODY TEXT AFTER SIGN IN:\n", text.slice(0, 500));
  } catch (err: any) {
    console.error("Inspect error:", err.message);
  } finally {
    await browser.close();
  }
}

inspectAlconAuth();
