import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectButtonsAndCheckbox() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    const url = "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3";
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(4000);

    const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    await page.waitForSelector("input[type='file']", { timeout: 15000 });
    await page.locator("input[type='file']").first().setInputFiles(resumePath);
    await page.waitForTimeout(8000);

    // Confirm email
    const confirmEmail = page.locator("spl-input#confirm-email-input input");
    if (await confirmEmail.count() > 0) {
      await confirmEmail.fill("hrutinnammi8@gmail.com");
    }

    // Check draft experience card
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

    // Click Next
    const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
    await nextBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await nextBtn.click({ force: true });
    await page.waitForTimeout(5000);

    const checkDetails = await page.evaluate(() => {
      const cb = document.querySelector("spl-checkbox[data-test='consent-box']");
      const submit = document.querySelector("oc-button[data-test='footer-submit']");
      return {
        cbOuter: cb?.outerHTML,
        cbShadow: cb?.shadowRoot?.innerHTML,
        submitOuter: submit?.outerHTML,
        submitShadow: submit?.shadowRoot?.innerHTML
      };
    });

    console.log("Checkbox Outer:", checkDetails.cbOuter);
    console.log("Checkbox Shadow:", checkDetails.cbShadow);
    console.log("Submit Outer:", checkDetails.submitOuter);
    console.log("Submit Shadow:", checkDetails.submitShadow);

    // Now let's click the checkbox and see if submit button becomes enabled/active
    console.log("Clicking consent checkbox...");
    await page.locator("spl-checkbox[data-test='consent-box']").click();
    await page.waitForTimeout(1000);

    const submitStateAfterClick = await page.evaluate(() => {
      const submit = document.querySelector("oc-button[data-test='footer-submit']");
      const btn = submit?.shadowRoot?.querySelector("button") || submit?.querySelector("button");
      return {
        disabled: btn?.hasAttribute("disabled") || (btn as any)?.disabled,
        classes: btn?.className,
        ocDisabled: submit?.hasAttribute("disabled") || (submit as any)?.disabled
      };
    });
    console.log("Submit state after clicking consent checkbox:", submitStateAfterClick);

    const screenPath = path.resolve(__dirname, "../screenshots/linkedin_ready_to_submit.png");
    await page.screenshot({ path: screenPath, fullPage: true });
    console.log("Screenshot saved:", screenPath);

  } finally {
    await browser.close();
  }
}

inspectButtonsAndCheckbox().catch(console.error);
