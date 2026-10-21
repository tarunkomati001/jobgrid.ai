import { chromium } from 'playwright';
import { applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to Alcon...");
  await page.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Click Apply
  const applyBtn = page.locator("button[data-automation-id='adventureButton']");
  await applyBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Click Autofill with resume
  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']");
  await autofillBtn.click({ force: true });
  await page.waitForTimeout(3000);

  // Switch to sign in if on create account
  const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  if (await signInLink.count() > 0) {
    await signInLink.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Try signing in with babufakemail+alcon1791812505447@gmail.com and Tarun@2006
  console.log("Testing login with babufakemail+alcon1791812505447@gmail.com...");
  await page.fill("input[data-automation-id='userName'], input[data-automation-id='email']", "babufakemail+alcon1791812505447@gmail.com");
  await page.fill("input[data-automation-id='password']", "Tarun@2006");
  
  const submitBtn = page.locator("button[data-automation-id='signInSubmitButton']").first();
  await submitBtn.click({ force: true });
  await page.waitForTimeout(6000);

  console.log("Current URL:", page.url());
  const bodyText = await page.innerText('body');
  const hasError = bodyText.includes("wrong email") || bodyText.includes("locked");
  console.log("Has error?", hasError);
  console.log("Is in wizard / upload?", bodyText.includes("Autofill with Resume") || bodyText.includes("My Information") || !page.url().includes("/login"));

  await browser.close();
}

main().catch(console.error);
