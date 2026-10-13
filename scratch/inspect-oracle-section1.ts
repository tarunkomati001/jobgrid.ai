import { chromium } from "playwright";
import fs from "fs";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Fill email
  await page.fill("input#primary-email-1, input[type='email']", "babufakemail@gmail.com");

  // Check terms
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

  // Click Next
  await page.locator("button:has-text('Next')").first().click();

  // Wait for SPA URL change
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    const currUrl = page.url();
    console.log(`[${s * 1.5}s] URL: ${currUrl}`);
    if (!currUrl.includes("/apply/email")) {
      console.log("Navigated away from /apply/email!");
      break;
    }
  }

  // Give section 1 time to render completely
  await page.waitForTimeout(6000);

  // Save HTML
  const html = await page.content();
  fs.writeFileSync("scratch/oracle_section1.html", html);
  console.log("Saved scratch/oracle_section1.html");

  // Take full page screenshot
  await page.screenshot({ path: "scratch/oracle_section1_fullpage.png", fullPage: true });

  // Analyze all interactive and text elements in section 1
  const report = await page.evaluate(`
    (() => {
      const fields = [];
      const nodes = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox'], [role='listbox'], [role='textbox'], button, [data-bind]"));
      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fields.push({
            tag: node.tagName.toLowerCase(),
            type: node.type || null,
            id: node.id || null,
            name: node.name || null,
            role: node.getAttribute('role') || null,
            ariaLabel: node.getAttribute('aria-label') || null,
            placeholder: node.placeholder || null,
            text: (node.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60),
            dataBind: (node.getAttribute('data-bind') || '').slice(0, 50)
          });
        }
      }
      return fields;
    })()
  `);

  fs.writeFileSync("scratch/oracle_section1_elements.json", JSON.stringify(report, null, 2));
  console.log("Found " + report.length + " visible interactive elements on Section 1.");

  await browser.close();
}

main().catch(console.error);
