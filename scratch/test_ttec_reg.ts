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
  console.log("Clicking New User...");
  await newUserBtn.click();
  await page.waitForTimeout(3000);

  console.log("New User page title:", await page.title());
  console.log("URL:", page.url());

  const randSuffix = Date.now().toString().slice(-4);
  const uname = `hrutin_${randSuffix}`;
  const password = "ClucoPass@2026!Secure";
  const email = `babufakemail+${randSuffix}@gmail.com`;

  await page.fill("#dialogTemplate-dialogForm-userName", uname);
  await page.fill("#dialogTemplate-dialogForm-password", password);
  await page.fill("#dialogTemplate-dialogForm-passwordConfirm", password);
  await page.fill("#dialogTemplate-dialogForm-email", email);
  await page.fill("#dialogTemplate-dialogForm-emailConfirm", email);

  console.log(`Registering as ${uname} (${email})...`);
  const regSubmit = page.locator("#dialogTemplate-dialogForm-defaultCmd").first();
  await regSubmit.click();
  await page.waitForTimeout(5000);

  console.log("After registration title:", await page.title());
  console.log("After registration URL:", page.url());
  await page.screenshot({ path: "scratch/ttec_after_reg.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);

