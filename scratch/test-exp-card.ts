import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as path from "path";

async function testExp() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // Click Add Experience
  await page.locator("oc-experience [data-test='add-experience'] button, oc-experience button:has-text('Add')").first().click();
  await page.waitForTimeout(1000);

  // Check how title autocomplete works
  console.log("Typing Title...");
  const titleAc = page.locator("[data-test='job-title-autocomplete'] input").first();
  await titleAc.click();
  await page.keyboard.type("Software Engineer", { delay: 100 });
  await page.waitForTimeout(1500);

  // Check options
  const options = await page.locator("[role='listbox'] [role='option'], .c-spl-autocomplete-item").allInnerTexts().catch(() => []);
  console.log("Title options found:", options.slice(0, 5));
  if (options.length > 0) {
    await page.locator("[role='listbox'] [role='option'], .c-spl-autocomplete-item").first().click();
    console.log("Clicked first title option");
  }

  // Company
  console.log("Typing Company...");
  const compAc = page.locator("[data-test='company-autocomplete'] input").first();
  await compAc.click();
  await page.keyboard.type("Google", { delay: 100 });
  await page.waitForTimeout(1500);
  const compOpts = await page.locator("[role='listbox'] [role='option'], .c-spl-autocomplete-item").allInnerTexts().catch(() => []);
  console.log("Company options found:", compOpts.slice(0, 5));
  if (compOpts.length > 0) {
    await page.locator("[role='listbox'] [role='option'], .c-spl-autocomplete-item").first().click();
    console.log("Clicked first comp option");
  }

  // From Date
  console.log("Setting From Date...");
  await page.evaluate(`(() => {
    const df = document.querySelector("spl-date-field[id*='exp-from']");
    if (df) {
      const inp = df.shadowRoot?.querySelector("input");
      if (inp) {
        inp.focus();
        inp.value = "2022-01";
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
        inp.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    }
  })()`);

  // Current work checkbox
  console.log("Clicking 'I currently work here'...");
  await page.evaluate(`(() => {
    const cb = document.querySelector("oc-checkbox[formcontrolname='current'] spl-checkbox, [data-test='experience-current'] spl-checkbox");
    if (cb) {
      const innerInput = cb.shadowRoot?.querySelector("input");
      if (innerInput) {
        innerInput.click();
      } else {
        cb.click();
      }
    }
  })()`);

  await page.waitForTimeout(1000);

  // Click Save
  console.log("Clicking Save...");
  await page.locator("oc-button[data-test='experience-save'] button, [data-test='experience-save'] button").first().click();
  await page.waitForTimeout(2000);

  // Screenshot
  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, "test_exp_saved.png"), fullPage: true });

  // Check if experience was saved (edit form closed and entry summary displayed)
  const entryText = await page.locator("oc-experience-entry, [data-test='experience-entry']").innerText().catch(() => "");
  console.log("Experience entry text after Save:\n", entryText.trim());

  await browser.close();
}

testExp().catch(console.error);
