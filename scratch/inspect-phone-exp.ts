import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

async function inspectPhoneAndExperience() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow", { waitUntil: "load" });
  await page.waitForTimeout(4000);

  // Check how spl-select inside spl-phone-field behaves
  const phoneSelectInfo = await page.evaluate(`(() => {
    const pf = document.querySelector("spl-phone-field");
    if (!pf) return "NO_PHONE_FIELD";
    const shadow = pf.shadowRoot;
    if (!shadow) return "NO_PF_SHADOW";
    const select = shadow.querySelector("spl-select");
    if (!select) return "NO_SPL_SELECT";
    return {
      selectTag: select.tagName,
      selectValue: (select).value,
      hasSelectShadow: !!select.shadowRoot,
      selectShadowHtml: select.shadowRoot ? select.shadowRoot.innerHTML.slice(0, 500) : "none"
    };
  })()`);
  console.log("Phone select info:", phoneSelectInfo);

  // Let's test clicking the country trigger in spl-phone-field
  console.log("Testing phone country selection...");
  const countryTrigger = page.locator("spl-phone-field spl-select, spl-phone-field [data-test='country-code-select'], spl-phone-field .c-spl-phone-field-selected").first();
  await countryTrigger.click();
  await page.waitForTimeout(1000);

  // Check if dropdown opened
  const openSelectOptions = await page.locator("spl-select-option, [role='option'], .c-spl-phone-field-select-option").allInnerTexts().catch(() => []);
  console.log(`Open select options count: ${openSelectOptions.length}`);
  console.log("First 3 options:", openSelectOptions.slice(0, 3));

  // Try selecting United States (+1)
  const usOption = page.locator("spl-select-option[value='US'], spl-select-option:has-text('United States')").first();
  if (await usOption.count() > 0) {
    await usOption.click();
    console.log("Clicked US option!");
  } else {
    // Evaluate click or set value
    const setRes = await page.evaluate(`(() => {
      const pf = document.querySelector("spl-phone-field");
      const shadow = pf?.shadowRoot;
      const select = shadow?.querySelector("spl-select");
      if (select) {
        select.value = "US";
        select.dispatchEvent(new CustomEvent("spl-change", { detail: { value: "US" }, bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return "SET_US_VIA_EVAL";
      }
      return "SELECT_NOT_FOUND";
    })()`);
    console.log("Evaluate set US result:", setRes);
  }

  // Type phone number
  const phoneInput = page.locator("spl-phone-field input[type='tel'], input[type='tel']").first();
  await phoneInput.click();
  await phoneInput.fill("4155551234");
  await phoneInput.blur();
  await page.waitForTimeout(500);

  // Check Experience section
  console.log("\nTesting Experience + Add button...");
  const expAddBtn = page.locator("oc-experience [data-test='add-experience'] button, oc-experience button:has-text('Add')").first();
  console.log("Experience Add button count:", await expAddBtn.count());
  if (await expAddBtn.count() > 0) {
    await expAddBtn.click();
    await page.waitForTimeout(1500);
    // Inspect what fields appear in Experience dialog / section
    const expFields = await page.evaluate(`(() => {
      const inputs = Array.from(document.querySelectorAll("oc-experience input, oc-experience textarea, spl-modal input, spl-modal textarea, spl-dialog input"));
      return inputs.map(i => ({
        tag: i.tagName,
        id: i.id,
        name: i.getAttribute("name"),
        label: i.getAttribute("label") || i.getAttribute("aria-label"),
        placeholder: (i).placeholder,
        type: (i).type
      }));
    })()`);
    console.log("Experience fields appeared:", expFields);
  }

  const outDir = path.join(__dirname, "../screenshots");
  await page.screenshot({ path: path.join(outDir, `inspect_phone_exp.png`), fullPage: true });

  await browser.close();
}

inspectPhoneAndExperience().catch(console.error);
