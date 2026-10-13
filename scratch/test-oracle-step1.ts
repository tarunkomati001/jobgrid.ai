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
  await page.waitForTimeout(4000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(4000);

  // Fill email
  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.fill("tarunkomati2@gmail.com");

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

  // Click Next
  const nextBtn = page.locator("button:has-text('Next')").first();
  console.log("Clicking Next...");
  await nextBtn.click();

  // Wait for loading to finish and next page / inputs to appear
  console.log("Waiting for next screen...");
  await page.waitForTimeout(15000);

  console.log("URL:", page.url());
  console.log("Title:", await page.title());
  await page.screenshot({ path: "scratch/oracle_after_next_15s.png", fullPage: true });

  const textContent = await page.evaluate(() => document.body.innerText);
  console.log("Page Content Snippet:\n", textContent.slice(0, 1500));

  // Find all inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button")).map(el => {
      const inp = el as any;
      return {
        tag: inp.tagName,
        type: inp.type || null,
        name: inp.name || null,
        id: inp.id || null,
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
