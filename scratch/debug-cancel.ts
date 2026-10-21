import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function debugCancel() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(7000);

  // Let's inspect oc-button[data-test='experience-cancel']
  const cancelDetails = await page.evaluate(`(() => {
    const ocBtn = document.querySelector("oc-button[data-test='experience-cancel']");
    const splBtn = ocBtn?.querySelector("spl-button");
    const innerBtn = splBtn?.shadowRoot?.querySelector("button");
    return {
      hasOcBtn: !!ocBtn,
      hasSplBtn: !!splBtn,
      hasInnerBtn: !!innerBtn,
      ocBtnEvents: ocBtn ? Object.keys(ocBtn) : []
    };
  })()`);
  console.log("Cancel element details:", cancelDetails);

  // Let's use Playwright mouse click at the exact bounding box after scrolling into view!
  const splCancel = page.locator("oc-button[data-test='experience-cancel']");
  await splCancel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const box = await splCancel.boundingBox();
  console.log("Cancel bounding box after scroll:", box);

  if (box) {
    console.log("Clicking cancel with mouse at center of box...");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(2000);
  }

  // Confirm email
  console.log("Filling Confirm Email...");
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
  await page.screenshot({ path: path.join(outDir, "linkedin_after_cancel_next.png"), fullPage: true });

  await browser.close();
}

debugCancel().catch(console.error);
