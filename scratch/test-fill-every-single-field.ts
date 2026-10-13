import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function fillIfPresent(page: any, selector: string, value: string, name: string) {
  try {
    const loc = page.locator(selector).first();
    if (await loc.count() > 0 && await loc.isVisible()) {
      await loc.click({ force: true });
      await loc.fill(value);
      await page.keyboard.press("Enter");
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
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Email
  await page.fill("input#primary-email-1", "hrutin_all_filled_verified@gmail.com");
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  // SECTION 1
  console.log("Filling Section 1...");
  await fillIfPresent(page, "input[name='title'], input[id*='title']", "Mr.", "Title");
  await fillIfPresent(page, "input[name='firstName'], input[id*='firstName']", "Hrutin", "First Name");
  await fillIfPresent(page, "input[name='lastName'], input[id*='lastName']", "Nammi", "Last Name");
  await fillIfPresent(page, "input[name='namInformation29'], input[id*='namInformation29']", "He/Him", "Pronoun");
  await fillIfPresent(page, "input[type='tel']", "8688423267", "Phone");
  await fillIfPresent(page, "input[name='addressLine1'], input[id*='addressLine1']", "ava street", "Address Line 1");
  await fillIfPresent(page, "input[name='addressLine2'], input[id*='addressLine2']", "ava street", "Address Line 2");
  await fillIfPresent(page, "input[name='postalCode'], input[id*='postalCode']", "390144", "Postal Code");
  await fillIfPresent(page, "input[name='city'], input[id*='city']", "Vadodara", "City");

  // Upload resume
  const rInput = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput.count() > 0) {
    await rInput.setInputFiles(resumePath).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Advance to Section 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);

  // SECTION 2
  console.log("On Section 2, uploading resume...");
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath).catch(() => {});
    await page.waitForTimeout(2000);
  }

  // Advance to Section 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);
  console.log("On Section 3! Current URL:", page.url());

  // SECTION 3: Fill every single field
  console.log("Filling Section 3 fields...");

  // Address Line 1 & 2 on Sec 3
  await fillIfPresent(page, "input[name='addressLine1'], input[id*='addressLine1']", "ava street", "Address Line 1 (Sec 3)");
  await fillIfPresent(page, "input[name='addressLine2'], input[id*='addressLine2']", "ava street", "Address Line 2 (Sec 3)");
  await fillIfPresent(page, "input[name='postalCode'], input[id*='postalCode']", "390144", "Pin Code (Sec 3)");

  // 1. Month dropdown
  console.log("Selecting Month: October...");
  const monthBtn = page.locator("button[id*='month-earliestAvailableDate'][id*='toggle']").first();
  if (await monthBtn.count() > 0 && await monthBtn.isVisible()) {
    await monthBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='month-earliestAvailableDate'][id*='listbox'] .cx-select__list-item"));
      const match = items.find(i => i.textContent?.toLowerCase().includes("oct")) || items[9];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(400);
  }

  // 2. Day dropdown
  console.log("Selecting Day: 1...");
  const dayBtn = page.locator("button[id*='day-earliestAvailableDate'][id*='toggle']").first();
  if (await dayBtn.count() > 0 && await dayBtn.isVisible()) {
    await dayBtn.click({ force: true });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='day-earliestAvailableDate'][id*='listbox'] .cx-select__list-item"));
      const match = items.find(i => i.textContent?.trim() === "1" || i.textContent?.trim() === "01") || items[0];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(400);
  }

  // 3. Year
  console.log("Setting Year: 2026...");
  await fillIfPresent(page, "input[id*='year-earliestAvailableDate']", "2026", "Year");

  // 4. Screening Questions (Radios)
  const radioButtons = page.locator("button[role='radio']");
  const rCount = await radioButtons.count();
  console.log("Total radio buttons found:", rCount);
  if (rCount >= 6) {
    console.log("Clicking: Q1 No [1], Q2 No [3], Q3 Yes [4]...");
    await radioButtons.nth(1).click({ force: true });
    await page.waitForTimeout(300);
    await radioButtons.nth(3).click({ force: true });
    await page.waitForTimeout(300);
    await radioButtons.nth(4).click({ force: true });
    await page.waitForTimeout(300);
  }

  // 5. Gender
  await fillIfPresent(page, "input[name*='GENDER'], input[id*='GENDER']", "Male", "Gender");

  // 6. Checkboxes
  await page.evaluate(() => {
    const cbs = Array.from(document.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[];
    for (const cb of cbs) {
      if (!cb.checked) {
        if (cb.id) {
          const l = document.querySelector(`label[for='${cb.id}']`) as HTMLElement;
          if (l) l.click();
          else cb.click();
        } else {
          cb.click();
        }
      }
    }
  });

  // 7. Full Name (Signature)
  await fillIfPresent(page, "input[name='fullName'], input[id*='fullName']", "Hrutin Nammi", "Full Name (Signature)");

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/audit_sec3_100pct_filled.png", fullPage: true });

  // Check remaining empty visible inputs
  const emptyFields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));
    return inputs
      .filter(i => {
        const inp = i as any;
        const rect = inp.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !inp.value && inp.type !== "file";
      })
      .map(i => {
        const inp = i as any;
        return { id: inp.id, name: inp.name, label: document.querySelector("label[for='" + inp.id + "']")?.textContent?.trim() };
      });
  });

  console.log("Empty visible fields remaining on Step 3 (should be empty array):", JSON.stringify(emptyFields, null, 2));

  await browser.close();
}

main().catch(console.error);
