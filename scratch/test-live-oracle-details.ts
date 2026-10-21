import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer";
const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  console.log("Navigating to URL...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const testEmail = `hrutin_test_live_${Date.now()}@gmail.com`;
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

  // SECTION 1: Check how to change country-codes-dropdownphoneNumber to India (+91)
  console.log("=== TESTING PHONE COUNTRY CODE SELECT ===");
  const pInput = page.locator("input#country-codes-dropdownphoneNumber");
  console.log("phoneCountryInput count:", await pInput.count());
  if (await pInput.count() > 0) {
    console.log("Initial phone country value:", await pInput.inputValue());
    
    // Test 1: Click the reset button if value exists
    await page.evaluate(() => {
      const reset = document.getElementById("country-codes-dropdownphoneNumber-reset-button") as HTMLElement;
      if (reset) reset.click();
    });
    await page.waitForTimeout(500);

    // Test 2: Fill India
    await pInput.click();
    await pInput.fill("India");
    await page.waitForTimeout(1000);

    // Check listbox options
    const listboxOpts = await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("#country-codes-dropdownphoneNumber-listbox [role='option'], [role='option'], .cx-select__list-item"));
      return opts.map(o => ({ text: o.textContent?.trim(), id: o.id }));
    });
    console.log("Listbox options found for phone country:", listboxOpts.slice(0, 5));

    // Click the matching India option
    await page.evaluate(() => {
      const opts = Array.from(document.querySelectorAll("[role='option'], .cx-select__list-item"));
      const india = opts.find(o => o.textContent?.toLowerCase().includes("india") || o.textContent?.includes("+91"));
      if (india) (india as HTMLElement).click();
    });
    await page.waitForTimeout(500);
    console.log("Phone country value after selection:", await pInput.inputValue());
  }

  // Upload resume in Sec 1
  const rInput = page.locator("input[type='file']").first();
  if (await rInput.count() > 0) {
    await rInput.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Fill Sec 1 basics
  await page.fill("input[name='firstName'], input[id*='firstName']", "Hrutin").catch(() => {});
  await page.fill("input[name='lastName'], input[id*='lastName']", "Nammi").catch(() => {});
  await page.fill("input[type='tel']", "8688423267").catch(() => {});
  await page.fill("input[name='addressLine1'], input[id*='addressLine1']", "ava street").catch(() => {});
  await page.fill("input[name='postalCode'], input[id*='postalCode']", "390144").catch(() => {});
  await page.fill("input[name='city'], input[id*='city']", "Vadodara").catch(() => {});

  // Advance to Sec 2
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(5000);

  // Resume in Sec 2
  const rInput2 = page.locator("input[type='file'][id*='attachment-upload-2'], input[type='file']").first();
  if (await rInput2.count() > 0) {
    await rInput2.setInputFiles(resumePath);
    await page.waitForTimeout(6000);
  }

  // Advance to Sec 3
  await page.locator("button:has-text('Next')").first().click();
  await page.waitForTimeout(8000);
  console.log("On Section 3. URL:", page.url());

  // Check the Experience block specifically
  console.log("=== TESTING EXPERIENCE SECTION ===");
  const expBlockInfo = await page.evaluate(() => {
    // Find all blocks with Experience in title
    const headings = Array.from(document.querySelectorAll("h2, h3, .apply-flow-block__title"));
    const expHeading = headings.find(h => h.textContent?.toLowerCase().includes("experience"));
    if (!expHeading) return { found: false };
    const container = expHeading.closest("apply-flow-block, .apply-flow-block");
    if (!container) return { found: true, noContainer: true };

    const tiles = Array.from(container.querySelectorAll(".apply-flow-profile-item-tile"));
    const addBtn = container.querySelector("button[id*='profileItemsAddButton'], .apply-flow-profile-item-tile__new-tile");

    return {
      found: true,
      tileCount: tiles.length,
      tiles: tiles.map(t => ({
        id: t.id,
        className: t.className,
        text: t.textContent?.replace(/\s+/g, " ").trim(),
        hasEdit: !!t.querySelector(".apply-flow-profile-item-tile__edit-item-icon"),
        hasDelete: !!t.querySelector(".apply-flow-profile-item-tile__delete-icon")
      })),
      addBtnText: addBtn?.textContent?.trim()
    };
  });
  console.log("Experience block info:", JSON.stringify(expBlockInfo, null, 2));

  // Now, let's click Edit on the invalid tile or first tile, OR click "Add Experience"
  // Let's test clicking the edit icon on the invalid tile
  const clickRes = await page.evaluate(() => {
    const invalidTile = document.querySelector(".apply-flow-profile-item-tile--invalid");
    if (invalidTile) {
      const editBtn = invalidTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon") as HTMLElement;
      if (editBtn) {
        editBtn.click();
        return "CLICKED_INVALID_EDIT";
      }
    }
    const addBtn = document.querySelector(".apply-flow-profile-item-tile__new-tile") as HTMLElement;
    if (addBtn) {
      addBtn.click();
      return "CLICKED_ADD_EXP";
    }
    return "NOTHING_CLICKED";
  });
  console.log("Click result:", clickRes);
  await page.waitForTimeout(3000);

  // Now check what elements exist inside the container or on page!
  const afterClickInfo = await page.evaluate(() => {
    // Look for inputs or forms inside the experience container
    const headings = Array.from(document.querySelectorAll("h2, h3, .apply-flow-block__title"));
    const expHeading = headings.find(h => h.textContent?.toLowerCase().includes("experience"));
    const container = expHeading?.closest("apply-flow-block, .apply-flow-block");
    
    const inputs = container ? Array.from(container.querySelectorAll("input, select, textarea, button, [role='combobox']")) : [];
    return inputs.map(el => {
      const inp = el as any;
      let label = "";
      if (inp.id) {
        const l = document.querySelector(`label[for='${inp.id}']`);
        if (l) label = l.textContent?.trim() || "";
      }
      if (!label) {
        const p = el.closest(".form-block, .field, .input-row, div");
        if (p) {
          const l = p.querySelector("label, .label, span.title");
          if (l) label = l.textContent?.trim() || "";
        }
      }
      return {
        tag: el.tagName,
        id: inp.id,
        name: inp.name,
        type: inp.type,
        label,
        value: inp.value,
        text: el.textContent?.trim().slice(0, 40)
      };
    }).filter(x => x.id || x.name || x.label);
  });
  console.log("Inputs inside Experience block after clicking Edit/Add:", JSON.stringify(afterClickInfo, null, 2));

  // Take screenshot of experience area
  await page.evaluate(() => {
    const expHeading = Array.from(document.querySelectorAll("h2, h3, .apply-flow-block__title")).find(h => h.textContent?.toLowerCase().includes("experience"));
    if (expHeading) expHeading.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "scratch/oracle_exp_scrolled.png" });

  await browser.close();
}

main().catch(console.error);
