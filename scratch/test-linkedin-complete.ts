import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

async function testLinkedInComplete() {
  console.log("Navigating to LinkedIn...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // 1. Upload resume
  const testPdf = path.join(__dirname, "test-resume.pdf");
  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(testPdf);
    await page.waitForTimeout(3000);
  }

  // 2. Personal info
  await page.locator("spl-input#first-name-input input").fill("Tarun");
  await page.locator("spl-input#last-name-input input").fill("Kumar");
  await page.locator("spl-input#email-input input").fill("tarun.applicant@gmail.com");
  await page.locator("spl-input#confirm-email-input input").fill("tarun.applicant@gmail.com");

  // 3. City
  const cityInput = page.locator("spl-autocomplete input").first();
  await cityInput.click();
  await cityInput.fill("Mountain View");
  await page.waitForTimeout(1500);
  await page.locator("[role='listbox'] [role='option'], .c-spl-autocomplete-item").first().click();

  // 4. Phone country code
  const countryTrigger = page.locator("spl-phone-field spl-select, spl-phone-field .c-spl-phone-field-selected").first();
  await countryTrigger.click();
  await page.waitForTimeout(500);
  const usOpt = page.locator("spl-select-option[value='US'], spl-select-option:has-text('United States')").first();
  if (await usOpt.count() > 0) {
    await usOpt.click();
  }
  await page.locator("spl-phone-field input[type='tel']").first().fill("6505551234");

  // 5. Add Experience
  console.log("Opening Experience form...");
  const expAddBtn = page.locator("oc-experience [data-test='add-experience'] button, oc-experience button:has-text('Add')").first();
  await expAddBtn.click();
  await page.waitForTimeout(1000);

  // Title: in spl-autocomplete, the input is inside
  const titleInp = page.locator("[data-test='job-title-autocomplete'] input");
  await titleInp.click();
  await titleInp.fill("Software Engineer");
  await page.waitForTimeout(1000);
  // Pick option if menu opens or press Tab
  const firstTitleOpt = page.locator("[role='listbox'] [role='option']").first();
  if (await firstTitleOpt.isVisible().catch(() => false)) {
    await firstTitleOpt.click();
  } else {
    await page.keyboard.press("Enter");
  }

  // Company: in spl-autocomplete
  const compInp = page.locator("[data-test='company-autocomplete'] input");
  await compInp.click();
  await compInp.fill("Google");
  await page.waitForTimeout(1000);
  const firstCompOpt = page.locator("[role='listbox'] [role='option']").first();
  if (await firstCompOpt.isVisible().catch(() => false)) {
    await firstCompOpt.click();
  } else {
    await page.keyboard.press("Enter");
  }

  // Check "I currently work here"
  const currentWorkCheckbox = page.locator("oc-checkbox[formcontrolname='current'] spl-checkbox, [data-test='experience-current']").first();
  await currentWorkCheckbox.click();
  await page.waitForTimeout(500);

  // From date: type 01/2022 or click
  const fromDateInp = page.locator("spl-date-field[id*='exp-from'] input, [data-test='experience-date-from'] input").first();
  if (await fromDateInp.count() > 0) {
    await fromDateInp.click();
    await fromDateInp.fill("01/2022");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
  } else {
    // If inside shadow root of spl-date-field:
    await page.evaluate(`(() => {
      const df = document.querySelector("spl-date-field[id*='exp-from']");
      const inp = df?.shadowRoot?.querySelector("input");
      if (inp) {
        inp.value = "01/2022";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`);
  }

  await page.waitForTimeout(1000);

  // Click Save experience
  console.log("Saving Experience...");
  const saveBtn = page.locator("oc-button[data-test='experience-save'] button, [data-test='experience-save'] button").first();
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // 6. Profiles
  await page.locator("spl-input#linkedin-input input").fill("https://www.linkedin.com/in/tarun-kumar");
  await page.locator("spl-input#website-input input").fill("https://tarun-portfolio.example.com");

  // 7. Click Next
  console.log("Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button, [data-test='footer-next'] button").first();
  await nextBtn.click();
  await page.waitForTimeout(5000);

  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  const shotPath = path.join(outDir, "linkedin_page2_success.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Screenshot saved to", shotPath);

  await browser.close();
}

testLinkedInComplete().catch(console.error);
