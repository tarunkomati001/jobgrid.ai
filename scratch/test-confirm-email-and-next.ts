import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import { Page } from "playwright";

async function fillSmartRecruitersFull(page: Page, jobUrl: string, jobName: string) {
  console.log(`\n======================================================`);
  console.log(`TESTING: ${jobName}`);
  console.log(`URL: ${jobUrl}`);
  console.log(`======================================================`);

  await page.goto(jobUrl, { waitUntil: "load", timeout: 45000 });
  await page.waitForTimeout(4000);

  // 1. Upload resume
  console.log(`[${jobName}] Step 1: Uploading resume...`);
  const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const fileInput = page.locator("input[type='file']").first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(resumePath);
    console.log(`  Uploaded resume file.`);
    // Wait generously for SmartRecruiters resume prefill parser to finish
    await page.waitForTimeout(9000);
  }

  // 2. Email and Confirm Email handling
  console.log(`[${jobName}] Step 2: Handling Email & Confirm Email...`);
  const emailInput = page.locator("spl-input#email-input input, input#email-input").first();
  let emailVal = "";
  if (await emailInput.count() > 0) {
    emailVal = (await emailInput.inputValue()).trim();
  }
  if (!emailVal) {
    emailVal = "hrutinnammi8@gmail.com";
    if (await emailInput.count() > 0) {
      await emailInput.click();
      await emailInput.fill(emailVal);
      await emailInput.blur();
    }
  }
  console.log(`  Target Email to use: "${emailVal}"`);

  // Fill confirm email with multiple fallbacks (click + fill + blur + keyboard typing + evaluate)
  const confirmEmailInput = page.locator("spl-input#confirm-email-input input, input#confirm-email-input").first();
  if (await confirmEmailInput.count() > 0) {
    await confirmEmailInput.scrollIntoViewIfNeeded().catch(() => {});
    await confirmEmailInput.click();
    await page.waitForTimeout(300);
    await confirmEmailInput.fill(emailVal);
    await confirmEmailInput.dispatchEvent("input");
    await confirmEmailInput.dispatchEvent("change");
    await confirmEmailInput.blur();
    await page.waitForTimeout(300);

    // Verify it actually has the value
    const curConfirmVal = await confirmEmailInput.inputValue().catch(() => "");
    console.log(`  Confirm Email input value is now: "${curConfirmVal}"`);

    if (curConfirmVal !== emailVal) {
      console.log(`  Falling back to direct evaluate injection for confirm email...`);
      await page.evaluate((val) => {
        const inp = (document.querySelector("spl-input#confirm-email-input input") ||
          document.querySelector("input#confirm-email-input") ||
          document.querySelector("spl-input#confirm-email-input")?.shadowRoot?.querySelector("input")) as HTMLInputElement;
        if (inp) {
          inp.focus();
          inp.value = val;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          inp.blur();
        }
      }, emailVal);
    }
  }

  // 3. First name and Last name fallbacks
  console.log(`[${jobName}] Step 3: Checking First & Last Name...`);
  const fnInput = page.locator("spl-input#first-name-input input, input#first-name-input").first();
  if (await fnInput.count() > 0 && !(await fnInput.inputValue())) {
    await fnInput.fill("Hrutin");
  }
  const lnInput = page.locator("spl-input#last-name-input input, input#last-name-input").first();
  if (await lnInput.count() > 0 && !(await lnInput.inputValue())) {
    await lnInput.fill("Nammi");
  }

  // 4. Phone Country Code & Number
  console.log(`[${jobName}] Step 4: Checking Phone...`);
  const phoneVal = await page.locator("spl-phone-field spl-select input").inputValue().catch(() => "");
  if (!phoneVal) {
    const sel = page.locator("spl-phone-field spl-select");
    if (await sel.count() > 0) {
      await sel.first().click();
      await page.waitForTimeout(500);
      const inOpt = page.locator("spl-phone-field spl-option[value='+91'], spl-option:has-text('India'), spl-phone-field spl-option[value='+1']").first();
      if (await inOpt.count() > 0) await inOpt.click();
    }
  }
  const phoneInp = page.locator("spl-phone-field spl-input input, input[type='tel']").first();
  if (await phoneInp.count() > 0 && !(await phoneInp.inputValue())) {
    await phoneInp.fill("8688423267");
  }

  // 5. City / Location Autocomplete
  console.log(`[${jobName}] Step 5: Checking City...`);
  const cityInput = page.locator("spl-autocomplete#location-input input, spl-autocomplete[id*='location'] input, spl-autocomplete input").first();
  if (await cityInput.count() > 0) {
    const curLoc = await cityInput.inputValue().catch(() => "");
    if (!curLoc) {
      await cityInput.fill("Vadodara");
      await page.waitForTimeout(1200);
      const opt = page.locator("spl-autocomplete-option, [role='option']").first();
      if (await opt.count() > 0) {
        await opt.click();
      } else {
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
      }
    }
  }

  // 6. Experience draft card resolution
  const isExpOpen = await page.locator("oc-button[data-test='experience-save'] button").count();
  if (isExpOpen > 0) {
    console.log(`[${jobName}] Resolving open draft experience card...`);
    await page.evaluate(`(() => {
      const cb = document.querySelector("oc-experience spl-checkbox");
      if (cb) {
        cb.click();
        const input = cb.shadowRoot?.querySelector("input");
        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    })()`);
    await page.waitForTimeout(1000);

    const saveBtn = page.locator("oc-button[data-test='experience-save'] button");
    if (await saveBtn.count() > 0) {
      await saveBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  // 7. Social profiles
  const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input").first();
  if (await liInput.count() > 0) {
    await liInput.fill("https://linkedin.com/in/hrutin-nammi");
  }

  const webInput = page.locator("spl-input#website-input input, spl-input[id*='website'] input").first();
  if (await webInput.count() > 0 && !(await webInput.inputValue())) {
    await webInput.fill("https://github.com/hrutinnammi");
  }

  // 8. Message to hiring team
  const msgInput = page.locator("spl-textarea textarea, textarea[name='messageToHiringTeam']").first();
  if (await msgInput.count() > 0 && !(await msgInput.inputValue())) {
    await msgInput.fill("I am very excited about this role and look forward to contributing my technical skills.");
  }

  // Re-check confirm email one more time right before clicking Next!
  if (await confirmEmailInput.count() > 0) {
    const val = await confirmEmailInput.inputValue().catch(() => "");
    if (!val || val !== emailVal) {
      console.log(`  Re-applying confirm email before Next: ${emailVal}`);
      await confirmEmailInput.click();
      await confirmEmailInput.fill(emailVal);
      await confirmEmailInput.dispatchEvent("input");
      await confirmEmailInput.dispatchEvent("change");
      await confirmEmailInput.blur();
      await page.waitForTimeout(300);
    }
  }

  // Check for any errors on Page 1 before Next
  const p1Errors = await page.locator(".spl-form-field-error, .c-spl-form-field-error, [class*='error']:visible").allInnerTexts().catch(() => []);
  console.log(`[${jobName}] Page 1 errors before clicking Next:`, p1Errors.filter(e => e.trim()));

  // 9. Click Next and wait for Page 2 (/screening)
  console.log(`[${jobName}] Step 9: Clicking Next button...`);
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button, [data-test='footer-next'] button, oc-nav-first-page button:has-text('Next')").first();
  await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(500);
  await nextBtn.click({ force: true });

  console.log(`[${jobName}] Waiting for redirect to Page 2 (/screening)...`);
  try {
    await page.waitForURL(url => url.toString().includes("screening"), { timeout: 15000 });
    console.log(`✅ Successfully navigated to Page 2! URL: ${page.url()}`);
  } catch (e) {
    console.warn(`⚠️ Wait for /screening URL timed out. Current URL: ${page.url()}`);
  }

  await page.waitForTimeout(3000);

  // 10. Fill Page 2 if on screening page
  if (page.url().includes("screening") || (await page.locator("spl-radio-group").count()) > 0) {
    console.log(`[${jobName}] Step 10: Filling Page 2 screening questions...`);

    // Radio groups
    const radioGroups = page.locator("spl-radio-group, [role='radiogroup']");
    const radioCount = await radioGroups.count();
    console.log(`  Found ${radioCount} radio groups.`);
    for (let i = 0; i < radioCount; i++) {
      const group = radioGroups.nth(i);
      const text = (await group.innerText().catch(() => "")).toLowerCase();
      let choice = "No";
      if (text.includes("authorized") || text.includes("relocate") || text.includes("willing to relocate")) {
        choice = "Yes";
      }
      const radioChoice = group.locator(`text='${choice}'`).first();
      if (await radioChoice.count() > 0) {
        await radioChoice.click({ force: true }).catch(() => {});
      } else {
        const first = group.locator("spl-radio, input[type='radio']").first();
        if (await first.count() > 0) await first.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(100);
    }

    // Multiselect autocompletes
    const multis = page.locator("spl-multiselect-autocomplete");
    const multiCount = await multis.count();
    for (let i = 0; i < multiCount; i++) {
      const m = multis.nth(i);
      const inp = m.locator("input");
      if (await inp.count() > 0) {
        await inp.scrollIntoViewIfNeeded().catch(() => {});
        await inp.click().catch(() => {});
        await page.waitForTimeout(300);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }

    // Regular Dropdowns / Autocompletes
    const acInputs = page.locator("spl-autocomplete input, spl-select input");
    const acCount = await acInputs.count();
    for (let i = 0; i < acCount; i++) {
      const inp = acInputs.nth(i);
      await inp.scrollIntoViewIfNeeded().catch(() => {});
      const curVal = await inp.inputValue().catch(() => "");
      if (!curVal) {
        await inp.click().catch(() => {});
        await page.waitForTimeout(400);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(150);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
      }
    }

    // Text inputs (Signature, Date, Full Name)
    const splInputs = page.locator("spl-input");
    const inpCount = await splInputs.count();
    const todayDate = new Date().toISOString().split("T")[0];
    for (let i = 0; i < inpCount; i++) {
      const item = splInputs.nth(i);
      const text = (await item.innerText().catch(() => "")).toLowerCase();
      const id = (await item.getAttribute("id").catch(() => "")) || "";
      const inp = item.locator("input");
      if (await inp.count() > 0) {
        const val = await inp.inputValue().catch(() => "");
        if (!val) {
          if (text.includes("name") || text.includes("signature") || id.includes("name")) {
            await inp.fill("Hrutin Nammi");
          } else if (text.includes("date") || id.includes("date")) {
            await inp.fill(todayDate);
          } else if (text.includes("email") || id.includes("email")) {
            await inp.fill(emailVal);
          }
        }
      }
    }

    // Checkboxes (Consent & agreements)
    const splCbs = page.locator("spl-checkbox");
    const cbCount = await splCbs.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = splCbs.nth(i);
      await cb.scrollIntoViewIfNeeded().catch(() => {});
      const isChecked = await cb.locator("input").isChecked().catch(() => false);
      if (!isChecked) {
        const target = cb.locator("label, .c-spl-checkbox-wrapper, input").first();
        if (await target.count() > 0) {
          await target.click({ force: true }).catch(() => {});
        } else {
          await cb.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(150);
      }
    }

    console.log(`✅ [${jobName}] Page 2 filling completed!`);

    // Check submit button
    const submitBtn = page.locator("oc-button[data-test='footer-submit'] button, [data-test='footer-submit'] button").first();
    const submitVisible = (await submitBtn.count()) > 0;
    console.log(`[${jobName}] Submit button visible & ready: ${submitVisible}`);
  }
}

async function run() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    // Run ServiceNow first (which was the one failing on confirm email in the screenshot!)
    await fillSmartRecruitersFull(
      page,
      "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow",
      "ServiceNow"
    );

    // Keep page open for 10 seconds so user can see Page 2 filled!
    console.log("Holding page open for 10s for visual confirmation...");
    await page.waitForTimeout(10000);

    // Run LinkedIn next
    await fillSmartRecruitersFull(
      page,
      "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3",
      "LinkedIn"
    );

    console.log("Holding page open for 10s for visual confirmation...");
    await page.waitForTimeout(10000);

  } finally {
    await browser.close();
  }
}

run().catch(console.error);
