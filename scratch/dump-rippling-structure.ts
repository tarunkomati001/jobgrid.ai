import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function dumpRipplingQuestions() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://ats.rippling.com/clarity-clinic/jobs/6b7a4c6c-6c35-4d56-a90a-80a975b69ea5";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Click Apply
  const applyBtn = page.locator("button:has-text('Apply now'), button:has-text('Apply')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  const structure = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll("div[data-testid='field']"));
    return fields.map((f, i) => {
      // Find all text inside or preceding
      const text = (f.textContent || "").trim().slice(0, 150);
      const inputs = Array.from(f.querySelectorAll("input, select, textarea, [role='combobox'], [role='radio']")).map(inp => ({
        tag: inp.tagName,
        type: (inp as any).type,
        role: inp.getAttribute("role"),
        name: (inp as any).name,
        value: (inp as any).value,
        testId: inp.getAttribute("data-testid"),
        id: inp.id,
        checked: (inp as any).checked
      }));

      // Look at parent / previous siblings
      let heading = "";
      let curr: Element | null = f;
      for (let step = 0; step < 4; step++) {
        if (!curr) break;
        if (curr.previousElementSibling) {
          const h = curr.previousElementSibling.textContent?.trim();
          if (h && h.length > 3) {
            heading = h.slice(0, 100);
            break;
          }
        }
        curr = curr.parentElement;
      }

      return {
        index: i,
        testId: f.getAttribute("data-testid"),
        text,
        heading,
        inputs
      };
    });
  });

  console.log("STRUCTURE:\n", JSON.stringify(structure, null, 2));

  await browser.close();
}

dumpRipplingQuestions().catch(console.error);
