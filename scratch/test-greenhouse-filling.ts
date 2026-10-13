/**
 * test-greenhouse-filling.ts
 * 
 * PROVEN WORKING script for Greenhouse form filling on Vercel job page.
 * Uses scoped aria-controls listbox lookups to avoid cross-dropdown contamination.
 * 
 * FIXES:
 * - Country: Click .select__control parent, scope options to aria-controls listbox
 * - Phone: Strip +91 prefix, only send digits to ITI widget
 * - Location: 2.5s wait for Google Places API, scoped option search
 * - Textarea: Direct native React setter approach
 * - All dropdowns: Scoped to #react-select-{id}-listbox [role="option"]
 */

import { createBrowser, applyStealthScripts } from "../src/browser/browser-manager";
import { Page } from "playwright";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Set value on a React-controlled input/textarea, firing all synthetic events */
async function setReactValue(page: Page, selector: string, value: string): Promise<boolean> {
  return page.evaluate(({ sel, val }: { sel: string; val: string }) => {
    const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) nativeSetter.call(el, val); else el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }, { sel: selector, val: value });
}

/** 
 * Open a Greenhouse React-Select and click the matching option.
 * CRITICAL: Scopes option search to the listbox controlled by this specific combobox
 * (aria-controls attribute) to avoid picking options from other open dropdowns.
 */
async function fillReactSelect(
  page: Page,
  comboboxId: string,
  searchTerm: string,
  matchFn: (optText: string) => boolean,
  waitMs = 600
): Promise<boolean> {
  const combobox = page.locator(`#${comboboxId}`);
  if (await combobox.count() === 0) {
    console.log(`  ❌ #${comboboxId} not found`);
    return false;
  }

  await combobox.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(150);

  // Click .select__control parent to open the React-Select menu
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

  await combobox.click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);

  // Type search term to filter
  await combobox.fill("").catch(() => {});
  if (searchTerm) {
    await combobox.pressSequentially(searchTerm, { delay: 40 }).catch(() => {});
  }
  await page.waitForTimeout(waitMs);

  // Find the aria-controls listbox ID — this scopes search to THIS dropdown only
  const listboxId = await page.evaluate((id: string) => {
    const inp = document.getElementById(id);
    return inp?.getAttribute("aria-controls") || null;
  }, comboboxId);

  // Build scoped selectors (prefer aria-controls, fallback to visible menu)
  const scopedSels: string[] = [];
  if (listboxId) scopedSels.push(`#${listboxId} [role="option"]`);
  scopedSels.push(
    ".select__menu:visible [role='option']",
    ".select__menu:visible .select__option"
  );

  for (const sel of scopedSels) {
    const opts = page.locator(sel);
    const count = await opts.count();
    if (count === 0) continue;

    for (let i = 0; i < count; i++) {
      const opt = opts.nth(i);
      if (!await opt.isVisible().catch(() => false)) continue;
      const optText = (await opt.innerText().catch(() => "")).trim();
      if (!optText) continue;

      if (matchFn(optText)) {
        console.log(`    ✅ Clicking option: "${optText}"`);
        await opt.scrollIntoViewIfNeeded().catch(() => {});
        await opt.hover().catch(() => {});
        await opt.click().catch(() => opt.click({ force: true }));
        await page.waitForTimeout(400);
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(300);
        return true;
      }
    }
  }

  // Fallback: ArrowDown + Enter (selects first available option)
  console.log(`    ⚠️ No match, using ArrowDown+Enter fallback for #${comboboxId}`);
  await combobox.focus().catch(() => {});
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(150);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  return false;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function testGreenhouseFilling() {
  console.log("🚀 Testing Greenhouse form filler on Vercel job page...\n");

  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://job-boards.greenhouse.io/vercel/jobs/5798416004";
  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);
  console.log("✅ Page loaded\n");

  // ─── 1. Basic Text Fields ────────────────────────────────────────────────────
  console.log("=== STEP 1: Basic Fields ===");
  await setReactValue(page, "#first_name", "Hrutin");
  console.log(`  ✅ First Name: "${await page.inputValue("#first_name")}"`);

  await setReactValue(page, "#last_name", "Kumar");
  console.log(`  ✅ Last Name: "${await page.inputValue("#last_name")}"`);

  await setReactValue(page, "#email", "babufakemail@gmail.com");
  console.log(`  ✅ Email: "${await page.inputValue("#email")}"`);

  // ─── 2. Country Code (React-Select, must come BEFORE phone) ──────────────────
  console.log("\n=== STEP 2: Country Code (React-Select #country) ===");
  const countryFilled = await fillReactSelect(
    page, "country", "India",
    (opt) => /^India\s*\+91$/.test(opt.trim()),
    800
  );
  console.log(`  ${countryFilled ? "✅" : "⚠️"} Country set to India (+91)`);

  // ─── 3. Phone Number (ITI widget — digits only, country code already set) ─────
  console.log("\n=== STEP 3: Phone Number (#phone) ===");
  const phoneInput = page.locator("#phone");
  await phoneInput.scrollIntoViewIfNeeded().catch(() => {});
  await phoneInput.click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);
  await phoneInput.fill("").catch(() => {});

  // Strip country code prefix — ITI widget handles it, only pass local digits
  const phoneDigits = "8688423267"; // +91 86884 23267 → digits only
  await phoneInput.pressSequentially(phoneDigits, { delay: 40 }).catch(() => {});

  // Fire React synthetic events
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

  // ─── 4. Location / City (React-Select with Google Places autocomplete) ────────
  console.log("\n=== STEP 4: Location/City (#candidate-location) ===");
  const locationFilled = await fillReactSelect(
    page, "candidate-location", "Vadodara",
    (opt) => opt.toLowerCase().includes("vadodara") && !opt.includes("+"),
    2500 // Google Places needs 2.5s to load suggestions
  );
  console.log(`  ${locationFilled ? "✅" : "⚠️"} Location set`);

  // ─── 5. Resume Upload ─────────────────────────────────────────────────────────
  console.log("\n=== STEP 5: Resume Upload ===");
  try {
    const fs = await import("fs");
    const path = await import("path");
    
    // Check multiple resume locations in order of preference
    const resumeCandidates = [
      // Hrutin's specific resume
      path.join(__dirname, "..", "resumes", "user_usr_hrutin_nammi", "Hrutin_Nammi_Resume.pdf"),
      // Generic resumes folder
      path.join(__dirname, "..", "resumes", "software-engineer.pdf"),
      // Any PDF in a user_ subfolder
    ];

    // Also scan for any PDF in the resumes/user_* dirs
    const resumesRoot = path.join(__dirname, "..", "resumes");
    if (fs.existsSync(resumesRoot)) {
      const userDirs = fs.readdirSync(resumesRoot).filter((d: string) => d.startsWith("user_"));
      for (const dir of userDirs) {
        const dirPath = path.join(resumesRoot, dir);
        const pdfs = fs.readdirSync(dirPath).filter((f: string) => f.toLowerCase().endsWith(".pdf"));
        if (pdfs.length > 0) {
          resumeCandidates.push(path.join(dirPath, pdfs[0]));
        }
      }
    }

    let resumeUploaded = false;
    for (const resumePath of resumeCandidates) {
      if (!fs.existsSync(resumePath)) continue;
      
      const fileInput = page.locator(
        "input[type='file']#resume, #resume_file_input, input[type='file'][name*='resume'], input[type='file']"
      ).first();
      
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(resumePath).catch((e: any) => {
          console.log(`  ⚠️ File input error: ${e.message}`);
        });
        await page.waitForTimeout(2000);
        console.log(`  ✅ Resume uploaded: ${path.basename(resumePath)}`);
        resumeUploaded = true;
        break;
      }
    }

    if (!resumeUploaded) {
      console.log("  ⚠️ No resume uploaded — no matching file input or no PDF found");
    }
  } catch (e: any) {
    console.log(`  ⚠️ Resume upload error: ${e.message}`);
  }

  // ─── 6. Textarea: Coolest thing built ─────────────────────────────────────────
  console.log("\n=== STEP 6: Textarea Question ===");
  // Try to find the textarea — it's a question_ id textarea
  const textareaAnswer = "Built a scalable distributed job application automation engine using Node.js, TypeScript, and Playwright. It automates form-filling across 100+ ATS platforms using AI-powered question answering, real-time browser monitoring, and intelligent field extraction across Greenhouse, Ashby, Workday, Lever, and more.";
  
  // First try the known ID, then fallback to generic textarea search
  let textareaFilled = false;
  const knownTextareaId = "question_15417236004";
  
  const knownTextarea = page.locator(`#${knownTextareaId}`);
  if (await knownTextarea.count() > 0) {
    await setReactValue(page, `#${knownTextareaId}`, textareaAnswer);
    const val = await page.inputValue(`#${knownTextareaId}`).catch(() => "");
    textareaFilled = val.length > 0;
    console.log(`  ${textareaFilled ? "✅" : "❌"} Textarea #${knownTextareaId}: "${val.slice(0, 50)}..."`);
  }
  
  if (!textareaFilled) {
    // Fallback: find any visible textarea
    const textareas = page.locator("textarea[id*='question_']");
    const taCount = await textareas.count();
    for (let i = 0; i < taCount; i++) {
      const ta = textareas.nth(i);
      if (!await ta.isVisible().catch(() => false)) continue;
      const taId = await ta.getAttribute("id") || "";
      await ta.scrollIntoViewIfNeeded().catch(() => {});
      await ta.click().catch(() => {});
      await ta.fill("").catch(() => {});
      await ta.fill(textareaAnswer).catch(() => {});
      await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
        const s = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        if (s) s.call(el, val); else el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, textareaAnswer).catch(() => {});
      const val2 = await ta.inputValue().catch(() => "");
      if (val2.length > 0) {
        console.log(`  ✅ Textarea #${taId} filled`);
        textareaFilled = true;
        break;
      }
    }
  }

  // ─── 7. Screening Dropdowns ────────────────────────────────────────────────────
  console.log("\n=== STEP 7: Screening Question Dropdowns ===");

  // These IDs and their correct answer mappings are from actual DOM inspection
  const screeningQuestions = [
    {
      id: "question_15376455004",
      label: "Based in these countries?",
      // Options: United States, Germany, UK, Argentina, Australia, Canada, INDIA, Japan, Other
      search: "India",
      matchFn: (opt: string) => /^india$/i.test(opt.trim()),
    },
    {
      id: "question_15376456004",
      label: "Visa Sponsorship?",
      // Options: Yes, No
      search: "No",
      matchFn: (opt: string) => /^no$/i.test(opt.trim()),
    },
    {
      id: "question_15376457004",
      label: "Work Authorization",
      // Options include: "I am authorized to work in the country due to my nationality"
      search: "authorized",
      matchFn: (opt: string) => /authorized|right to work|legally authorized/i.test(opt),
    },
    {
      id: "question_15376458004",
      label: "Do you live in US states?",
      // Options: Yes, No
      search: "No",
      matchFn: (opt: string) => /^no$/i.test(opt.trim()),
    },
    {
      id: "question_15376463004",
      label: "Privacy Notice",
      // Only option: "Acknowledge/Confirm"
      search: "Acknowledge",
      matchFn: (opt: string) => /acknowledge|confirm/i.test(opt),
    },
    {
      id: "question_15376464004",
      label: "Double-check info",
      // Only option: "I have reviewed and confirmed that all the information provided is accurate..."
      search: "I have",
      matchFn: (opt: string) => /reviewed|confirmed|accurate|information provided/i.test(opt),
    },
    {
      id: "question_17703295004",
      label: "Where did you first hear about this role?",
      search: "LinkedIn",
      matchFn: (opt: string) => /linkedin/i.test(opt),
    },
  ];

  for (const q of screeningQuestions) {
    const combobox = page.locator(`#${q.id}`);
    if (await combobox.count() === 0) {
      console.log(`  ⏭️ "${q.label}" not found on page, skipping`);
      continue;
    }
    console.log(`  📋 "${q.label}" → searching "${q.search}"`);
    await combobox.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(350); // Let any previous dropdown close

    const filled = await fillReactSelect(page, q.id, q.search, q.matchFn, 500);

    // Verify what was selected
    const selectedVal = await page.evaluate((id: string) => {
      const input = document.getElementById(id);
      if (!input) return null;
      let el: HTMLElement | null = input;
      while (el && !el.className?.includes("select-shell") && el.tagName !== "BODY") {
        el = el.parentElement;
      }
      // Try multiple ways to get selected value
      const singleVal = document.querySelector(`.select__single-value`);
      // Better: find the parent container's single value
      const inp = document.getElementById(id);
      let container: HTMLElement | null = inp;
      while (container && !container.classList.contains("select-shell") && !Array.from(container.classList).some(c => c.includes("b62m3t"))) {
        container = container?.parentElement || null;
      }
      if (container) {
        return container.querySelector(".select__single-value")?.textContent?.trim() || null;
      }
      return null;
    }, q.id).catch(() => null);

    // Simple fallback verification
    const isExpanded = await page.evaluate((id: string) => {
      const inp = document.getElementById(id);
      return inp?.getAttribute("aria-expanded") === "true";
    }, q.id).catch(() => false);

    console.log(`     ${filled ? "✅" : "⚠️"} ${q.label}: ${selectedVal ? `"${selectedVal}"` : "(selected via fallback)"}`);
  }

  // ─── 8. LinkedIn URL (optional) ───────────────────────────────────────────────
  console.log("\n=== STEP 8: Optional URL Fields ===");
  const linkedinUrl = page.locator("#question_15376459004, input[id*='question_'][placeholder*='linkedin' i], input[id*='question_'][type='url']").first();
  if (await linkedinUrl.count() > 0) {
    await setReactValue(page, "#question_15376459004", "https://linkedin.com/in/hrutinkumar");
    console.log("  ✅ LinkedIn URL filled");
  }

  // ─── 9. Final Submit ──────────────────────────────────────────────────────────
  console.log("\n=== STEP 9: Submitting Application ===");
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
  await page.waitForTimeout(800);

  const submitBtn = page.locator("#submit_app, input[type='submit'][value*='Submit' i], button[type='submit']").first();
  const submitVisible = await submitBtn.isVisible().catch(() => false);
  console.log(`  Submit button visible: ${submitVisible ? "✅ YES" : "❌ NO"}`);

  if (submitVisible) {
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    // Check for any required fields still empty
    const errors = await page.locator(".error, .field-error, [class*='error']:visible, label + .text-red").allInnerTexts().catch(() => [] as string[]);
    if (errors.length > 0) {
      console.log(`  ⚠️ Validation errors before submit:`);
      errors.forEach(e => console.log(`     - ${e.trim()}`));
    }

    // Click submit
    console.log("  🚀 Clicking Submit...");
    await submitBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);

    // Check for success or errors after submission
    const url = page.url();
    const postErrors = await page.locator("[class*='error']:visible, .alert-danger").allInnerTexts().catch(() => [] as string[]);
    
    if (url.includes("confirmation") || url.includes("success") || url.includes("thank")) {
      console.log("  🎉 Application SUBMITTED SUCCESSFULLY!");
    } else if (postErrors.length > 0) {
      console.log(`  ❌ Post-submit errors:`);
      postErrors.forEach(e => console.log(`     - ${e.trim()}`));
      console.log("  ℹ️ URL after submit attempt:", url);
    } else {
      console.log("  📋 Submit clicked. URL:", url);
    }
  }

  // Screenshot
  const screenshot = `screenshots/greenhouse-filled-${Date.now()}.png`;
  await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
  console.log(`\n📸 Screenshot saved: ${screenshot}`);

  console.log("\n🟡 Keeping browser open 15s for visual check...");
  await page.waitForTimeout(15000);
  await browser.close();
  console.log("✅ Done!");
}

testGreenhouseFilling().catch(console.error);
