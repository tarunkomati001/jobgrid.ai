import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import path from "path";

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

  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Resume absolute path:", resumePath);

  // Find file input and attach
  const fileInput = page.locator("input[type='file'], input[id*='uploadedFile']").first();
  console.log("File input count:", await fileInput.count(), "visible:", await fileInput.isVisible().catch(() => false));

  await fileInput.setInputFiles(resumePath);
  await page.waitForTimeout(1000);

  const attachBtn = page.locator("input[id*='attachFileCommand'], input[value='Attach']").first();
  console.log("Attach button count:", await attachBtn.count(), "visible:", await attachBtn.isVisible().catch(() => false));
  await attachBtn.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(5000);

  // Check if file is attached in table
  const tableText = await page.evaluate(() => {
    return document.querySelector("table")?.innerText || "";
  });
  console.log("Table after attach:", tableText.slice(0, 200));

  // Check if there is a Resume radio button to select
  const resumeRadio = page.locator("input[type='radio'][id*='resume'], input[type='radio'][name*='resume']").first();
  if (await resumeRadio.count() > 0) {
    console.log("Checking resume radio button...");
    await resumeRadio.check({ force: true });
  }

  // Click Save and Continue
  const saveCont = page.locator("input[id*='saveContinueCmdBottom']").first();
  console.log("Advancing step 1...");
  await saveCont.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(5000);

  console.log("After step 1 advance - Title:", await page.title());
  console.log("After step 1 advance - URL:", page.url());

  await page.screenshot({ path: "scratch/ttec_after_attach_advance.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);

