import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/336378/?location=India&locationId=300000000106947";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  console.log(`Checking Job 5 (India): ${URL}`);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);

  const title = await page.evaluate(() => {
    const titleEl = document.querySelector(".job-title, [class*='requisition-title'], h1:not([class*='accessibility']), h2:not([class*='accessibility'])");
    return titleEl?.textContent?.trim() || document.title;
  });
  console.log("Job 5 Title:", title);

  const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now')").first();
  console.log("Apply button visible:", await applyBtn.isVisible().catch(() => false));

  await browser.close();
}

main().catch(console.error);
