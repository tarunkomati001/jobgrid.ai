import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testAuthForm() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  await autofillOption.click();

  console.log("Waiting for auth inputs to appear...");
  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName'], input[type='email'], input[type='password']", { timeout: 25000 });
  console.log("Auth inputs appeared!");

  await page.screenshot({ path: "scratch/alcon_auth_inputs_loaded.png", fullPage: true });

  const formElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a, [role='button']"))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type,
        automationId: el.getAttribute("data-automation-id"),
        id: el.id,
        name: (el as HTMLInputElement).name,
        label: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent?.trim()?.slice(0, 50)
      }))
      .filter(x => x.automationId || x.type === "password" || x.type === "email" || x.type === "text");
  });

  console.log("Form elements:\n", JSON.stringify(formElements, null, 2));

  await browser.close();
}

testAuthForm().catch(console.error);
