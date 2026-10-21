import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+testsec${Date.now()}@gmail.com`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1100 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });

  console.log("Navigating to URL with fresh alias:", testAlias);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(testAlias);

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);

  console.log("Submitting email...");
  const nextBtn = page.locator("button:has-text('Next')").first();
  await nextBtn.click();
  console.log("Next clicked. Waiting 10s...");
  await page.waitForTimeout(10000);

  console.log("Current URL:", page.url());
  console.log("Body text:\n", (await page.evaluate(() => document.body.innerText)).slice(0, 1000));
  await page.screenshot({ path: "scratch/debug_after_email_10s.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
