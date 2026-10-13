import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_us_fields_${Date.now()}@gmail.com`;
  console.log("Navigating to Oracle apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input[type='tel'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log("Section 1 loaded! Testing Country selection...");
  
  // 1. SELECT COUNTRY: United States
  const countryInp = page.locator("input[name='country'], input[id*='country']").first();
  const cId = await countryInp.getAttribute("id");
  console.log("Country input id:", cId, "initial value:", await countryInp.inputValue());

  // Click reset button
  await page.evaluate((id) => {
    const btn = (id ? document.getElementById(id + "-reset-button") : null) || document.querySelector("button[id*='country'][id*='reset']");
    if (btn) (btn as HTMLElement).click();
  }, cId);
  await page.waitForTimeout(400);

  await countryInp.click();
  await countryInp.fill("United States");
  await page.waitForTimeout(800);

  const clickedCountry = await page.evaluate((id) => {
    const opts = Array.from(document.querySelectorAll(id ? `#${id}-listbox [role='option'], .cx-select__list-item` : "[role='option'], .cx-select__list-item"));
    const us = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
    if (us) {
      (us as HTMLElement).click();
      return us.textContent?.trim();
    }
    return null;
  }, cId);
  console.log("Clicked Country Option:", clickedCountry);
  await page.waitForTimeout(3000);

  const countryAfter = await countryInp.inputValue();
  console.log("Country value after selection:", countryAfter);

  // 2. PHONE COUNTRY CODE: United States (+1)
  console.log("Testing Phone Country Code selection...");
  const phoneCountryInp = page.locator("input#country-codes-dropdownphoneNumber, input[name='phoneNumber'][role='combobox']").first();
  const pcId = await phoneCountryInp.getAttribute("id") || "country-codes-dropdownphoneNumber";

  await page.evaluate((id) => {
    const btn = document.getElementById(id + "-reset-button") || document.querySelector("button[id*='country-codes'][id*='reset']");
    if (btn) (btn as HTMLElement).click();
  }, pcId);
  await page.waitForTimeout(400);

  await phoneCountryInp.click();
  await phoneCountryInp.fill("United States");
  await page.waitForTimeout(1000);

  const clickedPhoneCountry = await page.evaluate((id) => {
    const opts = Array.from(document.querySelectorAll(`#${id}-listbox [role='option'], [role='option'], .cx-select__list-item`));
    const match = opts.find(o => {
      const t = (o.textContent || "").toLowerCase();
      return t.includes("united states") && t.includes("+1");
    }) || opts.find(o => (o.textContent || "").toLowerCase().includes("united states"));
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  }, pcId);
  console.log("Clicked Phone Country Code Option:", clickedPhoneCountry);
  await page.waitForTimeout(1000);

  const phoneCountryAfter = await phoneCountryInp.inputValue();
  console.log("Phone Country Code value after selection:", phoneCountryAfter);

  // 3. PHONE NUMBER
  console.log("Testing Phone Number filling...");
  const phoneInput = page.locator("input.phone-row__input, input[type='tel']").first();
  await phoneInput.click();
  await phoneInput.fill("4155552671");
  await phoneInput.dispatchEvent("input");
  await phoneInput.dispatchEvent("change");
  await phoneInput.blur();
  const phoneValAfter = await phoneInput.inputValue();
  console.log("Phone Number value after filling:", phoneValAfter);

  // 4. ADDRESS LINE 1 & 2
  await page.locator("input[name='addressLine1'], input[id*='addressLine1']").first().fill("500 Oracle Parkway");
  await page.locator("input[name='addressLine2'], input[id*='addressLine2']").first().fill("Suite 100");

  // 5. POSTAL CODE AUTOCOMPLETE
  console.log("Testing Postal Code autocomplete with 94065...");
  const pinInp = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  await pinInp.click();
  await pinInp.fill("94065");
  await page.waitForTimeout(1500);

  const clickedPin = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option']"));
    const match = opts.find(o => o.textContent?.includes("94065") || o.textContent?.toLowerCase().includes("redwood"));
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  });
  console.log("Clicked Postal Code item:", clickedPin);
  await page.waitForTimeout(1500);

  const finalState = await page.evaluate(() => {
    return {
      country: (document.querySelector("input[name='country']") as any)?.value,
      phoneCountry: (document.getElementById("country-codes-dropdownphoneNumber") as any)?.value,
      phone: (document.querySelector("input.phone-row__input, input[type='tel']") as any)?.value,
      addressLine1: (document.querySelector("input[name='addressLine1']") as any)?.value,
      addressLine2: (document.querySelector("input[name='addressLine2']") as any)?.value,
      postalCode: (document.querySelector("input[name='postalCode']") as any)?.value,
      city: (document.querySelector("input[name='city']") as any)?.value,
      county: (document.querySelector("input[name='region1']") as any)?.value,
      state: (document.querySelector("input[name='region2'], input[name='state']") as any)?.value
    };
  });
  console.log("FINAL SECTION 1 VALUES:", JSON.stringify(finalState, null, 2));

  await browser.close();
}

main().catch(console.error);
