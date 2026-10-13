import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1, input[type='email']", "hrutin_inspect_step3@gmail.com");

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
  await page.waitForTimeout(6000);

  // Fill Section 1
  const fn = page.locator("input[name='firstName'], input[id*='firstName']").first();
  if (await fn.count() > 0) await fn.fill("Hrutin");
  const ln = page.locator("input[name='lastName'], input[id*='lastName']").first();
  if (await ln.count() > 0) await ln.fill("Nammi");
  const ph = page.locator("input[type='tel']").first();
  if (await ph.count() > 0) await ph.fill("8688423267");

  // Advance to Step 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);

  // Step 2: Upload resume
  const rInput = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput.count() > 0) {
    await rInput.setInputFiles(resumePath);
    await page.waitForTimeout(3000);
  }

  // Advance to Step 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(6000);
  console.log("Current URL (Step 3):", page.url());

  // Save Step 3 HTML and screenshot
  const html = await page.content();
  fs.writeFileSync("scratch/oracle_step3.html", html);
  await page.screenshot({ path: "scratch/oracle_step3_detailed.png", fullPage: true });

  // Dump all interactive elements in Step 3
  const step3Details = await page.evaluate(`
    (() => {
      const items = [];
      const els = Array.from(document.querySelectorAll("input, select, textarea, button, [role='combobox'], [role='radio'], [role='listbox']"));
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        let label = '';
        if (el.id) {
          const l = document.querySelector("label[for='" + el.id + "']");
          if (l) label = l.textContent.trim();
        }
        if (!label) {
          const parent = el.closest(".form-block, .block, .field, div, p, label, fieldset");
          if (parent) {
            const l = parent.querySelector("label, legend, span.label, span.title, p");
            if (l) label = l.textContent.trim();
          }
        }

        let options = [];
        if (el.tagName === "SELECT") {
          options = Array.from(el.options).map(o => ({ text: o.text.trim(), value: o.value }));
        }

        items.push({
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          id: el.id || null,
          name: el.name || null,
          role: el.getAttribute('role') || null,
          text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80),
          label: label.replace(/\\s+/g, ' ').slice(0, 100),
          value: el.value || null,
          ariaLabel: el.getAttribute('aria-label') || null,
          options: options.length > 0 ? options.slice(0, 10) : undefined,
          visible: rect.width > 0 && rect.height > 0
        });
      }
      return items;
    })()
  `);

  fs.writeFileSync("scratch/oracle_step3_elements.json", JSON.stringify(step3Details, null, 2));
  console.log("Dumped " + step3Details.length + " elements to scratch/oracle_step3_elements.json");

  await browser.close();
}

main().catch(console.error);
