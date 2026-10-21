import { chromium } from "playwright";

async function testCNew() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  console.log("Current URL:", page.url());
  const visibleInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button[id*='country']")).map(i => ({
      name: (i as HTMLInputElement).name,
      id: i.id,
      tag: i.tagName,
      type: (i as HTMLInputElement).type,
      visible: (i as HTMLElement).offsetParent !== null
    })).filter(x => x.visible);
  });
  console.log("Visible inputs on /c/new:", visibleInputs);

  await browser.close();
}

testCNew().catch(console.error);
