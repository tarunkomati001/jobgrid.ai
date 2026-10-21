import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testClickNextAfterCancel() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(7000);

  // Click cancel if open
  const cancelLocator = page.locator("oc-experience").locator("text=Cancel");
  if (await cancelLocator.count() > 0) {
    console.log("Clicking cancel locator...");
    await cancelLocator.first().click();
    await page.waitForTimeout(2000);
  }

  // Fill Confirm Email
  console.log("Filling confirm email...");
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");
  await page.waitForTimeout(1000);

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
  const shotPath = path.join(outDir, "linkedin_after_next_result.png");
  await page.screenshot({ path: shotPath, fullPage: true });
  console.log("Screenshot saved to", shotPath);

  await browser.close();
}

testClickNextAfterCancel().catch(console.error);
