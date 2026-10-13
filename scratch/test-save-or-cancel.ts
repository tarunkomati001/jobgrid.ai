import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testHandleDraft() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(7000);

  // Check the Cancel button inside shadow root
  const clicked = await page.evaluate(`(() => {
    // 1. Try to click cancel button directly in shadow root
    const splBtn = document.querySelector("spl-button[aria-label*='Cancel'], [data-test='experience-cancel'] spl-button");
    if (splBtn && splBtn.shadowRoot) {
      const b = splBtn.shadowRoot.querySelector("button");
      if (b) {
        b.click();
        return "CLICKED_SHADOW_CANCEL_BUTTON";
      }
    }
    // 2. Try click current work checkbox & save
    const currentCb = document.querySelector("oc-checkbox[formcontrolname='current'] spl-checkbox");
    if (currentCb && currentCb.shadowRoot) {
      const inp = currentCb.shadowRoot.querySelector("input") || currentCb.shadowRoot.querySelector("button");
      if (inp) inp.click();
    }
    const saveBtn = document.querySelector("spl-button[aria-label*='Save'], [data-test='experience-save'] spl-button");
    if (saveBtn && saveBtn.shadowRoot) {
      const b = saveBtn.shadowRoot.querySelector("button");
      if (b) {
        b.click();
        return "CLICKED_SHADOW_SAVE_BUTTON";
      }
    }
    return "NOTHING_FOUND";
  })()`);

  console.log("Evaluate click result:", clicked);
  await page.waitForTimeout(2000);

  // Confirm email
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");

  // Click Next
  const nextClicked = await page.evaluate(`(() => {
    const nextSplBtn = document.querySelector("oc-button[data-test='footer-next'] spl-button, [data-test='footer-next'] spl-button");
    if (nextSplBtn && nextSplBtn.shadowRoot) {
      const b = nextSplBtn.shadowRoot.querySelector("button");
      if (b) {
        b.click();
        return "CLICKED_NEXT";
      }
    }
    return "NEXT_NOT_FOUND";
  })()`);
  console.log("Next click result:", nextClicked);

  await page.waitForTimeout(5000);
  console.log("Current URL after Next:", page.url());

  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, "linkedin_page2_reached.png"), fullPage: true });

  await browser.close();
}

testHandleDraft().catch(console.error);
