import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720";

  await page.goto(url, { waitUntil: "networkidle" });

  const headerInfo = await page.evaluate(() => {
    // Find text in the top container / requisition overview
    const elements = Array.from(document.querySelectorAll("div, span, p, td, th")).filter(el => {
      const text = el.textContent?.trim() || "";
      return text.length > 3 && text.length < 80 && el.children.length === 0;
    }).slice(0, 30);

    return elements.map(e => ({ tag: e.tagName, text: e.textContent?.trim(), class: e.className }));
  });

  console.log("Elements:", headerInfo);
  await browser.close();
}

main().catch(console.error);
