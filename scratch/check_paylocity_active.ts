import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const urls = [
    "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4585012",
    "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597",
    "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4616387",
    "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4447994"
  ];

  for (const u of urls) {
    try {
      console.log(`Checking ${u}...`);
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(3000);
      const title = await page.title();
      const currentUrl = page.url();
      console.log(` -> Title: ${title}, URL: ${currentUrl}`);
    } catch (e: any) {
      console.log(` -> Failed: ${e.message}`);
    }
  }

  await browser.close();
}

main();

