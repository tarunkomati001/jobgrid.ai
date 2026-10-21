import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("button:has-text('Apply now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  const customQs = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll("div[data-testid='field']"));
    const results: any[] = [];
    fields.forEach(f => {
      const inputs = Array.from(f.querySelectorAll("input, textarea, div[role='combobox']"));
      const isCustom = inputs.some(i => i.getAttribute("name")?.includes("customQuestions") || i.getAttribute("data-testid")?.includes("customQuestions"));
      if (isCustom) {
        let label = f.querySelector("label, span[id$='-label'], [class*='label']")?.textContent || "";
        if (!label) {
          let p = f.parentElement;
          while (p && p.tagName !== "FORM" && p.tagName !== "BODY") {
            if (p.previousElementSibling) {
              const prev = p.previousElementSibling.querySelector("p, h4, h5, label")?.textContent;
              if (prev && prev.trim().length > 3) {
                label = prev.trim();
                break;
              }
            }
            p = p.parentElement;
          }
        }
        results.push({
          label: label.replace(/\s+/g, " "),
          inputs: inputs.map(i => ({
            type: (i as HTMLInputElement).type,
            name: (i as HTMLInputElement).name,
            testId: i.getAttribute("data-testid"),
            placeholder: (i as HTMLInputElement).placeholder,
            value: (i as HTMLInputElement).value
          })),
          text: f.textContent?.replace(/\s+/g, " ").slice(0, 200)
        });
      }
    });
    return results;
  });

  console.log("Custom Questions found:", JSON.stringify(customQs, null, 2));
  await browser.close();
}

main().catch(console.error);
