import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";
const testAlias = `babufakemail+sec1_${Date.now()}@gmail.com`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
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

  await page.locator("button:has-text('Next')").first().click();

  // Wait for URL to include section/1
  console.log("Waiting for URL to include /section/1...");
  await page.waitForURL(url => url.toString().includes("/section/1"), { timeout: 25000 });
  console.log("Reached /section/1! Current URL:", page.url());
  await page.waitForTimeout(3000);

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button[id*='toggle'], [role='combobox']")).map((el: any) => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      ariaLabel: el.getAttribute("aria-label"),
      outerHTML: el.outerHTML.slice(0, 150)
    }));
  });

  console.log("Total inputs found on Section 1:", inputs.length);
  console.log(JSON.stringify(inputs, null, 2));

  await browser.close();
}

main().catch(console.error);
