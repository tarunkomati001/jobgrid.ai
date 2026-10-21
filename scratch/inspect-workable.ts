import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import fs from "fs";
import path from "path";

const URLS = [
  "https://apply.workable.com/rokt/j/7219AFDA7F/apply/",
  "https://apply.workable.com/rokt/j/8C792C8AC9/apply/",
  "https://apply.workable.com/rokt/j/33E0F9B588/apply/"
];

async function inspectWorkable() {
  const browser = await createBrowser(true);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const allData: any[] = [];

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\n======================================================`);
    console.log(`Analyzing [${i+1}/${URLS.length}]: ${url}`);
    console.log(`======================================================\n`);

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(3000);

      const title = await page.title();
      console.log(`Page title: ${title}`);

      // Handle cookie banners if any
      try {
        const cookieBtn = page.locator("button:has-text('Accept'), button:has-text('Allow all'), #onetrust-accept-btn-handler, [data-ui='cookie-consent-accept']").first();
        if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
          console.log("Accepting cookies...");
          await cookieBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {}

      // Take a screenshot
      const shotPath = path.resolve(__dirname, `workable_job_${i+1}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      console.log(`Saved screenshot to ${shotPath}`);

      // Extract comprehensive DOM and form details
      const formInfo = await page.evaluate(() => {
        // Find form containers
        const forms = Array.from(document.querySelectorAll("form")).map(f => ({
          id: f.id,
          name: f.name,
          action: f.action,
          className: f.className,
          dataAttrs: Object.fromEntries(Object.entries(f.dataset))
        }));

        // Find all interactive input elements
        const elements = Array.from(document.querySelectorAll("input, textarea, select, [role='radiogroup'], [role='radio'], [role='combobox'], [data-ui]"));

        const fieldDetails = elements.map(el => {
          const input = el as HTMLInputElement;
          const tagName = el.tagName.toLowerCase();
          const type = input.type || el.getAttribute("role") || "";
          const name = input.name || el.getAttribute("name") || "";
          const id = el.id || "";
          const placeholder = input.placeholder || el.getAttribute("placeholder") || "";
          const required = input.required || el.getAttribute("aria-required") === "true" || el.getAttribute("required") !== null;
          const ariaLabel = el.getAttribute("aria-label") || "";
          const dataUi = el.getAttribute("data-ui") || "";
          const role = el.getAttribute("role") || "";

          // find label text
          let labelText = "";
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) labelText = lbl.textContent?.trim() || "";
          }
          if (!labelText) {
            const parentLabel = el.closest("label");
            if (parentLabel) {
              const clone = parentLabel.cloneNode(true) as HTMLElement;
              clone.querySelectorAll("input, textarea, select").forEach(n => n.remove());
              labelText = clone.textContent?.trim() || "";
            }
          }
          if (!labelText) {
            const container = el.closest("[data-ui*='field'], [data-ui*='form-field'], [data-ui*='question'], [class*='field'], [class*='question'], [class*='form-group'], [class*='FormSection'], section, div");
            if (container) {
              const lbl = container.querySelector("label, [data-ui*='label'], [class*='label'], h3, h4, legend, [class*='title']");
              if (lbl && lbl !== el) labelText = lbl.textContent?.trim() || "";
            }
          }

          let options: any[] = [];
          if (tagName === "select") {
            options = Array.from((el as HTMLSelectElement).options).map(o => ({ text: o.text.trim(), value: o.value }));
          }

          return {
            tagName,
            type,
            name,
            id,
            placeholder,
            required,
            ariaLabel,
            dataUi,
            role,
            labelText,
            options: options.slice(0, 10),
            className: el.className
          };
        });

        // Submit button
        const submitButtons = Array.from(document.querySelectorAll("button")).filter(b => {
          const text = b.textContent?.trim().toLowerCase() || "";
          return text.includes("submit") || text.includes("apply") || (b.getAttribute("data-ui") || "").includes("submit");
        }).map(b => ({
          text: b.textContent?.trim(),
          type: (b as HTMLButtonElement).type,
          dataUi: b.getAttribute("data-ui") || "",
          id: b.id,
          className: b.className
        }));

        // File upload sections
        const fileUploads = Array.from(document.querySelectorAll("input[type='file'], [data-ui*='upload'], [data-ui*='resume'], [data-ui*='file']")).map(u => ({
          tagName: u.tagName.toLowerCase(),
          type: (u as HTMLInputElement).type,
          id: u.id,
          name: (u as HTMLInputElement).name,
          dataUi: u.getAttribute("data-ui") || "",
          accept: (u as HTMLInputElement).accept || ""
        }));

        // Radios and buttons groups (e.g. Yes/No questions)
        const radioGroups = Array.from(document.querySelectorAll("[role='radiogroup'], [data-ui*='radio-group'], [class*='radioGroup']")).map(rg => {
          const label = rg.closest("div, section")?.querySelector("label, [data-ui*='label'], h3, h4, legend")?.textContent?.trim() || "";
          const options = Array.from(rg.querySelectorAll("input[type='radio'], button, [role='radio'], label")).map(opt => ({
            text: opt.textContent?.trim() || "",
            value: (opt as HTMLInputElement).value || opt.getAttribute("value") || opt.getAttribute("data-value") || "",
            role: opt.getAttribute("role") || "",
            dataUi: opt.getAttribute("data-ui") || ""
          }));
          return {
            label,
            options
          };
        });

        return {
          forms,
          fieldDetails: fieldDetails.filter(f => f.dataUi || f.name || f.id || f.labelText),
          radioGroups,
          submitButtons,
          fileUploads
        };
      });

      console.log(`Extracted ${formInfo.fieldDetails.length} fields, ${formInfo.fileUploads.length} uploads, ${formInfo.submitButtons.length} submit buttons`);
      allData.push({
        url,
        title,
        ...formInfo
      });

    } catch (err: any) {
      console.error(`Error inspecting ${url}:`, err.message);
    }
  }

  const outPath = path.resolve(__dirname, "workable-inspection.json");
  fs.writeFileSync(outPath, JSON.stringify(allData, null, 2));
  console.log(`\nWritten inspection data to ${outPath}`);

  await browser.close();
}

inspectWorkable().catch(console.error);
