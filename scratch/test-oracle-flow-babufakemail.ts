import { chromium } from "playwright";
import path from "path";

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
  await page.waitForTimeout(4000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(4000);

  // Fill email
  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill("babufakemail@gmail.com");

  // Check the terms checkbox
  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) {
        label.click();
      } else {
        cb.click();
      }
    }
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/oracle_babu_step1.png" });

  // Click Next
  const nextBtn = page.locator("button:has-text('Next')").first();
  console.log("Clicking Next with babufakemail@gmail.com...");
  await nextBtn.click();

  // Wait for response/screen change
  for (let s = 1; s <= 6; s++) {
    await page.waitForTimeout(2000);
    const currUrl = page.url();
    console.log(`[${s * 2}s] URL: ${currUrl}`);
    if (!currUrl.includes("/apply/email")) {
      console.log("Navigated away from /apply/email!");
      break;
    }
  }

  await page.waitForTimeout(4000);
  await page.screenshot({ path: "scratch/oracle_babu_after_next.png", fullPage: true });

  const headingText = await page.locator("h1, h2, h3, .heading").allInnerTexts();
  console.log("Headings:", headingText);

  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log("Body Snippet:\n", bodySnippet);

  // Dump visible interactive elements
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button")).map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const lbl = document.querySelector(`label[for='${inp.id}']`);
        if (lbl) label = lbl.textContent?.trim() || "";
      }
      if (!label && inp.labels && inp.labels.length > 0) {
        label = Array.from(inp.labels).map((l: any) => l.textContent?.trim()).join(" ");
      }
      return {
        tag: inp.tagName,
        type: inp.type || null,
        name: inp.name || null,
        id: inp.id || null,
        label,
        text: inp.textContent?.trim().slice(0, 50),
        placeholder: inp.placeholder || null,
        ariaLabel: inp.getAttribute("aria-label"),
        isVisible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
      };
    }).filter(i => i.isVisible);
  });

  console.log("Visible interactive elements:", JSON.stringify(inputs, null, 2));

  await browser.close();
}

main().catch(console.error);
