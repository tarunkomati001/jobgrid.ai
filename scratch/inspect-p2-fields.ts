import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectLinkedInPage2Fields() {
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

    const inputsInfo = await page.evaluate(() => {
      const results: any[] = [];
      document.querySelectorAll("spl-input, spl-autocomplete, spl-radio-group, spl-checkbox").forEach((el) => {
        // Look for any label element or text inside or nearby
        const labelAttr = el.getAttribute("label") || "";
        const idAttr = el.getAttribute("id") || "";
        const dataTest = el.getAttribute("data-test") || "";
        const labelEl = el.querySelector("label, spl-typography-label, [slot='label-content'], [slot='label']");
        const labelText = labelEl ? labelEl.textContent?.trim() : "";
        const parentLabel = el.closest(".c-spl-form-field, [class*='field'], [class*='question']")?.textContent?.slice(0, 100).replace(/\s+/g, " ");

        results.push({
          tag: el.tagName.toLowerCase(),
          id: idAttr,
          dataTest,
          labelAttr,
          labelText,
          parentLabel
        });
      });
      return results;
    });

    console.log("Found", inputsInfo.length, "inputs on LinkedIn P2:");
    console.log(JSON.stringify(inputsInfo, null, 2));

  } finally {
    await browser.close();
  }
}

inspectLinkedInPage2Fields().catch(console.error);
