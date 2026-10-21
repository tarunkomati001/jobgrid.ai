import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720";

  await page.goto(url, { waitUntil: "networkidle" });

  const info = await page.evaluate(() => {
    return {
      title: document.title,
      h1: Array.from(document.querySelectorAll("h1, h2, h3, h4")).map(h => ({ tag: h.tagName, text: h.textContent?.trim() })),
      classesWithTitle: Array.from(document.querySelectorAll("[class*='title'], [class*='requisition']")).map(el => ({
        cls: el.className,
        text: el.textContent?.trim()?.slice(0, 100)
      }))
    };
  });

  console.log("Page info:", JSON.stringify(info, null, 2));
  await browser.close();
}

main().catch(console.error);
