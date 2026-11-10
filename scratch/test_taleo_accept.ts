import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("Initial Title:", await page.title());
  // Click "I Accept"
  const acceptBtn = page.locator("input[value='I Accept'], button:has-text('I Accept'), input[id*='ContinueButton']").first();
  console.log("Accept button visible:", await acceptBtn.isVisible());
  await acceptBtn.click();
  await page.waitForTimeout(4000);

  console.log("URL after accept:", page.url());
  console.log("Title after accept:", await page.title());

  const pageElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), button, a.button")).map(el => ({
      tagName: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      text: (el as HTMLElement).innerText?.trim() || (el as any).value
    }));
  });
  console.log("PAGE ELEMENTS AFTER ACCEPT:", JSON.stringify(pageElements, null, 2));

  await browser.close();
}

main();

