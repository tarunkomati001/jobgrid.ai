import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+ats${Date.now()}@gmail.com`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Navigating to URL with alias:", testAlias);
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

  console.log("Clicking Next...");
  const nextBtn = page.locator("button:has-text('Next')").first();
  await nextBtn.click();
  await page.waitForTimeout(5000);

  const bodySnippet = await page.evaluate(() => document.body.innerText);
  console.log("Page text after Next:\n", bodySnippet.slice(0, 1000));
  await page.screenshot({ path: "scratch/oracle_alias_test.png" });

  await browser.close();
}

main().catch(console.error);
