import { chromium } from "playwright";

async function testClick() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const btn = page.locator("button[data-cy='agree-to-all-cookies'], button[data-testid='agree-to-all-cookies'], button:has-text('Agree to all')").first();
  console.log("Found button count:", await btn.count());
  if (await btn.count() > 0) {
    await btn.click();
    console.log("Clicked Agree to all cookies!");
    await page.waitForTimeout(1000);
  }

  const dialogRemaining = await page.locator("[role='dialog'][aria-labelledby='cookie-dialog-title'], [data-testid='agree-to-all-cookies']").count();
  console.log("Dialog remaining count:", dialogRemaining);

  await browser.close();
}

testClick().catch(console.error);
