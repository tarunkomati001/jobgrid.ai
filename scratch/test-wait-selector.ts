import { chromium } from "playwright";

async function testWaitSelector() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  
  const el = await page.waitForSelector("button[data-cy='agree-to-all-cookies'], #cookie-dialog-title", { timeout: 5000 }).catch(() => null);
  console.log("Found via waitForSelector:", !!el);

  const agreeBtn = page.locator("button[data-cy='agree-to-all-cookies'], button[data-testid='agree-to-all-cookies'], button:has-text('Agree to all')").first();
  console.log("agreeBtn count:", await agreeBtn.count());
  if (await agreeBtn.count() > 0) {
    console.log("Clicking agreeBtn...");
    await agreeBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  const titleCount = await page.locator("#cookie-dialog-title").count();
  console.log("Cookie title count after click:", titleCount);

  await browser.close();
}

testWaitSelector().catch(console.error);
