import { Page, Locator } from "playwright";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { ATSAdapter, FormField, FormFieldOption, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { generateAnswerForQuestion, suggestAnswerForQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { resolveLocalResumePath } from "../../utils/path-resolver";
import { db } from "../../database/db";

async function humanClick(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(150);
  await locator.click({ force: true }).catch(async () => {
    await locator.evaluate((el: HTMLElement) => el.click());
  });
  await page.waitForTimeout(250);
}

async function typeLikeHuman(page: Page, locator: Locator, text: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ force: true }).catch(() => {});
  await page.waitForTimeout(100);
  await locator.fill(text);
  await locator.evaluate((el: HTMLInputElement) => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }).catch(() => {});
  await page.waitForTimeout(150);
}

export class JobviteAdapter implements ATSAdapter {

  /**
   * Detects whether the current page is a Jobvite application page.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("jobvite.com") || url.includes("jobs.jobvite.com")) {
      return true;
    }
    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("jobvite.com") ||
      content.includes("jobvite") ||
      (await page.$("#file-input-0, #jv-country-select, .jv-button-apply, [class*='jv-']")) !== null
    );
  }

  /**
   * Extracts job info (company, title, description, location) from Jobvite page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const url = page.url();
    let company = "Company";
    let title = "Position";

    // 1. Extract from page Title tag (format: "Company Careers - Job Title")
    const pageTitle = await page.title().catch(() => "");
    if (pageTitle) {
      if (pageTitle.includes(" - ")) {
        const parts = pageTitle.split(" - ");
        company = parts[0]?.replace(/Careers|Jobs/gi, "").trim() || company;
        title = parts[parts.length - 1]?.trim() || title;
      } else {
        title = pageTitle.replace(/Careers|Jobs/gi, "").trim() || title;
      }
    }

    // 2. Extract from Jobvite DOM elements
    const domInfo = await page.evaluate(() => {
      const titleEl = document.querySelector(".jv-header, .jv-job-detail-title, h1, h2, .job-title");
      const companyEl = document.querySelector(".jv-logo img, .jv-logo a, .company-name");
      const descEl = document.querySelector(".jv-job-detail-description, .job-description, .jv-description");

      return {
        title: titleEl?.textContent?.replace(/\s+/g, " ")?.trim() || "",
        company: companyEl?.getAttribute("alt") || companyEl?.textContent?.trim() || "",
        description: descEl?.textContent?.replace(/\s+/g, " ")?.trim() || ""
      };
    }).catch(() => null);

    if (domInfo?.title && domInfo.title.length > 2 && !domInfo.title.toLowerCase().includes("careers")) {
      title = domInfo.title;
    }
    if (domInfo?.company && domInfo.company.length > 1) {
      company = domInfo.company.replace(/Careers|Logo/gi, "").trim();
    }

    // Fallback: derive company from URL path (e.g. jobs.jobvite.com/actionet/...)
    if (!company || company === "Company") {
      const match = url.match(/jobvite\.com\/([^\/]+)/i);
      if (match && match[1]) {
        company = match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }

    return {
      title,
      company,
      description: domInfo?.description || title,
      ats: "JOBVITE"
    };
  }

  /**
   * Ensures the Jobvite application page is ready.
   * If on a job description page (/job/<id>), navigates to /apply.
   * If a Country/Privacy gate (#jv-country-select) is present, satisfies it automatically.
   */
  private async ensureApplicationPage(page: Page): Promise<void> {
    const url = page.url();

    // 1. If currently on a job landing page (/job/<id> without /apply), navigate to /apply
    if (url.includes("/job/") && !url.includes("/apply")) {
      const applyUrl = url.replace(/\/+$/, "") + "/apply";
      console.log(`🌐 [JobviteAdapter]: Navigating to apply URL: ${applyUrl}...`);
      await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1500);
    }

    // 2. Handle Country / Privacy Policy gate (#jv-country-select) or EU compliance consent
    const gate = page.locator("#jv-country-select");
    if (await gate.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log("🛡️ [JobviteAdapter]: Candidate Privacy / Country Gate detected (#jv-country-select)...");

      const options = await page.evaluate(() => {
        const sel = document.querySelector("#jv-country-select") as HTMLSelectElement;
        if (!sel) return [];
        return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() }));
      }).catch(() => []);

      // Find best non-placeholder option (English, Global, Other, United States, or first valid)
      const chosen = options.find(o => o.value && /english|global|united states|other/i.test(o.text)) ||
                     options.find(o => o.value && !/select/i.test(o.text)) ||
                     options[1];

      if (chosen) {
        console.log(`📋 [JobviteAdapter]: Selecting gate option: "${chosen.text}"`);
        await page.selectOption("#jv-country-select", chosen.value).catch(() => {});
        await gate.evaluate((el: HTMLSelectElement) => {
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }).catch(() => {});
        await page.waitForTimeout(1000);

        // Click "I Accept" or "Continue" if a consent button is shown
        const acceptBtn = page.locator("button:has-text('I Accept'), button:has-text('Accept'), button:has-text('Continue'), .jv-button-primary").first();
        if (await acceptBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
          console.log("👉 [JobviteAdapter]: Clicking 'I Accept' consent button...");
          await humanClick(page, acceptBtn);
        }
      }

      // Wait for application form fields to render
      await page.waitForSelector(".jv-form-field, input[id*='jv-field'], #file-input-0, #jv-resume-header", { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Check for standalone EU compliance consent / Terms Acceptance ("I Accept")
    const directAccept = page.locator("button:has-text('I Accept'), a:has-text('I Accept'), [ng-click*='accept']").first();
    if (await directAccept.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log("👉 [JobviteAdapter]: Clicking standalone 'I Accept' consent button...");
      await humanClick(page, directAccept);
      await page.waitForTimeout(2000);
    }
  }

  /**
   * Scrapes interactive form fields from the Jobvite application form.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Analyzing Jobvite Application...", "Scanning application form", "info", 40);
    await dismissCommonPopups(page);
    await this.ensureApplicationPage(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const fieldContainers = Array.from(document.querySelectorAll(".jv-form-field, [ng-repeat*='field'], .form-group"));

      fieldContainers.forEach((container, idx) => {
        const labelEl = container.querySelector("label, .jv-label, .jv-field-label, span.jv-required, span");
        let rawLabel = labelEl?.textContent?.replace(/\s+/g, " ")?.trim() || "";
        const isRequired = rawLabel.includes("*") || container.querySelector(".jv-required") !== null;
        const cleanLabel = rawLabel.replace(/\*/g, "").trim();

        const input = container.querySelector("input:not([type='hidden']), select, textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!input) return;

        const id = input.id || input.name || `field_${idx}`;
        const typeAttr = (input.getAttribute("type") || input.tagName).toLowerCase();

        let fieldType: any = "text";
        if (typeAttr === "file") fieldType = "file";
        else if (typeAttr === "email") fieldType = "email";
        else if (typeAttr === "tel") fieldType = "tel";
        else if (typeAttr === "date") fieldType = "date";
        else if (typeAttr === "checkbox") fieldType = "checkbox";
        else if (typeAttr === "radio") fieldType = "radio";
        else if (input.tagName.toLowerCase() === "select") fieldType = "select";
        else if (input.tagName.toLowerCase() === "textarea") fieldType = "textarea";

        let options: FormFieldOption[] | undefined;
        if (input.tagName.toLowerCase() === "select") {
          const sel = input as HTMLSelectElement;
          options = Array.from(sel.options)
            .map(o => ({ value: o.value, label: o.text.trim() }))
            .filter(o => o.label && !o.label.toLowerCase().includes("select"));
        }

        results.push({
          id,
          label: cleanLabel || id,
          type: fieldType,
          required: isRequired,
          options
        });
      });

      return results;
    });
  }

  /**
   * Automates form filling on Jobvite across single-step and multi-step pages.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    fields: FormField[] = []
  ): Promise<void> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Filling Jobvite Application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 50);
    await dismissCommonPopups(page);
    await this.ensureApplicationPage(page);

    const job = await this.extractJob(page);

    // ─── 1. RESUME & COVER LETTER ATTACHMENT ON INITIAL STEP ───
    const resumePath = additionalAnswers?.resumePath || profile.resumePath || resolveLocalResumePath(profile.resumePath || "");
    await this.uploadResume(page, resumePath, fields, profile);

    // ─── 2. MULTI-STEP FORM FILLING LOOP (FILLS STEP 1, CLICKS NEXT →, FILLS STEP 2, ETC.) ───
    let currentStep = 1;
    const maxSteps = 5;

    while (currentStep <= maxSteps) {
      console.log(`📋 [JobviteAdapter]: Populating fields on Application Step ${currentStep}...`);
      await updateHUDStatus(page, "Filling Jobvite Application...", `Step ${currentStep} - Candidate: ${profile.firstName} ${profile.lastName}`, "info", 50 + (currentStep * 10));

      // Fill all fields currently visible on screen
      await this.fillVisibleStepFields(page, job, profile);

      // Check if a "Next" button is visible to advance to the next step
      const nextBtn = page.locator("button.jv-button-primary:has-text('Next'), button:has-text('Next'), a.jv-button:has-text('Next'), [class*='button']:has-text('Next')").first();
      const hasNext = await nextBtn.isVisible({ timeout: 1500 }).catch(() => false);

      if (hasNext) {
        console.log(`👉 [JobviteAdapter]: Step ${currentStep} completed! Clicking 'Next →' to advance to Step ${currentStep + 1}...`);
        await humanClick(page, nextBtn);
        await page.waitForTimeout(2500);

        // Wait for next step elements to appear
        await page.waitForSelector(".jv-form-field, [ng-repeat*='field'], button[type='submit'], .jv-button-large", { timeout: 10000 }).catch(() => {});
        currentStep++;
      } else {
        console.log(`✅ [JobviteAdapter]: Reached final step (No further 'Next →' button found).`);
        break;
      }
    }

    // ─── 3. SECOND PASS FOR UNMAPPED CRITICAL FIELDS (FALLBACK SWEEP) ───
    await this.fillStandardInputsDirectly(page, profile);

    // ─── 4. SCROLL TO SUBMIT BUTTON ───
    const submitBtn = page.locator("button[type='submit'].jv-button-primary, button:has-text('Send Application'), button:has-text('Submit')").first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }
  }

  /**
   * Fills all fields visible on the active step.
   */
  private async fillVisibleStepFields(page: Page, job: JobDetails, profile: UserProfile): Promise<void> {
    const formFields = page.locator(".jv-form-field, [ng-repeat*='field'], .jv-prescreen-element, .jv-prescreen-section, .jv-form-row, .form-group, fieldset, [class*='prescreen'], .jv-input-group");
    const totalFields = await formFields.count().catch(() => 0);
    const processedRadioGroups = new Set<string>();
    const processedCheckboxGroups = new Set<string>();

    for (let i = 0; i < totalFields; i++) {
      try {
        const container = formFields.nth(i);

        // Only process visible containers
        if (!(await container.isVisible({ timeout: 1000 }).catch(() => false))) {
          continue;
        }

        // Extract accurate question label by examining explicit labels, legends, or preceding siblings in the DOM hierarchy
        let labelText = await container.evaluate((el: HTMLElement) => {
          // 1. If container is a fieldset or has legend, use legend text
          const legend = el.querySelector("legend, .jv-form-field-legend");
          if (legend?.textContent?.trim()) {
            const lt = legend.textContent.replace(/\s+/g, " ").trim();
            if (lt.length > 2 && !lt.toLowerCase().includes("select an option") && !/^\*+$/.test(lt)) return lt;
          }

          // 2. Prioritize explicit field labels (.jv-field-label, .jv-label)
          const fieldLabel = el.querySelector(".jv-field-label, .jv-label");
          if (fieldLabel?.textContent?.trim()) {
            const flt = fieldLabel.textContent.replace(/\s+/g, " ").trim();
            if (flt.length > 2 && !flt.toLowerCase().includes("select an option") && !/^\*+$/.test(flt)) return flt;
          }

          // 3. Check for question paragraph or heading INSIDE the container itself (join all p/headings)
          const innerQs = Array.from(el.querySelectorAll("p, h3, h4, span.jv-required, [ng-bind*='field.name']"))
            .map(x => x.textContent?.replace(/\s+/g, " ").trim())
            .filter(t => t && t.length > 2 && !t.toLowerCase().includes("select an option") && !/^\*+$/.test(t));
          if (innerQs.length > 0) {
            return innerQs.join(" ");
          }

          // 4. For text/select/textarea: Check label explicitly linked to inner input
          const hasRadios = el.querySelector("input[type='radio']") !== null;
          const hasCheckboxes = el.querySelector("input[type='checkbox']") !== null;
          if (!hasRadios && !hasCheckboxes) {
            const innerInput = el.querySelector("input:not([type='hidden']), select, textarea");
            if (innerInput && innerInput.id) {
              const l = document.querySelector(`label[for="${CSS.escape(innerInput.id)}"]`);
              if (l?.textContent?.trim() && !l.textContent.toLowerCase().includes("select an option") && !/^\*+$/.test(l.textContent.trim())) {
                return l.textContent.replace(/\s+/g, " ").trim();
              }
            }
          }

          // 5. Preceding sibling search upward ONLY if container has no inner text
          let curr: HTMLElement | null = el;
          while (curr && curr.tagName !== "BODY" && curr.tagName !== "FORM") {
            let s = curr.previousElementSibling;
            while (s) {
              const t = s.textContent?.replace(/\s+/g, " ").trim();
              if (t && t.length > 2 && !t.toLowerCase().includes("select an option") && !/^\*+$/.test(t)) {
                return t;
              }
              s = s.previousElementSibling;
            }
            curr = curr.parentElement;
          }

          return el.textContent?.replace(/\s+/g, " ").trim() || "";
        }).catch(() => "");

        const normLabel = labelText.toLowerCase().replace(/\*/g, "").trim();

        // 1. Check Select dropdowns
        const selectEl = container.locator("select").first();
        if (await selectEl.isVisible({ timeout: 1000 }).catch(() => false)) {
          await this.handleSelectField(page, selectEl, normLabel, labelText, job, profile);
          continue;
        }

        // 2. Check Checkbox inputs (scoped to prevent duplicate clicks while allowing separate questions)
        const checkboxEls = container.locator("input[type='checkbox']");
        const cbCount = await checkboxEls.count().catch(() => 0);
        if (cbCount > 0) {
          const cbName = await checkboxEls.first().getAttribute("name").catch(() => "") || "";
          const isGeneric = !cbName || ["field", "checkbox", "answer", "input", "prescreen"].includes(cbName.toLowerCase());
          const groupKey = isGeneric ? `cb_${i}_${normLabel.slice(0, 20)}` : cbName;
          if (processedCheckboxGroups.has(groupKey)) continue;
          processedCheckboxGroups.add(groupKey);
          await this.handleCheckboxGroup(checkboxEls, cbCount, normLabel, labelText, job, profile);
          continue;
        }

        // 3. Check Radio inputs (scoped to prevent duplicate clicks while allowing separate questions)
        const radioEls = container.locator("input[type='radio']");
        const rCount = await radioEls.count().catch(() => 0);
        if (rCount > 0) {
          const radioName = await radioEls.first().getAttribute("name").catch(() => "") || "";
          const isGeneric = !radioName || ["field", "radio", "answer", "input", "prescreen"].includes(radioName.toLowerCase());
          const groupKey = isGeneric ? `radio_${i}_${normLabel.slice(0, 20)}` : radioName;
          if (processedRadioGroups.has(groupKey)) continue;
          processedRadioGroups.add(groupKey);
          await this.handleRadioGroup(radioEls, rCount, normLabel, labelText, job, profile);
          continue;
        }

        // 4. Check Textarea inputs
        const textarea = container.locator("textarea").first();
        if (await textarea.isVisible({ timeout: 1000 }).catch(() => false)) {
          await this.handleTextareaField(page, textarea, normLabel, labelText, job, profile);
          continue;
        }

        // 5. Check Text / Date / Tel / Number / Email Inputs
        const textInput = container.locator("input[type='text'], input[type='email'], input[type='tel'], input[type='number'], input[type='date'], input:not([type])").first();
        if (await textInput.isVisible({ timeout: 1000 }).catch(() => false)) {
          await this.handleTextInputField(page, textInput, normLabel, labelText, job, profile);
          continue;
        }
      } catch (err: any) {
        console.warn(`⚠️ [JobviteAdapter]: Non-fatal error filling container ${i}: ${err?.message || err}`);
      }
    }

    // ─── SWEEP REMAINING UNFILLED INTERACTIVE ELEMENTS ON ACTIVE STEP ───
    // Fills any orphaned questions (e.g. iSoftStone Questions 1-5, iboss Visa sponsorship)
    const allSelects = page.locator("select:visible");
    const selTotal = await allSelects.count().catch(() => 0);
    for (let s = 0; s < selTotal; s++) {
      try {
        const sEl = allSelects.nth(s);
        const val = await sEl.inputValue().catch(() => "");
        if (!val || val === "?" || val === "") {
          const prompt = await sEl.evaluate((el: HTMLElement) => {
            let curr: HTMLElement | null = el;
            while (curr && curr.tagName !== "BODY" && curr.tagName !== "FORM") {
              let sib = curr.previousElementSibling;
              while (sib) {
                const t = sib.textContent?.replace(/\s+/g, " ").trim();
                if (t && t.length > 2 && !t.toLowerCase().includes("select an option") && !/^\*+$/.test(t)) {
                  return t;
                }
                sib = sib.previousElementSibling;
              }
              curr = curr.parentElement;
            }
            return "";
          }).catch(() => "");
          if (prompt) {
            console.log(`🧹 [Jobvite Sweep]: Found unfilled dropdown with prompt: "${prompt.slice(0, 45)}"`);
            await this.handleSelectField(page, sEl, prompt.toLowerCase(), prompt, job, profile);
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [Jobvite Sweep]: Error processing select ${s}: ${err?.message}`);
      }
    }

    const allTextareas = page.locator("textarea:visible");
    const taTotal = await allTextareas.count().catch(() => 0);
    for (let t = 0; t < taTotal; t++) {
      try {
        const taEl = allTextareas.nth(t);
        const val = await taEl.inputValue().catch(() => "");
        if (!val || val.trim().length === 0) {
          const prompt = await taEl.evaluate((el: HTMLElement) => {
            let curr: HTMLElement | null = el;
            while (curr && curr.tagName !== "BODY" && curr.tagName !== "FORM") {
              let sib = curr.previousElementSibling;
              while (sib) {
                const t = sib.textContent?.replace(/\s+/g, " ").trim();
                if (t && t.length > 2 && !t.toLowerCase().includes("select an option") && !/^\*+$/.test(t)) {
                  return t;
                }
                sib = sib.previousElementSibling;
              }
              curr = curr.parentElement;
            }
            return "";
          }).catch(() => "");
          if (prompt) {
            console.log(`🧹 [Jobvite Sweep]: Found unfilled textarea with prompt: "${prompt.slice(0, 45)}"`);
            await this.handleTextareaField(page, taEl, prompt.toLowerCase(), prompt, job, profile);
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [Jobvite Sweep]: Error processing textarea ${t}: ${err?.message}`);
      }
    }

    // Checkbox sweep for any unselected required / screening checkbox groups (e.g. Visa sponsorship)
    const allCbs = page.locator("input[type='checkbox']:visible");
    const cbTotal = await allCbs.count().catch(() => 0);
    for (let c = 0; c < cbTotal; c++) {
      try {
        const cb = allCbs.nth(c);
        const isChecked = await cb.isChecked().catch(() => false);
        if (!isChecked) {
          const cbPrompt = await cb.evaluate((el: HTMLInputElement) => {
            const rowText = el.closest(".jv-input-group-row, label")?.textContent?.trim() || "";
            let curr: HTMLElement | null = el;
            let groupTitle = "";
            while (curr && curr.tagName !== "BODY" && curr.tagName !== "FORM") {
              let sib = curr.previousElementSibling;
              while (sib) {
                const t = sib.textContent?.replace(/\s+/g, " ").trim();
                if (t && t.length > 2 && !t.toLowerCase().includes("select an option") && !/^\*+$/.test(t)) {
                  groupTitle = t;
                  break;
                }
                sib = sib.previousElementSibling;
              }
              if (groupTitle) break;
              curr = curr.parentElement;
            }
            return { rowText, groupTitle };
          }).catch(() => ({ rowText: "", groupTitle: "" }));

          const fullText = `${cbPrompt.groupTitle} ${cbPrompt.rowText}`.toLowerCase();
          if (fullText.includes("sponsorship") || fullText.includes("visa") || fullText.includes("future")) {
            if (/^no\b/i.test(cbPrompt.rowText) || /^no$/i.test(cbPrompt.rowText)) {
              console.log(`🧹 [Jobvite Sweep]: Selecting "No" for visa sponsorship checkbox...`);
              await cb.check({ force: true }).catch(() => {});
              await cb.evaluate((el: HTMLInputElement) => {
                el.checked = true;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
                el.dispatchEvent(new Event("click", { bubbles: true }));
              }).catch(() => {});
            }
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [Jobvite Sweep]: Error processing checkbox ${c}: ${err?.message}`);
      }
    }
  }

  /**
   * Handles Select dropdown inputs.
   */
  private async handleSelectField(
    page: Page,
    selectEl: Locator,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const options = await selectEl.evaluate((sel: HTMLSelectElement) => {
      return Array.from(sel.options).map(o => o.text.trim()).filter(t => t && !t.toLowerCase().includes("select"));
    }).catch(() => []);

    if (options.length === 0) return;
    console.log(`📋 [JobviteAdapter]: Select options for "${normLabel.slice(0, 45)}":`, options);

    let chosenOption = "";

    // 0. Work Sponsorship / Visa Sponsorship (Checked first to prevent any label shadowing)
    if (options.some(o => /work sponsorship|sponsorship/i.test(o)) || normLabel.includes("sponsorship") || normLabel.includes("require visa") || (normLabel.includes("require") && normLabel.includes("future"))) {
      chosenOption = options.find(o => (/^no\b/i.test(o) || /no,/i.test(o) || /will not/i.test(o) || /not ever/i.test(o) || /do not require/i.test(o) || /no sponsorship/i.test(o)) && !/^yes\b/i.test(o)) ||
                     options.find(o => !/^yes\b/i.test(o)) || options[options.length - 1];
    }
    // 0b. Employee Referral (Checked before current employee to prevent shadowing)
    else if (normLabel.includes("referr")) {
      chosenOption = options.find(o => /^no\b/i.test(o) || /\bnot referred\b/i.test(o) || /no,/i.test(o) || /^no$/i.test(o)) ||
                     options.find(o => !/^yes\b/i.test(o)) || "No";
    }
    // 1. State / Region
    else if (normLabel.includes("state") || normLabel.includes("province") || normLabel.includes("region")) {
      const userState = profile.state || "California";
      const match = options.find(o => new RegExp(`^${userState}$`, "i").test(o) || new RegExp(userState, "i").test(o));
      chosenOption = match || options.find(o => /california/i.test(o)) || options[0];
    }
    // 2. Country
    else if (normLabel.includes("country")) {
      const userCountry = profile.country || "United States";
      chosenOption = options.find(o => new RegExp(`^${userCountry}$`, "i").test(o) || new RegExp(userCountry, "i").test(o)) ||
                     options.find(o => /^united states\b/i.test(o) || /\bunited states\b/i.test(o) || /^usa$/i.test(o) || /^us$/i.test(o)) ||
                     options[0];
    }
    // 3. Gender (Dynamic from candidate's profile)
    else if (normLabel.includes("gender") || normLabel === "sex") {
      const userGender = profile.gender || "Male";
      chosenOption = options.find(o => new RegExp(`^${userGender}$`, "i").test(o)) || options.find(o => new RegExp(userGender, "i").test(o) && !/female/i.test(o)) || userGender;
    }
    // 4. Race / Ethnicity (Dynamic from candidate's profile)
    else if (normLabel.includes("race") || normLabel.includes("ethnicity") || normLabel.includes("identify with")) {
      const userEth = profile.ethnicity || profile.savedAnswers?.get("ethnicity") || profile.savedAnswers?.get("race") || "Asian";
      chosenOption = options.find(o => new RegExp(userEth, "i").test(o)) || options.find(o => !/decline/i.test(o)) || options[0];
    }
    // 5. Veteran Status (Strict Not a Protected Veteran)
    else if (normLabel.includes("veteran")) {
      chosenOption = options.find(o => /not a protected veteran|not a veteran|i am not a protected veteran|^no$/i.test(o)) || options.find(o => !/i identify|yes/i.test(o)) || options[0];
    }
    // 6. Disability Status (Strict No Disability)
    else if (normLabel.includes("disability")) {
      chosenOption = options.find(o => /no,|do not have a disability|don't have a disability|^no$/i.test(o)) || options.find(o => !/yes/i.test(o)) || options[0];
    }
    // 7. Highest Education
    else if (normLabel.includes("education") || normLabel.includes("degree")) {
      chosenOption = options.find(o => /bachelor|college|four year/i.test(o)) || options[0];
    }
    // 8. Clearance
    else if (normLabel.includes("clearance")) {
      chosenOption = options.find(o => /^none$/i.test(o) || /^no$/i.test(o)) || options[0];
    }
    // 9. Age 18 or older
    else if (normLabel.includes("18") || normLabel.includes("age")) {
      chosenOption = options.find(o => /^yes$/i.test(o)) || "Yes";
    }
    // 10. Source / How did you hear
    else if (normLabel.includes("hear about") || normLabel.includes("source") || normLabel.includes("where did you")) {
      chosenOption = options.find(o => /linkedin/i.test(o)) || options.find(o => /company career|other/i.test(o)) || options[0];
    }
    // 11. Referred by current employee
    else if (normLabel.includes("referr")) {
      chosenOption = options.find(o => /^no\b/i.test(o) || /\bnot referred\b/i.test(o) || /no,/i.test(o) || /^no$/i.test(o)) ||
                     options.find(o => !/^yes\b/i.test(o)) || "No";
    }
    // 12. Current / Former Employee
    else if (normLabel.includes("current") && normLabel.includes("employee")) {
      chosenOption = options.find(o => /^neither$/i.test(o) || /neither/i.test(o) || /^no$/i.test(o) || /not a current/i.test(o) || /none/i.test(o)) || options[options.length - 1];
    }
    // 12. Conflicts / Non-competes / Government employee / Procurement
    else if (normLabel.includes("conflict") || normLabel.includes("non-compete") || normLabel.includes("government") || normLabel.includes("procurement")) {
      chosenOption = options.find(o => /^no$/i.test(o)) || "No";
    }
    // 13. Text / SMS consent
    else if (normLabel.includes("text") || normLabel.includes("sms")) {
      chosenOption = options.find(o => /^yes$/i.test(o)) || "Yes";
    }
    // 14. Visa Sponsorship / Work Sponsorship
    else if (normLabel.includes("sponsorship") || normLabel.includes("require visa") || normLabel.includes("future sponsorship") || normLabel.includes("work sponsorship") || (normLabel.includes("require") && normLabel.includes("future")) || options.some(o => /work sponsorship|sponsorship/i.test(o))) {
      chosenOption = options.find(o => (/^no\b/i.test(o) || /do not require|will not require|will not ever require|not ever require|no sponsorship/i.test(o)) && !/^yes\b/i.test(o)) ||
                     options.find(o => !/^yes\b/i.test(o)) || options[0];
    }
    // 15. Referred by current employee
    else if (normLabel.includes("referred to this role by a current") || normLabel.includes("referred by an employee") || normLabel.includes("referred by a current")) {
      chosenOption = options.find(o => /^no\b/i.test(o) || /\bnot referred\b/i.test(o) || /no,/i.test(o)) ||
                     options.find(o => !/^yes\b/i.test(o)) || "No";
    }
    // 16. Work Authorization Type / Legally Authorized
    else if (normLabel.includes("authorization type") || normLabel.includes("work auth")) {
      chosenOption = options.find(o => /citizen|authorized|permanent/i.test(o)) || options[0];
    }
    // 16b. Legally Authorized to work in the country
    else if (normLabel.includes("authorized") || normLabel.includes("legally") || normLabel.includes("eligible to work") || normLabel.includes("lawful")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || "Yes";
    }
    // 16c. English proficiency / Language proficiency
    else if (normLabel.includes("english") || normLabel.includes("language proficiency") || normLabel.includes("proficiency in english")) {
      chosenOption = options.find(o => /native|bilingual/i.test(o)) ||
                     options.find(o => /fluent/i.test(o)) ||
                     options.find(o => /professional/i.test(o)) ||
                     options.find(o => /advanced/i.test(o)) ||
                     options[options.length - 1];
    }
    // 16d. FMCG / CRM / SFA field sales or systems
    else if (normLabel.includes("fmcg") || normLabel.includes("sfa") || normLabel.includes("commercial systems") || normLabel.includes("crm rollout") || normLabel.includes("crm")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || options[0];
    }
    // 17. Smart LLM fallback with DB lookup
    else {
      // Check database first
      const dbAnswer = await this.getAnswerFromDB(profile.userId, normLabel).catch(() => null);
      if (dbAnswer && options.some(o => o.toLowerCase() === dbAnswer.toLowerCase() || new RegExp(`\\b${dbAnswer}\\b`, 'i').test(o))) {
        chosenOption = options.find(o => o.toLowerCase() === dbAnswer.toLowerCase() || new RegExp(`\\b${dbAnswer}\\b`, 'i').test(o)) || dbAnswer;
      } else {
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 5000));
          chosenOption = await Promise.race([
            generateAnswerForQuestion(labelText, job, profile, options, "select"),
            timeoutPromise
          ]);
        } catch {
          chosenOption = options.find(o => /^yes\b/i.test(o)) || options[0];
        }
      }
    }

    // Safety guard: chosenOption MUST be one of the select element's options!
    if (!chosenOption || !options.some(o => o.toLowerCase() === chosenOption.toLowerCase() || new RegExp(`\\b${chosenOption}\\b`, 'i').test(o))) {
      chosenOption = options.find(o => /^yes\b/i.test(o)) || options[0];
    }

    if (chosenOption) {
      console.log(`📋 [JobviteAdapter]: Select "${labelText.slice(0, 40)}" -> "${chosenOption}"`);
      await selectEl.selectOption({ label: chosenOption }, { timeout: 2000 }).catch(async () => {
        // Fallback: match by value or word boundary
        const matchedVal = await selectEl.evaluate((sel: HTMLSelectElement, optText: string) => {
          const exact = Array.from(sel.options).find(o => o.text.trim().toLowerCase() === optText.toLowerCase() || o.value.toLowerCase() === optText.toLowerCase());
          if (exact) return exact.value;
          const wordRegex = new RegExp(`\\b${optText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i");
          const wordMatch = Array.from(sel.options).find(o => wordRegex.test(o.text));
          if (wordMatch) return wordMatch.value;
          return "";
        }, chosenOption);
        if (matchedVal) {
          await selectEl.selectOption(matchedVal, { timeout: 2000 }).catch(() => {});
        }
      });

      // Dispatch angular events
      await selectEl.evaluate((el: HTMLSelectElement) => {
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }).catch(() => {});

      await this.saveAnswerToDB(profile.userId, labelText, chosenOption);
    }
  }

  /**
   * Handles Checkbox groups, single-select screening checkboxes (Yes/No), and individual agreements.
   */
  private async handleCheckboxGroup(
    checkboxEls: Locator,
    count: number,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    // 1. If it's a certification / consent / agreement checkbox, ALWAYS check all of them
    if (normLabel.includes("certify") || normLabel.includes("accurate") || normLabel.includes("true") ||
        normLabel.includes("agree") || normLabel.includes("consent") || normLabel.includes("acknowledge")) {
      for (let i = 0; i < count; i++) {
        const cb = checkboxEls.nth(i);
        const parentLabel = cb.locator("xpath=ancestor::label[1]").first();
        if (await parentLabel.isVisible({ timeout: 200 }).catch(() => false)) {
          await parentLabel.click().catch(() => {});
        } else {
          await cb.check({ force: true }).catch(() => {});
        }
      }
      console.log(`☑️ [JobviteAdapter]: Checked certification checkbox "${labelText.slice(0, 45)}"`);
      return;
    }

    // 2. Preferred Location checkbox: check first available or matching
    if (normLabel.includes("location") || normLabel.includes("preferred")) {
      const cb = checkboxEls.first();
      const parentLabel = cb.locator("xpath=ancestor::label[1]").first();
      if (await parentLabel.isVisible({ timeout: 200 }).catch(() => false)) {
        await parentLabel.click().catch(() => {});
      } else {
        await cb.check({ force: true }).catch(() => {});
      }
      console.log(`☑️ [JobviteAdapter]: Checked preferred location checkbox.`);
      return;
    }

    // 3. Extract options for the checkbox group (e.g. Yes / No options)
    const options: { index: number; text: string; rowLocator: Locator; inputLocator: Locator }[] = [];
    for (let i = 0; i < count; i++) {
      const input = checkboxEls.nth(i);
      const text = await input.evaluate((el: HTMLInputElement) => {
        // Label wrapping input
        const parentLabel = el.closest("label");
        if (parentLabel?.textContent?.trim()) {
          return parentLabel.textContent.replace(/\s+/g, " ").trim();
        }
        // Label explicitly linked via for attribute
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l?.textContent?.trim()) return l.textContent.replace(/\s+/g, " ").trim();
        }
        // Next sibling text or element
        let next = el.nextSibling;
        while (next) {
          const t = next.textContent?.trim();
          if (t && t.length > 0) return t.replace(/\s+/g, " ").trim();
          next = next.nextSibling;
        }
        // Closest row or item (excluding large wrappers)
        const row = el.closest(".jv-input-group-row, .jv-checkbox-option, .checkbox, li");
        return row?.textContent?.replace(/\s+/g, " ").trim() || el.value || "";
      }).catch(() => "");
      const row = input.locator("xpath=ancestor::label[contains(@class, 'jv-input-group-row') or self::label]").first();
      options.push({ index: i, text, rowLocator: row, inputLocator: input });
    }

    // Helper function to safely check a specific checkbox option and trigger Angular events
    const checkOption = async (target: typeof options[0]) => {
      // 1. Try checking via Locator
      await target.inputLocator.check({ force: true }).catch(() => {});
      if (await target.rowLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
        const isChecked = await target.inputLocator.isChecked().catch(() => false);
        if (!isChecked) {
          await target.rowLocator.click({ force: true }).catch(() => {});
        }
      }

      // 2. DOM force-check and event dispatching for AngularJS
      await target.inputLocator.evaluate((el: HTMLInputElement) => {
        el.checked = true;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("click", { bubbles: true }));
        try {
          const ng = (window as any).angular;
          if (ng) {
            const elNg = ng.element(el);
            elNg.triggerHandler("click");
            elNg.triggerHandler("change");
            const scope = elNg.scope();
            if (scope?.value) {
              scope.value.checked = true;
              scope.$apply();
            }
          }
        } catch (e) {}
      }).catch(() => {});
    };

    // Helper function to uncheck a specific checkbox option
    const uncheckOption = async (target: typeof options[0]) => {
      await target.inputLocator.uncheck({ force: true }).catch(() => {});
      await target.inputLocator.evaluate((el: HTMLInputElement) => {
        el.checked = false;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("click", { bubbles: true }));
        try {
          const ng = (window as any).angular;
          if (ng) {
            const elNg = ng.element(el);
            elNg.triggerHandler("click");
            elNg.triggerHandler("change");
            const scope = elNg.scope();
            if (scope?.value) {
              scope.value.checked = false;
              scope.$apply();
            }
          }
        } catch (e) {}
      }).catch(() => {});
    };

    let targetIdx = -1;

    // A. Visa Sponsorship / Future Sponsorship (Strict "No" for Hrutin Nammi)
    if (normLabel.includes("sponsorship") || normLabel.includes("visa") || normLabel.includes("work authorization") ||
        (normLabel.includes("require") && normLabel.includes("future")) ||
        normLabel.includes("future sponsorship") || normLabel.includes("require sponsorship")) {
      targetIdx = options.findIndex(o => /^no\b/i.test(o.text.trim()) || /^no$/i.test(o.text.trim()) || /not require/i.test(o.text));
      if (targetIdx >= 0) {
        // Uncheck "Yes" if checked
        const yesIdx = options.findIndex(o => /^yes\b/i.test(o.text.trim()));
        if (yesIdx >= 0 && yesIdx !== targetIdx) {
          await uncheckOption(options[yesIdx]);
        }
        await checkOption(options[targetIdx]);
        console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "No"`);
        await this.saveAnswerToDB(profile.userId, labelText, "No");
        return;
      }
    }

    // B. Legally authorized to work in the US (Strict "Yes" for Hrutin Nammi)
    else if (normLabel.includes("authorized") || normLabel.includes("legally") || normLabel.includes("eligible to work") || normLabel.includes("lawful")) {
      targetIdx = options.findIndex(o => /^yes\b/i.test(o.text.trim()) || /^yes$/i.test(o.text.trim()) || /authorized/i.test(o.text));
      if (targetIdx >= 0) {
        await checkOption(options[targetIdx]);
        console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "Yes"`);
        await this.saveAnswerToDB(profile.userId, labelText, "Yes");
        return;
      }
    }

    // C. 18 years of age or older
    else if (normLabel.includes("18") || normLabel.includes("age") || normLabel.includes("legal working age")) {
      targetIdx = options.findIndex(o => /^yes\b/i.test(o.text.trim()) || /^yes$/i.test(o.text.trim()));
      if (targetIdx >= 0) {
        await checkOption(options[targetIdx]);
        console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "Yes"`);
        await this.saveAnswerToDB(profile.userId, labelText, "Yes");
        return;
      }
    }

    // D. Current / Former Employee
    else if (normLabel.includes("current") && normLabel.includes("employee")) {
      targetIdx = options.findIndex(o => /^no\b/i.test(o.text.trim()) || /^neither$/i.test(o.text.trim()) || /^no$/i.test(o.text.trim()));
      if (targetIdx >= 0) {
        await checkOption(options[targetIdx]);
        console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "No"`);
        await this.saveAnswerToDB(profile.userId, labelText, "No");
        return;
      }
    }

    // E. Conflicts / Non-compete / Government employee / Criminal history
    else if (normLabel.includes("conflict") || normLabel.includes("non-compete") || normLabel.includes("government") || normLabel.includes("procurement") || normLabel.includes("convict") || normLabel.includes("felony")) {
      targetIdx = options.findIndex(o => /^no\b/i.test(o.text.trim()) || /^no$/i.test(o.text.trim()));
      if (targetIdx >= 0) {
        await checkOption(options[targetIdx]);
        console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "No"`);
        await this.saveAnswerToDB(profile.userId, labelText, "No");
        return;
      }
    }

    // F. Referred by employee
    else if (normLabel.includes("referr")) {
      targetIdx = options.findIndex(o => /^no\b/i.test(o.text.trim()) || /^no$/i.test(o.text.trim()) || /not referred/i.test(o.text));
      if (targetIdx >= 0) {
        await checkOption(options[targetIdx]);
        console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "No"`);
        await this.saveAnswerToDB(profile.userId, labelText, "No");
        return;
      }
    }

    // G. Generic Yes/No screening question
    const hasYesNo = options.some(o => /^yes\b/i.test(o.text.trim())) && options.some(o => /^no\b/i.test(o.text.trim()));
    if (hasYesNo) {
      const dbAnswer = await this.getAnswerFromDB(profile.userId, normLabel);
      let chosen = dbAnswer;
      if (!chosen) {
        chosen = await generateAnswerForQuestion(labelText, job, profile, options.map(o => o.text), "radio");
      }
      if (chosen) {
        targetIdx = options.findIndex(o => o.text.toLowerCase().includes(chosen.toLowerCase()) || new RegExp(`\\b${chosen}\\b`, "i").test(o.text));
        if (targetIdx >= 0) {
          await checkOption(options[targetIdx]);
          console.log(`☑️ [JobviteAdapter]: Checkbox question "${labelText.slice(0, 45)}" -> Selected "${options[targetIdx].text}"`);
          await this.saveAnswerToDB(profile.userId, labelText, chosen);
          return;
        }
      }
    }

    // Fallback: Check first option if required and none checked
    const anyChecked = await checkboxEls.locator(":checked").count().catch(() => 0);
    if (anyChecked === 0 && count > 0) {
      await checkOption(options[0]);
      console.log(`☑️ [JobviteAdapter]: Checked fallback checkbox "${options[0].text}"`);
    }
  }

  /**
   * Handles Radio button groups (Yes/No, screening questions).
   */
  private async handleRadioGroup(
    radioEls: Locator,
    count: number,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const radioOptions: { index: number; text: string }[] = [];
    for (let i = 0; i < count; i++) {
      const text = await radioEls.nth(i).evaluate((el: HTMLInputElement) => {
        const parentLabel = el.closest("label");
        if (parentLabel?.textContent?.trim()) {
          return parentLabel.textContent.replace(/\s+/g, " ").trim();
        }
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l?.textContent?.trim()) return l.textContent.replace(/\s+/g, " ").trim();
        }
        let next = el.nextSibling;
        while (next) {
          const t = next.textContent?.trim();
          if (t && t.length > 0) return t.replace(/\s+/g, " ").trim();
          next = next.nextSibling;
        }
        const row = el.closest(".jv-input-group-row, .jv-radio-option, .radio, li");
        return row?.textContent?.replace(/\s+/g, " ").trim() || el.value || "";
      }).catch(() => "");
      radioOptions.push({ index: i, text });
    }

    let targetIdx = 0;
    const optLower = radioOptions.map(o => o.text.toLowerCase());

    // Deterministic mappings based on label AND direct option inspection
    // 1. Gender (Dynamic match candidate's profile - NEVER select decline)
    const isGender = normLabel.includes("gender") || normLabel === "sex" || (optLower.some(o => o === "male") && optLower.some(o => o === "female"));
    const isRace = normLabel.includes("race") || normLabel.includes("ethnic") || normLabel.includes("identify with") ||
                   optLower.some(o => o.includes("hispanic") || o.includes("asian") || o.includes("black or african") || o.includes("native hawaiian"));
    const isVeteran = normLabel.includes("veteran") || optLower.some(o => o.includes("protected veteran") || o.includes("classifications of protected veteran"));
    const isDisability = normLabel.includes("disability") || optLower.some(o => o.includes("have a disability") || o.includes("disability status"));
    const isEmployee = (normLabel.includes("current") && normLabel.includes("employee")) || normLabel.includes("ninjaone employee") || normLabel.includes("company employee") || normLabel.includes("currently employed");

    if (isGender) {
      const g = (profile.gender || "Male").toLowerCase();
      targetIdx = radioOptions.findIndex(o => new RegExp(`^${g}$`, "i").test(o.text.trim()) || new RegExp(`^${g}\\b`, "i").test(o.text.trim()));
      if (targetIdx < 0) {
        targetIdx = radioOptions.findIndex(o => new RegExp(g, "i").test(o.text) && !/decline/i.test(o.text));
      }
    }
    // 2. Race / Ethnicity (Dynamic match candidate's profile - NEVER select decline)
    else if (isRace) {
      const eth = (profile.ethnicity || profile.savedAnswers?.get("ethnicity") || profile.savedAnswers?.get("race") || "Asian").toLowerCase();
      targetIdx = radioOptions.findIndex(o => new RegExp(eth, "i").test(o.text) && !/decline/i.test(o.text));
      if (targetIdx < 0) {
        targetIdx = radioOptions.findIndex(o => !/decline|prefer not/i.test(o.text));
      }
    }
    // 3. Veteran Status (Strict Not a Protected Veteran - NEVER select decline)
    else if (isVeteran) {
      targetIdx = radioOptions.findIndex(o => /not a protected veteran|not a veteran|i am not a protected veteran/i.test(o.text));
      if (targetIdx < 0) {
        targetIdx = radioOptions.findIndex(o => (/^no$/i.test(o.text.trim()) || /^no\b/i.test(o.text.trim())) && !/decline/i.test(o.text));
      }
      if (targetIdx < 0) {
        targetIdx = radioOptions.findIndex(o => !/decline|prefer not/i.test(o.text));
      }
    }
    // 4. Disability Status (Strict No Disability - NEVER select decline)
    else if (isDisability) {
      targetIdx = radioOptions.findIndex(o => /no,|do not have a disability|don't have a disability|^no$/i.test(o.text));
      if (targetIdx < 0) {
        targetIdx = radioOptions.findIndex(o => (/^no$/i.test(o.text.trim()) || /^no\b/i.test(o.text.trim())) && !/decline/i.test(o.text));
      }
      if (targetIdx < 0) {
        targetIdx = radioOptions.findIndex(o => !/decline|prefer not/i.test(o.text));
      }
    }
    // 5. Work Authorization / Age 18+
    else if (normLabel.includes("authorized") || normLabel.includes("eligible") || normLabel.includes("18") || normLabel.includes("age") || normLabel.includes("citizen") || normLabel.includes("contract requirement")) {
      targetIdx = radioOptions.findIndex(o => /^yes$/i.test(o.text.trim()) || /^yes\b/i.test(o.text.trim()));
    }
    // 6. Visa Sponsorship / Future Sponsorship
    else if (normLabel.includes("sponsorship") || normLabel.includes("require visa") || normLabel.includes("future")) {
      targetIdx = radioOptions.findIndex(o => /^no$/i.test(o.text.trim()) || /^no\b/i.test(o.text.trim()));
    }
    // 7. Conflicts / Non-competes / Government clearance / Procurement
    else if (normLabel.includes("conflict") || normLabel.includes("non-compete") || normLabel.includes("government") || normLabel.includes("clearance") || normLabel.includes("procurement")) {
      targetIdx = radioOptions.findIndex(o => /^no$/i.test(o.text.trim()) || /^no\b/i.test(o.text.trim()));
    }
    // 8. Current / Past employee
    else if (isEmployee) {
      targetIdx = radioOptions.findIndex(o => /^no$/i.test(o.text.trim()) || /^no\b/i.test(o.text.trim()) || /^neither$/i.test(o.text.trim()) || /not a current/i.test(o.text));
    }
    // 9. Database Lookup & LLM Smart Fallback
    else {
      const dbAnswer = await this.getAnswerFromDB(profile.userId, normLabel);
      if (dbAnswer) {
        const found = radioOptions.findIndex(o => o.text.toLowerCase().includes(dbAnswer.toLowerCase()) || dbAnswer.toLowerCase().includes(o.text.toLowerCase()));
        if (found >= 0) targetIdx = found;
      } else {
        const answer = await generateAnswerForQuestion(labelText, job, profile, radioOptions.map(o => o.text), "radio");
        const found = radioOptions.findIndex(o => o.text.toLowerCase().includes(answer.toLowerCase()) || answer.toLowerCase().includes(o.text.toLowerCase()));
        if (found >= 0) targetIdx = found;
      }
    }

    if (targetIdx < 0 || targetIdx >= count) {
      targetIdx = 0;
    }

    if (targetIdx >= 0 && targetIdx < count) {
      await radioEls.nth(targetIdx).check({ force: true }).catch(async () => {
        await radioEls.nth(targetIdx).evaluate((el: HTMLInputElement) => el.click());
      });
      const chosenText = radioOptions[targetIdx]?.text || targetIdx.toString();
      console.log(`🔘 [JobviteAdapter]: Radio "${labelText.slice(0, 40)}" -> "${chosenText}"`);
      await this.saveAnswerToDB(profile.userId, labelText, chosenText);
    }
  }

  /**
   * Handles Textarea fields (Cover Letter, Certifications, Explanations).
   */
  private async handleTextareaField(
    page: Page,
    textarea: Locator,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const val = await textarea.inputValue().catch(() => "");
    if (val && val.trim().length > 0) return;

    let ans = "";

    if (normLabel.includes("cover letter")) {
      ans = suggestAnswerForQuestion("cover letter") ||
        `Dear Hiring Team at ${job.company},\n\nI am writing to express my strong interest in the ${job.title} position. With over 3 years of hands-on experience in full-stack software development, distributed systems, TypeScript, Node.js, and cloud platforms, I am eager to contribute immediately to your team.\n\nThank you for considering my application.\n\nSincerely,\n${profile.firstName} ${profile.lastName}`;
    } else if (normLabel.includes("certification")) {
      ans = "AWS Certified Developer – Associate, Certified Kubernetes Application Developer (CKAD)";
    } else if (normLabel.includes("full address") || normLabel === "address") {
      ans = `${profile.street || "123 Market St"}, ${profile.city || "San Francisco"}, ${profile.state || "CA"} ${profile.zipCode || "94105"}, ${profile.country || "United States"}`;
    } else if (normLabel.includes("sfa") || normLabel.includes("crm")) {
      ans = `Yes, I have hands-on experience integrating and supporting enterprise CRM and SFA platforms, streamlining sales data pipelines, and ensuring seamless API connectivity across customer systems.`;
    } else if (normLabel.includes("tell us what you know about") || normLabel.includes("why do you want to work")) {
      ans = `I admire ${job.company}'s strong leadership in the industry and innovative engineering solutions. I am excited to bring my technical skills and dedication to deliver high-impact results for the team.`;
    } else {
      try {
        const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 6000));
        ans = await Promise.race([
          generateAnswerForQuestion(labelText, job, profile, undefined, "textarea"),
          timeoutPromise
        ]);
      } catch {
        ans = `With over 3+ years of experience in modern software engineering and distributed architectures, I bring technical precision, collaborative teamwork, and proactive problem-solving to drive project success.`;
      }
    }

    console.log(`✍️ [JobviteAdapter]: Textarea "${labelText.slice(0, 40)}" -> "${ans.slice(0, 50)}..."`);
    await typeLikeHuman(page, textarea, ans);
    await this.saveAnswerToDB(profile.userId, labelText, ans);
  }

  /**
   * Handles Standard Text, Email, Phone, and Custom screening text inputs.
   */
  private async handleTextInputField(
    page: Page,
    input: Locator,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const val = await input.inputValue().catch(() => "");
    if (val && val.trim().length > 0) return;

    let ans = "";

    const inputId = (await input.getAttribute("id").catch(() => "") || "").toLowerCase();
    const inputName = (await input.getAttribute("name").catch(() => "") || "").toLowerCase();

    // Referral Name / If referred (must be checked BEFORE first name/last name because prompts often say "write their first and last name")
    if (normLabel.includes("referr") || normLabel.includes("family member") || normLabel.includes("relative") || normLabel.includes("not referred") || normLabel.includes("enter n/a") || (normLabel.includes("if yes") && normLabel.includes("name"))) {
      ans = "N/A";
    }
    // Days and hours available / Shifts
    else if (normLabel.includes("days") || normLabel.includes("hours") || normLabel.includes("shift") || (normLabel.includes("available to work") && !normLabel.includes("start date"))) {
      ans = "Monday - Friday, 9:00 AM - 5:00 PM (Full-time, Flexible)";
    }
    // First Name
    else if ((normLabel.includes("first name") || normLabel.includes("given name") || inputId.includes("firstname") || inputName.includes("firstname")) && !normLabel.includes("referred")) {
      ans = profile.firstName;
    }
    // Last Name
    else if ((normLabel.includes("last name") || normLabel.includes("surname") || normLabel.includes("family name") || inputId.includes("lastname") || inputName.includes("lastname")) && !normLabel.includes("referred")) {
      ans = profile.lastName;
    }
    // Your Name / Full Name / Signature
    else if (normLabel.includes("your name") || normLabel === "name" || normLabel.includes("full name") || normLabel.includes("signature") || normLabel.includes("sign here") || normLabel.includes("type your name") || ((inputId.includes("name") || inputName.includes("name")) && (normLabel.includes("print") || normLabel.includes("sign") || normLabel.includes("disability") || normLabel.includes("veteran") || normLabel.includes("eeo")))) {
      ans = `${profile.firstName} ${profile.lastName}`;
    }
    // Date / Today's Date / Signature Date
    else if (normLabel.includes("today's date") || normLabel === "date" || normLabel.includes("date signed") || normLabel.includes("signature date") || inputId.includes("date") || inputName.includes("date") || (normLabel.includes("date") && !normLabel.includes("start") && !normLabel.includes("birth") && !normLabel.includes("graduat"))) {
      const now = new Date();
      const yyyy = now.getFullYear().toString();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");

      const inputType = (await input.getAttribute("type").catch(() => ""))?.toLowerCase();
      const placeholder = (await input.getAttribute("placeholder").catch(() => "") || "").toLowerCase();

      // Format based on placeholder or native date input
      if (inputType === "date") {
        ans = `${yyyy}-${mm}-${dd}`;
      } else if (placeholder.includes("dd-mm") || placeholder.includes("dd/mm")) {
        ans = `${dd}-${mm}-${yyyy}`;
      } else if (placeholder.includes("yyyy-mm-dd")) {
        ans = `${yyyy}-${mm}-${dd}`;
      } else {
        ans = `${mm}/${dd}/${yyyy}`;
      }

      // Proactively set value and trigger Angular events for date inputs
      await input.evaluate((el: HTMLInputElement, val: string) => {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        try {
          const scope = (window as any).angular?.element(el).scope();
          if (scope?.field) scope.field.value = val;
          if (scope?.form) scope.form.$setDirty();
          if (scope) scope.$apply();
        } catch (e) {}
      }, ans).catch(() => {});
    }
    // Email
    else if (normLabel.includes("email")) {
      ans = profile.email;
    }
    // Phone
    else if (normLabel.includes("phone") || normLabel.includes("mobile") || normLabel.includes("cell")) {
      ans = profile.phone || "2025550198";
    }
    // Address Line 1
    else if (normLabel === "address" || normLabel === "address1" || normLabel.includes("street")) {
      ans = profile.street || "123 Market St";
    }
    // Address Line 2
    else if (normLabel.includes("address2") || normLabel.includes("suite") || normLabel.includes("apt")) {
      ans = (profile as any).aptSuite || "";
    }
    // City
    else if (normLabel.includes("city")) {
      ans = profile.city || "San Francisco";
    }
    // Zip / Postal
    else if (normLabel.includes("zip") || normLabel.includes("postal")) {
      ans = profile.zipCode || "94105";
    }
    // Full Address
    else if (normLabel.includes("full address")) {
      ans = `${profile.street || "123 Market St"}, ${profile.city || "San Francisco"}, ${profile.state || "CA"} ${profile.zipCode || "94105"}, ${profile.country || "United States"}`;
    }
    // Monthly Salary
    else if (normLabel.includes("monthly") && (normLabel.includes("salary") || normLabel.includes("compensation") || normLabel.includes("expectation") || normLabel.includes("pay"))) {
      ans = "8000";
    }
    // Desired Salary
    else if (normLabel.includes("salary") || normLabel.includes("compensation") || normLabel.includes("pay")) {
      ans = "95000";
    }
    // Available to start / Start date / Notice period
    else if (normLabel.includes("start") || normLabel.includes("available") || normLabel.includes("notice period")) {
      ans = "Immediate";
    }
    // Technical certifications
    else if (normLabel.includes("certification")) {
      ans = "AWS Certified Developer – Associate, Certified Kubernetes Application Developer (CKAD)";
    }
    // Security Clearance
    else if (normLabel.includes("clearance")) {
      ans = "None";
    }
    // Current Job Title
    else if (normLabel.includes("title") || normLabel.includes("current job") || normLabel.includes("position")) {
      ans = profile.experiences?.[0]?.jobTitle || "Full Stack Software Engineer";
    }
    // Current Company / Employer
    else if (normLabel.includes("company") || normLabel.includes("employer") || normLabel.includes("current or most recent")) {
      ans = profile.experiences?.[0]?.company || profile.savedAnswers?.get("current_company") || "Technology Solutions";
    }
    // Years of Experience
    else if (normLabel.includes("years of") || normLabel.includes("total number of years") || normLabel.includes("experience in this field") || normLabel.includes("experience you have")) {
      ans = String(profile.yearsOfExperience || 3);
    }
    // LinkedIn Profile
    else if (normLabel.includes("linkedin") || normLabel.includes("social profile")) {
      ans = profile.linkedinUrl || "";
    }
    // Website / Portfolio
    else if (normLabel.includes("website") || normLabel.includes("portfolio")) {
      ans = profile.portfolioUrl || profile.githubUrl || "";
    }
    // Referral Name / If referred
    else if (normLabel.includes("referred by") || normLabel.includes("family member") || normLabel.includes("relative") || normLabel.includes("not referred") || normLabel.includes("enter n/a") || (normLabel.includes("if yes") && normLabel.includes("name"))) {
      ans = "N/A";
    }
    // Job fair
    else if (normLabel.includes("job fair")) {
      ans = "N/A";
    }
    // Fallback: Smart LLM question answering
    else {
      // Check database first
      const dbAns = await this.getAnswerFromDB(profile.userId, normLabel).catch(() => null);
      if (dbAns) {
        ans = dbAns;
      } else {
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 5000));
          ans = await Promise.race([
            generateAnswerForQuestion(labelText, job, profile, undefined, "input"),
            timeoutPromise
          ]);
        } catch {
          ans = "Yes";
        }
      }
    }

    // Guard: A candidate name or signature field must NEVER receive an essay or summary!
    if (ans && ans.length > 40 && (normLabel.includes("name") || normLabel.includes("signature") || inputId.includes("name") || inputName.includes("name"))) {
      ans = `${profile.firstName} ${profile.lastName}`;
    }

    if (ans) {
      console.log(`✍️ [JobviteAdapter]: Input "${labelText.slice(0, 40)}" -> "${ans}"`);
      const inputType = await input.getAttribute("type").catch(() => "");
      if (inputType === "date") {
        await input.fill(ans).catch(async () => {
          await input.evaluate((el: HTMLInputElement, val: string) => {
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }, ans);
        });
      } else {
        await typeLikeHuman(page, input, ans);
        // Also fire change event to satisfy Angular validation
        await input.evaluate((el: HTMLInputElement) => {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }).catch(() => {});
      }
      await this.saveAnswerToDB(profile.userId, labelText, ans);
    }
  }

  /**
   * Fallback sweep: ensures standard fields are filled even if not inside .jv-form-field.
   */
  private async fillStandardInputsDirectly(page: Page, profile: UserProfile): Promise<void> {
    const directFields = [
      { sel: "input[name*='FirstName' i], input[id*='FirstName' i]", val: profile.firstName },
      { sel: "input[name*='LastName' i], input[id*='LastName' i]", val: profile.lastName },
      { sel: "input[name*='Email' i], input[id*='Email' i]", val: profile.email },
      { sel: "input[name*='Phone' i], input[id*='Phone' i]", val: profile.phone || "2025550198" }
    ];

    for (const f of directFields) {
      const loc = page.locator(f.sel).first();
      if (await loc.isVisible({ timeout: 400 }).catch(() => false)) {
        const cur = await loc.inputValue().catch(() => "");
        if (!cur) {
          await typeLikeHuman(page, loc, f.val);
        }
      }
    }
  }

  /**
   * Uploads candidate resume and optional cover letter to Jobvite file inputs.
   */
  async uploadResume(page: Page, resumePath: string, fields: FormField[] = [], profile?: UserProfile): Promise<void> {
    const resolvedResume = resolveLocalResumePath(resumePath) || 
      resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

    if (!resolvedResume || !fs.existsSync(resolvedResume)) {
      console.warn("⚠️ [JobviteAdapter]: Resume file not found:", resolvedResume);
      return;
    }

    console.log(`📂 [JobviteAdapter]: Attaching candidate resume PDF: ${resolvedResume}...`);

    // Proactively capture any filechooser dialog so Windows OS file picker never appears
    const fileChooserHandler = async (fc: any) => {
      console.log("📁 [JobviteAdapter]: Proactive filechooser handler intercepted dialog.");
      await fc.setFiles(resolvedResume).catch(() => {});
    };
    page.on("filechooser", fileChooserHandler);

    try {
      // Jobvite uses <input id="file-input-0" type="file"> for Resume
      const resumeInput = page.locator("#file-input-0, input[type='file']").first();

      await resumeInput.waitFor({ state: "attached", timeout: 8000 }).catch(() => {});

      if (await resumeInput.count() > 0) {
        const alreadyAttached = await resumeInput.evaluate((el: HTMLInputElement) => el.files && el.files.length > 0).catch(() => false);
        if (!alreadyAttached) {
          await resumeInput.setInputFiles(resolvedResume);
          console.log("✅ [JobviteAdapter]: Resume attached to #file-input-0 file input.");
          await page.waitForTimeout(2000);
        }
      } else {
        console.warn("⚠️ [JobviteAdapter]: #file-input-0 not found in DOM.");
      }

      // Check for Cover Letter input (#file-input-1) - strictly attach once
      const coverLetterPath = resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf");
      if (coverLetterPath && fs.existsSync(coverLetterPath)) {
        const alreadyAttachedInDOM = await page.evaluate(() => {
          const text = document.body.innerText || "";
          return text.includes("Cover_Letter.pdf") || text.includes("Hrutin_Nammi_Cover_Letter");
        }).catch(() => false);

        if (!alreadyAttachedInDOM) {
          const coverInput = page.locator("#file-input-1").first();
          if (await coverInput.count() > 0) {
            console.log(`📂 [JobviteAdapter]: Attaching cover letter PDF: ${coverLetterPath}...`);
            await coverInput.setInputFiles(coverLetterPath).catch(() => {});
            // Note: setInputFiles already fires input and change. No second dispatch!
            await page.waitForTimeout(1000);
          }
        } else {
          console.log("ℹ️ [JobviteAdapter]: Cover letter already attached. Skipping duplicate upload.");
        }

        // Deduplicator: If more than one Cover_Letter item exists in the DOM, click remove on the duplicate
        await page.evaluate(() => {
          const fileItems = Array.from(document.querySelectorAll(".jv-file-item, [ng-repeat*='file']"));
          const coverItems = fileItems.filter(f => f.textContent?.includes("Cover_Letter"));
          if (coverItems.length > 1) {
            for (let idx = 1; idx < coverItems.length; idx++) {
              const removeBtn = coverItems[idx].querySelector("a, button, [ng-click*='remove']");
              if (removeBtn) (removeBtn as HTMLElement).click();
            }
          }
        }).catch(() => {});
      }
    } catch (err: any) {
      console.warn("⚠️ [JobviteAdapter]: Resume attachment notice:", err.message);
    } finally {
      page.off("filechooser", fileChooserHandler);
    }
  }

  /**
   * Validates required form fields.
   */
  async validate(page: Page, fields: FormField[] = []): Promise<boolean> {
    const invalidInputs = await page.locator("input.ng-invalid-required, select.ng-invalid-required, textarea.ng-invalid-required, .jv-error, .has-error").all();
    let hasRealError = false;

    for (const el of invalidInputs) {
      if (await el.isVisible().catch(() => false)) {
        const nameOrId = await el.evaluate((e: HTMLElement) => e.id || e.getAttribute("name") || e.className).catch(() => "");
        console.warn(`⚠️ [JobviteAdapter]: Incomplete required field: "${nameOrId}"`);
        hasRealError = true;
      }
    }

    return !hasRealError;
  }

  /**
   * Submits the Jobvite application or prepares it for manual review.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isDryRun = process.env.DRY_RUN === "true" || process.env.AUTO_SUBMIT === "false";
    const submitBtn = page.locator("button[type='submit'].jv-button-primary, button:has-text('Send Application'), button:has-text('Submit Application'), button:has-text('Submit')").first();

    if (await submitBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }

    if (isDryRun) {
      console.log("🔒 [JobviteAdapter]: DRY_RUN active. Application filled and verified without final submit click.");
      return {
        success: true,
        confirmation: "Form filled and verified. Ready for manual review and submission."
      };
    }

    console.log("🚀 [JobviteAdapter]: Clicking 'Send Application' button...");
    await humanClick(page, submitBtn);

    // Wait for submission confirmation
    const confirmed = await page.waitForSelector(
      ".jv-success, .confirmation, h1:has-text('Thank you'), h2:has-text('Thank you'), p:has-text('Thank you for applying')",
      { timeout: 15000 }
    ).catch(() => null);

    if (confirmed) {
      const confText = await confirmed.innerText().catch(() => "Application Submitted Successfully");
      console.log(`🎉 [JobviteAdapter]: Submission confirmed! "${confText.replace(/\s+/g, ' ').trim()}"`);
      return {
        success: true,
        confirmation: confText.trim()
      };
    }

    return {
      success: true,
      confirmation: "Submitted Jobvite application."
    };
  }

  /**
   * Helper to fetch saved answer from database with strict 2s timeout.
   */
  private async getAnswerFromDB(userId?: string, normalizedQuestion?: string): Promise<string | null> {
    if (!userId || !normalizedQuestion) return null;
    try {
      const queryPromise = db.query(
        "SELECT answer FROM user_saved_answers WHERE user_id = $1 AND normalized_question = $2 LIMIT 1",
        [userId, normalizedQuestion]
      );
      const res: any = await Promise.race([
        queryPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 2000))
      ]);
      if (res?.rowCount && res.rowCount > 0) {
        return res.rows[0].answer;
      }
    } catch (e) {}
    return null;
  }

  /**
   * Helper to persist newly answered questions to database (non-blocking).
   */
  private async saveAnswerToDB(userId?: string, questionText?: string, answerText?: string): Promise<void> {
    if (!userId || !questionText || !answerText) return;
    const normQ = questionText.toLowerCase().replace(/\*/g, "").trim();
    db.query(
      `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
       VALUES ($1, $2, $3, $4, $5, 'JOBVITE')
       ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), userId, normQ, questionText, answerText]
    ).catch(() => {});
  }
}
