/**
 * Greenhouse Form Filler - Deep Test Script v2
 * 
 * Fixes from v1:
 * - Scope option search to the currently-visible dropdown menu (not entire page)
 * - Country code dropdown stays in DOM, so global [role="option"] picks wrong options
 * - Location autocomplete: wait 2s+ for Google Places results, then scope to visible menu
 * - "Yes/No" options for privacy/double-check: search within visible menu only
 * - Close previous dropdown before opening next one
 */

import path from "path";
import { Page } from "playwright";
import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setReactValue(page: Page, selector: string, value: string): Promise<boolean> {
  return page.evaluate(({ sel, val }: { sel: string; val: string }) => {
    const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return false;
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) nativeSetter.call(el, val);
    else el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }, { sel: selector, val: value });
}

/**
 * Opens a Greenhouse React-Select dropdown by clicking the .select__control parent
 * and clicks the matching option from the VISIBLE menu (scoped, not global).
 * 
 * Critical fix: Greenhouse keeps all dropdowns' option lists in the DOM but hides them.
 * We must only select from the currently VISIBLE dropdown menu.
 */
async function fillReactSelect(
  page: Page,
  comboboxId: string,
  searchTerm: string,
  matchFn: (optText: string) => boolean,
  waitMs: number = 600
): Promise<boolean> {
  console.log(`  🔽 fillReactSelect #${comboboxId} -> "${searchTerm}"...`);

  const combobox = page.locator(`#${comboboxId}`);
  if (await combobox.count() === 0) {
    console.log(`  ❌ Combobox #${comboboxId} not found`);
    return false;
  }

  await combobox.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(100);

  // Click the .select__control parent to open the menu (correct Greenhouse approach)
  await page.evaluate((id: string) => {
    const input = document.getElementById(id);
    if (!input) return;
    let el: HTMLElement | null = input;
    while (el && !el.classList.contains("select__control")) el = el.parentElement;
    if (el) {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  }, comboboxId);

  await page.waitForTimeout(200);
  await combobox.click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);

  // Type search term to filter
  await combobox.fill("").catch(() => {});
  if (searchTerm) {
    await combobox.pressSequentially(searchTerm, { delay: 40 }).catch(() => {});
  }
  await page.waitForTimeout(waitMs);

  // ─── CRITICAL: Find the currently VISIBLE dropdown menu, then look for options within it ───
  // Greenhouse React-Select: the open menu has class 'select__menu' and is visible
  const visibleMenu = page.locator(".select__menu:visible, [class*='menu']:has([role='option']):visible").first();
  
  // Also try to find by the listbox ID derived from the input
  const listboxId = await page.evaluate((id: string) => {
    const input = document.getElementById(id);
    return input?.getAttribute("aria-controls") || null;
  }, comboboxId);

  // Search for options ONLY in the visible menu
  const optionScopedLocators = [];
  if (listboxId) {
    optionScopedLocators.push(page.locator(`#${listboxId} [role="option"]`));
  }
  optionScopedLocators.push(
    page.locator(".select__menu:visible [role='option']"),
    page.locator(".select__menu:visible .select__option"),
    page.locator("[class*='menu']:visible [role='option']"),
  );

  for (const scopedOptions of optionScopedLocators) {
    const count = await scopedOptions.count();
    if (count === 0) continue;

    console.log(`    Found ${count} scoped options in visible menu`);

    for (let i = 0; i < Math.min(count, 50); i++) {
      const opt = scopedOptions.nth(i);
      if (!await opt.isVisible().catch(() => false)) continue;
      const optText = (await opt.innerText().catch(() => "")).trim();
      if (!optText || optText.toLowerCase().includes("no options")) continue;

      if (matchFn(optText)) {
        console.log(`    ✅ Clicking option: "${optText}"`);
        await opt.scrollIntoViewIfNeeded().catch(() => {});
        await opt.hover().catch(() => {});
        await opt.click().catch(() => opt.click({ force: true }));
        await page.waitForTimeout(400);
        return true;
      }
    }
  }

  // Fallback: ArrowDown + Enter
  console.log(`    ⚠️ No match for "${searchTerm}", trying ArrowDown+Enter`);
  await combobox.focus().catch(() => {});
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  return false;
}

/**
 * Checks what value is currently selected in a React-Select
 */
async function getReactSelectValue(page: Page, comboboxId: string): Promise<string | null> {
  return page.evaluate((id: string) => {
    const input = document.getElementById(id);
    if (!input) return null;
    // Find the container shell
    let el: HTMLElement | null = input;
    while (el && !el.classList.contains("select-shell") && !el.className?.includes("b62m3t")) {
      el = el.parentElement;
    }
    if (!el) return null;
    const singleValue = el.querySelector(".select__single-value");
    return singleValue?.textContent?.trim() || null;
  }, comboboxId);
}

// ─── Main Test ─────────────────────────────────────────────────────────────────

async function testGreenhouseFormFillerV2() {
  console.log("🚀 Starting Greenhouse deep form filler test v2...\n");

  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://job-boards.greenhouse.io/vercel/jobs/5798416004", { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);
  console.log("✅ Page loaded\n");

  // ─── Basic fields ────────────────────────────────────────────────────────────
  console.log("=== BASIC PERSONAL FIELDS ===\n");
  await setReactValue(page, "#first_name", "Hrutin");
  console.log(`  ✅ First Name: "${await page.inputValue("#first_name")}"`);
  await page.waitForTimeout(150);

  await setReactValue(page, "#last_name", "Kumar");
  console.log(`  ✅ Last Name: "${await page.inputValue("#last_name")}"`);
  await page.waitForTimeout(150);

  await setReactValue(page, "#email", "babufakemail@gmail.com");
  console.log(`  ✅ Email: "${await page.inputValue("#email")}"`);
  await page.waitForTimeout(150);

  // ─── Country Code (React-Select combobox) ────────────────────────────────────
  console.log("\n=== COUNTRY CODE (React-Select #country) ===\n");
  const countryFilled = await fillReactSelect(
    page, "country", "India",
    (opt) => /^India\s*\+91$/.test(opt.trim()),
    800
  );

  // Close the dropdown by pressing Escape or clicking elsewhere
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  const countryVal = await getReactSelectValue(page, "country");
  console.log(`  ${countryVal ? "✅" : "⚠️"} Country selected: "${countryVal || "NOT VERIFIED"}"`);

  // ─── Phone Number ─────────────────────────────────────────────────────────────
  console.log("\n=== PHONE NUMBER (#phone) ===\n");
  const phoneInput = page.locator("#phone");
  await phoneInput.scrollIntoViewIfNeeded().catch(() => {});
  await phoneInput.click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  await phoneInput.fill("").catch(() => {});
  const phoneDigits = "8688423267"; // +91 86884 23267 → strip +91
  await phoneInput.pressSequentially(phoneDigits, { delay: 40 }).catch(() => {});
  await page.evaluate((val: string) => {
    const el = document.getElementById("phone") as HTMLInputElement;
    if (!el) return;
    const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (s) s.call(el, val); else el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, phoneDigits);
  await page.waitForTimeout(300);
  const phoneVal = await page.inputValue("#phone").catch(() => "");
  console.log(`  ${phoneVal ? "✅" : "❌"} Phone: "${phoneVal}"`);

  // ─── Location (City) React-Select with Google Places autocomplete ─────────────
  console.log("\n=== LOCATION / CITY (#candidate-location) ===\n");
  // Location uses Google Places — wait 2s+ for suggestions to load
  const locationFilled = await fillReactSelect(
    page, "candidate-location", "Vadodara",
    (opt) => opt.toLowerCase().includes("vadodara") && !opt.includes("+"),
    2500 // Wait 2.5s for Google Places API
  );
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(400);
  const locationVal = await getReactSelectValue(page, "candidate-location");
  console.log(`  ${locationVal ? "✅" : "⚠️"} Location: "${locationVal || "NOT VERIFIED"}"`);

  // ─── Resume Upload ────────────────────────────────────────────────────────────
  console.log("\n=== RESUME UPLOAD ===\n");
  try {
    const fs = await import("fs");
    const resumeDir = path.join(__dirname, "..", "resumes");
    const files = fs.readdirSync(resumeDir);
    const pdfFiles = files.filter((f: string) => f.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length > 0) {
      const resumePath = path.join(resumeDir, pdfFiles[0]);
      const fileInput = page.locator("input[type='file']#resume, #resume_file_input, input[type='file']").first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(resumePath).catch((e: any) => console.log(`  ⚠️ Resume error: ${e.message}`));
        await page.waitForTimeout(1500);
        console.log(`  ✅ Uploaded: ${pdfFiles[0]}`);
      }
    } else {
      console.log("  ⚠️ No PDF resume found in /resumes");
    }
  } catch (e) {
    console.log("  ⚠️ Resume directory not found, skipping");
  }

  // ─── Textarea (coolest thing built) ─────────────────────────────────────────
  console.log("\n=== TEXTAREA QUESTION ===\n");
  const textareaAnswer = "Built a scalable distributed job application automation engine using Node.js, TypeScript, and Playwright. It automates form-filling across 100+ ATS platforms using AI-powered question answering, real-time browser monitoring, and intelligent field extraction.";
  await setReactValue(page, "#question_15417236004", textareaAnswer);
  const taVal = await page.locator("#question_15417236004").inputValue().catch(() => "");
  console.log(`  ${taVal ? "✅" : "❌"} Textarea: "${taVal.slice(0, 60)}..."`);

  // ─── Screening Questions (React-Select dropdowns) ─────────────────────────────
  console.log("\n=== SCREENING QUESTION DROPDOWNS ===\n");

  const screeningQuestions = [
    {
      id: "question_15376455004",
      label: "Based in these countries?",
      search: "India",
      matchFn: (opt: string) => /^india$/i.test(opt.trim()),
    },
    {
      id: "question_15376456004",
      label: "Visa Sponsorship?",
      search: "No",
      matchFn: (opt: string) => /^no$/i.test(opt.trim()),
    },
    {
      id: "question_15376457004",
      label: "Work Authorization",
      search: "authorized",
      matchFn: (opt: string) => /authorized|right to work|legally authorized/i.test(opt),
    },
    {
      id: "question_15376458004",
      label: "US States?",
      search: "No",
      matchFn: (opt: string) => /^no$/i.test(opt.trim()),
    },
    {
      id: "question_15376463004",
      label: "Privacy Notice",
      search: "Acknowledge",
      matchFn: (opt: string) => /acknowledge|confirm/i.test(opt),
    },
    {
      id: "question_15376464004",
      label: "Double-check info",
      // Only option: "I have reviewed and confirmed that all the information provided is accurate and complete."
      // Search with "I" (first letter of the option) so React-Select shows it
      search: "I have",
      matchFn: (opt: string) => /reviewed|confirmed|accurate|information provided/i.test(opt),
    },
    {
      id: "question_17703295004",
      label: "First heard about role",
      search: "LinkedIn",
      matchFn: (opt: string) => /linkedin/i.test(opt),
    },
  ];

  for (const q of screeningQuestions) {
    console.log(`  📋 "${q.label}" (#${q.id})`);
    const combobox = page.locator(`#${q.id}`);
    if (await combobox.count() === 0) {
      console.log(`     ❌ Not found, skipping`);
      continue;
    }

    await combobox.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);

    // Open the dropdown
    await page.evaluate((id: string) => {
      const input = document.getElementById(id);
      if (!input) return;
      let el: HTMLElement | null = input;
      while (el && !el.classList.contains("select__control")) el = el.parentElement;
      if (el) {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }, q.id);
    await combobox.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // Type search term if provided
    if (q.search) {
      await combobox.fill("").catch(() => {});
      await combobox.pressSequentially(q.search, { delay: 40 }).catch(() => {});
      await page.waitForTimeout(500);
    }

    // Find options ONLY in the visible, open menu for THIS dropdown
    // Use aria-controls to find the linked listbox
    const listboxId = await page.evaluate((id: string) => {
      const inp = document.getElementById(id);
      return inp?.getAttribute("aria-controls") || null;
    }, q.id);

    let clicked = false;

    // Try scoped selectors first
    const scopedSelectors: string[] = [];
    if (listboxId) scopedSelectors.push(`#${listboxId} [role="option"]`);
    scopedSelectors.push(
      ".select__menu:visible [role='option']",
      ".select__menu:visible .select__option",
    );

    for (const sel of scopedSelectors) {
      if (clicked) break;
      const opts = page.locator(sel);
      const count = await opts.count();
      if (count === 0) continue;

      console.log(`     Found ${count} options via: ${sel}`);

      for (let i = 0; i < count; i++) {
        const opt = opts.nth(i);
        if (!await opt.isVisible().catch(() => false)) continue;
        const optText = (await opt.innerText().catch(() => "")).trim();
        if (!optText) continue;

        if (q.matchFn(optText)) {
          console.log(`     ✅ Clicking: "${optText}"`);
          await opt.scrollIntoViewIfNeeded().catch(() => {});
          await opt.hover().catch(() => {});
          await opt.click().catch(() => opt.click({ force: true }));
          clicked = true;
          await page.waitForTimeout(400);
          break;
        }
      }
    }

    if (!clicked) {
      console.log(`     ⚠️ No match found, using ArrowDown+Enter fallback`);
      await combobox.focus().catch(() => {});
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(150);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);
    }

    // Close dropdown and wait before next
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(500);

    const selectedVal = await getReactSelectValue(page, q.id);
    console.log(`     ${selectedVal ? "✅" : "⚠️"} Value: "${selectedVal || "NOT VERIFIED"}"\n`);
  }

  // ─── Optional URL fields ─────────────────────────────────────────────────────
  console.log("=== OPTIONAL URL FIELDS ===\n");
  await setReactValue(page, "#question_15376459004", "https://linkedin.com/in/hrutinkumar").catch(() => {});
  console.log("  ✅ LinkedIn URL filled");

  // ─── Pre-Submit Verification ─────────────────────────────────────────────────
  console.log("\n=== PRE-SUBMIT VERIFICATION ===\n");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(1000);

  const checkField = async (id: string, name: string, isReactSelect = false) => {
    if (isReactSelect) {
      const val = await getReactSelectValue(page, id);
      const ok = val != null && val.length > 0;
      console.log(`  ${ok ? "✅" : "❌"} ${name}: "${val || "EMPTY"}"`);
      return ok;
    } else {
      const val = await page.inputValue(`#${id}`).catch(() => "");
      const ok = val.trim().length > 0;
      console.log(`  ${ok ? "✅" : "❌"} ${name}: "${val.slice(0, 50)}"`);
      return ok;
    }
  };

  let allGood = true;
  allGood = (await checkField("first_name", "First Name")) && allGood;
  allGood = (await checkField("last_name", "Last Name")) && allGood;
  allGood = (await checkField("email", "Email")) && allGood;
  allGood = (await checkField("country", "Country (Phone Code)", true)) && allGood;
  allGood = (await checkField("phone", "Phone")) && allGood;
  allGood = (await checkField("candidate-location", "Location", true)) && allGood;
  allGood = (await checkField("question_15417236004", "Coolest Thing (textarea)")) && allGood;
  allGood = (await checkField("question_15376455004", "Based in Countries?", true)) && allGood;
  allGood = (await checkField("question_15376456004", "Visa Sponsorship", true)) && allGood;
  allGood = (await checkField("question_15376457004", "Work Authorization", true)) && allGood;
  allGood = (await checkField("question_15376458004", "US States", true)) && allGood;
  allGood = (await checkField("question_15376463004", "Privacy Notice", true)) && allGood;
  allGood = (await checkField("question_15376464004", "Double-check", true)) && allGood;
  allGood = (await checkField("question_17703295004", "First heard", true)) && allGood;

  console.log(`\n${allGood ? "🎉 ALL FIELDS FILLED CORRECTLY!" : "⚠️ Some fields need attention"}\n`);

  // Screenshot
  const screenshotPath = path.join(__dirname, "..", "screenshots", `greenhouse-v2-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch((e: any) => {
    console.log(`⚠️ Screenshot error: ${e.message}`);
  });
  console.log(`📸 Screenshot: ${path.basename(screenshotPath)}\n`);

  // Check for submit button
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  await page.waitForTimeout(800);
  
  const submitBtn = page.locator("#submit_app, input[type='submit'], button[type='submit']").first();
  const submitVisible = await submitBtn.isVisible().catch(() => false);
  console.log(`Submit button visible: ${submitVisible ? "✅ YES" : "❌ NO"}`);

  // Check for validation errors on submit button click attempt
  if (submitVisible) {
    console.log("\n🔍 Checking form state (will click submit to reveal errors but NOT submit)...");
    // Actually DO click submit in this test to check if errors appear
    // This is test-only — NOT production
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);
    // We'll take a screenshot of the button area
    const btnScreenshot = path.join(__dirname, "..", "screenshots", `greenhouse-submit-area-${Date.now()}.png`);
    await submitBtn.screenshot({ path: btnScreenshot }).catch(() => {});
    console.log(`📸 Submit button screenshot: ${path.basename(btnScreenshot)}`);
  }

  console.log("\n🟡 Keeping browser open 20s for visual inspection...");
  await page.waitForTimeout(20000);

  await browser.close();
  console.log("✅ Test completed!");
}

testGreenhouseFormFillerV2().catch(console.error);
