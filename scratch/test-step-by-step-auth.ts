import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testStepByStep() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 900 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Associate-I--Instrumentation---Calibration-Technical-Support_R-2026-49466-1?codes=IND";
  console.log("1. Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  // Check cookie banner
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Look for apply button
  console.log("2. Searching for Apply button...");
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  const applyVisible = await applyBtn.isVisible().catch(() => false);
  console.log("Apply button visible?", applyVisible);
  if (applyVisible) {
    const text = await applyBtn.innerText();
    console.log("Apply button text:", text);
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }

  // Check URL & options
  console.log("3. Current URL after clicking Apply:", page.url());
  const options = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, [role='button']"))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        automationId: el.getAttribute("data-automation-id"),
        href: (el as HTMLAnchorElement).href
      }));
  });
  console.log("Visible buttons after Apply:", JSON.stringify(options.filter(o => o.text?.toLowerCase().includes("apply") || o.text?.toLowerCase().includes("resume") || o.text?.toLowerCase().includes("manual")), null, 2));

  // Check if popup/modal appeared or if navigated
  const autofill = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
  if (await autofill.count() > 0 && await autofill.isVisible()) {
    console.log("Clicking Autofill with Resume...");
    await autofill.click();
    await page.waitForTimeout(4000);
  }

  console.log("4. Current URL after Autofill with Resume:", page.url());
  await page.screenshot({ path: "scratch/step_by_step_auth.png", fullPage: true });

  // Print all visible inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button")).map(el => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type,
      id: el.id,
      automationId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent?.trim()?.slice(0, 50),
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(x => x.visible);
  });
  console.log("5. Visible inputs & buttons:", JSON.stringify(inputs, null, 2));

  await browser.close();
}

testStepByStep().catch(console.error);
