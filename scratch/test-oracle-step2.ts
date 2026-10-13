import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function fillIfVisible(locator: any, value: string, name: string) {
  try {
    if (await locator.count() > 0 && await locator.first().isVisible()) {
      await locator.first().fill(value);
      return true;
    }
  } catch (e) {}
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click Apply Now
  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Email
  await page.fill("input#primary-email-1, input[type='email']", "hrutin_step2_test@gmail.com");

  // Check terms
  await page.evaluate(`
    (() => {
      const cb = document.getElementById("legal-disclaimer-checkbox");
      if (cb && !cb.checked) {
        const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label");
        if (label) label.click();
        else cb.click();
      }
    })()
  `);
  await page.waitForTimeout(1000);

  // Next
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  // Fill Step 1
  await fillIfVisible(page.locator("input[name='firstName'], input[id*='firstName']"), "Hrutin", "First Name");
  await fillIfVisible(page.locator("input[name='lastName'], input[id*='lastName']"), "Nammi", "Last Name");
  await fillIfVisible(page.locator("input[type='tel']"), "8688423267", "Phone");

  // Advance to Step 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);
  console.log("Current URL (Step 2):", page.url());

  // Also upload resume on Step 2 dropzone if required
  const step2ResumeInput = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await step2ResumeInput.count() > 0) {
    console.log("Uploading resume on Step 2 dropzone...");
    await step2ResumeInput.setInputFiles(resumePath);
    await page.waitForTimeout(3000);
  }

  // Try clicking Next on Step 2 to see if it advances or shows validation errors
  console.log("Clicking Next on Step 2...");
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  console.log("URL after Step 2 Next:", page.url());
  await page.screenshot({ path: "scratch/oracle_after_step2_click.png", fullPage: true });

  const errors = await page.evaluate(`
    (() => {
      const errNodes = Array.from(document.querySelectorAll(".error, [class*='error'], [aria-invalid='true'], .oj-message-detail"));
      return errNodes.map(e => e.textContent.trim()).filter(Boolean);
    })()
  `);
  console.log("Errors on Step 2 (if any):", errors);

  await browser.close();
}

main().catch(console.error);
