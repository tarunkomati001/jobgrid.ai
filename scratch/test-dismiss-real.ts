import { chromium } from "playwright";

async function testDismiss() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Method 1: Playwright locator click
  const agreeBtn = page.locator("button[data-cy='agree-to-all-cookies'], button[data-testid='agree-to-all-cookies'], button:has-text('Agree to all')").first();
  console.log("Count before click:", await agreeBtn.count());
  if (await agreeBtn.count() > 0) {
    await agreeBtn.click({ force: true });
    console.log("Clicked agree button!");
    await page.waitForTimeout(1000);
  }

  // Check if dialog is gone
  const titlePresent = await page.locator("#cookie-dialog-title, [role='dialog'][aria-labelledby='cookie-dialog-title']").count();
  console.log("Dialog count after click:", titlePresent);

  // If still present or on any other site, evaluate removal:
  await page.evaluate(() => {
    const dialogs = document.querySelectorAll("[role='dialog'][aria-labelledby*='cookie'], [aria-describedby*='cookie'], #cookie-dialog-title");
    for (const d of dialogs) {
      const top = d.closest("[role='dialog']") || d.closest("div[tabindex='-1']") || d;
      top.remove();
    }
  });

  const finalCheck = await page.locator("#cookie-dialog-title").count();
  console.log("Final check title count:", finalCheck);

  await browser.close();
}

testDismiss().catch(console.error);
