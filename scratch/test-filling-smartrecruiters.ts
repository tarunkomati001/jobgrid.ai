import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

async function testFillAndNext(url: string, prefix: string) {
  console.log(`\n======================================================`);
  console.log(`Testing Fill & Next: ${url}`);
  console.log(`======================================================`);

  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(4000);

  // 1. Upload resume FIRST so parser doesn't overwrite fields later
  console.log("Step 1: Uploading resume...");
  // Let's use a real or realistic text file/PDF
  const resumesDir = path.join(__dirname, "../storage/resumes");
  let resumeFile = path.join(resumesDir, "test_resume.pdf");
  if (!fs.existsSync(resumeFile)) {
    resumeFile = path.join(__dirname, "test-resume.pdf");
  }

  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(resumeFile);
    console.log("  Uploaded resume file");
    // Wait for prefill notification banner
    await page.waitForTimeout(4000);
  }

  // 2. Fill First Name
  console.log("Step 2: Filling First Name...");
  const firstName = page.locator("spl-input#first-name-input input, input#first-name-input").first();
  if (await firstName.count() > 0) {
    await firstName.click();
    await firstName.fill("Tarun");
    await firstName.blur();
  }

  // 3. Fill Last Name
  console.log("Step 3: Filling Last Name...");
  const lastName = page.locator("spl-input#last-name-input input, input#last-name-input").first();
  if (await lastName.count() > 0) {
    await lastName.click();
    await lastName.fill("Kumar");
    await lastName.blur();
  }

  // 4. Fill Email
  console.log("Step 4: Filling Email & Confirm Email...");
  const email = page.locator("spl-input#email-input input, input#email-input").first();
  if (await email.count() > 0) {
    await email.click();
    await email.fill("tarun.applicant@gmail.com");
    await email.blur();
  }

  const confirmEmail = page.locator("spl-input#confirm-email-input input, input#confirm-email-input").first();
  if (await confirmEmail.count() > 0) {
    await confirmEmail.click();
    await confirmEmail.fill("tarun.applicant@gmail.com");
    await confirmEmail.blur();
  }

  // 5. Fill City / Location via spl-autocomplete
  console.log("Step 5: Selecting City...");
  // In spl-autocomplete, the input is inside spl-autocomplete
  const cityInput = page.locator("spl-autocomplete input, [data-test='location-autocomplete'] input, spl-input#spl-form-element_10 input").first();
  if (await cityInput.count() > 0) {
    await cityInput.click();
    await cityInput.fill("San Francisco");
    await page.waitForTimeout(2000);
    // Find dropdown options in the menu
    const option = page.locator("[role='listbox'] [role='option'], spl-autocomplete-option, .c-spl-autocomplete-item").first();
    if (await option.count() > 0 && await option.isVisible().catch(() => false)) {
      const optText = await option.innerText().catch(() => "");
      console.log(`  Found city option: "${optText.trim()}"`);
      await option.click();
    } else {
      console.log("  Directly clicking first suggestion via evaluate if hidden...");
      await page.evaluate(`(() => {
        const opt = document.querySelector("[role='listbox'] [role='option'], .c-spl-autocomplete-item");
        if (opt) (opt).click();
      })()`);
    }
  }

  // 6. Fill Phone
  console.log("Step 6: Filling Phone...");
  const phone = page.locator("spl-phone-field input[type='tel'], spl-phone-field spl-input input, input[type='tel']").first();
  if (await phone.count() > 0) {
    await phone.click();
    await phone.fill("4155551234");
    await phone.blur();
  }

  // 7. Check if Experience is required (indicated by red asterisk)
  console.log("Step 7: Checking Experience section...");
  const expAddBtn = page.locator("oc-experience spl-button button, [data-test='add-experience'] button, oc-experience button:has-text('Add')").first();
  const hasExpRequired = await page.evaluate(`(() => {
    const section = document.querySelector("oc-experience");
    return section ? section.innerText.includes("*") : false;
  })()`);
  console.log(`  Experience required asterisk? ${hasExpRequired}`);

  // 8. Profiles / Social
  console.log("Step 8: Filling Profiles...");
  const linkedin = page.locator("spl-input#linkedin-input input, input#linkedin-input").first();
  if (await linkedin.count() > 0) {
    await linkedin.click();
    await linkedin.fill("https://www.linkedin.com/in/tarun-kumar");
    await linkedin.blur();
  }

  const website = page.locator("spl-input#website-input input, input#website-input").first();
  if (await website.count() > 0) {
    await website.click();
    await website.fill("https://tarun-portfolio.example.com");
    await website.blur();
  }

  // 9. Message to hiring manager
  console.log("Step 9: Message to hiring manager...");
  const msg = page.locator("spl-textarea#hiring-manager-message-input textarea, textarea").first();
  if (await msg.count() > 0) {
    await msg.click();
    await msg.fill("I am very excited to apply for this role and believe my experience is a great match!");
    await msg.blur();
  }

  await page.waitForTimeout(2000);

  // Save screenshot of filled page 1
  const outDir = path.join(__dirname, "../screenshots");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  await page.screenshot({ path: path.join(outDir, `${prefix}_filled_p1.png`), fullPage: true });

  // 10. Click Next
  console.log("Step 10: Clicking Next button...");
  // Look for the Next button inside oc-button or spl-button or footer
  const nextButton = page.locator("oc-button[data-test='footer-next'] button, [data-test='footer-next'] button, oc-nav-first-page button:has-text('Next'), button:has-text('Next')").first();
  const nextExists = await nextButton.count() > 0;
  console.log(`  Next button locator count: ${await nextButton.count()}`);

  if (nextExists) {
    await nextButton.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    await nextButton.click({ force: true });
    console.log("  Clicked Next!");
    await page.waitForTimeout(5000);

    // Save screenshot after Next
    await page.screenshot({ path: path.join(outDir, `${prefix}_after_next.png`), fullPage: true });

    // Check URL or Page changes
    console.log(`  URL after Next: ${page.url()}`);

    // Check for errors on page
    const errors = await page.locator(".spl-form-field-error, .c-spl-form-field-error, [class*='error']:visible, [aria-invalid='true']").allInnerTexts().catch(() => []);
    console.log(`  Errors after Next (${errors.length}):`, errors.filter(e => e.trim().length > 0));
  } else {
    console.log("  Next button not found with standard selector. Trying evaluate click...");
    await page.evaluate(`(() => {
      const btn = document.querySelector("oc-button[data-test='footer-next']")?.shadowRoot?.querySelector("button") 
        || document.querySelector("oc-button[data-test='footer-next'] spl-button")?.shadowRoot?.querySelector("button")
        || document.querySelector("oc-button[data-test='footer-next'] button");
      if (btn) btn.click();
    })()`);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(outDir, `${prefix}_after_next.png`), fullPage: true });
  }

  await browser.close();
}

async function run() {
  await testFillAndNext("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", "linkedin");
  await testFillAndNext("https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow", "servicenow");
}

run().catch(console.error);
