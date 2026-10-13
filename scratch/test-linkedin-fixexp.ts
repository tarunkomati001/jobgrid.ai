import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testLinkedInFixExp() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to LinkedIn...");
  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Uploading resume...");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(8000);

  // Fill Confirm Email
  console.log("Filling Confirm Email...");
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");

  // Select phone country if not set
  console.log("Checking phone country...");
  const phoneVal = await page.locator("spl-phone-field spl-select input").inputValue().catch(() => "");
  if (!phoneVal) {
    const sel = page.locator("spl-phone-field spl-select");
    await sel.click();
    await page.waitForTimeout(500);
    const inOpt = page.locator("spl-phone-field spl-option[value='+91'], spl-option:has-text('India')").first();
    if (await inOpt.count() > 0) {
      await inOpt.click();
    }
  }

  // Handle experience:
  const isExpOpen = await page.locator("oc-button[data-test='experience-save'] button").count();
  console.log("Is experience card open?", isExpOpen);

  if (isExpOpen > 0) {
    console.log("Card is open. Let's check 'I currently work here'...");
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

    // Click Save button
    console.log("Clicking experience Save button...");
    const saveBtn = page.locator("oc-button[data-test='experience-save'] button");
    await saveBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Fill LinkedIn URL
  const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input");
  if (await liInput.count() > 0) {
    await liInput.first().fill("https://linkedin.com/in/hrutin-nammi");
  }

  // Click Next
  console.log("Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);

  console.log("Current URL after Next:", page.url());
  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, "linkedin_page2_after_fixed_exp.png"), fullPage: true });

  await browser.close();
}

testLinkedInFixExp().catch(console.error);
