import path from "path";
import { Page, Frame } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { mapLabelToProfileKey, normalizeLabel } from "../../application/field-mapper";
import { suggestAnswerForQuestion } from "../../application/question-answering";
import { extractLogicalFields, fillLogicalField, fillCustomSelectDropdown, verifyFieldFilled, simulateHumanMouse, humanClick, typeLikeHuman } from "../../browser/form-filler";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { db } from "../../database/db";
import { v4 as uuidv4 } from "uuid";
import { resolveLocalResumePath } from "../../utils/path-resolver";

export class GreenhouseAdapter implements ATSAdapter {

  private async getTarget(page: Page): Promise<Page | Frame> {
    if (page.url().includes("greenhouse.io")) {
      return page;
    }

    let iframe = page.frames().find(f => f.url().includes("greenhouse.io") && f !== page.mainFrame());
    
    if (!iframe) {
      try {
        const frameSelector = "iframe[src*='greenhouse.io'], iframe#grnhse_iframe, iframe[name*='greenhouse']";
        await page.waitForSelector(frameSelector, { timeout: 8000 }).catch(() => {});
        iframe = page.frames().find(f => f.url().includes("greenhouse.io") && f !== page.mainFrame());
      } catch (e) {}
    }
    
    if (iframe) {
      console.log(`ℹ️ [GreenhouseAdapter]: Routing operations to iframe: ${iframe.url()}`);
      await iframe.waitForSelector("input, textarea, select, button[type='submit'], #submit_app", { timeout: 15000 }).catch(() => {});
      return iframe;
    }
    return page;
  }
  
  async detect(page: Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("greenhouse.io")) return true;
    
    const content = await page.content();
    const lower = content.toLowerCase();
    if (lower.includes("greenhouse.io") || (await page.$("#grnhse_app")) !== null || (await page.$("form[action*='greenhouse']")) !== null) {
      return true;
    }
    return false;
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const target = await this.getTarget(page);
    const pageTitle = await page.title();
    
    const h1Text = await target.locator("h1, .app-title, #header h1").first().innerText().catch(() => "");
    const companyText = await target.locator(".company-name, #header .company, [class*='company']").first().innerText().catch(() => "");
    const description = await target.locator("#content, #main, .content, [id*='description'], [class*='description']").first().innerText().catch(() => "");

    let company = companyText.trim() || "Unknown Company";
    
    if (company === "Unknown Company") {
      try {
        const url = target.url();
        const pathname = new URL(url).pathname;
        const parts = pathname.split("/").filter(Boolean);
        if (parts[0] && parts[0] !== "embed" && parts[0] !== "jobs") {
          company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        } else if (parts[1] && parts[0] === "embed") {
          company = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        }
      } catch (e) {}
    }

    if (company === "Unknown Company" && pageTitle.includes("at ")) {
      const parts = pageTitle.split("at ");
      if (parts.length > 1) {
        company = parts[1].trim();
      }
    }

    return {
      company,
      title: h1Text || pageTitle.split("-")[0]?.trim() || "Unknown Position",
      description: description || "No description extracted",
      ats: "GREENHOUSE",
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    const target = await this.getTarget(page);
    await injectVisualHUD(target);
    await updateHUDStatus(target, "Scanning Greenhouse application form...", "Analyzing inputs & dropdowns", "info", 15);
    return extractLogicalFields(target);
  }

  async fillForm(
    page: Page, 
    profile: UserProfile, 
    additionalAnswers: Record<string, string> = {}, 
    preExtractedFields?: FormField[]
  ): Promise<void> {
    console.log("🚀 [GreenhouseAdapter]: Starting form filling flow...");
    const target = await this.getTarget(page);
    await injectVisualHUD(target);
    
    const fields = preExtractedFields || await this.extractFields(page);
    console.log(`📋 [GreenhouseAdapter]: Processing ${fields.length} form fields for candidate ${profile.firstName} ${profile.lastName}...`);

    // Fetch saved database answers
    let userSavedAnswers: Record<string, string> = {};
    if (profile.userId) {
      try {
        const savedRes = await db.query(
          "SELECT normalized_question, answer FROM user_saved_answers WHERE user_id = $1",
          [profile.userId]
        );
        for (const row of savedRes.rows) {
          userSavedAnswers[normalizeLabel(row.normalized_question)] = row.answer;
        }
      } catch (e) {}
    }

    let filledCount = 0;
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const normLabel = normalizeLabel(field.label);
      const profileKey = mapLabelToProfileKey(field.label);
      
      let targetValue = "";

      // 1. Check direct profile key mapping
      if (profileKey && profile[profileKey] !== undefined) {
        const val = profile[profileKey];
        if (typeof val === "boolean") {
          targetValue = val ? "Yes" : "No";
        } else {
          targetValue = String(val);
        }
      }

      // Special overrides for common Greenhouse fields
      if (normLabel.includes("first name") || normLabel === "first_name" || normLabel === "firstname") {
        targetValue = profile.firstName;
      } else if (normLabel.includes("last name") || normLabel === "last_name" || normLabel === "lastname") {
        targetValue = profile.lastName;
      } else if (normLabel === "email" || normLabel.includes("email address")) {
        targetValue = profile.email;
      } else if (normLabel.includes("phone") || normLabel.includes("mobile") || normLabel === "country" || field.id === "country" || field.id === "phone") {
        targetValue = profile.phone;
      } else if (normLabel.includes("based in any of these countries") || normLabel.includes("accepting applications")) {
        targetValue = "India";
      } else if (normLabel.includes("visa sponsorship")) {
        targetValue = "No";
      } else if (normLabel.includes("authorization to work") || normLabel.includes("work authorization")) {
        targetValue = "Authorized to work";
      } else if (normLabel.includes("following states") || normLabel.includes("live in one")) {
        targetValue = "No";
      } else if (normLabel.includes("privacy notice") || normLabel.includes("acknowledge")) {
        targetValue = "Acknowledge/Confirm";
      } else if (normLabel.includes("doublecheck") || normLabel.includes("double check") || normLabel.includes("double-check") || normLabel.includes("ensuring accuracy")) {
        targetValue = "I have reviewed and confirmed that all the information provided is accurate and complete.";
      } else if (normLabel.includes("first hear") || normLabel.includes("hear about")) {
        targetValue = "LinkedIn";
      } else if (normLabel.includes("coolest thing") || normLabel.includes("coolest") || normLabel.includes("built")) {
        targetValue = "Built a scalable distributed web automation engine using Node.js, TypeScript, and Playwright.";
      }

      // 2. Check additionalAnswers or DB saved answers
      if (!targetValue) {
        for (const [addQ, addA] of Object.entries(additionalAnswers)) {
          if (normalizeLabel(addQ) === normLabel || normLabel.includes(normalizeLabel(addQ))) {
            targetValue = addA;
            break;
          }
        }
      }

      if (!targetValue && userSavedAnswers[normLabel]) {
        targetValue = userSavedAnswers[normLabel];
      }

      // 3. Smart Question Answering Suggestion
      if (!targetValue) {
        const optionsLabels = field.options?.map(o => o.label);
        targetValue = suggestAnswerForQuestion(field.label, optionsLabels);
      }

      // Skip reCAPTCHA fields
      if (field.id.includes("recaptcha") || normLabel.includes("recaptcha")) {
        continue;
      }

      // Skip file input fields if targetValue is text instead of a file path
      if (field.type === "file" && !/\.(pdf|doc|docx|txt)$/i.test(targetValue)) {
        console.log(`⏩ [GreenhouseAdapter]: Skipping file input "${field.label}" (text answer suggested instead of file path).`);
        continue;
      }

      if (!targetValue) continue;

      const pct = Math.floor(20 + ((i + 1) / fields.length) * 65);
      await updateHUDStatus(
        target, 
        `Filling Field [${i + 1}/${fields.length}]`, 
        `Setting "${field.label}" -> ${targetValue.slice(0, 35)}...`, 
        "info", 
        pct
      );

      let isFilled = false;

      // ── 1. Phone & Country Code handling (Ensures BOTH Country dropdown & Phone input are populated)
      const isPhoneOrCountry = 
        field.id === "country" || 
        field.id === "phone" || 
        field.id.includes("phone") || 
        normLabel.includes("phone") || 
        normLabel.includes("mobile") || 
        normLabel === "country";

      if (isPhoneOrCountry) {
        // Step 1A: Fill Country Code if #country combobox is present
        const countryCombobox = target.locator("input[role='combobox']#country, #country").first();
        if (await countryCombobox.count() > 0) {
          const isIndianPhone = profile.phone.includes("+91") || /^(?:\+91[\s-]?)?[6-9]\d{9}$/.test(profile.phone.replace(/\s/g, ""));
          const isUSPhone = profile.phone.includes("+1") || profile.phone.replace(/[^0-9]/g, "").length === 10;
          let targetCountryName: string;
          if (isIndianPhone) {
            targetCountryName = "India";
          } else if (isUSPhone) {
            targetCountryName = "United States";
          } else {
            targetCountryName = profile.location?.includes("India") ? "India" : "United States";
          }
          await this.fillGreenhouseReactSelect(target, "country", targetCountryName, (opt) => {
            return opt.toLowerCase().startsWith(targetCountryName.toLowerCase());
          });
          console.log(`🌍 [GreenhouseAdapter]: Country code select -> "${targetCountryName}" set`);
        }

        // Step 1B: Fill Phone Number into #phone
        const phoneInput = target.locator("#phone, input[type='tel'], input[name='phone']").first();
        if (await phoneInput.count() > 0) {
          const cleanPhone = profile.phone
            .replace(/^\+91[\s-]?/, "")
            .replace(/^\+1[\s-]?/, "")
            .replace(/^00\d{1,3}[\s-]?/, "")
            .replace(/\s/g, "");
          const phoneDigits = cleanPhone || profile.phone.replace(/[^0-9]/g, "");

          await phoneInput.scrollIntoViewIfNeeded().catch(() => {});
          await phoneInput.click({ force: true }).catch(() => {});
          await page.waitForTimeout(150);
          await phoneInput.fill("").catch(() => {});
          await phoneInput.pressSequentially(phoneDigits, { delay: 80 + Math.floor(Math.random() * 50) }).catch(() => {});

          await phoneInput.evaluate((el: HTMLInputElement, val: string) => {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, val); else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          }, phoneDigits).catch(() => {});

          const currentVal = await phoneInput.inputValue().catch(() => "");
          console.log(`📞 [GreenhouseAdapter]: Phone field filled with "${currentVal}" (from "${profile.phone}")`);
        }
        isFilled = true;
      }

      // ── 2. Textarea Inputs (MUST NEVER BE ROUTED TO SELECT/DROPDOWN!)
      const isTextarea = 
        field.type === "textarea" || 
        (await target.locator(`textarea[id="${field.id}"]`).count()) > 0 ||
        normLabel.includes("coolest thing") ||
        normLabel.includes("built");

      if (!isFilled && isTextarea) {
        const ta = target.locator(`textarea[id="${field.id}"], #${field.id}`).first();
        if (await ta.count() > 0) {
          await ta.scrollIntoViewIfNeeded().catch(() => {});
          await ta.click({ force: true }).catch(() => {});
          await ta.fill("").catch(() => {});
          await ta.fill(targetValue).catch(() => {});
          await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
            const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, val); else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          }, targetValue).catch(() => {});
          const val = await ta.inputValue().catch(() => "");
          console.log(`📝 [GreenhouseAdapter]: Textarea #${field.id} populated: "${val.slice(0, 45)}..."`);
          isFilled = true;
        }
      }

      // ── 3. Comboboxes & Custom Select dropdowns
      // Only treat as select if element is ACTUALLY a select or combobox (NOT textarea/text input!)
      if (!isFilled) {
        const isCombobox = (await target.locator(`input[role='combobox']#${field.id}, #${field.id}[role='combobox']`).count()) > 0;
        const isNativeSelect = (await target.locator(`select#${field.id}`).count()) > 0;
        const isSelectField = 
          field.type === "select" || 
          isCombobox || 
          isNativeSelect || 
          field.id.includes("location") ||
          normLabel.includes("location") ||
          normLabel.includes("city");

        if (isSelectField) {
          isFilled = await this.fillGreenhouseSelect(target, field, targetValue);
        }
      }

      // ── 4. Plain text/email/URL inputs (first_name, last_name, email, linkedin, twitter, website, etc.)
      if (!isFilled) {
        const explicitInput = target.locator(`input[id="${field.id}"], #${field.id}`).first();
        if (await explicitInput.count() > 0) {
          try {
            await explicitInput.scrollIntoViewIfNeeded().catch(() => {});
            await explicitInput.click({ force: true }).catch(() => {});
            await explicitInput.fill("").catch(() => {});
            await explicitInput.fill(targetValue).catch(() => {});
            await explicitInput.evaluate((el: HTMLInputElement | HTMLTextAreaElement, val: string) => {
              const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
              const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
              if (nativeSetter) nativeSetter.call(el, val); else el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
            }, targetValue).catch(() => {});
            isFilled = true;
            console.log(`✍️ [GreenhouseAdapter]: Text input #${field.id} ("${field.label}") populated.`);
          } catch (e) {}
        }
      }

      if (!isFilled) {
        isFilled = await fillLogicalField(target, field, targetValue);
      }

      if (isFilled) filledCount++;
      await page.waitForTimeout(150 + Math.floor(Math.random() * 150));
    }

    // Safety check: ensure #phone has digits and #country is set before leaving form
    const finalPhone = target.locator("#phone").first();
    if (await finalPhone.count() > 0) {
      const pVal = await finalPhone.inputValue().catch(() => "");
      if (!pVal || pVal.trim() === "") {
        const cleanPhone = profile.phone.replace(/[^0-9]/g, "").slice(-10);
        await finalPhone.click({ force: true }).catch(() => {});
        await finalPhone.fill(cleanPhone).catch(() => {});
        console.log(`🛡️ [GreenhouseAdapter]: Safety fallback populated empty phone with "${cleanPhone}"`);
      }
    }

    console.log(`✅ [GreenhouseAdapter]: Successfully processed ${filledCount}/${fields.length} form fields.`);
    await updateHUDStatus(target, "Form Filling Complete", `Filled ${filledCount}/${fields.length} fields`, "success", 85);
  }

  /**
   * Fills a Greenhouse React-Select combobox by clicking the control to open the menu,
   * optionally typing a search term, then clicking the matching option.
   * Works with both the country code selector and all screening question dropdowns.
   */
  private async fillGreenhouseReactSelect(
    target: Page | Frame,
    comboboxId: string,
    searchTerm: string,
    matchFn?: (optText: string) => boolean
  ): Promise<boolean> {
    const pageObj = "keyboard" in target ? target : (target as Frame).page();
    const combobox = target.locator(`#${comboboxId}`);
    if (await combobox.count() === 0) return false;

    await combobox.scrollIntoViewIfNeeded().catch(() => {});

    // Click the .select__control div (parent of the combobox input) to open the React-Select menu
    await target.evaluate((id: string) => {
      const input = document.getElementById(id);
      if (!input) return false;
      // Walk up to the control element
      let el: HTMLElement | null = input;
      while (el && !el.classList.contains("select__control")) {
        el = el.parentElement;
      }
      if (el) {
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }
      return false;
    }, comboboxId);

    await pageObj.waitForTimeout(300);
    // Also click/focus the input itself
    await combobox.click({ force: true }).catch(() => {});
    await pageObj.waitForTimeout(200);

    // Type search term to filter options
    await combobox.fill("").catch(() => {});
    if (searchTerm) {
      await combobox.pressSequentially(searchTerm, { delay: 85 + Math.floor(Math.random() * 45) }).catch(() => {});
    }
    // Wait longer for location/places autocomplete (needs 2s+ for Google Places API)
    const isLocationField = comboboxId.includes("location");
    await pageObj.waitForTimeout(isLocationField ? 2500 : 600);

    // ─── CRITICAL FIX: Find the aria-controls listbox ID to scope option search ───
    // Greenhouse keeps ALL dropdown menus in DOM simultaneously. Global [role="option"]
    // picks up options from ALL dropdowns. We must scope to this combobox's listbox only.
    const listboxId = await target.evaluate((id: string) => {
      const input = document.getElementById(id);
      return input?.getAttribute("aria-controls") || null;
    }, comboboxId);

    // Build scoped option locators (prefer aria-controls listbox, fallback to visible menu)
    const scopedSelectors: string[] = [];
    if (listboxId) scopedSelectors.push(`#${listboxId} [role="option"]`);
    scopedSelectors.push(
      ".select__menu:visible [role='option']",
      ".select__menu:visible .select__option",
      "[class*='menu']:visible [role='option']"
    );

    for (const sel of scopedSelectors) {
      const options = target.locator(sel);
      const count = await options.count();
      if (count === 0) continue;

      for (let i = 0; i < Math.min(count, 30); i++) {
        const opt = options.nth(i);
        if (!await opt.isVisible().catch(() => false)) continue;
        const optText = (await opt.innerText().catch(() => "")).trim();
        if (!optText || optText.toLowerCase().includes("no options")) continue;

        const isMatch = matchFn
          ? matchFn(optText)
          : optText.toLowerCase().includes(searchTerm.toLowerCase());

        if (isMatch) {
          console.log(`    🎯 [GreenhouseAdapter]: Clicking React-Select option "${optText}" for #${comboboxId}`);
          await opt.scrollIntoViewIfNeeded().catch(() => {});
          await opt.hover().catch(() => {});
          await opt.click().catch(() => opt.click({ force: true }));
          await pageObj.waitForTimeout(350);
          // Close the dropdown
          await pageObj.keyboard.press("Escape").catch(() => {});
          await pageObj.waitForTimeout(200);
          return true;
        }
      }
    }

    // Fallback: ArrowDown + Enter
    console.log(`    ⚠️ [GreenhouseAdapter]: Fallback ArrowDown+Enter for #${comboboxId}`);
    await combobox.focus().catch(() => {});
    await pageObj.keyboard.press("ArrowDown");
    await pageObj.waitForTimeout(150);
    await pageObj.keyboard.press("Enter");
    await pageObj.waitForTimeout(300);
    return true;
  }

  /**
   * Special helper to fill standard `<select>` and custom React-Select / Greenhouse dropdowns.
   * For React-Select comboboxes (question_ IDs, location, etc.), delegates to fillGreenhouseReactSelect.
   */
  private async fillGreenhouseSelect(target: Page | Frame, field: FormField, targetValue: string): Promise<boolean> {
    // If this is a React-Select combobox (has input[role='combobox'] with the field id), use direct method
    const combobox = target.locator(`input[role='combobox']#${field.id}`).first();
    if (await combobox.count() > 0) {
      const normLabel = field.label.toLowerCase();
      let matchFn: ((opt: string) => boolean) | undefined;
      let searchTerm = targetValue; // Default search term = target value

      if (normLabel.includes("sponsorship") || normLabel.includes("visa")) {
        // Options: "Yes", "No"
        const wantsNo = targetValue.toLowerCase() === "no" || targetValue.toLowerCase().includes("no");
        searchTerm = wantsNo ? "No" : "Yes";
        matchFn = wantsNo
          ? (opt) => /^no$/i.test(opt.trim()) || /not require|no sponsorship/i.test(opt)
          : (opt) => /^yes$/i.test(opt.trim()) || /require sponsorship/i.test(opt);
      } else if (normLabel.includes("authorization") || normLabel.includes("work authorization")) {
        // Options: "I am authorized to work in the country due to my nationality", etc.
        searchTerm = "authorized";
        matchFn = (opt) => /authorized|right to work|legally authorized/i.test(opt);
      } else if (normLabel.includes("following states") || normLabel.includes("live in one")) {
        // Options: "Yes", "No"
        const wantsNo = targetValue.toLowerCase() === "no";
        searchTerm = wantsNo ? "No" : "Yes";
        matchFn = wantsNo ? (opt) => /^no$/i.test(opt.trim()) : (opt) => /^yes$/i.test(opt.trim());
      } else if (normLabel.includes("privacy notice") || normLabel.includes("acknowledge") || normLabel.includes("privacy policy")) {
        // Only option: "Acknowledge/Confirm" — no "Yes"
        searchTerm = "Acknowledge";
        matchFn = (opt) => /acknowledge|confirm/i.test(opt);
      } else if (normLabel.includes("double") || normLabel.includes("ensuring accuracy") || normLabel.includes("double-check")) {
        // Only option: "I have reviewed and confirmed that all the information provided is accurate and complete."
        // Use "I have" as search (start of option text) so React-Select shows it
        searchTerm = "I have";
        matchFn = (opt) => /reviewed|confirmed|accurate|information provided/i.test(opt);
      } else if (normLabel.includes("first hear") || normLabel.includes("hear about")) {
        // Options: "LinkedIn", "Job Board", "Referral", etc.
        searchTerm = "LinkedIn";
        matchFn = (opt) => /linkedin/i.test(opt);
      } else if (normLabel.includes("based in any of these countries") || normLabel.includes("accepting applications")) {
        // Options: Specific country names: "United States", "Germany", "United Kingdom",
        // "Argentina", "Australia", "Canada", "India", "Japan", "Other"
        // We select India since the candidate is based in India
        searchTerm = "India";
        matchFn = (opt) => /^india$/i.test(opt.trim());
      }

      return this.fillGreenhouseReactSelect(target, field.id, searchTerm, matchFn);
    }

    // Fallback to generic fillCustomSelectDropdown for native selects and other patterns
    let container = target.locator(`[id="${field.id}"], [name="${field.id}"]`).locator("xpath=ancestor::div[contains(@class, 'field') or contains(@class, 'form-group') or contains(@class, 'row')][1]");
    if (await container.count() === 0) {
      container = target.locator('div, fieldset, .field, .form-group').filter({ hasText: new RegExp(field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    }
    if (await container.count() === 0) {
      container = target.locator("body");
    }

    return await fillCustomSelectDropdown(target, container, field, targetValue);
  }

  async uploadResume(page: Page, resumePath: string, fields?: FormField[]): Promise<void> {
    const target = await this.getTarget(page);
    await updateHUDStatus(target, "Uploading Resume...", `Attaching PDF: ${path.basename(resumePath)}`, "info", 90);
    console.log(`📄 [GreenhouseAdapter]: Attaching resume file: ${resumePath}`);

    const fileInputSelectors = [
      "input[type='file'][id*='resume']",
      "#resume_file_input",
      "input[type='file'][name*='resume']",
      "input[type='file'][name*='answers']",
      "input[type='file']"
    ];

    let uploaded = false;
    for (const selector of fileInputSelectors) {
      const fileInput = target.locator(selector).first();
      if (await fileInput.count() > 0) {
        try {
          await fileInput.setInputFiles(resumePath);
          console.log(`✅ [GreenhouseAdapter]: Resume successfully attached using selector: ${selector}`);
          uploaded = true;
          break;
        } catch (e: any) {
          console.warn(`⚠️ [GreenhouseAdapter]: Failed to attach via ${selector}: ${e.message}`);
        }
      }
    }

    if (!uploaded) {
      // Try clicking "Attach" button if input file creation is dynamic
      const attachBtn = target.locator("button:has-text('Attach'), a:has-text('Attach'), [data-source='attach']").first();
      if (await attachBtn.count() > 0) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null),
          attachBtn.click().catch(() => attachBtn.click({ force: true }))
        ]);
        if (fileChooser) {
          await fileChooser.setFiles(resumePath);
          console.log("✅ [GreenhouseAdapter]: Resume set via file chooser dialog.");
          uploaded = true;
        }
      }
    }

    await page.waitForTimeout(1000);
  }

  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    const target = await this.getTarget(page);
    const formFields = fields || await this.extractFields(page);
    
    let allValid = true;
    for (const field of formFields) {
      if (field.required) {
        const filled = await verifyFieldFilled(target, field, "");
        if (!filled) {
          console.warn(`⚠️ [GreenhouseAdapter]: Required field missing verification: "${field.label}"`);
          allValid = false;
        }
      }
    }
    return allValid;
  }

  async submit(page: Page): Promise<SubmissionResult> {
    const target = await this.getTarget(page);
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";
    const isDryRun = process.env.DRY_RUN === "true" || !isAutoSubmit;

    await updateHUDStatus(
      target, 
      !isAutoSubmit ? "Ready for Review" : "Submitting Application", 
      !isAutoSubmit ? "Application filled: Ready for your manual submission" : "Clicking Submit button...", 
      "info", 
      95
    );

    const submitBtnLocators = [
      "#submit_app",
      "input[type='submit']",
      "button[type='submit']",
      "button:has-text('Submit application')",
      "button:has-text('Submit Application')",
      "button:has-text('Submit')",
      "input[value*='Submit']"
    ];

    let submitBtn = null;
    for (const sel of submitBtnLocators) {
      const btn = target.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        submitBtn = btn;
        break;
      }
    }

    if (!submitBtn) {
      return {
        success: false,
        errorMessage: "GREENHOUSE_SUBMIT_BUTTON_NOT_FOUND"
      };
    }

    // Smooth scroll to bottom so submit button is centered in viewport
    const pageObj = "evaluate" in target ? target : (target as Frame).page();
    await pageObj.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })).catch(() => {});
    await page.waitForTimeout(600);
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);

    // Visually highlight submit button with glowing green outline for manual submission
    await target.evaluate(() => {
      const btn = document.querySelector("#submit_app, input[type='submit'], button[type='submit']") ||
        Array.from(document.querySelectorAll("button")).find(b => (b.textContent || "").includes("Submit"));
      if (btn) {
        (btn as HTMLElement).style.outline = "3px solid #22c55e";
        (btn as HTMLElement).style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.85)";
        (btn as HTMLElement).style.borderRadius = "8px";
        (btn as HTMLElement).style.transition = "all 0.3s ease";
      }
    }).catch(() => {});

    // If auto-submit is NOT explicitly enabled, stop here and leave for manual submission
    if (!isAutoSubmit) {
      console.log("👉 [GreenhouseAdapter]: Ready for manual submission. Submit button is centered & highlighted for you to click!");
      await updateHUDStatus(target, "Ready to Submit", "Application completed! Submit button highlighted below for you to submit manually 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION"
      };
    }

    console.log("🔴 [GreenhouseAdapter]: LIVE AUTO-SUBMIT — Preparing to click Greenhouse submit button...");
    
    // 1. Human review pause & Bezier mouse movement to build Turnstile / anti-bot score
    console.log("⏳ [GreenhouseAdapter]: Executing human review pause & mouse movement to build Turnstile / bot score...");
    await updateHUDStatus(target, "Reviewing Form...", "Simulating natural human review before submitting", "info", 92);
    await simulateHumanMouse(target);
    await page.waitForTimeout(3000 + Math.floor(Math.random() * 2000));

    // 2. Smooth scroll to bottom of page so submit button is in viewport
    await pageObj.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })).catch(() => {});
    await page.waitForTimeout(700);

    // 3. Ensure submit button is centered in view
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(500);

    // 4. Perform natural human click, with direct forced click fallback
    try {
      await humanClick(target, submitBtn);
    } catch (err: any) {
      console.warn("⚠️ [GreenhouseAdapter]: humanClick failed, trying direct click:", err.message);
      await submitBtn.click({ force: true }).catch(() => {});
    }

    // Secondary click trigger if button wasn't activated
    await page.waitForTimeout(1000);
    const postClickErrors = await page.locator(".error:visible, .field-error:visible, [class*='error']:visible, label + .text-red").allInnerTexts().catch(() => []);
    if (postClickErrors.length > 0) {
      const errSummary = postClickErrors.map(e => e.trim()).filter(Boolean).join("; ");
      console.warn(`❌ [GreenhouseAdapter]: Form submission blocked by client-side validation errors: ${errSummary}`);
      return {
        success: false,
        errorMessage: `GREENHOUSE_VALIDATION_ERROR: ${errSummary}`
      };
    }

    // 4. Wait for response, redirect, verification code prompt, or error banner
    try {
      // Loop check for up to 25 seconds to catch confirmation, verification challenge, or processing errors
      const startTime = Date.now();
      while (Date.now() - startTime < 25000) {
        await page.waitForTimeout(1500);

        const currentUrl = page.url();
        if (currentUrl.includes("confirmation") || currentUrl.includes("thank") || currentUrl.includes("success")) {
          console.log("🎉 [GreenhouseAdapter]: Application submission confirmed via URL!");
          await updateHUDStatus(target, "Application Submitted", "Successfully submitted to Greenhouse!", "success", 100);
          return {
            success: true,
            confirmation: "GREENHOUSE_SUBMISSION_SUCCESS"
          };
        }

        const content = await page.content().catch(() => "");
        const lowerContent = content.toLowerCase();

        // Check for success confirmation text
        if (/thank you|application received|submitted successfully|thanks for applying/i.test(lowerContent)) {
          console.log("🎉 [GreenhouseAdapter]: Application submission confirmed via page content!");
          await updateHUDStatus(target, "Application Submitted", "Successfully submitted to Greenhouse!", "success", 100);
          return {
            success: true,
            confirmation: "GREENHOUSE_SUBMISSION_SUCCESS"
          };
        }

        // Check for Greenhouse error banner: "There was an error processing your application. Please try again."
        if (lowerContent.includes("error processing your application") || lowerContent.includes("there was an error processing your application")) {
          console.error("❌ [GreenhouseAdapter]: Greenhouse reported: 'There was an error processing your application. Please try again.'");
          await updateHUDStatus(target, "Submission Error", "Greenhouse error processing application (check email/bot detection)", "error", 100);
          return {
            success: false,
            errorMessage: "GREENHOUSE_ERROR_PROCESSING_APPLICATION: Greenhouse failed to process application. This occurs if an aliased email (+tag) is rejected by Greenhouse OTP mail service, or if Cloudflare Turnstile bot detection flagged the submission."
          };
        }

        // Check for Greenhouse 8-character human verification code screen
        if (
          lowerContent.includes("verification code was sent to") ||
          lowerContent.includes("confirm you're a human") ||
          lowerContent.includes("enter the 8-character code") ||
          (lowerContent.includes("security code") && await page.locator("input").count() >= 8)
        ) {
          console.warn("⚠️ [GreenhouseAdapter]: Greenhouse prompted for Human Verification 8-character security code!");
          await updateHUDStatus(target, "Verification Code Required", "Greenhouse sent an 8-character verification code to email", "warning", 90);
          
          // Wait up to 60 seconds if in headed/interactive mode for user to input the 8-character code
          console.log("⏳ [GreenhouseAdapter]: Pausing to allow 8-character code entry in browser...");
          for (let sec = 0; sec < 30; sec++) {
            await page.waitForTimeout(2000);
            const updatedContent = await page.content().catch(() => "");
            if (/thank you|application received|submitted successfully/i.test(updatedContent)) {
              console.log("🎉 [GreenhouseAdapter]: Verification code verified & application submitted!");
              return {
                success: true,
                confirmation: "GREENHOUSE_SUBMISSION_SUCCESS_AFTER_VERIFICATION"
              };
            }
          }

          return {
            success: false,
            errorMessage: "GREENHOUSE_VERIFICATION_CODE_REQUIRED: Greenhouse triggered human verification (8-character security code sent to email). Please enter the code in the browser or use a clean unaliased email address."
          };
        }
      }

      return {
        success: false,
        errorMessage: "GREENHOUSE_SUBMISSION_TIMEOUT_OR_FAILED"
      };
    } catch (e: any) {
      return {
        success: false,
        errorMessage: `Submission failed: ${e.message}`
      };
    }
  }
}
