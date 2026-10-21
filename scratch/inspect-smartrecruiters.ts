import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import * as fs from "fs";
import * as path from "path";

const URLS = [
  "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3",
  "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow"
];

async function inspectSmartRecruiters() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`\n======================================================`);
    console.log(`Analyzing [${i + 1}/${URLS.length}]: ${url}`);
    console.log(`======================================================`);

    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      console.log(`Response status: ${resp?.status()}`);
      await page.waitForTimeout(5000); // allow hydration & client-side rendering

      const finalUrl = page.url();
      const title = await page.title();
      console.log(`Final URL: ${finalUrl}`);
      console.log(`Title: ${title}`);

      // Check iframes
      const frames = page.frames();
      console.log(`Frames count: ${frames.length}`);
      frames.forEach((f, idx) => console.log(`  Frame ${idx}: ${f.url()}`));

      // Check elements on page
      const inputs = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll("input, select, textarea, button, [role='combobox'], [role='listbox'], [data-test], [data-automation-id]"));
        return els.map(el => {
          const tag = el.tagName.toLowerCase();
          const type = (el as HTMLInputElement).type || "";
          const id = el.id || "";
          const name = (el as HTMLInputElement).name || "";
          const placeholder = (el as HTMLInputElement).placeholder || "";
          const ariaLabel = el.getAttribute("aria-label") || "";
          const dataTest = el.getAttribute("data-test") || el.getAttribute("data-automation-id") || "";
          const role = el.getAttribute("role") || "";
          const text = el.textContent?.trim().slice(0, 50) || "";
          const labelEl = id ? document.querySelector(`label[for="${id}"]`) : null;
          const labelText = labelEl?.textContent?.trim() || el.closest("label")?.textContent?.trim() || "";
          const isVisible = (el as HTMLElement).offsetParent !== null;

          return { tag, type, id, name, placeholder, ariaLabel, dataTest, role, text, labelText, isVisible };
        });
      });

      console.log(`Total interactive elements found: ${inputs.length}`);
      const visibleInputs = inputs.filter(x => x.isVisible && ["input", "select", "textarea", "button"].includes(x.tag));
      console.log(`Visible inputs/buttons (${visibleInputs.length}):`);
      visibleInputs.forEach(inp => {
        console.log(`  [${inp.tag}:${inp.type}] id="${inp.id}" name="${inp.name}" test="${inp.dataTest}" label="${inp.labelText}" placeholder="${inp.placeholder}" aria="${inp.ariaLabel}" text="${inp.text}"`);
      });

      // Take a screenshot
      const outDir = path.join(__dirname, "../screenshots");
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const shotPath = path.join(outDir, `sr_inspect_${i + 1}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
      console.log(`Screenshot saved to ${shotPath}`);

      // Dump page text / headings
      const headings = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("h1, h2, h3, h4, .job-title, .company-name, [class*='title'], [class*='header']"))
          .map(h => `${h.tagName}: ${h.textContent?.trim()}`)
          .filter(t => t.length > 3 && t.length < 150)
          .slice(0, 15);
      });
      console.log("Headings / Key headers:", headings);

      // Save HTML snippet
      const html = await page.content();
      fs.writeFileSync(path.join(outDir, `sr_inspect_${i + 1}.html`), html);

    } catch (e: any) {
      console.error(`Error loading ${url}:`, e.message);
    }
  }

  await browser.close();
}

inspectSmartRecruiters().catch(console.error);
