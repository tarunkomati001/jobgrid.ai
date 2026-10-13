import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testCancelAndNextNow() {
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
  if (await cancelBtn.count() > 0) {
    console.log("Clicking cancel button on draft...");
    await cancelBtn.first().click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Fill Confirm Email
  console.log("Filling Confirm Email...");
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");
  await page.waitForTimeout(500);

  // Fill LinkedIn profile URL
  console.log("Filling LinkedIn URL...");
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

  const shotPath = path.join(__dirname, "../screenshots/test_linkedin_p2_success.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Saved screenshot to", shotPath);

  await browser.close();
}

testCancelAndNextNow().catch(console.error);
