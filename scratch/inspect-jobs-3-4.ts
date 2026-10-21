import { chromium } from "playwright";

const URLS = [
  { name: "Job 3", url: "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/345236/?keyword=software+engineer" },
  { name: "Job 4", url: "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/338844/?keyword=software+engineers" }
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  for (const j of URLS) {
    console.log(`\n=== Inspecting ${j.name}: ${j.url} ===`);
    await page.goto(j.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
    if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
      await applyBtn.click();
      await page.waitForTimeout(3000);
    }

    const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
    if (await emailInput.count() > 0) {
      await emailInput.fill(`audit_${Date.now()}@gmail.com`);
      await page.evaluate(() => {
        const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
        if (cb && !cb.checked) {
          const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
          if (l) (l as HTMLElement).click();
          else cb.click();
        }
      });
      await page.waitForTimeout(1000);
      await page.locator("button:has-text('Next')").first().click();
      for (let s = 1; s <= 10; s++) {
        await page.waitForTimeout(1500);
        if (!page.url().includes("/apply/email")) break;
      }
      await page.waitForTimeout(5000);
    }

    console.log(`${j.name} Current URL:`, page.url());

    const fields = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea, button[role='radio'], [role='combobox']"));
      return els.map(el => {
        const inp = el as any;
        let label = "";
        if (inp.id) {
          const l = document.querySelector("label[for='" + inp.id + "']");
          if (l) label = l.textContent?.trim() || "";
        }
        if (!label && inp.labels && inp.labels.length > 0) {
          label = Array.from(inp.labels).map((x: any) => x.textContent?.trim()).join(" ");
        }
        if (!label) {
          const p = inp.closest(".form-block, .field, div, section, p, label");
          if (p) {
            const l = p.querySelector("label, span.label, span.title, p");
            if (l) label = l.textContent?.trim() || "";
          }
        }
        return {
          tag: el.tagName.toLowerCase(),
          id: inp.id || null,
          name: inp.name || null,
          type: inp.type || null,
          role: el.getAttribute("role") || null,
          label: label.replace(/\s+/g, " "),
          ariaLabel: el.getAttribute("aria-label") || null,
          value: inp.value !== undefined ? inp.value : null,
          required: inp.required || el.getAttribute("aria-required") === "true"
        };
      });
    });

    console.log(`${j.name} Found ${fields.length} interactive elements.`);
    console.log(`${j.name} Key Elements:`, JSON.stringify(fields.filter(f => f.label || f.name || f.required), null, 2));
  }

  await browser.close();
}

main().catch(console.error);
