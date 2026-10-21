import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to URL:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);

  console.log("Current page URL:", page.url());
  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  
  if (await emailInput.count() > 0) {
    console.log("Filling email babufakemail@gmail.com...");
    await emailInput.fill("babufakemail@gmail.com");

    await page.evaluate(() => {
      const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
      if (cb && !cb.checked) {
        const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
        if (label) label.click();
        else cb.click();
      }
    });
    await page.waitForTimeout(1000);

    const nextBtn = page.locator("button:has-text('Next')").first();
    await nextBtn.click();
    console.log("Clicked Next. Waiting 8s for next screen...");
    await page.waitForTimeout(8000);
  }

  console.log("URL after next:", page.url());
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("Body snippet:\n", bodyText.slice(0, 800));

  await page.screenshot({ path: "scratch/oracle_after_email.png" });
  await browser.close();
}

main().catch(console.error);
