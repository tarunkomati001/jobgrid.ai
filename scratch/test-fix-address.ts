import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_fix_addr_${Date.now()}@gmail.com`;
  console.log("Navigating to Oracle apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  // Wait for Section 1
  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);

  console.log("Section 1 loaded! Setting Country strictly on Address Country field...");

  // 1. SELECT ADDRESS COUNTRY: EXCLUDING PHONE
  const countryInp = page.locator("input[name='country']:not([id*='phone']):not([name*='phone']), input[id*='country']:not([id*='phone']):not([name*='phone']), select[name='country']").first();
  const cId = await countryInp.getAttribute("id");
  console.log("Address Country input id:", cId, "initial value:", await countryInp.inputValue());

  // Clear existing country if not United States
  const currentVal = await countryInp.inputValue();
  if (!currentVal.toLowerCase().includes("united states")) {
    await page.evaluate((id) => {
      const btn = (id ? document.getElementById(id + "-reset-button") : null) || 
                  document.querySelector(`button[id*='${id}'][id*='reset']`) ||
                  document.querySelector("button#country-12-reset-button");
      if (btn) (btn as HTMLElement).click();
    }, cId);
    await page.waitForTimeout(500);

    await countryInp.click();
    await countryInp.fill("United States");
    await page.waitForTimeout(1000);

    const clickedCountry = await page.evaluate((id) => {
      const listbox = id ? document.getElementById(id + "-listbox") : null;
      const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], .cx-select__list-item") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
      const match = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
      if (match) {
        (match as HTMLElement).click();
        return match.textContent?.trim();
      }
      return null;
    }, cId);
    console.log("Clicked Address Country Option:", clickedCountry);
    await page.waitForTimeout(3000);
  }

  const countryAfter = await countryInp.inputValue();
  console.log("Address Country value after selection:", countryAfter);

  // 2. PHONE COUNTRY CODE: United States (+1)
  console.log("Setting Phone Country Code (+1)...");
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
    const listbox = document.getElementById(id + "-listbox");
    const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], .cx-select__list-item") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
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

  // 3. PHONE NUMBER
  console.log("Filling Phone Number (4155552671)...");
  const phoneInput = page.locator("input.phone-row__input, input[type='tel']").first();
  await phoneInput.click();
  await phoneInput.fill("4155552671");
  await phoneInput.dispatchEvent("input");
  await phoneInput.dispatchEvent("change");
  await phoneInput.blur();

  // 4. ADDRESS LINE 1 & 2
  await page.locator("input[name='addressLine1'], input[id*='addressLine1']").first().fill("500 Oracle Parkway");
  await page.locator("input[name='addressLine2'], input[id*='addressLine2']").first().fill("Suite 100");

  // 5. POSTAL CODE AUTOCOMPLETE (94065 -> Redwood City, CA)
  console.log("Filling Postal Code: 94065...");
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
  await page.waitForTimeout(2000);

  const finalCheck = await page.evaluate(() => {
    const c = document.querySelector("input[name='country']:not([id*='phone']):not([name*='phone']), input[id*='country']:not([id*='phone']):not([name*='phone'])") as any;
    const pc = document.getElementById("country-codes-dropdownphoneNumber") as any;
    const p = document.querySelector("input.phone-row__input, input[type='tel']") as any;
    const a1 = document.querySelector("input[name='addressLine1']") as any;
    const a2 = document.querySelector("input[name='addressLine2']") as any;
    const pin = document.querySelector("input[name='postalCode']") as any;
    const city = document.querySelector("input[name='city']") as any;
    const county = document.querySelector("input[name='region1']") as any;
    const state = document.querySelector("input[name='region2'], input[name='state']") as any;

    return {
      country: c?.value,
      phoneCountry: pc?.value,
      phone: p?.value,
      addressLine1: a1?.value,
      addressLine2: a2?.value,
      postalCode: pin?.value,
      city: city?.value,
      county: county?.value,
      state: state?.value
    };
  });

  console.log("FINAL RESULT:", JSON.stringify(finalCheck, null, 2));
  await browser.close();
}

main().catch(console.error);
