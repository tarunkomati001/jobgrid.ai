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

  // Check if confirmation modal exists
  const confUser = page.locator("input[id*='flowConfmEditUsername']").first();
  const confPass = page.locator("input[id*='flowConfmEditPassword']").first();
  const confBtn = page.locator("input[id*='saveContinueCmdFlowPopUp']").first();

  console.log("Confirmation modal visible?", await confUser.isVisible().catch(() => false));

  if (await confUser.isVisible().catch(() => false)) {
    console.log("Filling confirmation modal...");
    await confUser.fill(uname);
    await confPass.fill(password);
    await confBtn.click();
    await page.waitForTimeout(4000);
  }

  // Advance step 1
  const saveCont = page.locator("input[id*='saveContinueCmdBottom']").first();
  console.log("Clicking Save and Continue...");
  await saveCont.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(4000);

  // Check again for confirmation modal
  if (await confUser.isVisible().catch(() => false)) {
    console.log("Filling confirmation modal on Step 1...");
    await confUser.fill(uname);
    await confPass.fill(password);
    await confBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log("Next Step Title:", await page.title());
  console.log("Next Step URL:", page.url());

  await page.screenshot({ path: "scratch/ttec_after_popup_confirm.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

