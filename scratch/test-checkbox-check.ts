import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testCheckboxCheck() {
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

    // Check all checkboxes on the entire page (both inside sr-screening-questions-form and at the bottom footer)
    console.log("Checking all checkboxes...");
    const cbs = page.locator("spl-checkbox");
    const count = await cbs.count();
    console.log(`Found ${count} spl-checkbox elements.`);

    for (let i = 0; i < count; i++) {
      const cb = cbs.nth(i);
      await cb.scrollIntoViewIfNeeded();
      const text = await cb.innerText();
      console.log(`Checkbox ${i}: ${text.slice(0, 60).replace(/\n/g, " ")}`);

      // Try clicking the label or input inside shadowRoot via locator
      const label = cb.locator("label, .c-spl-checkbox-wrapper, input").first();
      if (await label.count() > 0) {
        await label.click({ force: true });
      } else {
        await cb.click({ force: true });
      }
      await page.waitForTimeout(300);

      const isChecked = await cb.locator("input").isChecked().catch(() => false);
      console.log(`  isChecked: ${isChecked}`);
    }

    const outPath = path.resolve(__dirname, "../screenshots/linkedin_checkbox_check.png");
    await page.screenshot({ path: outPath, fullPage: true });

  } finally {
    await browser.close();
  }
}

testCheckboxCheck().catch(console.error);
