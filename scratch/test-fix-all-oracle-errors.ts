import { chromium } from "playwright";
import path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  console.log("Navigating to Oracle Job apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `hrutin_test_fix_${Date.now()}@gmail.com`;
  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']");
    if (l) (l as HTMLElement).click();
  });
  await page.waitForTimeout(1000);
  await page.locator("button:has-text('Next')").first().click();

  // Wait for Section 1
  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1500);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForTimeout(6000);

  console.log("=== STEP 1: FIXING PHONE COUNTRY CODE & PHONE NUMBER ===");
  // 1. Phone Country Code: Type +91 and select India
  const phoneCountryInput = page.locator("input#country-codes-dropdownphoneNumber, input[name='phoneNumber'][role='combobox']").first();
  if (await phoneCountryInput.count() > 0) {
    console.log("Clearing and setting phone country code to +91 (India)...");
    // Click reset button if present
    await page.evaluate(() => {
      const reset = document.getElementById("country-codes-dropdownphoneNumber-reset-button") as HTMLElement;
      if (reset) reset.click();
    });
    await page.waitForTimeout(400);

    await phoneCountryInput.click();
    await phoneCountryInput.fill("+91");
    await page.waitForTimeout(800);

    // Select the option matching "+91" and "India"
    const selected = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("#country-codes-dropdownphoneNumber-listbox [role='option'], [role='option'], .cx-select__list-item"));
      const match = opts.find(o => {
        const t = (o.textContent || "").trim();
        return t.includes("+91") && t.toLowerCase().includes("india");
      });
      if (match) {
        (match as HTMLElement).click();
        return match.textContent?.trim();
      }
      return null;
    });
    console.log("Selected country code option:", selected);
  }

  // 2. Phone Number
  console.log("Filling Phone Number: 8688423267...");
  const phoneInput = page.locator("input[type='tel'], input[name='phoneNumber']:not([role='combobox']), input[id*='phoneNumber']:not([id*='country-codes'])").first();
  if (await phoneInput.count() > 0) {
    await phoneInput.click();
    await phoneInput.fill("8688423267");
    await phoneInput.dispatchEvent("input");
    await phoneInput.dispatchEvent("change");
    await phoneInput.blur();
  }

  // Fill personal details
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "ava street").catch(() => {});
  await page.fill("input[name='addressLine2'], input[id*='addressLine2']", "ava street").catch(() => {});
  await page.fill("input[name='city'], input[id*='city']", "Vadodara").catch(() => {});

  console.log("=== STEP 2: FIXING PINCODE / POSTAL CODE WITH VADODARA AUTOCOMPLETE ===");
  const postalInput = page.locator("input[name='postalCode'], input[id*='postalCode']").first();
  if (await postalInput.count() > 0) {
    console.log("Filling Postal Code: 390144...");
    await postalInput.click();
    await postalInput.fill("390144");
    await page.waitForTimeout(1000);

    // Look for autocomplete option with Vadodara
    const optionSelected = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item, .cx-autocomplete__list-item, li"));
      const match = opts.find(o => {
        const t = (o.textContent || "").trim().toLowerCase();
        return t.includes("vadodara") || t.includes("390144") || t.includes("390");
      });
      if (match) {
        (match as HTMLElement).click();
        return match.textContent?.trim();
      }
      return null;
    });
    console.log("Selected postal autocomplete option:", optionSelected);

    if (!optionSelected) {
      console.log("Fallback keyboard press for postal code...");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/oracle_fixed_sec1.png", fullPage: true });

  // Advance to Section 2
  console.log("Advancing to Section 2...");
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Resume upload in Section 2
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    console.log("Uploading resume in Sec 2...");
    await rInput2.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Advance to Section 3
  console.log("Advancing to Section 3...");
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(8000);

  console.log("=== STEP 3: FIXING EXPERIENCE START & END DATES ===");
  // Check invalid experience tiles
  const hasInvalid = await page.evaluate(() => {
    return document.querySelectorAll(".apply-flow-profile-item-tile--invalid").length;
  });
  console.log("Number of invalid experience tiles before fix:", hasInvalid);

  // Function to resolve experience date issues
  const fixedExperience = await page.evaluate(async () => {
    const invalidTiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile--invalid"));
    let fixCount = 0;

    for (const tile of invalidTiles) {
      const editBtn = tile.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit'], button[aria-label='Edit']") as HTMLElement;
      if (!editBtn) continue;

      editBtn.click();
      // wait a bit for active form
      await new Promise(r => setTimeout(r, 1500));

      // Find Start Date and End Date inputs
      const startYearInput = document.querySelector("input[id*='year-startDate']") as HTMLInputElement;
      const endYearInput = document.querySelector("input[id*='year-endDate']") as HTMLInputElement;
      const startMonthInput = document.querySelector("input[id*='month-startDate']") as HTMLInputElement;
      const endMonthInput = document.querySelector("input[id*='month-endDate']") as HTMLInputElement;

      const currentStartYear = startYearInput?.value?.trim() || "";
      const currentEndYear = endYearInput?.value?.trim() || "";
      const currentStartMonth = startMonthInput?.value?.trim() || "";
      const currentEndMonth = endMonthInput?.value?.trim() || "";

      console.log(`Current Exp Dates: Start=${currentStartMonth} ${currentStartYear}, End=${currentEndMonth} ${currentEndYear}`);

      // If Start Year equals End Year (e.g. both 2025)
      if (startYearInput && endYearInput) {
        if (!currentStartYear || currentStartYear === currentEndYear) {
          const endYearNum = parseInt(currentEndYear, 10) || 2025;
          const adjustedStartYear = String(endYearNum - 1); // 2024

          // Set Start Year
          startYearInput.value = adjustedStartYear;
          startYearInput.dispatchEvent(new Event("input", { bubbles: true }));
          startYearInput.dispatchEvent(new Event("change", { bubbles: true }));
          startYearInput.dispatchEvent(new Event("blur", { bubbles: true }));

          // Set Start Month if missing
          if (startMonthInput && !startMonthInput.value) {
            startMonthInput.value = currentEndMonth || "September";
            startMonthInput.dispatchEvent(new Event("input", { bubbles: true }));
            startMonthInput.dispatchEvent(new Event("change", { bubbles: true }));
          }

          // Set End Month if missing
          if (endMonthInput && !endMonthInput.value) {
            endMonthInput.value = "September";
            endMonthInput.dispatchEvent(new Event("input", { bubbles: true }));
            endMonthInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }

      await new Promise(r => setTimeout(r, 800));

      // Click SAVE button in active form
      const saveBtn = Array.from(document.querySelectorAll("button")).find(b => {
        const t = b.textContent?.trim().toLowerCase();
        return t === "save" || t === "save experience";
      });

      if (saveBtn) {
        saveBtn.click();
        fixCount++;
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return fixCount;
  });

  console.log("Experience tiles fixed:", fixedExperience);
  await page.waitForTimeout(3000);

  const remainingInvalid = await page.evaluate(() => {
    return document.querySelectorAll(".apply-flow-profile-item-tile--invalid").length;
  });
  console.log("Remaining invalid experience tiles after fix:", remainingInvalid);

  await page.screenshot({ path: "scratch/oracle_fixed_sec3_exp.png", fullPage: true });

  await browser.close();
}

main().catch(console.error);
