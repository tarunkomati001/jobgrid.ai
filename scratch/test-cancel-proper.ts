import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testCancelProper() {
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

  // Check if draft card cancel button exists
  const cancelBtn = page.locator("oc-button[data-test='experience-cancel'] button");
  console.log("Cancel button count:", await cancelBtn.count());
  if (await cancelBtn.count() > 0) {
    console.log("Clicking cancel button with dispatchEvent or click...");
    await cancelBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Check state after cancel
  const remainingCancel = await page.locator("oc-button[data-test='experience-cancel'] button").count();
  console.log("Remaining cancel buttons:", remainingCancel);

  // If cancel button is still there, let's see why: click the trash button for this draft entry
  if (remainingCancel > 0) {
    console.log("Cancel didn't close it, trying checkbox or delete...");
    const cb = page.locator("oc-experience spl-checkbox input[type='checkbox']");
    if (await cb.count() > 0) {
      console.log("Checking checkbox...");
      await cb.first().check({ force: true });
      await page.waitForTimeout(1000);
      const saveBtn = page.locator("oc-button[data-test='experience-save'] button");
      await saveBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  await page.screenshot({ path: path.join(__dirname, "../screenshots/test_cancel_proper.png"), fullPage: true });
  console.log("Saved test_cancel_proper.png");
  await browser.close();
}

testCancelProper().catch(console.error);
