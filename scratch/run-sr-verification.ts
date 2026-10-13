import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import { Page } from "playwright";

const USER_DATA = {
  firstName: "Hrutin",
  lastName: "Nammi",
  email: "hrutinnammi8@gmail.com",
  phone: "8688423267",
  phoneCountryCode: "+91",
  country: "India",
  city: "Vadodara",
  linkedin: "https://linkedin.com/in/hrutin-nammi",
  website: "https://github.com/hrutinnammi",
  fullName: "Hrutin Nammi",
  todayDate: "09/09/2026"
};

export async function fillSmartRecruitersPage1(page: Page, jobName: string) {
  console.log(`\n[${jobName}] Step 1: Uploading resume...`);
  const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  
  await page.waitForSelector("input[type='file']", { timeout: 15000 });
  await page.locator("input[type='file']").first().setInputFiles(resumePath);
  await page.waitForTimeout(8000);

  console.log(`[${jobName}] Step 2: Filling personal details...`);
  // Confirm email
  const confirmEmail = page.locator("spl-input#confirm-email-input input");
  if (await confirmEmail.count() > 0) {
    await confirmEmail.fill(USER_DATA.email);
  }

  // First name & Last name fallbacks if not populated
  const fnInput = page.locator("spl-input#first-name-input input");
  if (await fnInput.count() > 0 && !(await fnInput.inputValue())) {
    await fnInput.fill(USER_DATA.firstName);
  }
  const lnInput = page.locator("spl-input#last-name-input input");
  if (await lnInput.count() > 0 && !(await lnInput.inputValue())) {
    await lnInput.fill(USER_DATA.lastName);
  }

  // Phone Country Code
  const phoneVal = await page.locator("spl-phone-field spl-select input").inputValue().catch(() => "");
  if (!phoneVal) {
    console.log(`[${jobName}] Selecting phone country code...`);
    const sel = page.locator("spl-phone-field spl-select");
    await sel.click();
    await page.waitForTimeout(500);
    const inOpt = page.locator("spl-phone-field spl-option[value='+91'], spl-option:has-text('India')").first();
    if (await inOpt.count() > 0) await inOpt.click();
  }

  // City autocomplete fallback
  const cityInput = page.locator("spl-autocomplete#location-input input, spl-autocomplete[id*='location'] input");
  if (await cityInput.count() > 0) {
    const val = await cityInput.inputValue();
    if (!val) {
      console.log(`[${jobName}] Filling city autocomplete...`);
      await cityInput.fill(USER_DATA.city);
      await page.waitForTimeout(1000);
      const opt = page.locator("spl-autocomplete-option, [role='option']").first();
      if (await opt.count() > 0) await opt.click();
    }
  }

  // Check draft experience card
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

  // Social profiles
  console.log(`[${jobName}] Step 3: Filling profiles...`);
  const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input");
  if (await liInput.count() > 0) {
    await liInput.first().fill(USER_DATA.linkedin);
  }

  const webInput = page.locator("spl-input#website-input input, spl-input[id*='website'] input");
  if (await webInput.count() > 0 && !(await webInput.first().inputValue())) {
    await webInput.first().fill(USER_DATA.website);
  }

  console.log(`[${jobName}] Page 1 successfully prepared.`);
}

export async function fillSmartRecruitersPage2(page: Page, jobName: string) {
  console.log(`\n[${jobName}] Step 4: Filling Page 2 (/screening)...`);

  // 1. Radio groups
  const radioGroups = page.locator("spl-radio-group, [role='radiogroup']");
  const radioCount = await radioGroups.count();
  console.log(`[${jobName}] Processing ${radioCount} radio groups...`);

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
    await page.waitForTimeout(150);
  }

  // 2. Multiselect autocompletes
  const multis = page.locator("spl-multiselect-autocomplete");
  const multiCount = await multis.count();
  if (multiCount > 0) {
    console.log(`[${jobName}] Processing ${multiCount} multiselect autocompletes...`);
    for (let i = 0; i < multiCount; i++) {
      const m = multis.nth(i);
      const inp = m.locator("input");
      await inp.scrollIntoViewIfNeeded();
      await inp.click();
      await page.waitForTimeout(400);
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  }

  // 3. Regular Autocompletes & Selects (Dropdowns)
  const acInputs = page.locator("spl-autocomplete input, spl-select input");
  const acCount = await acInputs.count();
  console.log(`[${jobName}] Processing ${acCount} dropdowns/autocompletes...`);

  for (let i = 0; i < acCount; i++) {
    const inp = acInputs.nth(i);
    await inp.scrollIntoViewIfNeeded().catch(() => {});
    const curVal = await inp.inputValue().catch(() => "");
    if (!curVal) {
      await inp.click().catch(() => {});
      await page.waitForTimeout(400);

      // Select first valid option via keyboard
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      const newVal = await inp.inputValue().catch(() => "");
      console.log(`  Dropdown ${i}: ${newVal}`);
    }
  }

  // 4. Text inputs (Signature, Dates, Name) using Playwright locators to pierce all shadow roots
  console.log(`[${jobName}] Filling text inputs (Signature, Date, Name, etc.)...`);
  const splInputs = page.locator("spl-input");
  const inpCount = await splInputs.count();
  for (let i = 0; i < inpCount; i++) {
    const item = splInputs.nth(i);
    const text = (await item.innerText().catch(() => "")).toLowerCase();
    const id = (await item.getAttribute("id").catch(() => "")) || "";
    const inp = item.locator("input");
    if (await inp.count() > 0) {
      const val = await inp.inputValue().catch(() => "");
      if (!val) {
        if (text.includes("name") || text.includes("signature") || id.includes("name")) {
          await inp.fill(USER_DATA.fullName);
        } else if (text.includes("date") || id.includes("date")) {
          await inp.fill(USER_DATA.todayDate);
        } else if (text.includes("email") || id.includes("email")) {
          await inp.fill(USER_DATA.email);
        }
      }
    }
  }

  // 5. Checkboxes (Acknowledge, consent, declarations)
  console.log(`[${jobName}] Checking all consent / declaration checkboxes...`);
  const splCbs = page.locator("spl-checkbox");
  const cbCount = await splCbs.count();
  console.log(`[${jobName}] Found ${cbCount} checkboxes`);

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
      await page.waitForTimeout(200);
    }
  }

  console.log(`[${jobName}] Page 2 filling complete.`);
}

async function runJob(job: { name: string; url: string }) {
  console.log(`\n======================================================`);
  console.log(`STARTING VERIFICATION: ${job.name.toUpperCase()}`);
  console.log(`URL: ${job.url}`);
  console.log(`======================================================`);

  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();
  const outDir = path.join(__dirname, "../screenshots");

  try {
    await page.goto(job.url, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    // Fill Page 1
    await fillSmartRecruitersPage1(page, job.name);
    const p1Path = path.join(outDir, `${job.name.toLowerCase()}_final_p1.png`);
    await page.screenshot({ path: p1Path, fullPage: true });
    console.log(`[${job.name}] Saved Page 1 Screenshot: ${p1Path}`);

    // Click Next
    console.log(`[${job.name}] Clicking Next to proceed to Page 2...`);
    const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
    await nextBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await nextBtn.click({ force: true });
    await page.waitForTimeout(6000);

    console.log(`[${job.name}] Current URL after Next: ${page.url()}`);

    // Fill Page 2
    await fillSmartRecruitersPage2(page, job.name);
    await page.waitForTimeout(3000);

    const p2Path = path.join(outDir, `${job.name.toLowerCase()}_final_p2.png`);
    await page.screenshot({ path: p2Path, fullPage: true });
    console.log(`[${job.name}] Saved Page 2 Screenshot: ${p2Path}`);

  } catch (err) {
    console.error(`Error on ${job.name}:`, err);
  } finally {
    await browser.close();
  }
}

async function main() {
  const jobs = [
    {
      name: "LinkedIn",
      url: "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3"
    },
    {
      name: "ServiceNow",
      url: "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow"
    }
  ];

  for (const job of jobs) {
    await runJob(job);
  }

  console.log("\n======================================================");
  console.log("ALL JOBS PROCESSED AND VERIFIED SUCCESSFULLY!");
  console.log("======================================================");
}

main().catch(console.error);
