import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://job-boards.greenhouse.io/figma", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='/figma/jobs/']"))
      .map(a => (a as HTMLAnchorElement).href);
  });

  console.log("Found Figma Greenhouse links:", links.slice(0, 5));
  await browser.close();
}

main().catch(console.error);

