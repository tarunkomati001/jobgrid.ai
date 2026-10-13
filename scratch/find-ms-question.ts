import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectLinkedInP2SpecificDropdown() {
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

    const confirmEmail = page.locator("spl-input#confirm-email-input input");
    if (await confirmEmail.count() > 0) await confirmEmail.fill("hrutinnammi8@gmail.com");

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

    const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
    await nextBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await nextBtn.click({ force: true });
    await page.waitForTimeout(6000);

    // Find all custom elements in sr-screening-questions-form
    const customElements = await page.locator("sr-screening-questions-form *").evaluateAll(els => {
      const uniqueTags = new Set(els.map(e => e.tagName.toLowerCase()));
      return Array.from(uniqueTags);
    });
    console.log("Unique tags in sr-screening-questions-form:", customElements);

    // Look for elements with text "worked at LinkedIn"
    const msQuestion = page.locator("*:has-text('worked at LinkedIn or Microsoft')").last();
    console.log("msQuestion text:", await msQuestion.innerText().catch(() => ""));
    console.log("msQuestion outerHTML:", await msQuestion.evaluate(el => el.outerHTML).catch(() => ""));

  } finally {
    await browser.close();
  }
}

inspectLinkedInP2SpecificDropdown().catch(console.error);
