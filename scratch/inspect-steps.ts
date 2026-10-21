import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectSteps() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  const stepDetails = await page.evaluate(() => {
    const stepIds = ["step-01", "step-02", "step-03", "step-04"];
    return stepIds.map(stepId => {
      const stepEl = document.getElementById(stepId);
      if (!stepEl) return { stepId, missing: true };

      const fields = Array.from(stepEl.querySelectorAll("input, select, textarea, button")).map(el => {
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
          placeholder: inp.placeholder || null,
          labelText: labelText.replace(/\s+/g, " "),
          required: inp.required || inp.getAttribute("aria-required") === "true" || !!inp.closest(".required, [class*='required']"),
          options: options.length > 0 ? options : undefined,
          value: inp.value
        };
      });

      return {
        stepId,
        title: stepEl.querySelector(".oracletaleocwsv2-step-title, h1, h2, h3, h4")?.textContent?.trim() || "",
        fieldsCount: fields.length,
        fields
      };
    });
  });

  fs.writeFileSync(path.resolve(__dirname, "taleo_steps_detailed.json"), JSON.stringify(stepDetails, null, 2));
  console.log("Steps extracted successfully!");
  for (const s of stepDetails) {
    console.log(`\n=== Step: ${s.stepId} (${s.title}) - ${s.fieldsCount} elements ===`);
    for (const f of s.fields) {
      if (f.type !== "hidden") {
        console.log(`  [${f.tag}:${f.type}] id='${f.id}' name='${f.name}' label='${f.labelText}' required=${f.required}${f.options ? ` options=(${f.options.length})` : ""}`);
      }
    }
  }

  await browser.close();
}

inspectSteps().catch(console.error);
