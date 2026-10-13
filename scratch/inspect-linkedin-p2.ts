import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";
import { Page } from "playwright";

async function inspectLinkedInP2() {
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
    await page.waitForTimeout(6000);

    console.log("Navigated to Page 2:", page.url());

    // Inspect all form elements on Page 2
    const elementsInfo = await page.evaluate(() => {
      const results: any[] = [];
      const all = document.querySelectorAll("spl-input, spl-autocomplete, spl-select, spl-radio-group, spl-checkbox, oc-button");
      all.forEach((el, idx) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id || el.getAttribute("id") || "";
        const label = el.getAttribute("label") || el.getAttribute("aria-label") || (el as any).label || "";
        const dataTest = el.getAttribute("data-test") || "";
        const innerText = (el as HTMLElement).innerText ? (el as HTMLElement).innerText.slice(0, 80).replace(/\n/g, " ") : "";
        const shadowInput = el.shadowRoot ? el.shadowRoot.querySelector("input, select, textarea") : null;
        const regularInput = el.querySelector("input, select, textarea");
        const val = shadowInput ? (shadowInput as any).value : regularInput ? (regularInput as any).value : "";
        
        results.push({
          idx,
          tag,
          id,
          label,
          dataTest,
          innerText,
          hasShadow: !!el.shadowRoot,
          inputVal: val
        });
      });
      return results;
    });

    console.log("Found", elementsInfo.length, "elements on Page 2:");
    for (const info of elementsInfo) {
      console.log(`[${info.idx}] <${info.tag}> id="${info.id}" data-test="${info.dataTest}" label="${info.label}" text="${info.innerText}" val="${info.inputVal}"`);
    }

  } finally {
    await browser.close();
  }
}

inspectLinkedInP2().catch(console.error);
