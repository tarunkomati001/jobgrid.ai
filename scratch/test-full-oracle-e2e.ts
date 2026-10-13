import { chromium } from "playwright";
import dotenv from "dotenv";
import path from "path";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+fulltest${Date.now()}@gmail.com`;
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  console.log("=== 1. Starting Email Step ===");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill(testAlias);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click(); else cb.click();
    }
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  for (let s = 0; s < 30; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/")) break;
  }
  console.log("Current URL:", page.url());
  await page.waitForTimeout(3000);

  console.log("=== 2. Handling Section 1 ===");
  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count() > 0) {
    console.log("Uploading resume on Section 1...");
    await fileInput.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  const fn = page.locator("input[name='firstName'], input[id*='firstName']").first();
  if (await fn.count() > 0) await fn.fill("Hrutin");
  const ln = page.locator("input[name='lastName'], input[id*='lastName']").first();
  if (await ln.count() > 0) await ln.fill("Nammi");

  const phoneCountryToggle = page.locator("button[id*='country-codes-dropdownphoneNumber']").first();
  if (await phoneCountryToggle.count() > 0) {
    await page.evaluate(() => {
      const btn = document.querySelector("button[id*='country-codes-dropdownphoneNumber']") as HTMLElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll("[id*='country-codes-dropdownphoneNumber'] [role='option'], [id*='country-codes-dropdownphoneNumber'] .cx-select__list-item"));
      const india = items.find(i => i.textContent?.toLowerCase().includes("india") || i.textContent?.includes("+91"));
      if (india) (india as HTMLElement).click();
    });
  }
  const phoneInp = page.locator("input[type='tel']").first();
  if (await phoneInp.count() > 0) await phoneInp.fill("8688423267");
  await page.waitForTimeout(2000);

  // Advance Section 1 -> Section 2
  console.log("Advancing to Section 2...");
  await page.waitForSelector("button.apply-flow-pagination__button:has-text('Next'):not([disabled])", { timeout: 15000 }).catch(() => {});
  await page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/2")) break;
  }
  console.log("Current URL:", page.url());
  await page.waitForTimeout(3000);

  console.log("=== 3. Handling Section 2 ===");
  const link1 = page.locator("input[name*='siteLink-1'], input[id*='siteLink-1']").first();
  if (await link1.count() > 0) await link1.fill("https://linkedin.com/in/hrutinnammi");
  await page.waitForTimeout(1000);

  // Advance Section 2 -> Section 3
  console.log("Advancing to Section 3...");
  await page.waitForSelector("button.apply-flow-pagination__button:has-text('Next'):not([disabled])", { timeout: 15000 }).catch(() => {});
  await page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next')").last().click();

  for (let s = 0; s < 20; s++) {
    await page.waitForTimeout(1000);
    if (page.url().includes("/section/3")) break;
  }
  console.log("Current URL:", page.url());
  await page.waitForTimeout(4000);

  console.log("=== 4. Handling Section 3 ===");
  // Fill Earliest Available Date: Month, Day, Year
  const today = new Date();
  const dayStr = String(today.getDate()).padStart(2, "0");
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthQuery = monthNames[today.getMonth()];
  const yearStr = String(today.getFullYear());

  console.log(`Setting Earliest Available Date: Month=${monthQuery}, Day=${dayStr}, Year=${yearStr}...`);
  // Month
  await page.evaluate(() => {
    const mBtn = document.querySelector("button[id*='month-earliestAvailableDate'][id*='toggle']") as HTMLElement;
    if (mBtn) mBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate((mQuery) => {
    const items = Array.from(document.querySelectorAll("[id*='month-earliestAvailableDate'] [role='option'], [id*='month-earliestAvailableDate'] .cx-select__list-item, [role='option']"));
    const match = items.find(i => i.textContent?.toLowerCase().includes(mQuery));
    if (match) (match as HTMLElement).click();
  }, monthQuery);
  await page.waitForTimeout(400);

  // Day
  await page.evaluate(() => {
    const dBtn = document.querySelector("button[id*='day-earliestAvailableDate'][id*='toggle']") as HTMLElement;
    if (dBtn) dBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate((dStr) => {
    const items = Array.from(document.querySelectorAll("[id*='day-earliestAvailableDate'] [role='option'], [id*='day-earliestAvailableDate'] .cx-select__list-item, [role='option']"));
    const match = items.find(i => i.textContent?.trim() === dStr || i.textContent?.trim() === String(parseInt(dStr, 10)));
    if (match) (match as HTMLElement).click();
  }, dayStr);
  await page.waitForTimeout(400);

  // Year
  await page.evaluate(() => {
    const yBtn = document.querySelector("button[id*='year-earliestAvailableDate'][id*='toggle']") as HTMLElement;
    if (yBtn) yBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate((yStr) => {
    const items = Array.from(document.querySelectorAll("[id*='year-earliestAvailableDate'] [role='option'], [id*='year-earliestAvailableDate'] .cx-select__list-item, [role='option']"));
    const match = items.find(i => i.textContent?.trim() === yStr);
    if (match) (match as HTMLElement).click();
  }, yearStr);
  await page.waitForTimeout(400);

  // Screening questions: Yes / No buttons
  console.log("Answering Section 3 screening questions...");
  const answered = await page.evaluate(() => {
    let count = 0;
    const containers = Array.from(document.querySelectorAll(".input-row, .form-block, fieldset, section, tr, td, div"));
    for (const c of containers) {
      const btns = Array.from(c.querySelectorAll("button")).filter(b => {
        const t = b.textContent?.trim().toLowerCase();
        return t === "yes" || t === "no";
      }) as HTMLElement[];
      if (btns.length === 2) {
        const text = (c.textContent || "").toLowerCase();
        let wantYes = true;
        if (text.includes("ex-oracle") || text.includes("former employee") || text.includes("government") || text.includes("public official")) {
          wantYes = false;
        }
        const targetBtn = btns.find(b => b.textContent?.trim().toLowerCase() === (wantYes ? "yes" : "no"));
        if (targetBtn && targetBtn.getAttribute("aria-checked") !== "true") {
          targetBtn.click();
          count++;
        }
      }
    }
    return count;
  });
  console.log(`Answered ${answered} questions.`);
  await page.waitForTimeout(1000);

  // Gender dropdown
  console.log("Setting Gender: Male...");
  await page.evaluate(() => {
    const gBtn = document.querySelector("button[id*='GENDER'][id*='toggle']") as HTMLElement;
    if (gBtn) gBtn.click();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[id*='GENDER'] [role='option'], [id*='GENDER'] .cx-select__list-item, [role='option']"));
    const match = items.find(i => {
      const t = i.textContent?.trim().toLowerCase() || "";
      return t === "male" || (t.includes("male") && !t.includes("female"));
    });
    if (match) (match as HTMLElement).click();
  });
  await page.waitForTimeout(1000);

  // Full Name Signature
  console.log("Entering Full Name E-Signature...");
  const sigInput = page.locator("input[name='fullName'], input[id*='fullName']").first();
  if (await sigInput.count() > 0) {
    await sigInput.fill("Hrutin Nammi");
  }
  await page.waitForTimeout(1000);

  // Take screenshot of filled Section 3
  await page.screenshot({ path: "scratch/oracle_section3_completed.png", fullPage: true });

  // Check Submit button state
  const submitState = await page.evaluate(() => {
    const btn = document.querySelector("button:has-text('Submit'), button[type='submit']") as any;
    const allButtons = Array.from(document.querySelectorAll("button")).map((b: any) => ({
      text: b.textContent?.trim(),
      disabled: b.disabled,
      visible: b.getBoundingClientRect().width > 0
    }));
    return {
      submitFound: !!btn,
      submitDisabled: btn ? btn.disabled : null,
      buttons: allButtons
    };
  });
  console.log("Submit button status:", JSON.stringify(submitState, null, 2));

  await browser.close();
}

main().catch(console.error);
