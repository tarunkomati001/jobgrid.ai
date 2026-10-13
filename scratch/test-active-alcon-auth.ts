import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testActiveAlcon() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  console.log("Navigating to active Alcon job:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies if present
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  console.log("Apply button found. Clicking...");
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Click Autofill with Resume
  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  console.log("Autofill option visible?", await autofillOption.isVisible());
  if (await autofillOption.isVisible()) {
    console.log("Clicking Autofill with Resume...");
    await autofillOption.click();
    await page.waitForTimeout(4000);
  }

  console.log("Current URL after Autofill with Resume:", page.url());
  await page.screenshot({ path: "scratch/active_alcon_auth.png", fullPage: true });

  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  console.log("Page text:\n", bodyText);

  // Check inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a")).filter(el => (el as HTMLElement).offsetParent !== null).map(el => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type,
      automationId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent?.trim()?.slice(0, 40)
    })).filter(x => x.automationId || x.label);
  });
  console.log("Visible elements:", JSON.stringify(inputs, null, 2));

  await browser.close();
}

testActiveAlcon().catch(console.error);
