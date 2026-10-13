import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  console.log("Apply button visible?", await applyBtn.isVisible());

  await applyBtn.click();
  console.log("Clicked Apply Now, waiting for changes/navigation...");
  await page.waitForTimeout(6000);

  console.log("New URL:", page.url());
  console.log("New Title:", await page.title());

  await page.screenshot({ path: "scratch/oracle_after_apply.png", fullPage: true });

  // Dump inputs/forms
  const formDetails = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input, select, textarea, button"));
    return inputs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const lbl = document.querySelector(`label[for='${inp.id}']`);
        if (lbl) label = lbl.textContent?.trim() || "";
      }
      if (!label && inp.labels && inp.labels.length > 0) {
        label = Array.from(inp.labels).map((l: any) => l.textContent?.trim()).join(" ");
      }
      if (!label) {
        const parent = inp.closest("div, p, label, section, [class*='field'], [class*='form']");
        if (parent) {
          const l = parent.querySelector("label, span.label, span.title, [class*='label']");
          if (l) label = l.textContent?.trim() || "";
        }
      }
      return {
        tag: inp.tagName,
        type: inp.type || null,
        name: inp.name || null,
        id: inp.id || null,
        placeholder: inp.placeholder || null,
        ariaLabel: inp.getAttribute("aria-label"),
        label: label.replace(/\s+/g, " "),
        text: inp.tagName === "BUTTON" ? inp.textContent?.trim() : undefined,
        required: inp.required || inp.getAttribute("aria-required") === "true"
      };
    });
  });

  console.log("Inputs found:", JSON.stringify(formDetails, null, 2));

  await browser.close();
}

main().catch(console.error);
