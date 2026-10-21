import { chromium } from "playwright";

async function testApplyClick() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  console.log("Initial URL:", page.url());
  const applyBtn = page.locator("button:has-text('Apply')").first();
  console.log("Clicking Apply button...");
  await applyBtn.click();
  await page.waitForTimeout(2000);

  console.log("URL after clicking Apply:", page.url());
  const visibleInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, select, textarea, button[id*='country']")).map(i => ({
      name: (i as HTMLInputElement).name,
      id: i.id,
      tag: i.tagName,
      type: (i as HTMLInputElement).type,
      visible: (i as HTMLElement).offsetParent !== null
    })).filter(x => x.visible);
  });
  console.log("Visible inputs after click:", visibleInputs);

  await browser.close();
}

testApplyClick().catch(console.error);
