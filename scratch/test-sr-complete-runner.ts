import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import { Page } from "playwright";

interface JobTestConfig {
  name: string;
  url: string;
  company: string;
}

const JOBS: JobTestConfig[] = [
  {
    name: "LinkedIn",
    company: "LinkedIn3",
    url: "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3"
  },
  {
    name: "ServiceNow",
    company: "ServiceNow",
    url: "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow"
  }
];

async function fillSmartRecruitersPage1(page: Page) {
  console.log("--- Starting Page 1 Filling ---");
  const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  
  // 1. Upload resume
  console.log("Uploading resume...");
  await page.locator("input[type='file']").first().setInputFiles(resumePath);
  await page.waitForTimeout(8000);

  // 2. Personal info
  console.log("Filling Personal Information...");
  // First Name
  const fnInput = page.locator("spl-input#first-name-input input");
  if (await fnInput.count() > 0 && !(await fnInput.inputValue())) {
    await fnInput.fill("Hrutin");
  }
  // Last Name
  const lnInput = page.locator("spl-input#last-name-input input");
  if (await lnInput.count() > 0 && !(await lnInput.inputValue())) {
    await lnInput.fill("Nammi");
  }
  // Email
  const emailInput = page.locator("spl-input#email-input input");
  if (await emailInput.count() > 0 && !(await emailInput.inputValue())) {
    await emailInput.fill("hrutinnammi8@gmail.com");
  }
  // Confirm Email
  const confirmEmailInput = page.locator("spl-input#confirm-email-input input");
  if (await confirmEmailInput.count() > 0) {
    await confirmEmailInput.fill("hrutinnammi8@gmail.com");
  }

  // City Autocomplete if empty
  const cityInput = page.locator("spl-autocomplete#location-input input, spl-autocomplete[id*='location'] input");
  if (await cityInput.count() > 0) {
    const val = await cityInput.inputValue();
    if (!val) {
      await cityInput.fill("Vadodara");
      await page.waitForTimeout(1000);
      const opt = page.locator("spl-autocomplete-option, [role='option']").first();
      if (await opt.count() > 0) await opt.click();
    }
  }

  // Country code if empty
  const phoneVal = await page.locator("spl-phone-field spl-select input").inputValue().catch(() => "");
  if (!phoneVal) {
    const sel = page.locator("spl-phone-field spl-select");
    await sel.click();
    await page.waitForTimeout(500);
    const inOpt = page.locator("spl-phone-field spl-option[value='+91'], spl-option:has-text('India')").first();
    if (await inOpt.count() > 0) await inOpt.click();
  }

  // Phone number if empty
  const phoneInp = page.locator("spl-phone-field spl-input input");
  if (await phoneInp.count() > 0 && !(await phoneInp.inputValue())) {
    await phoneInp.fill("8688423267");
  }

  // 3. Fix experience draft card if open
  const isExpOpen = await page.locator("oc-button[data-test='experience-save'] button").count();
  if (isExpOpen > 0) {
    console.log("Draft experience card detected. Setting 'I currently work here' and saving...");
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

  // 4. Social profiles
  console.log("Filling Social Profiles...");
  const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input");
  if (await liInput.count() > 0) {
    await liInput.first().fill("https://linkedin.com/in/hrutin-nammi");
  }

  const webInput = page.locator("spl-input#website-input input, spl-input[id*='website'] input");
  if (await webInput.count() > 0 && !(await webInput.first().inputValue())) {
    await webInput.first().fill("https://github.com/hrutinnammi");
  }

  // 5. Message to hiring team
  const msgInput = page.locator("spl-textarea textarea, textarea[name='messageToHiringTeam']");
  if (await msgInput.count() > 0) {
    await msgInput.first().fill("I am very excited about this role and look forward to contributing my technical skills and experience.");
  }

  console.log("Page 1 filled successfully.");
}

async function clickNextToPage2(page: Page) {
  console.log("Clicking Next to proceed to Page 2...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);
  console.log("URL after Next:", page.url());
}

async function fillSmartRecruitersPage2(page: Page, jobName: string) {
  console.log(`--- Starting Page 2 (/screening) Filling for ${jobName} ---`);

  // Handle all radio button questions on the page
  const radioGroups = page.locator("spl-radio-group, [role='radiogroup']");
  const radioGroupCount = await radioGroups.count();
  console.log(`Found ${radioGroupCount} radio groups.`);

  for (let i = 0; i < radioGroupCount; i++) {
    const group = radioGroups.nth(i);
    const legendText = (await group.innerText().catch(() => "")) || "";
    const lower = legendText.toLowerCase();

    // Determine smart answer:
    // Authorized to work? -> Yes
    // Visa sponsorship? -> No (or Yes depending on user) -> let's pick No
    // Relocate? -> Yes
    // Deloitte affiliates / Gov employee / etc? -> No
    // Disability? -> No
    // Protected veteran? -> No
    let targetOption = "No";
    if (lower.includes("authorized") || lower.includes("relocate") || lower.includes("willing to relocate")) {
      targetOption = "Yes";
    }

    // Try finding the radio button inside group
    const targetRadio = group.locator(`text='${targetOption}'`).first();
    if (await targetRadio.count() > 0) {
      await targetRadio.click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    } else {
      // Fallback: click first radio
      const firstRadio = group.locator("spl-radio, input[type='radio']").first();
      if (await firstRadio.count() > 0) {
        await firstRadio.click({ force: true }).catch(() => {});
      }
    }
  }

  // Handle all dropdowns / selects on Page 2
  const selects = page.locator("spl-select, spl-autocomplete");
  const selectCount = await selects.count();
  console.log(`Found ${selectCount} selects / autocompletes.`);

  for (let i = 0; i < selectCount; i++) {
    const sel = selects.nth(i);
    await sel.scrollIntoViewIfNeeded().catch(() => {});
    const text = (await sel.innerText().catch(() => "")) || "";
    console.log(`Select ${i}: ${text.slice(0, 40)}`);

    await sel.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);

    // Pick first available valid option or 'No' / 'Decline' / 'None'
    const options = page.locator("spl-option, spl-autocomplete-option, [role='option']");
    const optCount = await options.count();
    if (optCount > 0) {
      // Find 'No' or 'None' or first option
      let chosenIndex = 0;
      for (let j = 0; j < Math.min(optCount, 8); j++) {
        const optText = (await options.nth(j).innerText().catch(() => "")).toLowerCase();
        if (optText.includes("no") || optText.includes("none") || optText.includes("decline") || optText.includes("not")) {
          chosenIndex = j;
          break;
        }
      }
      await options.nth(chosenIndex).click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  // Handle signature and date fields
  const textInputs = page.locator("spl-input input");
  const inputCount = await textInputs.count();
  console.log(`Found ${inputCount} text inputs on Page 2.`);

  for (let i = 0; i < inputCount; i++) {
    const inp = textInputs.nth(i);
    const parent = inp.locator("xpath=../..");
    const label = (await parent.innerText().catch(() => "")).toLowerCase();
    const curVal = await inp.inputValue().catch(() => "");
    if (!curVal) {
      if (label.includes("name") || label.includes("signature")) {
        await inp.fill("Hrutin Nammi");
      } else if (label.includes("date")) {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        await inp.fill(today);
      } else if (label.includes("email")) {
        await inp.fill("hrutinnammi8@gmail.com");
      } else {
        await inp.fill("N/A");
      }
    }
  }

  // Check all required checkboxes (acknowledgements, privacy policies, etc.)
  const checkboxes = page.locator("spl-checkbox");
  const cbCount = await checkboxes.count();
  console.log(`Found ${cbCount} checkboxes on Page 2.`);

  for (let i = 0; i < cbCount; i++) {
    const cb = checkboxes.nth(i);
    await cb.scrollIntoViewIfNeeded().catch(() => {});
    await cb.click({ force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }

  console.log(`Finished filling Page 2 for ${jobName}.`);
}

async function runTest() {
  const browser = await createBrowser(false);
  const outDir = path.join(__dirname, "../screenshots");

  for (const job of JOBS) {
    console.log(`\n========================================`);
    console.log(`TESTING ${job.name.toUpperCase()}`);
    console.log(`URL: ${job.url}`);
    console.log(`========================================`);

    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await applyStealthScripts(context);
    const page = await context.newPage();

    try {
      await page.goto(job.url, { waitUntil: "load" });
      await page.waitForTimeout(4000);

      // Page 1
      await fillSmartRecruitersPage1(page);
      const p1Shot = path.join(outDir, `${job.name.toLowerCase()}_p1_complete.png`);
      await page.screenshot({ path: p1Shot, fullPage: true });
      console.log(`Saved Page 1 screenshot to ${p1Shot}`);

      // Next
      await clickNextToPage2(page);

      // Page 2
      await fillSmartRecruitersPage2(page, job.name);
      await page.waitForTimeout(3000);

      const p2Shot = path.join(outDir, `${job.name.toLowerCase()}_p2_complete.png`);
      await page.screenshot({ path: p2Shot, fullPage: true });
      console.log(`Saved Page 2 screenshot to ${p2Shot}`);

    } catch (err) {
      console.error(`Error testing ${job.name}:`, err);
    } finally {
      await context.close();
    }
  }

  await browser.close();
  console.log("\nALL TESTS COMPLETE!");
}

runTest().catch(console.error);
