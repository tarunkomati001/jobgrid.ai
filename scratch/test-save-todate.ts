import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testFillToDateAndSave() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to LinkedIn...");
  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(7000);

  // Set To date on the second draft entry
  console.log("Setting To date on draft entry...");
  await page.evaluate(`(() => {
    const toField = document.querySelector("spl-date-field[id*='exp-to'], [data-test='experience-date-to'] spl-date-field");
    if (toField && toField.shadowRoot) {
      const inp = toField.shadowRoot.querySelector("input");
      if (inp) {
        inp.focus();
        inp.value = "2026-02";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        inp.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }
  })()`);

  await page.waitForTimeout(1000);

  // Click Save
  console.log("Clicking Save on draft entry...");
  const saveBtn = page.locator("oc-button[data-test='experience-save']");
  await saveBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const saveBox = await saveBtn.boundingBox();
  if (saveBox) {
    await page.mouse.click(saveBox.x + saveBox.width / 2, saveBox.y + saveBox.height / 2);
  }
  await page.waitForTimeout(2000);

  // Fill Confirm Email
  console.log("Filling Confirm Email...");
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");
  await page.waitForTimeout(500);

  // Click Next
  console.log("Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next']");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const nextBox = await nextBtn.boundingBox();
  if (nextBox) {
    await page.mouse.click(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
  }
  await page.waitForTimeout(6000);

  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  const shotPath = path.join(outDir, "linkedin_page2_saved_next.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Screenshot saved to", shotPath);

  await browser.close();
}

testFillToDateAndSave().catch(console.error);
