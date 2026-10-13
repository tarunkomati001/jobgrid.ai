import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function dumpApplyPage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Extract all fields, labels, headings, sections, buttons
  const formAnalysis = await page.evaluate(() => {
    const steps = Array.from(document.querySelectorAll(".wizard-step, .step, [class*='step'], [id*='step']")).map(s => ({
      id: s.id,
      className: s.className,
      text: s.textContent?.trim().slice(0, 100)
    }));

    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, legend, .section-header, [class*='title']")).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim()
    })).filter(h => h.text && h.text.length < 100);

    const elements = Array.from(document.querySelectorAll("input, select, textarea, button")).map(el => {
      const inp = el as any;
      // Get associated label
      let labelText = "";
      if (inp.id) {
        const lbl = document.querySelector(`label[for='${inp.id}']`);
        if (lbl) labelText = lbl.textContent?.trim() || "";
      }
      if (!labelText && inp.labels && inp.labels.length > 0) {
        labelText = Array.from(inp.labels).map((l: any) => l.textContent?.trim()).join(" ");
      }
      if (!labelText) {
        // Look up parent or preceding label / text
        const parent = inp.closest(".form-group, tr, td, div, p");
        if (parent) {
          const lbl = parent.querySelector("label, .control-label, span.label");
          if (lbl) labelText = lbl.textContent?.trim() || "";
        }
      }

      // If select, get options
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
        options: options.length > 0 ? options.slice(0, 20) : undefined,
        isVisible: !!(inp.offsetWidth || inp.offsetHeight || inp.getClientRects().length),
        value: inp.value
      };
    });

    return {
      steps,
      headings,
      elements
    };
  });

  fs.writeFileSync(path.resolve(__dirname, "taleo_form_analysis.json"), JSON.stringify(formAnalysis, null, 2));
  console.log(`Saved form analysis with ${formAnalysis.elements.length} elements.`);
  console.log("Visible form fields:");
  const visible = formAnalysis.elements.filter(e => e.isVisible && e.tag !== "BUTTON" && e.type !== "hidden");
  console.log(JSON.stringify(visible, null, 2));

  // Let's also check buttons
  const buttons = formAnalysis.elements.filter(e => e.tag === "BUTTON" || (e.tag === "INPUT" && (e.type === "submit" || e.type === "button")));
  console.log("Buttons:", JSON.stringify(buttons, null, 2));

  await browser.close();
}

dumpApplyPage().catch(console.error);
