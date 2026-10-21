import { chromium } from "playwright";

async function dumpRipplingFields() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of [
    "https://ats.rippling.com/en-GB/rippling/jobs/94486f41-6474-446a-b67a-c164e11354ea",
    "https://ats.rippling.com/en-GB/rippling/jobs/1584be38-83a9-41a8-94e8-f733332ace4e"
  ]) {
    console.log("\n=================================================================");
    console.log("Analyzing Rippling Job:", url);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const applyBtn = page.locator("button:has-text('Apply now')").first();
    if (await applyBtn.count() > 0) {
      await applyBtn.click();
      await page.waitForTimeout(2000);
    }

    const fields = await page.evaluate(() => {
      const fieldDivs = Array.from(document.querySelectorAll("div[data-testid='field']"));
      return fieldDivs.map((div, i) => {
        const labelEl = div.querySelector("span[id$='-label'], [class*='eun831x3'], label, h4, h5");
        const label = (labelEl?.textContent || "").trim();
        const isRequired = !!div.querySelector("[class*='eun831x2'], [aria-required='true']") || label.includes("*");
        const input = div.querySelector("input:not([type='hidden']), textarea, select, [role='combobox'], [role='radiogroup']");
        
        // Also check if there are sub-labels or descriptions
        const tipEl = div.querySelector("[id*='tip'], [id*='description'], p");
        const tip = (tipEl?.textContent || "").trim().slice(0, 100);

        return {
          index: i,
          label,
          tip,
          isRequired,
          inputTag: input?.tagName,
          inputType: (input as HTMLInputElement)?.type || input?.getAttribute("role"),
          inputId: input?.id,
          inputName: (input as HTMLInputElement)?.name,
          placeholder: (input as HTMLInputElement)?.placeholder || input?.getAttribute("aria-label"),
          testid: input?.getAttribute("data-testid") || div.querySelector("[data-testid]")?.getAttribute("data-testid")
        };
      });
    });

    console.log(`Found ${fields.length} data-testid='field' blocks:`);
    for (const f of fields) {
      console.log(`[#${f.index}] "${f.label}" (req=${f.isRequired}) -> <${f.inputTag} type=${f.inputType} id=${f.inputId} name=${f.inputName} placeholder="${f.placeholder}" testid="${f.testid}"> tip="${f.tip}"`);
    }
  }

  await browser.close();
}

dumpRipplingFields().catch(console.error);
