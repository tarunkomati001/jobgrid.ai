import { chromium } from "playwright";

const URLS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer",
  "https://zeromotorcycles.recruitee.com/o/legal-counsel",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

async function findCookiePopup() {
  const browser = await chromium.launch({ headless: true });
  for (const url of URLS) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const hasCookie = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll("*")).map(e => e.textContent || "");
      const match = texts.find(t => t.includes("Cookies agreement") || t.includes("best experience on our website"));
      if (match) {
        // find element with exact text
        const el = Array.from(document.querySelectorAll("*")).find(e => e.children.length === 0 && e.textContent?.includes("Cookies agreement"));
        return {
          found: true,
          tag: el?.tagName,
          parentHTML: el?.parentElement?.parentElement?.outerHTML?.slice(0, 1000)
        };
      }
      return { found: false };
    });

    console.log(`URL: ${url} -> Cookie popup:`, hasCookie.found);
    if (hasCookie.found) {
      console.log("HTML:", hasCookie.parentHTML);
    }
    await page.close();
  }
  await browser.close();
}

findCookiePopup().catch(console.error);
