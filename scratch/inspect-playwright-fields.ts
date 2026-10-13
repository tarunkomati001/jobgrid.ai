import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectPlaywrightFields() {
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

    console.log("=== INSPECTING SPL-INPUT LOCATORS ===");
    const inputs = page.locator("spl-input");
    const inpCount = await inputs.count();
    for (let i = 0; i < inpCount; i++) {
      const inp = inputs.nth(i);
      const label = await inp.getAttribute("label");
      const id = await inp.getAttribute("id");
      const text = await inp.innerText().catch(() => "");
      const isVisible = await inp.isVisible();
      console.log(`spl-input [${i}]: id="${id}" label="${label}" visible=${isVisible} text="${text.slice(0, 50).replace(/\n/g, ' ')}"`);
    }

    console.log("\n=== INSPECTING SPL-AUTOCOMPLETE LOCATORS ===");
    const autocompletes = page.locator("spl-autocomplete");
    const acCount = await autocompletes.count();
    for (let i = 0; i < acCount; i++) {
      const ac = autocompletes.nth(i);
      const label = await ac.getAttribute("label");
      const id = await ac.getAttribute("id");
      const text = await ac.innerText().catch(() => "");
      console.log(`spl-autocomplete [${i}]: id="${id}" label="${label}" text="${text.slice(0, 50).replace(/\n/g, ' ')}"`);
    }

    console.log("\n=== INSPECTING SPL-CHECKBOX LOCATORS ===");
    const cbs = page.locator("spl-checkbox");
    const cbCount = await cbs.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = cbs.nth(i);
      const id = await cb.getAttribute("id");
      const dataTest = await cb.getAttribute("data-test");
      const text = await cb.innerText().catch(() => "");
      console.log(`spl-checkbox [${i}]: id="${id}" data-test="${dataTest}" text="${text.slice(0, 80).replace(/\n/g, ' ')}"`);
    }

    console.log("\n=== INSPECTING SPL-RADIO-GROUP LOCATORS ===");
    const rgs = page.locator("spl-radio-group");
    const rgCount = await rgs.count();
    for (let i = 0; i < rgCount; i++) {
      const rg = rgs.nth(i);
      const text = await rg.innerText().catch(() => "");
      console.log(`spl-radio-group [${i}]: text="${text.slice(0, 80).replace(/\n/g, ' ')}"`);
    }

  } finally {
    await browser.close();
  }
}

inspectPlaywrightFields().catch(console.error);
