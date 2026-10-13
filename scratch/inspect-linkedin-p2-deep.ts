import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import { Page } from "playwright";

async function inspectLinkedInP2Deep() {
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
    
    // Wait for screening page to settle
    console.log("Waiting for screening form to load...");
    await page.waitForTimeout(5000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log("Body text preview:\n", bodyText.slice(0, 1000));

    // Check if there are form questions or if LinkedIn publication only has consent-box or screening questions
    const questionSections = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll("oc-screening-question, oc-custom-question, [class*='question'], [class*='screening']"));
      return sections.map(s => ({ tag: s.tagName, class: s.className, text: s.textContent?.slice(0, 80) }));
    });
    console.log("Question sections:", questionSections);

    const isSubmitDisabled = await page.evaluate(() => {
      const btn = document.querySelector("oc-button[data-test='footer-submit'] button");
      return btn ? btn.hasAttribute("disabled") : "not found";
    });
    console.log("Is submit button disabled?", isSubmitDisabled);

    const consentBoxChecked = await page.evaluate(() => {
      const cb = document.querySelector("spl-checkbox[data-test='consent-box']");
      const inp = cb?.shadowRoot?.querySelector("input") || cb?.querySelector("input");
      return inp ? inp.checked : "not found";
    });
    console.log("Consent box checked?", consentBoxChecked);

  } finally {
    await browser.close();
  }
}

inspectLinkedInP2Deep().catch(console.error);
