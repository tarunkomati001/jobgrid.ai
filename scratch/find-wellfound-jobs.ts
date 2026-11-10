import { chromium } from "playwright";
import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function main() {
  const context = await createPersistentBrowserContext(true); // headless
  const page = await context.newPage();
  console.log("Navigating to Wellfound jobs...");
  await page.goto("https://wellfound.com/jobs", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const links = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href*='/jobs/']"));
    const urls = new Set<string>();
    for (const a of anchors) {
      const href = a.getAttribute("href");
      if (href && /\/jobs\/\d+-[a-z0-9-]+/.test(href)) {
        const full = href.startsWith("http") ? href : `https://wellfound.com${href.split("?")[0]}`;
        urls.add(full);
      }
    }
    return Array.from(urls);
  });

  console.log("Found Wellfound job links:", links.slice(0, 10));
  await context.close();
}

main().catch(console.error);

