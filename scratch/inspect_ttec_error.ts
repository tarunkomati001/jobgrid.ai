import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Accept agreement
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  // Click New User
  const newUserBtn = page.locator("#dialogTemplate-dialogForm-login-register, input[value='New User']").first();
  await newUserBtn.click();
  await page.waitForTimeout(3000);

  const randSuffix = Date.now().toString().slice(-4);
  const uname = `hrutin_${randSuffix}`;
  const password = "ClucoPass@2026!Secure";
  const email = `babufakemail+${randSuffix}@gmail.com`;

  await page.fill("#dialogTemplate-dialogForm-userName", uname);
  await page.fill("#dialogTemplate-dialogForm-password", password);
  await page.fill("#dialogTemplate-dialogForm-passwordConfirm", password);
  await page.fill("#dialogTemplate-dialogForm-email", email);

  console.log(`Registered user: ${uname}`);
  const regSubmit = page.locator("#dialogTemplate-dialogForm-defaultCmd").first();
  await regSubmit.click();
  await page.waitForTimeout(4000);

  // Advance step 1
  const saveCont = page.locator("input[id*='saveContinueCmdBottom']").first();
  console.log("Clicking Save and Continue...");
  await saveCont.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(4000);

  // Dump all error messages on the page
  const errors = await page.evaluate(() => {
    const errorEls = Array.from(document.querySelectorAll(".error, .errormsg, .inlineerror, [class*='error'], [id*='error'], .message, .msg, .notification"));
    return errorEls.map(el => el.textContent?.trim()).filter(Boolean);
  });

  console.log("ERRORS ON PAGE:", JSON.stringify(errors, null, 2));

  // Also check if resume was attached or required
  const pageText = await page.evaluate(() => document.body.innerText);
  const relevantLines = pageText.split("\n").map(l => l.trim()).filter(l => l.toLowerCase().includes("attach") || l.toLowerCase().includes("resume") || l.toLowerCase().includes("required") || l.toLowerCase().includes("error"));
  console.log("RELEVANT TEXT LINES:", JSON.stringify(relevantLines.slice(0, 20), null, 2));

  await browser.close();
}

main().catch(console.error);

