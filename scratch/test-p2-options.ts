import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testSelectOptions() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(8000);

  // Fill Confirm Email
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");

  // Fix draft experience if open
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
    await page.locator("oc-button[data-test='experience-save'] button").click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Click Next
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);

  // Now on Page 2: let's inspect the 4 autocompletes
  const acs = page.locator("spl-autocomplete");
  const acCount = await acs.count();
  console.log("Autocomplete count:", acCount);

  for (let i = 0; i < acCount; i++) {
    const ac = acs.nth(i);
    await ac.scrollIntoViewIfNeeded();
    const acInput = ac.locator("input");
    console.log(`\n--- Autocomplete ${i} ---`);
    console.log("Placeholder / label:", await acInput.getAttribute("placeholder"), await acInput.getAttribute("aria-label"));

    // Click input
    await acInput.click({ force: true });
    await page.waitForTimeout(1000);

    // Check menu options
    const options = page.locator("spl-autocomplete-option, [role='option'], spl-option");
    const optCount = await options.count();
    console.log(`Found ${optCount} options after clicking`);
    for (let j = 0; j < Math.min(optCount, 5); j++) {
      console.log(`  Option ${j}:`, await options.nth(j).innerText().catch(() => ""));
    }

    if (optCount > 0) {
      console.log("Clicking option 0...");
      await options.first().click({ force: true });
      await page.waitForTimeout(500);
    }
  }

  // Save screenshot of Page 2 after selecting options
  await page.screenshot({ path: path.join(__dirname, "../screenshots/p2_after_ac_test.png"), fullPage: true });
  console.log("Saved screenshots/p2_after_ac_test.png");

  await browser.close();
}

testSelectOptions().catch(console.error);
