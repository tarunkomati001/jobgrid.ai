import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1, input[type='email']", "hrutin_all_filled@gmail.com");

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
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  // SECTION 1
  console.log("Filling Section 1...");
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "8688423267").catch(() => {});
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "ava street").catch(() => {});
  await page.fill("input[name='addressLine2'], input[id*='addressLine2']", "ava street").catch(() => {});
  await page.fill("input[name='postalCode'], input[id*='postalCode']", "390144").catch(() => {});
  await page.fill("input[name='city'], input[id*='city']", "Vadodara").catch(() => {});

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
  console.log("On Section 3! Filling all Section 3 fields...");

  // 1. Month dropdown
  console.log("Selecting Month: October...");
  const monthBtn = page.locator("button[id*='month-earliestAvailableDate'][id*='toggle']").first();
  if (await monthBtn.count() > 0 && await monthBtn.isVisible()) {
    await monthBtn.click({ force: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='month-earliestAvailableDate'][id*='listbox'] .cx-select__list-item"));
      const match = items.find(i => i.textContent?.toLowerCase().includes("oct")) || items[9];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(500);
  }

  // 2. Day dropdown
  console.log("Selecting Day: 1...");
  const dayBtn = page.locator("button[id*='day-earliestAvailableDate'][id*='toggle']").first();
  if (await dayBtn.count() > 0 && await dayBtn.isVisible()) {
    await dayBtn.click({ force: true });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='day-earliestAvailableDate'][id*='listbox'] .cx-select__list-item"));
      const match = items.find(i => i.textContent?.trim() === "1" || i.textContent?.trim() === "01") || items[0];
      if (match) (match as HTMLElement).click();
    });
    await page.waitForTimeout(500);
  }

  // 3. Year
  console.log("Setting Year: 2026...");
  const yearInput = page.locator("input[id*='year-earliestAvailableDate']").first();
  if (await yearInput.count() > 0 && await yearInput.isVisible()) {
    await yearInput.fill("2026");
    await page.keyboard.press("Enter");
  }

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
  const genderInput = page.locator("input[name*='GENDER'], input[id*='GENDER']").first();
  if (await genderInput.count() > 0 && await genderInput.isVisible()) {
    console.log("Filling Gender: Male...");
    await genderInput.click({ force: true });
    await genderInput.fill("Male");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }

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
  const sigInput = page.locator("input[name='fullName'], input[id*='fullName']").first();
  if (await sigInput.count() > 0 && await sigInput.isVisible()) {
    console.log("Signing Full Name: Hrutin Nammi...");
    await sigInput.fill("Hrutin Nammi");
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/oracle_step3_100pct_success.png", fullPage: true });

  // Print all filled values
  const report = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, button[role='radio']"));
    return inputs.map(el => {
      const inp = el as any;
      return {
        id: inp.id || null,
        name: inp.name || null,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role') || null,
        text: el.textContent?.trim().slice(0, 30),
        value: inp.value !== undefined ? inp.value : null,
        checked: inp.checked !== undefined ? inp.checked : el.getAttribute('aria-checked')
      };
    }).filter(x => x.value || x.checked === 'true' || x.checked === true);
  });

  console.log("Verified Filled Fields on Step 3:\n", JSON.stringify(report, null, 2));

  await browser.close();
}

main().catch(console.error);
