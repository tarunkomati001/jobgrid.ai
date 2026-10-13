import { chromium } from "playwright";
import { applyStealthScripts, createBrowser } from "../src/browser/browser-manager";

async function inspectGreenhouseForm() {
  console.log("🔍 Launching browser to inspect Greenhouse DOM structure...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  console.log(`🌐 Navigating to: ${url}`);
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2000);

  // Inspect form inputs
  const inputsInfo = await page.evaluate(() => {
    const inputs = document.querySelectorAll("input, select, textarea, [role='combobox'], [class*='select']");
    return Array.from(inputs).map(el => {
      const htmlEl = el as HTMLElement;
      return {
        tag: htmlEl.tagName,
        id: htmlEl.id,
        name: htmlEl.getAttribute("name"),
        type: htmlEl.getAttribute("type"),
        role: htmlEl.getAttribute("role"),
        class: htmlEl.className,
        placeholder: htmlEl.getAttribute("placeholder"),
        ariaLabel: htmlEl.getAttribute("aria-label"),
        parentText: htmlEl.parentElement?.parentElement?.innerText?.slice(0, 80)
      };
    });
  });

  console.log(`\n📋 Found ${inputsInfo.length} input elements on page:\n`);
  inputsInfo.forEach((inp, idx) => {
    console.log(`${idx + 1}. <${inp.tag}> id="${inp.id}" name="${inp.name}" type="${inp.type}" role="${inp.role}" class="${inp.class}"`);
    console.log(`   Parent snippet: ${JSON.stringify(inp.parentText)}`);
    console.log("--------------------------------------------------------------------------------");
  });

  await browser.close();
}

inspectGreenhouseForm().catch(console.error);
