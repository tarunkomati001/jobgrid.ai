import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_switch_${Date.now()}@gmail.com`;
  console.log("Navigating to apply/email...");
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
  await page.waitForTimeout(2000);

  // Upload Resume
  console.log("Uploading resume...");
  const fileInp = page.locator("input[type='file']").first();
  await fileInp.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  // Wait for resume parsing: wait until firstName is populated and spinner disappears
  console.log("Waiting for resume parsing to populate fields...");
  for (let i = 1; i <= 25; i++) {
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => {
      const fn = (document.querySelector("input[name='firstName']") as any)?.value;
      const c = (document.querySelector("input[name='country']:not([id*='phone'])") as any)?.value;
      const spinner = !!document.querySelector(".loading, .spinner, .oj-loading, .apply-flow-dialog__loading");
      return { fn, c, spinner };
    });
    console.log(`[+${i}s] fn="${state.fn}" country="${state.c}" spinner=${state.spinner}`);
    if (state.fn && state.c && !state.spinner) {
      console.log("✅ Parser finished completely and spinner cleared!");
      break;
    }
  }

  await page.waitForTimeout(2000);

  // Now perform Country switch to United States
  console.log("\n--- Switching Country to United States ---");
  const countryInp = page.locator("input[name='country']:not([id*='phone']):not([name*='phone']), input[id*='country']:not([id*='phone']):not([name*='phone'])").first();
  const cId = await countryInp.getAttribute("id") || "country-12";
  console.log("Target Country ID:", cId, "Current Value:", await countryInp.inputValue());

  // Click reset button
  const resetSuccess = await page.evaluate((id) => {
    const btn = document.getElementById(id + "-reset-button") || document.querySelector(`button[id*='${id}'][id*='reset']`);
    if (btn) {
      (btn as HTMLElement).click();
      return true;
    }
    return false;
  }, cId);
  console.log("Reset button clicked:", resetSuccess);
  await page.waitForTimeout(1000);
  console.log("Value after reset:", await countryInp.inputValue());

  // Click and fill United States
  await countryInp.click();
  await countryInp.fill("United States");
  await page.waitForTimeout(1500);

  // Select option from listbox
  const optionClicked = await page.evaluate((id) => {
    const listbox = document.getElementById(id + "-listbox") || document.querySelector(".cx-select__list");
    const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], .cx-select__list-item") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
    console.log("Options count:", opts.length);
    const match = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  }, cId);
  console.log("Option clicked:", optionClicked);
  await page.waitForTimeout(3000);
  console.log("Country value after selection:", await countryInp.inputValue());

  // Now Phone Country Code (+1)
  console.log("\n--- Setting Phone Country Code (+1) ---");
  const phoneCountryInp = page.locator("input#country-codes-dropdownphoneNumber, input[name='phoneNumber'][role='combobox']").first();
  const pcId = await phoneCountryInp.getAttribute("id") || "country-codes-dropdownphoneNumber";
  await page.evaluate((id) => {
    const reset = document.getElementById(id + "-reset-button") || document.querySelector("button[id*='country-codes'][id*='reset']");
    if (reset) (reset as HTMLElement).click();
  }, pcId);
  await page.waitForTimeout(500);
  await phoneCountryInp.click();
  await phoneCountryInp.fill("United States");
  await page.waitForTimeout(1000);
  await page.evaluate((id) => {
    const listbox = document.getElementById(id + "-listbox");
    const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], .cx-select__list-item") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
    const match = opts.find(o => {
      const t = (o.textContent || "").toLowerCase();
      return t.includes("united states") && t.includes("+1");
    }) || opts.find(o => (o.textContent || "").toLowerCase().includes("united states"));
    if (match) (match as HTMLElement).click();
  }, pcId);
  await page.waitForTimeout(1000);
  console.log("Phone country value:", await phoneCountryInp.inputValue());

  // Phone number
  const phoneInput = page.locator("input.phone-row__input, input[type='tel']").first();
  await phoneInput.click();
  await phoneInput.fill("4155552671");
  await phoneInput.dispatchEvent("input");
  await phoneInput.dispatchEvent("change");
  await phoneInput.blur();

  // Address Line 1 & Line 2
  await page.locator("input[name='addressLine1'], input[id*='addressLine1']").first().fill("500 Oracle Parkway");
  await page.locator("input[name='addressLine2'], input[id*='addressLine2']").first().fill("Suite 100");

  // Postal code 94065 & Autocomplete
  console.log("\n--- Setting Postal Code 94065 ---");
  const pinInp = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  await pinInp.click();
  await pinInp.fill("94065");
  await page.waitForTimeout(1500);

  const postalClicked = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option'], .cx-autocomplete__list-item, li"));
    const match = opts.find(o => {
      const t = (o.textContent || "").toLowerCase();
      return t.includes("94065") && (t.includes("ca") || t.includes("redwood"));
    }) || opts.find(o => (o.textContent || "").includes("94065"));
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  });
  console.log("Postal code autocomplete clicked:", postalClicked);
  await page.waitForTimeout(3000);

  const finalCheck = await page.evaluate(() => {
    return {
      country: (document.querySelector("input[name='country']:not([id*='phone'])") as any)?.value,
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

  console.log("\n🎯 SECTION 1 FINAL STATE:\n", JSON.stringify(finalCheck, null, 2));

  await page.screenshot({ path: "scratch/test_country_switch_result.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
