import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testNotApplicable() {
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

    const firstMulti = page.locator("spl-multiselect-autocomplete").first();
    const inp = firstMulti.locator("input");
    await inp.click();
    await page.waitForTimeout(400);

    console.log("Typing 'Not'...");
    await inp.fill("Not");
    await page.waitForTimeout(600);

    const notAppItem = page.locator("spl-dropdown-item:has-text('Not Applicable'), [title*='Not Applicable']").first();
    const count = await notAppItem.count();
    console.log("Found Not Applicable item count:", count);

    if (count > 0) {
      await notAppItem.click({ force: true });
      console.log("Clicked Not Applicable!");
    } else {
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // Let's test the privacy consent checkbox specifically:
    console.log("Testing privacy checkbox...");
    const privacyCb = page.locator("spl-checkbox[data-test='consent-box'], spl-checkbox:has-text('privacy notice')");
    console.log("Privacy checkbox count:", await privacyCb.count());
    const isCheckedBefore = await privacyCb.locator("input").isChecked().catch(() => false);
    console.log("isChecked before:", isCheckedBefore);
    if (!isCheckedBefore) {
      await privacyCb.click({ force: true });
      await page.waitForTimeout(500);
    }
    const isCheckedAfter = await privacyCb.locator("input").isChecked().catch(() => false);
    console.log("isChecked after:", isCheckedAfter);

  } finally {
    await browser.close();
  }
}

testNotApplicable().catch(console.error);
