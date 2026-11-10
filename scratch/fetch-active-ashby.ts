import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Navigate to Ramp board on Ashby
  await page.goto("https://jobs.ashbyhq.com/ramp", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='/ramp/']"))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(h => h.split("/").length >= 5);
  });

  console.log("Found Ramp Ashby links:", links.slice(0, 5));
  await browser.close();
}

main().catch(console.error);

