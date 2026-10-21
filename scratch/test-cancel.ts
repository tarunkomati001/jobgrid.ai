import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function inspectCancelAndDraft() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  const realResumePath = path.resolve(__dirname, "../resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await page.locator("input[type='file']").first().setInputFiles(realResumePath);
  await page.waitForTimeout(7000);

  const debug = await page.evaluate(`(() => {
    // Find all buttons inside oc-experience
    const exp = document.querySelector("oc-experience");
    if (!exp) return { error: "no oc-experience" };

    const buttons = [];
    const walk = (el) => {
      if (!el) return;
      if (el.tagName === "BUTTON" || el.tagName === "SPL-BUTTON" || el.tagName === "OC-BUTTON") {
        buttons.push({
          tag: el.tagName,
          text: el.innerText || el.textContent,
          html: el.outerHTML ? el.outerHTML.slice(0, 200) : "",
          attributes: Array.from(el.attributes || []).map(a => a.name + "=" + a.value),
          shadowButtonHtml: el.shadowRoot ? el.shadowRoot.innerHTML.slice(0, 200) : null
        });
      }
      if (el.shadowRoot) walk(el.shadowRoot);
      for (const child of el.children || []) walk(child);
    };
    walk(exp);

    // Also look for checkbox
    const checkboxes = [];
    const findInputs = (el) => {
      if (!el) return;
      if (el.tagName === "INPUT" || el.tagName === "SPL-CHECKBOX") {
        checkboxes.push({
          tag: el.tagName,
          type: el.type,
          outer: el.outerHTML ? el.outerHTML.slice(0, 200) : ""
        });
      }
      if (el.shadowRoot) findInputs(el.shadowRoot);
      for (const child of el.children || []) findInputs(child);
    };
    findInputs(exp);

    return { buttons, checkboxes };
  })()`);

  console.log("DEBUG EXP BUTTONS & INPUTS:", JSON.stringify(debug, null, 2));

  // Now let's try clicking the Cancel button using Playwright's locator by text!
  console.log("Trying Playwright locator: text='Cancel' or button:has-text('Cancel')...");
  const cancelLocator = page.locator("oc-experience").locator("text=Cancel");
  console.log("Cancel count:", await cancelLocator.count());
  if (await cancelLocator.count() > 0) {
    console.log("Clicking cancel locator...");
    await cancelLocator.first().click();
    await page.waitForTimeout(2000);
  }

  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, "cancel_test_after_click.png"), fullPage: true });

  await browser.close();
}

inspectCancelAndDraft().catch(console.error);
