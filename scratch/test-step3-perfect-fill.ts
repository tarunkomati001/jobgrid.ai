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

  await page.fill("input#primary-email-1, input[type='email']", "hrutin_perfect_3@gmail.com");

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

  // SECTION 1:
  console.log("Filling Section 1...");
  const fn = page.locator("input[name='firstName'], input[id*='firstName']").first();
  if (await fn.count() > 0) await fn.fill("Hrutin");
  const ln = page.locator("input[name='lastName'], input[id*='lastName']").first();
  if (await ln.count() > 0) await ln.fill("Nammi");
  const ph = page.locator("input[type='tel']").first();
  if (await ph.count() > 0) await ph.fill("8688423267");

  const a1 = page.locator("input[name='addressLine1'], input[id*='addressLine1']").first();
  if (await a1.count() > 0 && await a1.isVisible()) await a1.fill("ava street");
  const a2 = page.locator("input[name='addressLine2'], input[id*='addressLine2']").first();
  if (await a2.count() > 0 && await a2.isVisible()) await a2.fill("ava street");
  const zip = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await zip.count() > 0 && await zip.isVisible()) await zip.fill("390144");
  const city = page.locator("input[name='city'], input[id*='city']").first();
  if (await city.count() > 0 && await city.isVisible()) await city.fill("Vadodara");

  // Advance to Section 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);

  // SECTION 2: Upload resume
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

  // 1. Earliest Available Date
  const today = new Date();
  const dayStr = String(today.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthStr = monthNames[today.getMonth()];
  const yearStr = String(today.getFullYear());

  const dayInput = page.locator("input[id*='day-earliestAvailableDate']").first();
  if (await dayInput.count() > 0 && await dayInput.isVisible()) {
    await dayInput.click();
    await dayInput.fill(dayStr);
    await page.keyboard.press("Enter");
  }

  const monthInput = page.locator("input[id*='month-earliestAvailableDate']").first();
  if (await monthInput.count() > 0 && await monthInput.isVisible()) {
    await monthInput.click();
    await monthInput.fill(monthStr);
    await page.keyboard.press("Enter");
  }

  const yearInput = page.locator("input[id*='year-earliestAvailableDate']").first();
  if (await yearInput.count() > 0 && await yearInput.isVisible()) {
    await yearInput.click();
    await yearInput.fill(yearStr);
    await page.keyboard.press("Enter");
  }

  // 2. Radio buttons for questions:
  // Q1: Ex-Oracle -> No
  // Q2: Govt employee -> No
  // Q3: Authorized -> Yes
  const radioButtons = page.locator("button[role='radio']");
  const rCount = await radioButtons.count();
  console.log("Radio count:", rCount);
  if (rCount >= 6) {
    console.log("Clicking radio options: Q1 No, Q2 No, Q3 Yes...");
    await radioButtons.nth(1).click();
    await page.waitForTimeout(400);
    await radioButtons.nth(3).click();
    await page.waitForTimeout(400);
    await radioButtons.nth(4).click();
    await page.waitForTimeout(400);
  }

  // 3. Gender Combobox
  const genderInput = page.locator("input[name*='GENDER'], input[id*='GENDER']").first();
  if (await genderInput.count() > 0 && await genderInput.isVisible()) {
    console.log("Setting Gender: Male...");
    await genderInput.click();
    await genderInput.fill("Male");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }

  // 4. Communication checkboxes
  await page.evaluate(`
    (() => {
      const cbs = Array.from(document.querySelectorAll("input[type='checkbox']"));
      for (const cb of cbs) {
        if (!cb.checked) {
          if (cb.id) {
            const l = document.querySelector("label[for='" + cb.id + "']");
            if (l) l.click();
            else cb.click();
          } else {
            cb.click();
          }
        }
      }
    })()
  `);

  // 5. Full Name (Signature)
  const sigInput = page.locator("input[name='fullName'], input[id*='fullName']").first();
  if (await sigInput.count() > 0 && await sigInput.isVisible()) {
    console.log("Signing Full Name: Hrutin Nammi...");
    await sigInput.fill("Hrutin Nammi");
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/oracle_step3_verified_complete.png", fullPage: true });

  // Check state of radio buttons
  const rStates = await page.evaluate(`
    (() => {
      return Array.from(document.querySelectorAll("button[role='radio']")).map(b => ({
        text: b.textContent.trim(),
        checked: b.getAttribute('aria-checked')
      }));
    })()
  `);
  console.log("Radio checked states:", JSON.stringify(rStates, null, 2));

  // Check values of all inputs on Step 3
  const inputVals = await page.evaluate(`
    (() => {
      return Array.from(document.querySelectorAll("input:not([type='hidden']), select")).map(i => ({
        id: i.id,
        label: i.getAttribute('aria-label') || (document.querySelector("label[for='" + i.id + "']") ? document.querySelector("label[for='" + i.id + "']").textContent.trim() : ''),
        value: i.value,
        checked: i.checked
      })).filter(x => x.id);
    })()
  `);
  console.log("Step 3 Input Values:", JSON.stringify(inputVals, null, 2));

  await browser.close();
}

main().catch(console.error);
