import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function deepInspectGreenhouse() {
  console.log("🔍 Deep inspecting Greenhouse form structure...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Get all form inputs with full context
  const formData = await page.evaluate(() => {
    const results: any[] = [];

    // 1. Basic named inputs
    const namedInputs = document.querySelectorAll("input[id], textarea[id], select[id]");
    namedInputs.forEach(el => {
      const htmlEl = el as HTMLElement;
      const label = document.querySelector(`label[for="${htmlEl.id}"]`);
      results.push({
        type: "named_input",
        tag: htmlEl.tagName,
        id: htmlEl.id,
        inputType: htmlEl.getAttribute("type"),
        role: htmlEl.getAttribute("role"),
        name: htmlEl.getAttribute("name"),
        ariaLabel: htmlEl.getAttribute("aria-label"),
        placeholder: htmlEl.getAttribute("placeholder"),
        labelText: label?.textContent?.trim() || "",
        parentSnippet: htmlEl.closest(".field, .form-group, fieldset, .s-form-field")?.textContent?.trim().slice(0, 100) || ""
      });
    });

    // 2. React-select comboboxes (no id on the actual input sometimes)
    const comboboxes = document.querySelectorAll("input[role='combobox']");
    comboboxes.forEach(el => {
      const htmlEl = el as HTMLElement;
      // Find label
      const container = htmlEl.closest(".select, .field, .form-group, fieldset, [class*='select']");
      const label = container?.querySelector("label");
      const placeholder = container?.querySelector("[class*='placeholder']");
      if (!results.find(r => r.id === htmlEl.id)) {
        results.push({
          type: "combobox",
          tag: "INPUT",
          id: htmlEl.id,
          inputType: "combobox",
          labelId: label?.id || "",
          labelText: label?.textContent?.trim() || "",
          placeholderText: placeholder?.textContent?.trim() || "",
          containerClass: container?.className?.slice(0, 60) || ""
        });
      }
    });

    // 3. Country code (ITI - intl-tel-input) 
    const itiFlag = document.querySelector(".iti__selected-flag, .iti__flag-container, [class*='iti']");
    if (itiFlag) {
      results.push({
        type: "iti_country_code",
        tag: "ITI",
        elementHTML: itiFlag.outerHTML.slice(0, 200)
      });
    }

    // 4. Country/Location select
    const countryEl = document.getElementById("country");
    if (countryEl) {
      results.push({
        type: "country_select",
        tag: countryEl.tagName,
        id: "country",
        inputType: countryEl.getAttribute("type"),
        role: countryEl.getAttribute("role"),
        parentHTML: countryEl.parentElement?.outerHTML?.slice(0, 300) || ""
      });
    }

    // 5. Location/city input
    const locationEl = document.getElementById("candidate-location");
    if (locationEl) {
      results.push({
        type: "location_input",
        id: "candidate-location",
        tag: locationEl.tagName,
        parentHTML: locationEl.parentElement?.outerHTML?.slice(0, 300) || ""
      });
    }

    return results;
  });

  console.log("\n📋 FORM STRUCTURE:\n");
  formData.forEach((item, i) => {
    console.log(`${i + 1}. [${item.type}] <${item.tag}> id="${item.id}"`);
    if (item.labelText) console.log(`   Label: "${item.labelText}"`);
    if (item.placeholderText) console.log(`   Placeholder: "${item.placeholderText}"`);
    if (item.parentSnippet) console.log(`   Context: "${item.parentSnippet.slice(0, 80)}"`);
    if (item.parentHTML) console.log(`   ParentHTML: ${item.parentHTML.slice(0, 150)}`);
    if (item.elementHTML) console.log(`   HTML: ${item.elementHTML}`);
    console.log("---");
  });

  // Also click the first react-select to see its options
  console.log("\n\n🔽 Opening first React-Select to see options...");
  const firstCombobox = page.locator("input[role='combobox']").first();
  if (await firstCombobox.count() > 0) {
    const containerId = await firstCombobox.getAttribute("id");
    console.log(`First combobox id: ${containerId}`);
    
    // Click the control (not the hidden input) to open menu
    const control = page.locator(".select__control").first();
    await control.click({ force: true });
    await page.waitForTimeout(800);

    const options = await page.locator("[role='option'], .select__option").allInnerTexts().catch(() => []);
    console.log("Options visible:", options);
  }

  // Check the phone field structure more carefully
  console.log("\n📞 Phone field structure:");
  const phoneInfo = await page.evaluate(() => {
    const phoneEl = document.getElementById("phone");
    if (!phoneEl) return "NOT FOUND";
    return {
      tag: phoneEl.tagName,
      type: phoneEl.getAttribute("type"),
      parentHTML: phoneEl.parentElement?.outerHTML?.slice(0, 500),
      grandParentHTML: phoneEl.parentElement?.parentElement?.outerHTML?.slice(0, 200)
    };
  });
  console.log("Phone field:", JSON.stringify(phoneInfo, null, 2));

  // Check country field structure
  console.log("\n🌍 Country field structure:");
  const countryInfo = await page.evaluate(() => {
    const countryEl = document.getElementById("country");
    if (!countryEl) return "NOT FOUND";
    return {
      tag: countryEl.tagName,
      type: countryEl.getAttribute("type"),
      role: countryEl.getAttribute("role"),
      className: countryEl.className,
      parentHTML: countryEl.parentElement?.outerHTML?.slice(0, 500),
    };
  });
  console.log("Country field:", JSON.stringify(countryInfo, null, 2));

  await page.waitForTimeout(2000);
  await browser.close();
}

deepInspectGreenhouse().catch(console.error);
