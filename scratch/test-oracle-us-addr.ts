import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_us_geo_${Date.now()}@gmail.com`;
  console.log("Navigating to apply/email...");
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
  await page.waitForTimeout(4000);

  // 1. SELECT COUNTRY: United States FIRST
  console.log("Setting Country: United States...");
  const countryInp = page.locator("input#country-12, input[name='country']").first();
  if (await countryInp.count() > 0) {
    await page.evaluate(() => {
      const reset = document.querySelector("button[id*='country'][id*='reset'], button#country-12-reset-button") as HTMLElement;
      if (reset) reset.click();
    });
    await page.waitForTimeout(400);

    await countryInp.click();
    await countryInp.fill("United States");
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("#country-12-listbox [role='option'], [role='option'], .cx-select__list-item"));
      const match = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
      if (match) (match as HTMLElement).click();
    });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
  }

  // 2. SET PHONE COUNTRY CODE: United States (+1)
  console.log("Setting Phone Country Code: United States (+1)...");
  const phoneCountryInput = page.locator("input#country-codes-dropdownphoneNumber, input[name='phoneNumber'][role='combobox']").first();
  if (await phoneCountryInput.count() > 0) {
    await page.evaluate(() => {
      const reset = document.getElementById("country-codes-dropdownphoneNumber-reset-button") as HTMLElement;
      if (reset) reset.click();
    });
    await page.waitForTimeout(400);

    await phoneCountryInput.click();
    await phoneCountryInput.fill("United States");
    await page.waitForTimeout(1000);

    const clicked = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("#country-codes-dropdownphoneNumber-listbox [role='option'], [role='option'], .cx-select__list-item"));
      const match = opts.find(o => {
        const t = (o.textContent || "").toLowerCase();
        return t.includes("united states") && t.includes("+1");
      }) || opts.find(o => (o.textContent || "").toLowerCase().includes("united states"));
      if (match) {
        (match as HTMLElement).click();
        return match.textContent?.trim();
      }
      return null;
    });
    console.log("Clicked US phone code:", clicked);
    await page.waitForTimeout(500);
  }

  // 3. FILL US PHONE NUMBER
  console.log("Filling Phone Number...");
  const phoneInput = page.locator("input.phone-row__input, input[type='tel']").first();
  if (await phoneInput.count() > 0) {
    await phoneInput.click();
    await phoneInput.fill("4155552671");
    await phoneInput.dispatchEvent("input");
    await phoneInput.dispatchEvent("change");
    await phoneInput.blur();
  }

  // 4. Fill Address Line 1 and 2
  await page.locator("input[name='addressLine1'], input[id*='addressLine1']").first().fill("500 Oracle Parkway");
  await page.locator("input[name='addressLine2'], input[id*='addressLine2']").first().fill("Suite 100");

  // 5. TEST: Type 94065 in Postal Code and check what autocomplete appears
  console.log("Typing 94065 in postalCode input...");
  const pinInp = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await pinInp.count() > 0) {
    await pinInp.click();
    await pinInp.fill("94065");
    await page.waitForTimeout(1500);

    const autocompleteItems = await page.evaluate(() => {
      const parent = document.querySelector("input[name='postalCode']")?.closest(".geo-hierarchy-form-element, .input-row, div");
      const listbox = parent?.querySelector("[role='listbox'], ul, .cx-select__list");
      const allListItems = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option']"));
      return {
        listboxFound: !!listbox,
        itemCount: allListItems.length,
        items: allListItems.map(i => i.textContent?.trim()).slice(0, 10)
      };
    });
    console.log("Postal Code Autocomplete result:", JSON.stringify(autocompleteItems, null, 2));

    // Try selecting matching option
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
  }

  // Check what values got populated after postal code selection
  let currentGeoValues = await page.evaluate(() => {
    return {
      postalCode: (document.querySelector("input[name='postalCode']") as any)?.value,
      city: (document.querySelector("input[name='city']") as any)?.value,
      state: (document.querySelector("input[name='region2'], input[name='state']") as any)?.value,
      county: (document.querySelector("input[name='region1']") as any)?.value
    };
  });
  console.log("Geo values after Postal Code select:", currentGeoValues);

  // If city/state/county are still empty, type in each one and select from autocomplete!
  if (!currentGeoValues.state) {
    console.log("Typing California in State (region2)...");
    const stateInp = page.locator("input[name='region2'], input[id*='region2'], input[name='state']").first();
    if (await stateInp.count() > 0) {
      await stateInp.click();
      await stateInp.fill("California");
      await page.waitForTimeout(1200);

      const clickedState = await page.evaluate(() => {
        const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option']"));
        const match = opts.find(o => o.textContent?.toLowerCase().includes("california") || o.textContent?.trim() === "CA");
        if (match) {
          (match as HTMLElement).click();
          return match.textContent?.trim();
        }
        return null;
      });
      console.log("Clicked State option:", clickedState);
      await page.waitForTimeout(1000);
    }
  }

  if (!currentGeoValues.county) {
    console.log("Typing San Mateo in County (region1)...");
    const countyInp = page.locator("input[name='region1'], input[id*='region1']").first();
    if (await countyInp.count() > 0) {
      await countyInp.click();
      await countyInp.fill("San Mateo");
      await page.waitForTimeout(1200);

      const clickedCounty = await page.evaluate(() => {
        const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option']"));
        const match = opts.find(o => o.textContent?.toLowerCase().includes("san mateo")) || opts[0];
        if (match) {
          (match as HTMLElement).click();
          return match.textContent?.trim();
        }
        return null;
      });
      console.log("Clicked County option:", clickedCounty);
      await page.waitForTimeout(1000);
    }
  }

  if (!currentGeoValues.city) {
    console.log("Typing Redwood City in City...");
    const cityInp = page.locator("input[name='city'], input[id*='city']").first();
    if (await cityInp.count() > 0) {
      await cityInp.click();
      await cityInp.fill("Redwood City");
      await page.waitForTimeout(1200);

      const clickedCity = await page.evaluate(() => {
        const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option']"));
        const match = opts.find(o => o.textContent?.toLowerCase().includes("redwood")) || opts[0];
        if (match) {
          (match as HTMLElement).click();
          return match.textContent?.trim();
        }
        return null;
      });
      console.log("Clicked City option:", clickedCity);
      await page.waitForTimeout(1000);
    }
  }

  // Fill Name
  await page.locator("input[name='firstName']").first().fill("Hrutin");
  await page.locator("input[name='lastName']").first().fill("Nammi");

  await page.waitForTimeout(2000);

  // Check all values
  const results = await page.evaluate(() => {
    return {
      firstName: (document.querySelector("input[name='firstName']") as any)?.value,
      lastName: (document.querySelector("input[name='lastName']") as any)?.value,
      phoneCountry: (document.getElementById("country-codes-dropdownphoneNumber") as any)?.value,
      phone: (document.querySelector("input.phone-row__input, input[type='tel']") as any)?.value,
      country: (document.querySelector("input[name='country']") as any)?.value,
      addressLine1: (document.querySelector("input[name='addressLine1']") as any)?.value,
      addressLine2: (document.querySelector("input[name='addressLine2']") as any)?.value,
      city: (document.querySelector("input[name='city']") as any)?.value,
      state: (document.querySelector("input[name='region2'], input[name='state']") as any)?.value,
      county: (document.querySelector("input[name='region1']") as any)?.value,
      postalCode: (document.querySelector("input[name='postalCode']") as any)?.value
    };
  });

  console.log("=== FINAL FIELD VALUES ===");
  console.log(JSON.stringify(results, null, 2));

  // Check Next button state
  const nextBtnEnabled = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    return btn ? !(btn as any).disabled : null;
  });
  console.log("Next button enabled:", nextBtnEnabled);

  // Check any validation errors
  const errors = await page.evaluate(() => {
    const errEls = Array.from(document.querySelectorAll(".error, [class*='error']:not(:empty), [aria-invalid='true']"));
    return errEls.map(e => e.textContent?.trim()).filter(Boolean);
  });
  console.log("Validation errors:", errors);

  await page.screenshot({ path: "scratch/oracle_us_geo_filled.png", fullPage: true });

  // Advance to Section 2 to verify!
  const nextBtn = page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next')").last();
  if (await nextBtn.count() > 0) {
    console.log("Clicking Next...");
    await nextBtn.click();
    await page.waitForTimeout(6000);
    console.log("Advanced URL:", page.url());
  }

  await browser.close();
}

main().catch(console.error);
