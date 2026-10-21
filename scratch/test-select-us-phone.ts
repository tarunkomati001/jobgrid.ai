import { chromium } from "playwright";

async function testSelectUSAndPhone() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const countryBtn = page.locator("button[id*='country-select']").first();
  const phoneInput = page.locator("input[name='candidate.phone']");

  console.log("1. Clicking Country Button...");
  await countryBtn.click();
  await page.waitForTimeout(300);

  // Press 'u' to jump to 'U' section
  await page.keyboard.press("u");
  await page.waitForTimeout(300);

  // Let's find United States in options
  console.log("2. Searching for United States option in [role='option']...");
  let usOption = page.locator("[role='option'][aria-label*='United States'], [role='option']:has-text('United States')").first();
  
  if (await usOption.count() === 0) {
    // Scroll a bit down in the scroll container
    await page.evaluate(() => {
      const scrollEl = document.querySelector(".sc-2arzqk-1") || document.querySelector("[role='listbox'] > div");
      if (scrollEl) {
        scrollEl.scrollTop += 300;
        scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
      }
    });
    await page.waitForTimeout(300);
  }

  usOption = page.locator("[role='option'][aria-label*='United States'], [role='option']:has-text('United States')").first();
  console.log("US option found?", await usOption.count() > 0);
  if (await usOption.count() > 0) {
    await usOption.click();
    await page.waitForTimeout(300);
  }

  console.log("Country button text:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));

  // Now fill phone number
  console.log("3. Filling phone number field...");
  await phoneInput.click();
  await phoneInput.fill("");
  await phoneInput.pressSequentially("+1 202 555 0198", { delay: 40 });
  await page.waitForTimeout(300);

  console.log("Final Country button text:", await countryBtn.innerText());
  console.log("Final Country button aria-label:", await countryBtn.getAttribute("aria-label"));
  console.log("Final Phone input value:", await phoneInput.inputValue());

  await browser.close();
}

testSelectUSAndPhone().catch(console.error);
