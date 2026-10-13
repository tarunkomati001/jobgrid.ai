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

  console.log("Navigating directly to apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `hrutin_test_exp_${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1", testEmail);
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

  // Section 1: Check Country Code and Address Country
  console.log("Checking Section 1 Country fields...");
  const sec1Dump = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("input, select, button[id*='country'], button[id*='phone']"));
    return els.map(e => ({
      id: e.id,
      name: (e as any).name,
      tag: e.tagName,
      type: (e as any).type,
      val: (e as any).value,
      text: e.textContent?.trim().slice(0, 30),
      label: document.querySelector(`label[for='${e.id}']`)?.textContent?.trim() || ""
    })).filter(x => x.id);
  });
  console.log("Sec 1 Elements:", JSON.stringify(sec1Dump, null, 2));

  // Fill Sec 1
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "8688423267").catch(() => {});
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "ava street").catch(() => {});
  await page.fill("input[name='addressLine2'], input[id*='addressLine2']", "ava street").catch(() => {});
  await page.fill("input[name='postalCode'], input[id*='postalCode']", "390144").catch(() => {});
  await page.fill("input[name='city'], input[id*='city']", "Vadodara").catch(() => {});

  // Advance to Sec 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Upload resume in Sec 2
  const rInput = page.locator("input[type='file']").first();
  if (await rInput.count() > 0) {
    console.log("Uploading resume...");
    await rInput.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Advance to Sec 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(8000);
  console.log("On Section 3. URL:", page.url());

  // Click edit on the invalid experience tile using evaluate
  console.log("Clicking Edit button on invalid tile via evaluate...");
  const clicked = await page.evaluate(() => {
    const invalidTile = document.querySelector(".apply-flow-profile-item-tile--invalid");
    if (invalidTile) {
      const editBtn = invalidTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit'], button[aria-label='Edit']") as HTMLElement;
      if (editBtn) {
        editBtn.click();
        return "CLICKED_INVALID_TILE_EDIT";
      }
      (invalidTile as HTMLElement).click();
      return "CLICKED_INVALID_TILE_DIRECTLY";
    }
    // Fallback: click any edit button
    const anyEdit = document.querySelector(".apply-flow-profile-item-tile__edit-item-icon") as HTMLElement;
    if (anyEdit) {
      anyEdit.click();
      return "CLICKED_FIRST_EDIT";
    }
    return "NO_EDIT_BUTTON";
  });
  console.log("Click result:", clicked);
  await page.waitForTimeout(3000);

  // Take screenshot of opened edit form
  await page.screenshot({ path: "scratch/oracle_exp_edit_opened.png", fullPage: true });

  // Dump all fields that appeared inside the edit form or modal!
  const editFields = await page.evaluate(() => {
    const form = document.querySelector(".profile-item-form, form, .apply-flow-profile-item-tile--active, [class*='edit'], [class*='profile-item']");
    const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button, [role='combobox']"));
    return inputs.map(el => {
      const inp = el as any;
      const rect = el.getBoundingClientRect();
      let label = "";
      if (inp.id) {
        const l = document.querySelector(`label[for='${inp.id}']`);
        if (l) label = l.textContent?.trim() || "";
      }
      if (!label) {
        const parent = el.closest(".form-block, .field, .input-row, div");
        if (parent) {
          const l = parent.querySelector("label, .label, span.title");
          if (l) label = l.textContent?.trim() || "";
        }
      }
      return {
        tag: el.tagName,
        id: inp.id,
        name: inp.name,
        type: inp.type,
        label,
        ariaLabel: el.getAttribute("aria-label"),
        value: inp.value,
        text: el.textContent?.trim().slice(0, 40),
        visible: rect.width > 0 && rect.height > 0
      };
    }).filter(x => x.visible && (x.label || x.id || x.name));
  });
  console.log("Visible form fields after clicking edit:", JSON.stringify(editFields, null, 2));

  // Check error message text inside the opened tile or form
  const errorTexts = await page.evaluate(() => {
    const errs = Array.from(document.querySelectorAll(".error, [class*='error'], [aria-invalid='true'], .oj-message-detail, .summary-validation, [data-bind*='validation']"));
    return errs.map(e => e.textContent?.trim()).filter(Boolean);
  });
  console.log("Errors / validation texts:", errorTexts);

  await browser.close();
}

main().catch(console.error);
