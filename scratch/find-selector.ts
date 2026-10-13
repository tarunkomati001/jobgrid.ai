import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=4720";

  await page.goto(url, { waitUntil: "networkidle" });

  const found = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("*")).filter(el => {
      return el.children.length === 0 && el.textContent?.trim() === "Information Systems Security Officer";
    });
    return els.map(e => ({
      tag: e.tagName,
      className: e.className,
      id: e.id,
      parentTag: e.parentElement?.tagName,
      parentClass: e.parentElement?.className,
      parentParentClass: e.parentElement?.parentElement?.className
    }));
  });

  console.log("Matching elements for job title:", found);
  await browser.close();
}

main().catch(console.error);
