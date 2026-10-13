import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import fs from "fs";
import path from "path";

const URLS = [
  "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply",
  "https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply"
];

async function inspectLever() {
  const browser = await createBrowser(true); // run headless for quick inspection
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  for (const url of URLS) {
    console.log(`\n======================================================`);
    console.log(`Analyzing: ${url}`);
    console.log(`======================================================\n`);

    try {
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      console.log(`Waiting 3 seconds for client render...`);
      await page.waitForTimeout(3000);

      const title = await page.title();
      console.log(`Page title: ${title}`);

      // Extract all form fields and structure
      const formInfo = await page.evaluate(() => {
        const results: any = {
          forms: [],
          inputs: [],
          customQuestions: [],
          dropdowns: [],
          cards: []
        };

        // 1. Basic inputs
        const allInputs = Array.from(document.querySelectorAll("input, textarea, select"));
        results.inputs = allInputs.map(el => {
          const input = el as HTMLInputElement;
          // find label or parent label
          let labelText = "";
          if (input.id) {
            const lbl = document.querySelector(`label[for="${input.id}"]`);
            if (lbl) labelText = lbl.textContent?.trim() || "";
          }
          if (!labelText) {
            const parentLabel = input.closest("label");
            if (parentLabel) labelText = parentLabel.textContent?.trim() || "";
          }
          if (!labelText) {
            const parentDiv = input.closest(".application-question, .form-group, .field, [class*='question'], [class*='field']");
            if (parentDiv) {
              const lbl = parentDiv.querySelector("label, .text, .label, [class*='label']");
              if (lbl) labelText = lbl.textContent?.trim() || "";
            }
          }

          return {
            tagName: el.tagName.toLowerCase(),
            type: input.type || "",
            name: input.name || "",
            id: input.id || "",
            placeholder: input.placeholder || "",
            required: input.required || input.getAttribute("aria-required") === "true",
            label: labelText,
            className: input.className || ""
          };
        });

        // 2. Custom Lever application questions
        const appQuestions = Array.from(document.querySelectorAll(".application-question, [class*='application-question']"));
        results.customQuestions = appQuestions.map(q => {
          const labelEl = q.querySelector(".application-label, label, [class*='label']");
          const label = labelEl ? labelEl.textContent?.trim() : "";
          const required = !!q.querySelector(".required, [class*='required']");
          
          // Check inputs inside
          const inputs = Array.from(q.querySelectorAll("input, select, textarea")).map(inp => {
            const i = inp as HTMLInputElement;
            return {
              type: i.type || inp.tagName.toLowerCase(),
              name: i.name,
              id: i.id,
              value: i.value,
              options: inp.tagName.toLowerCase() === "select" 
                ? Array.from((inp as HTMLSelectElement).options).map(o => ({ text: o.text.trim(), val: o.value }))
                : []
            };
          });

          // Check custom dropdowns or select2 / custom dropdown containers
          const customDropdowns = Array.from(q.querySelectorAll("[class*='dropdown'], [class*='select'], [role='combobox'], [role='listbox']")).map(cd => ({
            tag: cd.tagName,
            class: cd.className,
            role: cd.getAttribute("role")
          }));

          return {
            label,
            required,
            inputs,
            customDropdowns,
            htmlSnippet: q.outerHTML.slice(0, 300)
          };
        });

        // 3. Dropdown inspection specifically (native selects or custom select wrappers)
        const selects = Array.from(document.querySelectorAll("select"));
        results.dropdowns = selects.map(s => ({
          name: s.name,
          id: s.id,
          optionsCount: s.options.length,
          sampleOptions: Array.from(s.options).slice(0, 10).map(o => ({ text: o.text.trim(), val: o.value }))
        }));

        return results;
      });

      console.log(`Found ${formInfo.inputs.length} inputs, ${formInfo.customQuestions.length} custom questions, ${formInfo.dropdowns.length} native selects`);
      
      const outPath = path.join(__dirname, `lever-inspect-${url.includes("sonatype") ? "sonatype" : "moonpay"}.json`);
      fs.writeFileSync(outPath, JSON.stringify(formInfo, null, 2));
      console.log(`Saved detailed DOM analysis to ${outPath}`);

    } catch (err: any) {
      console.error(`Error inspecting ${url}:`, err.message);
    }
  }

  await browser.close();
}

inspectLever().catch(console.error);
