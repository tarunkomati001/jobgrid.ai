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

  // Find file input and attach
  const fileInput = page.locator("input[type='file'], input[id*='uploadedFile']").first();
  await fileInput.setInputFiles(resumePath);
  await page.waitForTimeout(1000);

  const attachBtn = page.locator("input[id*='attachFileCommand'], input[value='Attach']").first();
  await attachBtn.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(5000);

  // Click Save and Continue on Step 1
  const saveCont = page.locator("input[id*='saveContinueCmdBottom']").first();
  await saveCont.evaluate((el: HTMLElement) => el.click());
  await page.waitForTimeout(5000);

  console.log("Step 2 Title:", await page.title());

  // Dump all visible inputs and labels on Step 2
  const step2Inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(el => {
      const inp = el as any;
      let lbl = "";
      if (inp.id) {
        lbl = document.querySelector(`label[for='${inp.id}']`)?.textContent?.trim() || "";
      }
      return {
        tag: el.tagName,
        id: inp.id,
        name: inp.name,
        type: inp.type,
        value: inp.value,
        required: inp.required || inp.getAttribute("aria-required") === "true",
        label: lbl
      };
    });
  });

  console.log("STEP 2 CONTACT INFO INPUTS:", JSON.stringify(step2Inputs, null, 2));

  await browser.close();
}

main().catch(console.error);

