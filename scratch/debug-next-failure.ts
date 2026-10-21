import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import { SmartRecruitersAdapter } from "../src/ats/smartrecruiters/smartrecruiters.adapter";
import { UserProfile } from "../src/ats/ats.interface";
import * as path from "path";

async function debugServiceNowNext() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow";
  await page.goto(url, { waitUntil: "load" });

  const adapter = new SmartRecruitersAdapter();
  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "hrutinnammi8@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    linkedinUrl: "https://linkedin.com/in/hrutin-nammi",
    githubUrl: "https://github.com/hrutinnammi",
    willingToRelocate: true,
    yearsOfExperience: 3
  };

  const resumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  console.log("1. Uploading resume...");
  await adapter.uploadResume(page, resumePath);

  console.log("2. Calling adapter.fillForm()...");
  await adapter.fillForm(page, profile);

  console.log("3. Current URL after fillForm:", page.url());

  // Check if still on Page 1
  if (!page.url().includes("screening")) {
    console.log("⚠️ Still on Page 1! Inspecting DOM for blocking errors / state...");

    // Check all error elements
    const errors = await page.evaluate(() => {
      const errEls = Array.from(document.querySelectorAll(".spl-form-field-error, .c-spl-form-field-error, [class*='error']:not(:empty), [aria-invalid='true']"));
      return errEls.map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.trim(),
        parent: el.parentElement?.outerHTML.slice(0, 200)
      }));
    });
    console.log("Detected error elements:", errors);

    // Check Next button state
    const nextBtnState = await page.evaluate(() => {
      const ocBtn = document.querySelector("oc-button[data-test='footer-next']");
      const splBtn = ocBtn?.querySelector("spl-button");
      const nativeBtn = splBtn?.shadowRoot?.querySelector("button") || ocBtn?.querySelector("button");
      return {
        ocDisabled: ocBtn?.hasAttribute("disabled") || (ocBtn as any)?.disabled,
        splDisabled: splBtn?.hasAttribute("disabled") || (splBtn as any)?.disabled,
        nativeDisabled: nativeBtn?.hasAttribute("disabled") || (nativeBtn as any)?.disabled,
        nativeClass: nativeBtn?.className,
        nativeOuter: nativeBtn?.outerHTML
      };
    });
    console.log("Next button state:", nextBtnState);

    // Check experience section
    const expState = await page.evaluate(() => {
      const exp = document.querySelector("oc-experience");
      const saveBtn = exp?.querySelector("oc-button[data-test='experience-save']");
      const cancelBtn = exp?.querySelector("oc-button[data-test='experience-cancel']");
      return {
        hasSave: !!saveBtn,
        hasCancel: !!cancelBtn,
        expText: exp?.textContent?.slice(0, 300)
      };
    });
    console.log("Experience section state:", expState);

    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, "../screenshots/debug_servicenow_stuck.png"), fullPage: true });
    console.log("Saved debug screenshot to screenshots/debug_servicenow_stuck.png");
  } else {
    console.log("🎉 Successfully navigated to Page 2 (/screening)!");
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

debugServiceNowNext().catch(console.error);
