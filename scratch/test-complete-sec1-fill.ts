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

  console.log("Navigating to URL...");
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill(testAlias);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);

  console.log("Submitting email...");
  await page.locator("button:has-text('Next')").first().click();

  console.log("Waiting for URL to transition to application section...");
  for (let s = 0; s < 25; s++) {
    await page.waitForTimeout(1000);
    const curr = page.url();
    if (curr.includes("/section/") || (!curr.includes("/apply/email") && curr.includes("/apply/"))) {
      break;
    }
  }
  console.log("Current URL:", page.url());
  await page.waitForTimeout(6000);

  // 1. Upload resume
  console.log("Uploading resume to attachment-upload-2...");
  const fileInput = page.locator("input#attachment-upload-2, input[type='file']").first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(resumePath);
    console.log("Resume uploaded! Waiting 5s for auto-parse...");
    await page.waitForTimeout(5000);
  }

  // 2. Select Country: India
  console.log("Selecting Country: India...");
  await page.evaluate(() => {
    const reset = document.querySelector("button[id*='country'][id*='reset']") as HTMLElement;
    if (reset) reset.click();
  });
  await page.waitForTimeout(600);

  const countryInp = page.locator("input[id*='country'], input[name='country']").first();
  if (await countryInp.count() > 0) {
    await countryInp.click();
    await countryInp.fill("India");
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item"));
      const india = opts.find(o => o.textContent?.trim().toLowerCase() === "india");
      if (india) (india as HTMLElement).click();
    });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
  }

  // 3. Fill Link 1
  console.log("Filling LinkedIn Link...");
  const linkInp = page.locator("input[id*='siteLink-1'], input[name*='siteLink-1']").first();
  if (await linkInp.count() > 0) {
    await linkInp.fill("https://linkedin.com/in/hrutinnammi");
  }

  // 4. Fill Earliest Available Date: Month, Day, Year
  console.log("Filling Earliest Available Date...");
  await page.evaluate(() => {
    const mBtn = document.querySelector("button[id*='month-earliestAvailableDate'][id*='toggle']") as HTMLElement;
    if (mBtn) mBtn.click();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[id*='month-earliestAvailableDate'] [role='option'], [id*='month-earliestAvailableDate'] .cx-select__list-item"));
    const match = items.find(i => i.textContent?.toLowerCase().includes("oct")) || items[9];
    if (match) (match as HTMLElement).click();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const dBtn = document.querySelector("button[id*='day-earliestAvailableDate'][id*='toggle']") as HTMLElement;
    if (dBtn) dBtn.click();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[id*='day-earliestAvailableDate'] [role='option'], [id*='day-earliestAvailableDate'] .cx-select__list-item"));
    const match = items.find(i => i.textContent?.trim() === "1" || i.textContent?.trim() === "01") || items[0];
    if (match) (match as HTMLElement).click();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const yBtn = document.querySelector("button[id*='year-earliestAvailableDate'][id*='toggle']") as HTMLElement;
    if (yBtn) yBtn.click();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll("[id*='year-earliestAvailableDate'] [role='option'], [id*='year-earliestAvailableDate'] .cx-select__list-item"));
    const match = items.find(i => i.textContent?.trim() === "2026") || items[0];
    if (match) (match as HTMLElement).click();
  });

  const yearInp = page.locator("input[id*='year-earliestAvailableDate']").first();
  if (await yearInp.count() > 0 && await yearInp.isVisible()) {
    await yearInp.fill("2026");
    await page.keyboard.press("Enter");
  }

  // 5. Answer Screening Questions (Yes/No pills)
  console.log("Answering screening questions...");
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".input-row, [class*='question']"));
    for (const row of rows) {
      const text = row.textContent?.toLowerCase() || "";
      const btns = Array.from(row.querySelectorAll("button.cx-select-pill-section, button")) as HTMLElement[];
      const yesBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "yes");
      const noBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "no");
      if (yesBtn && noBtn) {
        if (text.includes("ex-oracle") || text.includes("government")) {
          noBtn.click();
        } else if (text.includes("authorized")) {
          yesBtn.click();
        }
      }
    }
  });
  await page.waitForTimeout(1000);

  // 6. Select Gender: Male
  console.log("Selecting Gender: Male...");
  const genderInp = page.locator("input[id*='GENDER'], input[name*='GENDER']").first();
  if (await genderInp.count() > 0) {
    await genderInp.click();
    await genderInp.fill("Male");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }

  // 7. Checkboxes
  console.log("Checking agree checkboxes...");
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

  // 8. Full Name E-Signature
  console.log("Filling Full Name signature...");
  const sigInput = page.locator("input[id*='fullName'], input[name*='fullName']").first();
  if (await sigInput.count() > 0) {
    await sigInput.fill("Hrutin Nammi");
  }

  await page.waitForTimeout(2000);
  await page.screenshot({ path: "scratch/test_sec1_after_fill.png", fullPage: true });

  // 9. Click Next
  console.log("Clicking Next to advance to Section 2...");
  const nextSectionBtn = page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next')").last();
  await nextSectionBtn.click();
  await page.waitForTimeout(8000);

  console.log("URL after Next:", page.url());
  console.log("Page title after Next:", await page.title());
  await page.screenshot({ path: "scratch/test_after_sec1_next.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
