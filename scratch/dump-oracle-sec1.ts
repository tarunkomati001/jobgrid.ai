import { chromium } from "playwright";
import fs from "fs";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1, input[type='email']", "hrutin_oracle_test@gmail.com");

  await page.evaluate(`
    (() => {
      const cb = document.getElementById("legal-disclaimer-checkbox");
      if (cb && !cb.checked) {
        const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label");
        if (label) label.click();
        else cb.click();
      }
    })()
  `);
  await page.waitForTimeout(1000);

  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }

  // Wait 8s for full render
  await page.waitForTimeout(8000);

  // Take screenshots of top and scrolled
  await page.screenshot({ path: "scratch/oracle_fresh_sec1_top.png" });
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/oracle_fresh_sec1_mid.png" });
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/oracle_fresh_sec1_bottom.png" });

  // Dump all visible labels and inputs
  const fieldData = await page.evaluate(`
    (() => {
      const results = [];
      const blocks = Array.from(document.querySelectorAll(".block, .section, .oj-form-layout, div[class*='group'], div[class*='field'], div[class*='section']"));
      const inputs = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox'], [role='listbox']"));
      for (const inp of inputs) {
        const rect = inp.getBoundingClientRect();
        let label = '';
        if (inp.id) {
          const l = document.querySelector("label[for='" + inp.id + "']");
          if (l) label = l.textContent.trim();
        }
        if (!label) {
          const p = inp.closest("div, p, label, section");
          if (p) {
            const l = p.querySelector("label, span.label, span.title");
            if (l) label = l.textContent.trim();
          }
        }
        results.push({
          tag: inp.tagName.toLowerCase(),
          type: inp.type || null,
          id: inp.id || null,
          name: inp.name || null,
          ariaLabel: inp.getAttribute('aria-label') || null,
          label: label.replace(/\\s+/g, ' '),
          value: inp.value || null,
          placeholder: inp.placeholder || null,
          required: inp.required || inp.getAttribute('aria-required') === 'true'
        });
      }
      return results;
    })()
  `);

  fs.writeFileSync("scratch/oracle_fields_dump.json", JSON.stringify(fieldData, null, 2));
  console.log("Dumped " + fieldData.length + " fields to scratch/oracle_fields_dump.json");

  await browser.close();
}

main().catch(console.error);
