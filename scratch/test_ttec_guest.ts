import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log("URL after accept:", page.url());
  console.log("Title after accept:", await page.title());

  const guestBtn = page.locator("input[id*='guestapply'], input[value='Apply as Guest']").first();
  console.log("Guest apply visible:", await guestBtn.isVisible());
  if (await guestBtn.isVisible()) {
    await guestBtn.click();
    await page.waitForTimeout(4000);
    console.log("URL after guest apply:", page.url());
    console.log("Title after guest apply:", await page.title());
  }

  await browser.close();
}

main();

