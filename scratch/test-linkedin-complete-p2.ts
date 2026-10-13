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

async function testLinkedInComplete() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    const url = "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3";
    console.log("Navigating to LinkedIn...");
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    // 1. Resume
    console.log("1. Uploading resume...");
    const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    await page.waitForSelector("input[type='file']", { timeout: 15000 });
    await page.locator("input[type='file']").first().setInputFiles(resumePath);
    await page.waitForTimeout(8000);

    // 2. Personal info
    console.log("2. Confirming email...");
    const confirmEmail = page.locator("spl-input#confirm-email-input input");
    if (await confirmEmail.count() > 0) await confirmEmail.fill(USER_DATA.email);

    // 3. Draft experience card
    console.log("3. Resolving draft experience card if open...");
    const isExpOpen = await page.locator("oc-button[data-test='experience-save'] button").count();
    if (isExpOpen > 0) {
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

    // 4. Social links
    const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input");
    if (await liInput.count() > 0) await liInput.first().fill(USER_DATA.linkedin);

    // Click Next
    console.log("Clicking Next...");
    const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
    await nextBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await nextBtn.click({ force: true });
    await page.waitForTimeout(6000);

    console.log("URL after Next:", page.url());

    // Page 2 Filling:
    // A. Radio groups
    console.log("Filling radio groups...");
    const radioGroups = page.locator("spl-radio-group");
    const rgCount = await radioGroups.count();
    for (let i = 0; i < rgCount; i++) {
      const group = radioGroups.nth(i);
      const text = (await group.innerText().catch(() => "")).toLowerCase();
      let choice = "No";
      if (text.includes("authorized") || text.includes("relocate")) {
        choice = "Yes";
      }
      const choiceEl = group.locator(`text='${choice}'`).first();
      if (await choiceEl.count() > 0) {
        await choiceEl.click({ force: true });
      } else {
        await group.locator("spl-radio").first().click({ force: true });
      }
      await page.waitForTimeout(200);
    }

    // B. Multiselect autocompletes
    console.log("Filling multiselect autocompletes...");
    const multis = page.locator("spl-multiselect-autocomplete");
    const multiCount = await multis.count();
    for (let i = 0; i < multiCount; i++) {
      const m = multis.nth(i);
      const mText = (await m.innerText().catch(() => "")).toLowerCase();
      const inp = m.locator("input");
      await inp.scrollIntoViewIfNeeded();
      await inp.click();
      await page.waitForTimeout(500);

      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(200);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(200);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // C. Regular autocompletes (EEO dropdowns: Gender, Race, Veteran, Disability)
    console.log("Filling regular autocompletes (EEO)...");
    const autocompletes = page.locator("spl-autocomplete");
    const acCount = await autocompletes.count();
    for (let i = 0; i < acCount; i++) {
      const ac = autocompletes.nth(i);
      const inp = ac.locator("input");
      await inp.scrollIntoViewIfNeeded();
      const cur = await inp.inputValue().catch(() => "");
      if (!cur) {
        await inp.click();
        await page.waitForTimeout(400);
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }

    // D. Text inputs (Your Name, Today's Date, etc.)
    console.log("Filling text inputs...");
    const splInputs = page.locator("spl-input");
    const inputCount = await splInputs.count();
    for (let i = 0; i < inputCount; i++) {
      const item = splInputs.nth(i);
      const text = (await item.innerText().catch(() => "")).toLowerCase();
      const inp = item.locator("input");
      if (await inp.count() > 0) {
        const val = await inp.inputValue().catch(() => "");
        if (!val) {
          if (text.includes("name") || text.includes("signature")) {
            await inp.fill(USER_DATA.fullName);
          } else if (text.includes("date")) {
            await inp.fill(USER_DATA.todayDate);
          }
        }
      }
    }

    // E. Consent and declaration Checkboxes
    console.log("Checking all checkboxes...");
    const cbs = page.locator("spl-checkbox");
    const cbCount = await cbs.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = cbs.nth(i);
      await cb.scrollIntoViewIfNeeded();
      await cb.click({ force: true });
      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(2000);

    const outPath = path.resolve(__dirname, "../screenshots/linkedin_fully_filled_p2.png");
    await page.screenshot({ path: outPath, fullPage: true });
    console.log("SUCCESS! Screenshot saved:", outPath);

  } finally {
    await browser.close();
  }
}

testLinkedInComplete().catch(console.error);
