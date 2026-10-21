import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testCheckboxAndSave() {
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

  // Click "I currently work here" text / span
  console.log("Clicking 'I currently work here'...");
  const label = page.locator("text='I currently work here'").first();
  await label.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await label.click({ force: true });
  await page.waitForTimeout(1000);

  // Click Save
  console.log("Clicking Save...");
  const saveLabel = page.locator("oc-button[data-test='experience-save'] span, oc-button[data-test='experience-save']").first();
  await saveLabel.click({ force: true });
  await page.waitForTimeout(2000);

  // Fill Confirm Email
  console.log("Filling Confirm Email...");
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");
  await page.waitForTimeout(1000);

  // Click Next
  console.log("Clicking Next...");
  const nextBtn = page.locator("oc-button[data-test='footer-next'] spl-button, oc-button[data-test='footer-next']").first();
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);

  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, "linkedin_after_save_next.png"), fullPage: true });

  await browser.close();
}

testCheckboxAndSave().catch(console.error);
