import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function fillIfVisible(locator: any, value: string, name: string) {
  try {
    if (await locator.count() > 0 && await locator.first().isVisible()) {
      await locator.first().fill(value);
      console.log(`Filled ${name}: ${value}`);
      return true;
    }
  } catch (e: any) {
    console.warn(`Could not fill ${name}: ${e.message}`);
  }
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
  console.log("Entering email...");
  await page.fill("input#primary-email-1, input[type='email']", "hrutin_step_test@gmail.com");

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
  await page.waitForTimeout(8000);
  console.log("On Section 1! Filling candidate details...");

  // Fill fields
  await fillIfVisible(page.locator("input[name='firstName'], input[id*='firstName']"), "Hrutin", "First Name");
  await fillIfVisible(page.locator("input[name='lastName'], input[id*='lastName']"), "Nammi", "Last Name");
  await fillIfVisible(page.locator("input[type='tel']"), "8688423267", "Phone");
  await fillIfVisible(page.locator("input[name='addressLine1'], input[id*='addressLine1']"), "ava street", "Address Line 1");
  await fillIfVisible(page.locator("input[name='addressLine2'], input[id*='addressLine2']"), "ava street", "Street");
  await fillIfVisible(page.locator("input[name='postalCode'], input[id*='postalCode']"), "390144", "Postal Code");
  await fillIfVisible(page.locator("input[name='city'], input[id*='city']"), "Vadodara", "City");

  // Upload Resume
  if (fs.existsSync(resumePath)) {
    const resumeInput = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
    if (await resumeInput.count() > 0) {
      console.log("Uploading resume:", resumePath);
      await resumeInput.setInputFiles(resumePath);
      await page.waitForTimeout(3000);
    }
  }

  // Available Date (Today)
  const today = new Date();
  await fillIfVisible(page.locator("input[id*='day-earliestAvailableDate']"), String(today.getDate()).padStart(2, "0"), "Available Day");
  await fillIfVisible(page.locator("input[id*='month-earliestAvailableDate']"), String(today.getMonth() + 1).padStart(2, "0"), "Available Month");
  await fillIfVisible(page.locator("input[id*='year-earliestAvailableDate']"), String(today.getFullYear()), "Available Year");

  // Full Name (Signature)
  await fillIfVisible(page.locator("input[name='fullName'], input[id*='fullName']"), "Hrutin Nammi", "Signature / Full Name");

  // Agree checkbox
  await page.evaluate(`
    (() => {
      const cb = document.getElementById("job-alerts-checkbox");
      if (cb && !cb.checked) {
        const l = document.querySelector("label[for='job-alerts-checkbox']");
        if (l) l.click();
        else cb.click();
      }
    })()
  `);

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/oracle_step1_filled_verified.png", fullPage: true });

  // Click Next
  const nextBtn = page.locator("button:has-text('Next')").first();
  console.log("Clicking Next to advance to Step 2...");
  await nextBtn.click();

  await page.waitForTimeout(8000);
  console.log("Current URL after Step 1 Next:", page.url());
  await page.screenshot({ path: "scratch/oracle_step2_screen.png", fullPage: true });

  const headings = await page.locator("h1, h2, h3, .heading").allInnerTexts();
  console.log("Headings after Next:", headings);

  // Check if any errors on page
  const errors = await page.evaluate(`
    (() => {
      const errNodes = Array.from(document.querySelectorAll(".error, [class*='error'], [aria-invalid='true']"));
      return errNodes.map(e => e.textContent.trim()).filter(Boolean);
    })()
  `);
  if (errors.length > 0) {
    console.log("Validation/Error messages:", errors);
  }

  await browser.close();
}

main().catch(console.error);
