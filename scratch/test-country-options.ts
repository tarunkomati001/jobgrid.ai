import { chromium } from "playwright";

async function testCountryOptions() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const phoneInput = page.locator("input[name='candidate.phone']");
  const countryBtn = page.locator("button[id*='country-select']").first();

  console.log("=== TEST 1: Type '+1' directly into phone input ===");
  await phoneInput.click();
  // Select all and type +1
  await phoneInput.fill("");
  await page.waitForTimeout(200);
  await phoneInput.pressSequentially("+1", { delay: 100 });
  await page.waitForTimeout(500);
  console.log("Country button text after typing +1 in phone:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));
  console.log("Phone value:", await phoneInput.inputValue());

  console.log("Now typing rest of US phone number (6505551234)...");
  await phoneInput.pressSequentially(" 650 555 1234", { delay: 50 });
  await page.waitForTimeout(500);
  console.log("Country button text:", await countryBtn.innerText());
  console.log("Country button aria-label:", await countryBtn.getAttribute("aria-label"));
  console.log("Phone value:", await phoneInput.inputValue());

  console.log("\n=== TEST 2: Inspecting Country Button and Downshift component ===");
  // Reload page to reset
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const freshCountryBtn = page.locator("button[id*='country-select']").first();
  await freshCountryBtn.click();
  await page.waitForTimeout(500);

  // Check how Downshift responds to typing
  console.log("Country button focused? Active element tag and id:", await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    id: document.activeElement?.id,
    class: document.activeElement?.className
  })));

  // Try keyboard type on the focused element
  console.log("Typing 'u' then 'n' then 'i'...");
  await page.keyboard.press("u");
  await page.waitForTimeout(300);
  console.log("After 'u', country button text:", await freshCountryBtn.innerText());
  console.log("Aria-label:", await freshCountryBtn.getAttribute("aria-label"));

  // Check all items in DOM right now
  const activeItems = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("[role='option']")).map(o => ({
      id: o.id,
      text: o.textContent?.trim(),
      ariaLabel: o.getAttribute("aria-label"),
      selected: o.getAttribute("aria-selected")
    }));
  });
  console.log("Active options in DOM:", activeItems);

  await browser.close();
}

testCountryOptions().catch(console.error);
