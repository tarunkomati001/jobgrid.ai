import { createBrowser } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const page = await browser.newPage();

  console.log("Navigating to Alcon search page...");
  await page.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(5000);

  const jobLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href*='/details/'], a[href*='/job/']"));
    return Array.from(new Set(anchors.map(a => (a as HTMLAnchorElement).href)));
  });

  console.log("Found Alcon job links:", jobLinks.slice(0, 5));
  await browser.close();
}

main().catch(console.error);
