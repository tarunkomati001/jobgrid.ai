/**
 * Inspect the actual option values in all Greenhouse React-Select dropdowns
 */

import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

async function inspectDropdownOptions() {
  console.log("🔍 Inspecting actual dropdown option values...\n");
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://job-boards.greenhouse.io/vercel/jobs/5798416004", { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2000);

  const dropdowns = [
    { id: "question_15376455004", label: "Based in these countries?" },
    { id: "question_15376456004", label: "Visa Sponsorship" },
    { id: "question_15376457004", label: "Work Authorization" },
    { id: "question_15376458004", label: "US States" },
    { id: "question_15376463004", label: "Privacy Notice" },
    { id: "question_15376464004", label: "Double-check info" },
    { id: "question_17703295004", label: "First heard about role" },
  ];

  for (const dd of dropdowns) {
    console.log(`\n📋 ${dd.label} (#${dd.id}):`);
    
    const combobox = page.locator(`#${dd.id}`);
    if (await combobox.count() === 0) {
      console.log("  ❌ Not found");
      continue;
    }

    await combobox.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(200);

    // Open the dropdown by clicking the .select__control
    await page.evaluate((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      let el: HTMLElement | null = input;
      while (el && !el.classList.contains("select__control")) {
        el = el.parentElement;
      }
      if (el) {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }, dd.id);

    await combobox.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);

    // Get all visible options
    const options = await page.locator('[role="option"], .select__option').allInnerTexts().catch(() => [] as string[]);
    if (options.length > 0) {
      console.log(`  Options found (${options.length}):`);
      options.forEach((opt, i) => console.log(`    ${i + 1}. "${opt.trim()}"`));
    } else {
      console.log("  ⚠️ No options visible after click");
    }

    // Close by pressing Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Also check the location field - what happens when we type?
  console.log("\n\n📍 Testing location autocomplete (#candidate-location):");
  const locationInput = page.locator("#candidate-location");
  await locationInput.scrollIntoViewIfNeeded().catch(() => {});
  
  // Click control to open
  await page.evaluate(() => {
    const input = document.getElementById("candidate-location");
    if (!input) return;
    let el: HTMLElement | null = input;
    while (el && !el.classList.contains("select__control")) {
      el = el.parentElement;
    }
    if (el) {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });
  await locationInput.click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  await locationInput.pressSequentially("Vadodara", { delay: 50 });
  
  // Wait longer for Google Places autocomplete
  await page.waitForTimeout(2000);
  
  const locationOptions = await page.locator('[role="option"], .select__option, div[class*="option"]').allInnerTexts().catch(() => [] as string[]);
  console.log(`  Options after typing "Vadodara" (waited 2s): ${locationOptions.length}`);
  locationOptions.forEach((opt, i) => console.log(`    ${i + 1}. "${opt.trim()}"`));

  await page.waitForTimeout(3000);
  await browser.close();
}

inspectDropdownOptions().catch(console.error);
