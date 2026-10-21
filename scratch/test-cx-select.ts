import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  await page.locator("button.apply-now-button, button:has-text('Apply Now')").first().click();
  await page.waitForTimeout(3000);
  await page.fill("input#primary-email-1", "hrutin_cx_test@gmail.com");
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
  // Next step 1
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);
  // Next step 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Click Month toggle button
  await page.locator("#month-earliestAvailableDate-13-toggle-button").click();
  await page.waitForTimeout(1000);
  const listboxHtml = await page.evaluate(() => {
    const lb = document.getElementById("month-earliestAvailableDate-13-listbox");
    return lb ? lb.innerHTML.slice(0, 1000) : "not found";
  });
  console.log("Month listbox HTML:", listboxHtml);

  // Click first option or find item
  const opt = page.locator("#month-earliestAvailableDate-13-listbox [role='option'], #month-earliestAvailableDate-13-listbox li, #month-earliestAvailableDate-13-listbox div").first();
  console.log("Option count:", await opt.count());
  if (await opt.count() > 0) {
    console.log("Option text:", await opt.innerText());
    await opt.click();
    await page.waitForTimeout(1000);
  }

  const monthVal = await page.locator("#month-earliestAvailableDate-13").inputValue();
  console.log("Month input value after selection:", monthVal);

  await browser.close();
}

main().catch(console.error);
