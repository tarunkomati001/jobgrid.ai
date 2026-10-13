import fs from "fs";
import path from "path";

const filePath = path.resolve("src/ats/oracle/oracle.adapter.ts");
let content = fs.readFileSync(filePath, "utf-8");

// Target section to replace
const targetStart = `      // Phone Country Code Dropdown: type +91 and select India (+91)`;
const targetEnd = `      await fillIfVisible("input[name='state'], input[id*='state'], input[name='region'], input[id*='region'], input[name='province']", stateVal, "State");`;

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error("Markers not found! startIndex:", startIndex, "endIndex:", endIndex);
  process.exit(1);
}

const replacement = `      // 2A. Country Selection: Set "United States" FIRST!
      // This is crucial because Oracle Cloud resets and re-renders address and phone fields upon country selection.
      try {
        const countryInp = page.locator("input[id*='country'], input[name='country']").first();
        if (await countryInp.count() > 0 && await countryInp.isVisible()) {
          const currentCountry = await countryInp.inputValue().catch(() => "");
          if (!currentCountry.toLowerCase().includes("united states")) {
            console.log("[OracleAdapter] Setting country to: United States...");
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
            await page.waitForTimeout(2500);
          }
        }
      } catch (e: any) {
        console.warn(\`[OracleAdapter] Country note: \${e.message}\`);
      }

      // 2B. Phone Country Code Dropdown: Select United States (+1)
      try {
        const phoneCountryInput = page.locator("input#country-codes-dropdownphoneNumber, input[name='phoneNumber'][role='combobox']").first();
        if (await phoneCountryInput.count() > 0 && await phoneCountryInput.isVisible()) {
          console.log("[OracleAdapter] Populating Phone Country Code: selecting United States (+1)...");
          // 1. Click reset button if present to clear existing default
          await page.evaluate(() => {
            const reset = document.getElementById("country-codes-dropdownphoneNumber-reset-button") as HTMLElement;
            if (reset) reset.click();
          });
          await page.waitForTimeout(300);

          // 2. Click and type "United States"
          await phoneCountryInput.click();
          await phoneCountryInput.fill("United States");
          await page.waitForTimeout(800);

          // 3. Select matching option "+1 (United States)"
          const matched = await page.evaluate(() => {
            const opts = Array.from(document.querySelectorAll("#country-codes-dropdownphoneNumber-listbox [role='option'], [role='option'], .cx-select__list-item"));
            const match = opts.find(o => {
              const t = (o.textContent || "").toLowerCase();
              return t.includes("united states") && t.includes("+1");
            }) || opts.find(o => (o.textContent || "").toLowerCase().includes("united states"));
            if (match) {
              (match as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (!matched) {
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          await page.waitForTimeout(500);
        }
      } catch (e: any) {
        console.warn(\`[OracleAdapter] Phone country code note: \${e.message}\`);
      }

      // 2C. Phone Number: Strictly fill into input.phone-row__input (NEVER into country code combobox!)
      try {
        const phoneInput = page.locator("input.phone-row__input, input[type='tel'], input[aria-label='Phone Number']:not([role='combobox']), input[id*='phoneNumber']:not([id*='country-codes']):not([role='combobox'])").first();
        if (await phoneInput.count() > 0 && await phoneInput.isVisible()) {
          await phoneInput.click();
          await phoneInput.fill(cleanPhone);
          await phoneInput.dispatchEvent("input");
          await phoneInput.dispatchEvent("change");
          await phoneInput.blur();
          console.log(\`[OracleAdapter] Filled US Phone Number: \${cleanPhone}\`);
        } else {
          await fillIfVisible("input.phone-row__input, input[type='tel']:not([role='combobox'])", cleanPhone, "US Phone Number");
        }
      } catch (e: any) {
        console.warn(\`[OracleAdapter] Phone filling note: \${e.message}\`);
      }

      // 2D. US Address Fields (Line 1 & Line 2)
      await fillIfVisible("input[name='addressLine1'], input[id*='addressLine1'], input[name='address1'], input[id*='address1'], input[name='building'], input[id*='building']", streetVal, "Address Line 1");
      await fillIfVisible("input[name='addressLine2'], input[id*='addressLine2'], input[name='address2'], input[id*='address2'], input[name='streetName'], input[id*='streetName']", line2Val, "Street / Address Line 2");

      // 2E. US Postal Code with Geography Hierarchy Autocomplete (Redwood City, San Mateo, CA)
      try {
        const pinInp = page.locator("input[name='postalCode'], input[id*='postalCode'], input[name='zipCode'], input[id*='zipCode']").first();
        if (await pinInp.count() > 0 && await pinInp.isVisible()) {
          console.log(\`[OracleAdapter] Filling US Zip Code (\${zipVal}) and selecting Redwood City, CA...\`);
          await pinInp.click();
          await pinInp.fill(zipVal);
          await page.waitForTimeout(1200);

          // Select matching option with 94065 or Redwood City
          const selectedGeo = await page.evaluate(() => {
            const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option'], .cx-autocomplete__list-item, li"));
            const match = opts.find(o => {
              const t = (o.textContent || "").toLowerCase();
              return t.includes("redwood") || (t.includes("94065") && t.includes("ca"));
            }) || opts.find(o => (o.textContent || "").includes("94065"));
            if (match) {
              (match as HTMLElement).click();
              return match.textContent?.trim();
            }
            return null;
          });

          if (selectedGeo) {
            console.log(\`[OracleAdapter] Selected US Postal Code autocomplete: \${selectedGeo}\`);
          } else {
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          await page.waitForTimeout(1000);
        }
      } catch (e: any) {
        console.warn(\`[OracleAdapter] Pin code note: \${e.message}\`);
      }

      // Fallback: If City, State, or County are still empty, fill them directly
      await fillIfVisible("input[name='city'], input[id*='city'], input[name='town'], input[id*='town']", cityVal, "City / Town");
      await fillIfVisible("input[name='region2'], input[id*='region2'], input[name='state'], input[id*='state'], input[name='province']", stateVal, "State");
      await fillIfVisible("input[name='region1'], input[id*='region1'], input[name='county'], input[id*='county']", "San Mateo", "County");`;

const newContent = content.slice(0, startIndex) + replacement + content.slice(endIndex + targetEnd.length);
fs.writeFileSync(filePath, newContent, "utf-8");
console.log("Successfully updated oracle.adapter.ts with US address, phone, and country code logic!");
