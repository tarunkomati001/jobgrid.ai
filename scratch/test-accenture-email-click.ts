import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  await p.goto("https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074", { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click();
  await p.waitForTimeout(2000);

  const autofill = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  await autofill.click();

  // Wait for either email input OR "Sign in with email" button
  console.log("Waiting for Sign in with email or inputs...");
  const emailProviderBtn = p.locator("button:has-text('Sign in with email'), [data-automation-id*='email'], div[role='button']:has-text('Sign in with email'), button:has-text('email')").first();
  await emailProviderBtn.waitFor({ state: "visible", timeout: 30000 });
  console.log("Found Sign in with email button! Clicking...");
  await emailProviderBtn.click();
  await p.waitForTimeout(3000);

  await p.screenshot({ path: "scratch/accenture_after_email_btn_click.png", fullPage: true });

  const inputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button")).filter(el => (el as HTMLElement).offsetParent !== null).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent?.trim()?.slice(0, 40)
    })).filter(x => x.autoId);
  });
  console.log("Inputs after clicking Sign in with email:\n", JSON.stringify(inputs, null, 2));

  await b.close();
}

main().catch(console.error);
