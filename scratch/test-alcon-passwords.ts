import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testPasswords() {
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

  await page.waitForSelector("button[data-automation-id='signInLink'], input[data-automation-id='email']", { timeout: 25000 });

  const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  await signInLink.click();
  await page.waitForTimeout(2000);

  const testCases = [
    { email: "babufakemail@gmail.com", pw: "Tarun@143" },
    { email: "babufakemail@gmail.com", pw: "Tarun@2006" },
    { email: "babufakemail@gmail.com", pw: "BabuFake123!" },
    { email: "babufakemail@gmail.com", pw: "ClucoAi@2026!Secure" },
    { email: "babufakemail+alcon1791812505447@gmail.com", pw: "Tarun@2006" }
  ];

  for (const tc of testCases) {
    console.log(`\nTesting ${tc.email} with ${tc.pw}...`);
    const emailInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email']").first();
    const pwInp = page.locator("input[data-automation-id='password']").first();
    await emailInp.fill(tc.email);
    await pwInp.fill(tc.pw);

    const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
    await submitBtn.click();
    await page.waitForTimeout(5000);

    const bodyText = await page.evaluate(() => document.body?.innerText || "");
    const errorMsg = bodyText.includes("wrong email address or password") || bodyText.includes("account might be locked") || bodyText.includes("Invalid");
    console.log(`Result: Error? ${errorMsg} | Current URL: ${page.url().slice(0, 80)}`);

    if (!errorMsg && (page.url().includes("/apply") || bodyText.includes("Upload") || bodyText.includes("My Information") || bodyText.includes("Resume"))) {
      console.log(` SUCCESS with email: ${tc.email} and pw: ${tc.pw}!`);
      break;
    }
  }

  await browser.close();
}

testPasswords().catch(console.error);
