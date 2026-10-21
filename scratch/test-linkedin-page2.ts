import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

async function testLinkedInPage2() {
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

  // 5. Add Experience (since LinkedIn requires at least 1)
  console.log("Adding required Experience...");
  const expAddBtn = page.locator("oc-experience [data-test='add-experience'] button, oc-experience button:has-text('Add')").first();
  if (await expAddBtn.count() > 0) {
    await expAddBtn.click();
    await page.waitForTimeout(1000);

    // Title
    const titleInp = page.locator("oc-experience spl-input[label*='Title'] input, oc-experience input[id*='title'], oc-experience spl-autocomplete[label*='Title'] input").first();
    if (await titleInp.count() > 0) {
      await titleInp.fill("Software Engineer");
      await page.waitForTimeout(500);
      // If autocomplete opens, pick or close
      const titleOpt = page.locator("[role='listbox'] [role='option']").first();
      if (await titleOpt.isVisible().catch(() => false)) await titleOpt.click();
    }

    // Company
    const compInp = page.locator("oc-experience spl-input[label*='Company'] input, oc-experience input[id*='company'], oc-experience spl-autocomplete[label*='Company'] input").first();
    if (await compInp.count() > 0) {
      await compInp.fill("Tech Corp");
      await page.waitForTimeout(500);
      const compOpt = page.locator("[role='listbox'] [role='option']").first();
      if (await compOpt.isVisible().catch(() => false)) await compOpt.click();
    }

    // "I currently work here" checkbox
    const currentWorkCheckbox = page.locator("oc-experience input[type='checkbox'], oc-experience spl-checkbox").first();
    if (await currentWorkCheckbox.count() > 0) {
      await currentWorkCheckbox.click();
    }

    // Save button
    const saveBtn = page.locator("oc-experience button:has-text('Save'), oc-experience spl-button button:has-text('Save')").first();
    if (await saveBtn.count() > 0) {
      await saveBtn.click();
      console.log("Clicked Save Experience!");
      await page.waitForTimeout(1000);
    }
  }

  // 6. Profiles
  await page.locator("spl-input#linkedin-input input").fill("https://www.linkedin.com/in/tarun-kumar");
  await page.locator("spl-input#website-input input").fill("https://tarun-portfolio.example.com");

  // 7. Message
  await page.locator("spl-textarea#hiring-manager-message-input textarea").fill("Excited about LinkedIn Web Infrastructure role.");

  await page.waitForTimeout(1500);

  // 8. Click Next
  console.log("Clicking Next on LinkedIn...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button, [data-test='footer-next'] button").first();
  await nextBtn.click();
  await page.waitForTimeout(5000);

  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  const shotPath = path.join(outDir, "linkedin_page2_inspected.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Screenshot saved to", shotPath);

  await browser.close();
}

testLinkedInPage2().catch(console.error);
