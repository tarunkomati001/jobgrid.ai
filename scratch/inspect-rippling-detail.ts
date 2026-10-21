import { chromium } from "playwright";

async function inspectRipplingDetail() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const url = "https://ats.rippling.com/en-GB/rippling/jobs/94486f41-6474-446a-b67a-c164e11354ea";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("button:has-text('Apply now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  const sections = await page.evaluate(() => {
    // Traverse all form groups / field containers
    const allFormElements = Array.from(document.querySelectorAll("form div, form fieldset, form section, [class*='field'], [class*='Field'], [class*='Form']"));
    
    // Find all labeled blocks
    const results: any[] = [];
    const processedEls = new Set<Element>();

    const inputs = Array.from(document.querySelectorAll("input, textarea, select, [role='combobox'], [role='listbox'], [id^='field-']"));
    for (const inp of inputs) {
      if (processedEls.has(inp)) continue;
      processedEls.add(inp);

      // Find surrounding container text
      let container = inp.parentElement;
      let questionTitle = "";
      let helperText = "";

      for (let i = 0; i < 6 && container; i++) {
        const labels = Array.from(container.querySelectorAll("label, [class*='label'], [class*='title'], [class*='header'], [class*='Question'], h1, h2, h3, h4, h5, p, span"));
        for (const l of labels) {
          if (!l.contains(inp) && l.textContent && l.textContent.trim().length > 1 && l.textContent.trim().length < 200) {
            const text = l.textContent.trim();
            if (!questionTitle && !text.includes("Drop or select")) {
              questionTitle = text;
            }
          }
        }
        if (questionTitle) break;
        container = container.parentElement;
      }

      const tag = inp.tagName.toLowerCase();
      const type = (inp as HTMLInputElement).type || tag;
      const placeholder = (inp as HTMLInputElement).placeholder || "";
      const aria = inp.getAttribute("aria-label") || inp.getAttribute("aria-placeholder") || "";
      const role = inp.getAttribute("role") || "";

      results.push({
        tag,
        type,
        role,
        id: inp.id,
        name: (inp as HTMLInputElement).name || inp.id,
        placeholder,
        aria,
        questionTitle,
        parentHTML: inp.parentElement?.outerHTML.slice(0, 300)
      });
    }
    return results;
  });

  console.log("DETAILED FORM FIELD BREAKDOWN:");
  for (const s of sections) {
    console.log(`\n• Field [${s.tag}/${s.type}] id="${s.id}" name="${s.name}" placeholder="${s.placeholder}" role="${s.role}"`);
    console.log(`  Question/Label: "${s.questionTitle}"`);
    console.log(`  HTML: ${s.parentHTML}`);
  }

  await browser.close();
}

inspectRipplingDetail().catch(console.error);
