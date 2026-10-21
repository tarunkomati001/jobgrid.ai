import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.locator("button.apply-now-button, button:has-text('Apply Now')").first().click();
  await page.waitForTimeout(3000);
  await page.fill("input#primary-email-1", "hrutin_check_date@gmail.com");
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(5000);
  // Next on step 1
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);
  // Next on step 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Click day toggle button and inspect dropdown popup
  console.log("Clicking month toggle...");
  await page.locator("#month-earliestAvailableDate-13-toggle-button").click();
  await page.waitForTimeout(1000);
  const monthOpts = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".oj-listbox-result, .oj-select-results li, [role='option']"));
    return items.map(i => i.textContent?.trim());
  });
  console.log("Month options:", monthOpts);

  // Click day toggle button and inspect
  console.log("Clicking day toggle...");
  await page.locator("#day-earliestAvailableDate-13-toggle-button").click();
  await page.waitForTimeout(1000);
  const dayOpts = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll(".oj-listbox-result, .oj-select-results li, [role='option']"));
    return items.map(i => i.textContent?.trim());
  });
  console.log("Day options:", dayOpts.slice(0, 10));

  await browser.close();
}

main().catch(console.error);
