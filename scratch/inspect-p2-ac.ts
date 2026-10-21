import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectPage2Autocompletes() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating to LinkedIn...");
  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(8000);

  // Fill Confirm Email
  await page.locator("spl-input#confirm-email-input input").fill("hrutinnammi8@gmail.com");

  // Fix draft experience if open
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
    await page.locator("oc-button[data-test='experience-save'] button").click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Click Next
  const nextBtn = page.locator("oc-button[data-test='footer-next'] button");
  await nextBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await nextBtn.click({ force: true });
  await page.waitForTimeout(6000);

  console.log("Now on Page 2:", page.url());

  // Inspect all autocomplete & select tags on Page 2
  const elements = await page.evaluate(`(() => {
    const list = Array.from(document.querySelectorAll("spl-autocomplete, spl-select"));
    return list.map(el => ({
      tag: el.tagName,
      id: el.id,
      name: el.getAttribute("name"),
      dataTest: el.getAttribute("data-test"),
      formControlName: el.getAttribute("formcontrolname"),
      outer: el.outerHTML.slice(0, 200)
    }));
  })()`);

  console.log("Page 2 autocompletes & selects:", JSON.stringify(elements, null, 2));

  await browser.close();
}

inspectPage2Autocompletes().catch(console.error);
