import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectWorkableLabels() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://apply.workable.com/rokt/j/8C792C8AC9/apply/";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const results: any[] = [];

    // 1. Radio groups
    const fieldsets = Array.from(document.querySelectorAll("fieldset[role='radiogroup']"));
    fieldsets.forEach((fs, i) => {
      const ariaLabelledby = fs.getAttribute("aria-labelledby");
      const labelEl = ariaLabelledby ? document.getElementById(ariaLabelledby) : null;
      const legend = fs.querySelector("legend");
      const options = Array.from(fs.querySelectorAll("[role='radio'], [data-ui='option']")).map(o => ({
        text: o.textContent?.trim(),
        value: (o.querySelector("input") as any)?.value
      }));

      results.push({
        type: "radiogroup",
        dataUi: fs.getAttribute("data-ui"),
        ariaLabelledby,
        labelTextFromId: labelEl?.textContent?.trim(),
        legendText: legend?.textContent?.trim(),
        options
      });
    });

    // 2. Custom text/textarea fields
    const customInputs = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']):not(#firstname):not(#lastname):not(#email):not(#address):not([name='phone']), textarea:not(#cover_letter)"));
    customInputs.forEach((inp: any) => {
      const id = inp.id;
      const ariaLabelledby = inp.getAttribute("aria-labelledby");
      const lblFor = id ? document.querySelector(`label[for='${id}']`) : null;
      const lblId = ariaLabelledby ? document.getElementById(ariaLabelledby) : null;
      
      // Also check closest parent field container
      const container = inp.closest("div[data-ui], section, fieldset") || inp.parentElement?.parentElement;
      const containerLabel = container?.querySelector("label, [id$='_label']");

      results.push({
        type: inp.tagName.toLowerCase(),
        id,
        name: inp.name,
        dataUi: inp.getAttribute("data-ui"),
        labelTextFromFor: lblFor?.textContent?.trim(),
        labelTextFromAria: lblId?.textContent?.trim(),
        labelTextFromContainer: containerLabel?.textContent?.trim()
      });
    });

    return results;
  });

  console.log("ACCURATE LABELS:\n", JSON.stringify(res, null, 2));
  await browser.close();
}

inspectWorkableLabels().catch(console.error);
