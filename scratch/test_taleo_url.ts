import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://chm.tbe.taleo.net/chm02/ats/careers/v2/viewRequisition?org=BASESOLU&cws=1&rid=1246", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);
    console.log("URL:", page.url());
    console.log("Title:", await page.title());
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log("Body snippet:", bodyText);
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

main();

