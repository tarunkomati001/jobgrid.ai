import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URLS = [
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4790",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4744"
];

async function inspectAll3() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const results: any[] = [];

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\nNavigating to Job ${i + 1}: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2000);

    const title = await page.title();
    const jobTitle = await page.locator("h1, h2, .oracletaleocwsv2-requisition-title, .title").allInnerTexts();

    // Extract all fields in step-02 and step-03
    const fields = await page.evaluate(() => {
      const step2 = document.getElementById("step-02");
      const step3 = document.getElementById("step-03");
      const step4 = document.getElementById("step-04");

      function getFields(container: HTMLElement | null) {
        if (!container) return [];
        return Array.from(container.querySelectorAll("input, select, textarea")).map(el => {
          const inp = el as any;
          let labelText = "";
          if (inp.id) {
            const lbl = document.querySelector(`label[for='${inp.id}']`);
            if (lbl) labelText = lbl.textContent?.trim() || "";
          }
          if (!labelText && inp.labels && inp.labels.length > 0) {
            labelText = Array.from(inp.labels).map((l: any) => l.textContent?.trim()).join(" ");
          }
          if (!labelText) {
            const parent = inp.closest(".form-group, tr, td, div, p");
            if (parent) {
              const lbl = parent.querySelector("label, .control-label, span.label, th");
              if (lbl) labelText = lbl.textContent?.trim() || "";
            }
          }

          let options: any[] = [];
          if (inp.tagName === "SELECT") {
            options = Array.from((inp as HTMLSelectElement).options).map(o => ({
              text: o.text.trim(),
              value: o.value
            }));
          }

          return {
            tag: inp.tagName,
            type: inp.type || null,
            id: inp.id || null,
            name: inp.name || null,
            labelText: labelText.replace(/\s+/g, " "),
            required: inp.required || inp.getAttribute("aria-required") === "true" || !!inp.closest(".required, [class*='required']"),
            options: options.length > 0 ? options : undefined
          };
        });
      }

      return {
        step2: getFields(step2),
        step3: getFields(step3),
        step4: getFields(step4)
      };
    });

    results.push({
      url,
      title,
      jobTitle,
      fields
    });
  }

  fs.writeFileSync(path.resolve(__dirname, "taleo_3jobs_comparison.json"), JSON.stringify(results, null, 2));
  console.log("Comparison complete! Saved to taleo_3jobs_comparison.json");

  // Print comparison
  for (let i = 0; i < results.length; i++) {
    console.log(`\n================ Job ${i+1}: ${results[i].url} ================`);
    console.log("Step 2 fields:", results[i].fields.step2.map((f: any) => `${f.name || f.id} (${f.labelText}) [required=${f.required}]`).join(", "));
    console.log("Step 3 fields:", results[i].fields.step3.map((f: any) => `${f.name || f.id} (${f.labelText}) [required=${f.required}]`).join(", "));
  }

  await browser.close();
}

inspectAll3().catch(console.error);
