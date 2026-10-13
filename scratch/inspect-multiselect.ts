import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectMultiSelect() {
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

    const multis = page.locator("spl-multiselect-autocomplete");
    const count = await multis.count();
    console.log(`Found ${count} spl-multiselect-autocomplete elements:`);
    for (let i = 0; i < count; i++) {
      const el = multis.nth(i);
      console.log(`\n--- Multiselect [${i}] ---`);
      console.log("Text:", (await el.innerText()).slice(0, 100).replace(/\n/g, " "));
      const inp = el.locator("input");
      await inp.click();
      await page.waitForTimeout(500);
      const options = page.locator("spl-dropdown [role='option'], spl-autocomplete-option, .c-spl-dropdown-item");
      const optCount = await options.count();
      console.log(`Options count: ${optCount}`);
      for (let j = 0; j < Math.min(optCount, 5); j++) {
        console.log(`  Option ${j}:`, (await options.nth(j).innerText()).trim());
      }
      // Click first option or press Enter
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

  } finally {
    await browser.close();
  }
}

inspectMultiSelect().catch(console.error);
