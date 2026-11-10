import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://tas-daimler.taleo.net/careersection/iam/accessmanagement/login.jsf?lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a")).map(el => ({
      tag: el.tagName,
      id: el.id,
      type: (el as any).type,
      value: (el as any).value,
      text: el.textContent?.trim().slice(0, 40)
    })).filter(x => x.id || x.value || x.text);
  });
  console.log("Daimler Login elements:", JSON.stringify(elements, null, 2));
  await browser.close();
}

main();

