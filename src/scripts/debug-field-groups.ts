import { chromium } from "playwright";

async function main() {
  const url = "https://jobs.ashbyhq.com/notion/05e14247-17c4-4e98-9a13-53828a4e2f13/application";
  console.log("🔍 Detailed DOM structural inspection...");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    // Look at form groups or inputs
    const inputs = await page.$$("input, textarea, select, [role='combobox'], [role='radio'], [role='checkbox']");
    console.log(`Found ${inputs.length} interactive elements.`);

    for (const input of inputs) {
      const tagName = await input.evaluate(el => el.tagName.toLowerCase());
      const type = await input.getAttribute("type");
      const id = await input.getAttribute("id");
      const name = await input.getAttribute("name");
      const role = await input.getAttribute("role");
      const placeholder = await input.getAttribute("placeholder");

      // Find closest label or text
      const associatedLabel = await input.evaluate(el => {
        // 1. Check for label pointing to id
        if (el.id) {
          const lbl = document.querySelector(`label[for="${el.id}"]`);
          if (lbl) return lbl.textContent?.trim();
        }
        // 2. Check for ancestor label
        const parentLabel = el.closest("label");
        if (parentLabel) return parentLabel.textContent?.trim();
        
        // 3. Search parent containers for text
        let parent = el.parentElement;
        while (parent) {
          const lbl = parent.querySelector("label");
          if (lbl) return lbl.textContent?.trim();
          parent = parent.parentElement;
        }
        return null;
      });

      console.log(`Element: <${tagName} type="${type || ''}" id="${id || ''}" name="${name || ''}" role="${role || ''}" placeholder="${placeholder || ''}">`);
      console.log(`  -> Associated Label Text: "${associatedLabel || 'None'}"`);
    }
  } catch (error) {
    console.error("DOM inspection failed:", error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
