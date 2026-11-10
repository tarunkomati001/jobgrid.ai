import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const mainForm = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("form input, form button, form a")).map(el => ({
      tagName: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      text: (el as HTMLElement).innerText?.trim() || (el as any).value
    })).filter(x => x.text || x.name || x.id);
  });
  console.log("FORM ELEMENTS:", JSON.stringify(mainForm, null, 2));

  await browser.close();
}

main();
