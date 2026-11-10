import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://wellfound.com/jobs/signup", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const formHtml = await page.locator("form").first().evaluate(el => el.outerHTML).catch(() => "NO FORM");
  console.log("FORM HTML:\n", formHtml);
  await browser.close();
}

main().catch(console.error);

