import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function testEmail(email: string) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log(`Testing email: ${email}...`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1, input[type='email']", email);

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

  // Wait 10s and check URL and headings
  await page.waitForTimeout(10000);
  console.log(`[Result for ${email}] URL: ${page.url()}`);
  const titleOrHeading = await page.locator("h1, h2, h3, .heading").allInnerTexts();
  console.log(`[Result for ${email}] Headings:`, titleOrHeading);

  await page.screenshot({ path: `scratch/oracle_test_${email.replace(/[^a-zA-Z0-9]/g, "_")}.png` });

  await browser.close();
}

async function main() {
  await testEmail("hrutinnammi123@gmail.com");
}

main().catch(console.error);
