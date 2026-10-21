import { chromium } from "playwright";

async function testClickUSDirect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  await countryBtn.click();
  await page.waitForTimeout(300);

  // Set scrollTop = 13500
  await page.evaluate(() => {
    const scrollEl = document.querySelector(".sc-2arzqk-1, [role='listbox'] > div, [role='listbox']") as HTMLElement;
    if (scrollEl) {
      scrollEl.scrollTop = 13500;
      scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  });
  await page.waitForTimeout(400);

  const usOption = page.locator("[role='option'][aria-label='United States'], [role='option']:has-text('United States')").first();
  console.log("US option count:", await usOption.count());
  if (await usOption.count() > 0) {
    await usOption.click({ force: true });
  }

  await page.waitForTimeout(500);
  console.log("Country button text:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));

  // Check phone input value
  const phoneInput = page.locator("input[name='candidate.phone']");
  console.log("Phone input value:", await phoneInput.inputValue());

  await browser.close();
}

testClickUSDirect().catch(console.error);
