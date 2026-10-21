import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function dumpPage2Tags() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

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

  // Dump all tag names
  const tags = await page.evaluate(`(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const custom = new Set(all.map(el => el.tagName.toLowerCase()).filter(t => t.includes("-")));
    return Array.from(custom);
  })()`);

  console.log("Custom tags on Page 2:", tags);

  // Let's also find all input and button and select elements on Page 2
  const formElements = await page.evaluate(`(() => {
    const all = Array.from(document.querySelectorAll("input, select, textarea, button"));
    return all.map(el => ({
      tag: el.tagName,
      type: el.type,
      id: el.id,
      name: el.name,
      ariaLabel: el.getAttribute("aria-label"),
      placeholder: el.getAttribute("placeholder")
    }));
  })()`);

  console.log("Form elements on Page 2:", JSON.stringify(formElements, null, 2));

  await browser.close();
}

dumpPage2Tags().catch(console.error);
