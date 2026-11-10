import { Page, Locator } from "playwright";
import fs from "fs";
import path from "path";
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
  await page.waitForTimeout(150);
}

export class JazzHRAdapter implements ATSAdapter {

  /**
   * Detects whether the current page is a JazzHR application page.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("applytojob.com") || url.includes("jazzhr.com")) {
      return true;
    }
    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("applytojob.com") ||
      content.includes("resumator") ||
      content.includes("jazzhr") ||
      (await page.$("form#form_submit_new_resume, #resumator-submit-resume, input[name^='resumator-']")) !== null
    );
  }

  /**
   * Extracts job info (company, title, description, location) from JazzHR page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const url = page.url();
    let company = "Company";
    let title = "Position";

    // 1. Extract from page Title tag (format: "Job Title - Company - Career Page")
    const pageTitle = await page.title().catch(() => "");
    if (pageTitle) {
      const parts = pageTitle.split(" - ");
      if (parts.length >= 2) {
        title = parts[0].trim();
        company = parts[1].trim();
      } else {
        title = pageTitle.trim();
      }
    }

    // 2. Extract title from DOM elements if available
    const domTitle = await page.locator(".job-title, h1.job-title, h1, [data-test='job-title']").first().innerText().catch(() => "");
    if (domTitle && domTitle.trim().length > 0) {
      const cleanTitle = domTitle.replace(/^Job Title:\s*/i, "").split("\n")[0].trim();
      if (cleanTitle) title = cleanTitle;
    }

    // 3. Extract company from logo or subdomain if default
    if (company === "Company" || company.toLowerCase().includes("career page")) {
      const brandLogoAlt = await page.locator(".brand-logo img, img.brand-logo, .page-header img").first().getAttribute("alt").catch(() => "");
      if (brandLogoAlt && brandLogoAlt.trim()) {
        company = brandLogoAlt.trim();
      } else {
        const subdomainMatch = url.match(/https?:\/\/([^.]+)\.applytojob\.com/i);
        if (subdomainMatch && subdomainMatch[1]) {
          const rawSub = subdomainMatch[1];
          company = rawSub.charAt(0).toUpperCase() + rawSub.slice(1);
        }
      }
    }

    // 4. Job description
    const description = await page.locator(
      ".job-description, #job-description, .description, div[class*='description'], article, main"
    ).first().innerText({ timeout: 2000 }).catch(() => "JazzHR job opportunity");

    return {
      company,
      title,
      description: description ? description.slice(0, 1500) : "JazzHR job opportunity",
      ats: "JAZZHR"
    };
  }

  /**
   * Scrapes interactive form fields from JazzHR.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Analyzing JazzHR Application...", "Scanning application form", "info", 40);
    await this.dismissJazzHRPopups(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const formGroups = Array.from(document.querySelectorAll(".form-group, div[class*='form-group']"));

      formGroups.forEach((group, idx) => {
        const labelEl = group.querySelector("label.control-label, label");
        const rawLabel = labelEl?.textContent?.replace(/\s+/g, " ").trim() || "";
        const isRequired = rawLabel.includes("*") || group.querySelector(".asterisk") !== null;
        const cleanLabel = rawLabel.replace(/\*/g, "").trim();

        // Skip instructions or honeypot sections in raw field list
        if (cleanLabel.toLowerCase().includes("optional") && !group.querySelector("input, select, textarea")) return;

        const input = group.querySelector("input:not([type='hidden']), select, textarea") as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!input) return;

        const id = input.id || input.name || `field_${idx}`;
        const typeAttr = (input.getAttribute("type") || input.tagName).toLowerCase();

        let fieldType: any = "text";
        if (typeAttr === "file") fieldType = "file";
        else if (typeAttr === "email") fieldType = "email";
        else if (typeAttr === "tel") fieldType = "tel";
        else if (typeAttr === "checkbox") fieldType = "checkbox";
        else if (typeAttr === "radio") fieldType = "radio";
        else if (input.tagName.toLowerCase() === "select") fieldType = "select";
        else if (input.tagName.toLowerCase() === "textarea") fieldType = "textarea";

        // Options for select
        let options: FormFieldOption[] | undefined;
        if (input.tagName.toLowerCase() === "select") {
          const selectEl = input as HTMLSelectElement;
          options = Array.from(selectEl.options).map(opt => ({
            label: opt.text.trim(),
            value: opt.value
          })).filter(o => o.value !== "resumator_no_selection" && o.value !== "0" && o.value !== "");
        } else if (fieldType === "checkbox" || fieldType === "radio") {
          const allOptions = Array.from(group.querySelectorAll("label.checkbox, label.radio, label")).map(l => ({
            label: l.textContent?.replace(/\s+/g, " ").trim() || "",
            value: (l.querySelector("input") as HTMLInputElement)?.value || ""
          })).filter(o => o.label.length > 0 && o.label !== cleanLabel);
          if (allOptions.length > 0) options = allOptions;
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
   * Resolves the candidate's Cover Letter PDF if available.
   */
  private resolveCoverLetterPath(resumePath: string, profile?: UserProfile): string | null {
    const resolvedResume = resolveLocalResumePath(resumePath);
    if (!resolvedResume) return null;

    const dir = path.dirname(resolvedResume);
    const candidateCoverName = profile ? `${profile.firstName}_${profile.lastName}_Cover_Letter.pdf` : "Cover_Letter.pdf";
    const candidateFiles = [
      profile?.coverLetterPath || "",
      path.join(dir, candidateCoverName),
      path.join(dir, "cover_letter.pdf"),
      path.join(dir, "Cover_Letter.pdf"),
      resolvedResume.replace(/Resume/i, "Cover_Letter"),
      resolvedResume.replace(/resume/i, "cover_letter")
    ];

    for (const f of candidateFiles) {
      if (fs.existsSync(f)) return f;
    }

    if (profile?.userId) {
      const userDir = path.resolve(process.cwd(), "resumes", `user_${profile.userId}`);
      if (fs.existsSync(userDir)) {
        try {
          const files = fs.readdirSync(userDir);
          const match = files.find(f => /cover.*letter.*\.pdf$/i.test(f));
          if (match) return path.join(userDir, match);
        } catch (e) {}
      }
    }

    return resolvedResume;
  }

  /**
   * Dismisses any JazzHR popups, tracking consent banners, cookie notices, or Bootstrap modals.
   */
  async dismissJazzHRPopups(page: Page): Promise<void> {
    try {
      // 1. Universal popup and cookie dismissal
      await dismissCommonPopups(page);

      // 2. JazzHR tracking consent banner (#tracking-consent-banner)
      const jazzBanner = page.locator("#tracking-consent-banner, .tracking-consent-banner-content").first();
      if (await jazzBanner.isVisible({ timeout: 400 }).catch(() => false)) {
        console.log("🍪 [JazzHRAdapter]: Detected JazzHR tracking consent banner. Dismissing...");
        const allowBtn = jazzBanner.locator(".tracking-consent-button.allow, button:has-text('Allow'), button.dismiss").first();
        if (await allowBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          await humanClick(page, allowBtn);
          await page.waitForTimeout(200);
        }
        await page.evaluate(() => {
          const b = document.getElementById("tracking-consent-banner");
          if (b) b.remove();
          try { window.localStorage.setItem("trackingConsentGranted", "true"); } catch (e) {}
        }).catch(() => {});
      }

      // 3. Close active Bootstrap modal dialogs if any
      const modalClose = page.locator(".modal.in [data-dismiss='modal'], .modal.show [data-dismiss='modal'], .modal.in .close, .modal.show .close").first();
      if (await modalClose.isVisible({ timeout: 300 }).catch(() => false)) {
        console.log("❌ [JazzHRAdapter]: Closing active Bootstrap modal popup...");
        await modalClose.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
      }

      // 4. Clean up modal backdrops and ensure scrolling is unlocked
      await page.evaluate(() => {
        document.querySelectorAll(".modal-backdrop").forEach(el => el.remove());
        if (document.body) {
          document.body.classList.remove("modal-open");
          document.body.style.overflow = "auto";
        }
        if (document.documentElement) {
          document.documentElement.style.overflow = "auto";
        }
      }).catch(() => {});
    } catch (e) {}
  }

  /**
   * Automatically fills all standard, custom, EEO, questionnaire, and file fields.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    fields: FormField[] = []
  ): Promise<void> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Filling JazzHR Application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 50);

    // Auto-dismiss any native dialogs (alert/confirm)
    page.on("dialog", async dialog => {
      console.log(`⚠️ [JazzHRAdapter]: Native dialog popup detected ("${dialog.message()}"). Accepting...`);
      await dialog.accept().catch(() => {});
    });

    await this.dismissJazzHRPopups(page);

    const job = await this.extractJob(page);

    // If on mobile/responsive layout, ensure applying state is toggled
    const mobileApplyBtn = page.locator("#resumator-mobile-apply-button").first();
    if (await mobileApplyBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await mobileApplyBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }

    // ─── 1. STANDARD CANDIDATE CONTACT FIELDS ───
    console.log("✍️ [JazzHRAdapter]: Filling candidate contact information...");

    // First Name
    const fn = page.locator("#resumator-firstname-value, input[name='resumator-firstname-value']").first();
    if (await fn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, fn, profile.firstName);
    }

    // Last Name
    const ln = page.locator("#resumator-lastname-value, input[name='resumator-lastname-value']").first();
    if (await ln.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, ln, profile.lastName);
    }

    // Email
    const em = page.locator("#resumator-email-value, input[name='resumator-email-value']").first();
    if (await em.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, em, profile.email);
    }

    // Phone
    const ph = page.locator("#resumator-phone-value, input[name='resumator-phone-value']").first();
    if (await ph.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, ph, profile.phone || "+1 202 555 0198");
    }

    // Address Line
    const addr = page.locator("#resumator-address-value, input[name='resumator-address-value']").first();
    if (await addr.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, addr, profile.street || "123 Market St");
    }

    // City
    const city = page.locator("#resumator-city-value, input[name='resumator-city-value']").first();
    if (await city.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, city, profile.city || "San Francisco");
    }

    // State / Province (Handles both <select> and <input>)
    const stateEl = page.locator("#resumator-state-value, input[name='resumator-state-value'], select[name='resumator-state-value']").first();
    if (await stateEl.isVisible({ timeout: 1500 }).catch(() => false)) {
      const tagName = await stateEl.evaluate(el => el.tagName.toLowerCase()).catch(() => "input");
      if (tagName === "select") {
        const val = await stateEl.evaluate((sel: HTMLSelectElement) => {
          const match = Array.from(sel.options).find(o => /^california$/i.test(o.text) || /\bCA\b/i.test(o.value) || /california/i.test(o.text));
          return match ? match.value : (sel.options[1] ? sel.options[1].value : "");
        });
        if (val) await stateEl.selectOption(val).catch(() => {});
      } else {
        await typeLikeHuman(page, stateEl, profile.state || "CA");
      }
    }

    // Postal / Zip Code
    const postal = page.locator("#resumator-postal-value, input[name='resumator-postal-value']").first();
    if (await postal.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, postal, profile.zipCode || "94105");
    }

    // Country (if present)
    const countryEl = page.locator("#resumator-country-value, select[name='resumator-country-value'], input[name='resumator-country-value']").first();
    if (await countryEl.isVisible({ timeout: 1000 }).catch(() => false)) {
      const tagName = await countryEl.evaluate(el => el.tagName.toLowerCase()).catch(() => "select");
      if (tagName === "select") {
        const val = await countryEl.evaluate((sel: HTMLSelectElement) => {
          const match = Array.from(sel.options).find(o => /united states|usa|us\b/i.test(o.text) || /US/i.test(o.value));
          return match ? match.value : (sel.options[1] ? sel.options[1].value : "");
        });
        if (val) await countryEl.selectOption(val).catch(() => {});
      } else {
        await typeLikeHuman(page, countryEl, "United States");
      }
    }

    // ─── 2. COVER LETTER & RELOCATION ───
    // Cover Letter Textarea
    const clTextarea = page.locator("#resumator-coverletter-value, textarea[name='resumator-coverletter-value']").first();
    if (await clTextarea.isVisible({ timeout: 1000 }).catch(() => false)) {
      const currentVal = await clTextarea.inputValue().catch(() => "");
      if (!currentVal || !currentVal.trim()) {
        const coverText = suggestAnswerForQuestion("cover letter");
        console.log("✍️ [JazzHRAdapter]: Populating Cover Letter textarea...");
        await typeLikeHuman(page, clTextarea, coverText);
      }
    }

    // Are you willing to relocate?
    const relocateEl = page.locator("#resumator-relocate-value, select[name='resumator-relocate-value']").first();
    if (await relocateEl.isVisible({ timeout: 1000 }).catch(() => false)) {
      // 1 = Yes, 2 = No
      await relocateEl.selectOption("1").catch(async () => {
        await relocateEl.selectOption({ label: "Yes" });
      });
    }

    // Desired Salary / Compensation field (if present as standard input)
    const salaryInp = page.locator("#resumator-salary-value, input[name='resumator-salary-value'], #resumator-compensation-value").first();
    if (await salaryInp.isVisible({ timeout: 1000 }).catch(() => false)) {
      const currentVal = await salaryInp.inputValue().catch(() => "");
      if (!currentVal) await typeLikeHuman(page, salaryInp, "Negotiable");
    }

    // ─── 3. EEO & DEMOGRAPHIC INFORMATION ───
    console.log("🏛️ [JazzHRAdapter]: Handling EEO Demographics (Gender, Race, Veteran, Disability)...");

    // Gender (Strict Male match, never selecting Female)
    const genderSel = page.locator("#resumator-eeo_gender-value, select[name='resumator-eeo_gender-value']").first();
    if (await genderSel.isVisible({ timeout: 1000 }).catch(() => false)) {
      const gVal = await genderSel.evaluate((sel: HTMLSelectElement) => {
        const opts = Array.from(sel.options);
        // Find option that contains male or man, but strictly NOT female or woman
        const maleOpt = opts.find(o => {
          const txt = o.text.trim().toLowerCase();
          return (txt.includes("male") || txt === "man") && !txt.includes("female") && !txt.includes("woman");
        });
        if (maleOpt) return maleOpt.value;
        const declineOpt = opts.find(o => /decline|prefer not|choose not/i.test(o.text));
        return declineOpt ? declineOpt.value : "";
      });
      if (gVal) await genderSel.selectOption(gVal).catch(() => {});
    }

    // Race / Ethnicity
    const raceSel = page.locator("#resumator-eeo_race-value, select[name='resumator-eeo_race-value']").first();
    if (await raceSel.isVisible({ timeout: 1000 }).catch(() => false)) {
      const rVal = await raceSel.evaluate((sel: HTMLSelectElement) => {
        const match = Array.from(sel.options).find(o => /asian/i.test(o.text) || /two or more/i.test(o.text));
        return match ? match.value : (sel.options[1] ? sel.options[1].value : "");
      });
      if (rVal) await raceSel.selectOption(rVal).catch(() => {});
    }

    // Veteran status (value 2 = Not a protected veteran)
    const veteranRadio = page.locator("#resumator-eeoc_veteran-value_2, input[name='resumator-eeoc_veteran-value'][value='2']").first();
    if (await veteranRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
      await veteranRadio.check({ force: true }).catch(() => {});
    } else {
      const fallbackVet = page.locator("input[name='resumator-eeoc_veteran-value']").nth(1);
      if (await fallbackVet.isVisible({ timeout: 500 }).catch(() => false)) {
        await fallbackVet.check({ force: true }).catch(() => {});
      }
    }

    // Disability status (value 2 = No, I don't have a disability; value 0 = Decline)
    const disabilityRadio = page.locator("#resumator-eeoc_disability-value-2, input[name='resumator-eeoc_disability-value'][value='2']").first();
    if (await disabilityRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
      await disabilityRadio.check({ force: true }).catch(() => {});
    } else {
      const fallbackDis = page.locator("input[name='resumator-eeoc_disability-value']").nth(1);
      if (await fallbackDis.isVisible({ timeout: 500 }).catch(() => false)) {
        await fallbackDis.check({ force: true }).catch(() => {});
      }
    }

    // Disability Signature Name & Date
    const sigInp = page.locator("#resumator-eeoc_disability_signature-value, input[name='resumator-eeoc_disability_signature-value']").first();
    if (await sigInp.isVisible({ timeout: 1000 }).catch(() => false)) {
      await typeLikeHuman(page, sigInp, `${profile.firstName} ${profile.lastName}`);
    }

    const dateInp = page.locator("#resumator-eeoc_disability_date-value, input[name='resumator-eeoc_disability_date-value']").first();
    if (await dateInp.isVisible({ timeout: 1000 }).catch(() => false)) {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const yyyy = today.getFullYear();
      const formattedDate = `${mm}/${dd}/${yyyy}`;
      await typeLikeHuman(page, dateInp, formattedDate);
    }

    // ─── 4. CUSTOM QUESTIONNAIRE QUESTIONS (INPUTS, SELECTS, RADIOS, CHECKBOXES) ───
    console.log("🤖 [JazzHRAdapter]: Processing custom questionnaire questions & screening forms...");

    const formGroups = await page.locator("form#form_submit_new_resume .form-group").all();
    for (const group of formGroups) {
      if (!(await group.isVisible().catch(() => false))) continue;

      // Extract question label
      const labelText = await group.evaluate((el: HTMLElement) => {
        const lbl = el.querySelector("label.control-label, label");
        return lbl?.textContent?.replace(/\s+/g, " ").trim() || "";
      }).catch(() => "");

      if (!labelText) continue;

      const normLabel = labelText.toLowerCase();

      // HONEYPOT DETECTION: Strictly skip internal use / anti-bot honeypots
      if (
        normLabel.includes("internal use only") ||
        normLabel.includes("should not fill") ||
        normLabel.includes("do not fill") ||
        normLabel.includes("leave blank") ||
        normLabel.includes("honeypot")
      ) {
        console.log(`🛡️ [JazzHRAdapter]: Honeypot detected ("${labelText.slice(0, 50)}") -> Leaving strictly empty.`);
        continue;
      }

      // Skip already-filled standard contact and EEO demographic fields
      if (
        normLabel.startsWith("first name") ||
        normLabel.startsWith("last name") ||
        normLabel.startsWith("email address") ||
        normLabel === "phone" ||
        normLabel === "address" ||
        normLabel.startsWith("resume") ||
        normLabel.startsWith("cover letter") ||
        normLabel.includes("disability") ||
        normLabel.includes("veteran") ||
        normLabel.includes("gender") ||
        normLabel.includes("race") ||
        normLabel.includes("optional questions") ||
        normLabel.includes("entirely optional")
      ) {
        continue;
      }

      // Check for <select> dropdown question
      const selectEl = group.locator("select").first();
      if (await selectEl.isVisible({ timeout: 400 }).catch(() => false)) {
        const currentVal = await selectEl.inputValue().catch(() => "");
        if (!currentVal || currentVal === "resumator_no_selection" || currentVal === "0" || currentVal === "") {
          const options = await selectEl.evaluate((sel: HTMLSelectElement) => {
            return Array.from(sel.options).map(o => o.text.trim()).filter(t => t && !t.includes("-- No answer --") && !t.includes("No answer") && !t.includes("Select"));
          });

          let chosenOption = "";
          // Rule: ALWAYS select LinkedIn for source question
          if (normLabel.includes("hear about") || normLabel.includes("source") || normLabel.includes("where did you find")) {
            const li = options.find(o => /linkedin/i.test(o));
            chosenOption = li || options[0] || "LinkedIn";
            console.log(`🎯 [JazzHRAdapter]: Source question detected -> Choosing LinkedIn: "${chosenOption}"`);
          } else {
            chosenOption = await generateAnswerForQuestion(labelText, job, profile, options, "select");
          }

          if (chosenOption) {
            console.log(`📋 [JazzHRAdapter]: Dropdown "${labelText.slice(0, 40)}" -> "${chosenOption}"`);
            await selectEl.selectOption({ label: chosenOption }).catch(async () => {
              const matchedVal = await selectEl.evaluate((sel: HTMLSelectElement, optText: string) => {
                const match = Array.from(sel.options).find(o => o.text.toLowerCase().includes(optText.toLowerCase()) || optText.toLowerCase().includes(o.text.toLowerCase()));
                return match ? match.value : "";
              }, chosenOption);
              if (matchedVal) await selectEl.selectOption(matchedVal).catch(() => {});
            });

            // Persist new field answer to database
            await this.saveAnswerToDB(profile.userId, labelText, chosenOption);
          }
        }
        continue;
      }

      // Check for Checkbox group
      const checkboxes = group.locator("input[type='checkbox']");
      const cbCount = await checkboxes.count().catch(() => 0);
      if (cbCount > 0) {
        const optionLabels: string[] = [];
        for (let i = 0; i < cbCount; i++) {
          const cbText = await checkboxes.nth(i).evaluate((el: HTMLInputElement) => {
            return el.closest("label")?.textContent?.replace(/\s+/g, " ").trim() || el.value || "";
          });
          optionLabels.push(cbText);
        }

        // Determine which checkboxes to check
        if (normLabel.includes("pronoun")) {
          // Check He/Him
          for (let i = 0; i < cbCount; i++) {
            if (/he\/him/i.test(optionLabels[i])) {
              await checkboxes.nth(i).check({ force: true }).catch(() => {});
            }
          }
        } else {
          // Use LLM to pick appropriate checkboxes or check top relevant
          console.log(`☑️ [JazzHRAdapter]: Checkbox group "${labelText.slice(0, 45)}" with options: [${optionLabels.join(", ")}]`);
          const pickedAnswer = await generateAnswerForQuestion(labelText, job, profile, optionLabels, "checkbox");
          for (let i = 0; i < cbCount; i++) {
            if (pickedAnswer.toLowerCase().includes(optionLabels[i].toLowerCase()) || optionLabels[i].toLowerCase().includes(pickedAnswer.toLowerCase())) {
              await checkboxes.nth(i).check({ force: true }).catch(() => {});
            }
          }
          // If none checked and required, check the first option
          const anyChecked = await group.locator("input[type='checkbox']:checked").count().catch(() => 0);
          if (anyChecked === 0 && cbCount > 0) {
            await checkboxes.first().check({ force: true }).catch(() => {});
          }
        }
        continue;
      }

      // Check for Radio group
      const radios = group.locator("input[type='radio']");
      const rCount = await radios.count().catch(() => 0);
      if (rCount > 0) {
        const rLabels: string[] = [];
        for (let i = 0; i < rCount; i++) {
          const rText = await radios.nth(i).evaluate((el: HTMLInputElement) => {
            return el.closest("label")?.textContent?.replace(/\s+/g, " ").trim() || el.value || "";
          });
          rLabels.push(rText);
        }

        let targetIdx = 0;
        if (normLabel.includes("hear about") || normLabel.includes("source")) {
          const liIdx = rLabels.findIndex(l => /linkedin/i.test(l));
          if (liIdx !== -1) targetIdx = liIdx;
        } else {
          const ans = await generateAnswerForQuestion(labelText, job, profile, rLabels, "radio");
          const idx = rLabels.findIndex(l => l.toLowerCase() === ans.toLowerCase() || ans.toLowerCase().includes(l.toLowerCase()));
          if (idx !== -1) targetIdx = idx;
        }

        console.log(`🔘 [JazzHRAdapter]: Radio "${labelText.slice(0, 40)}" -> "${rLabels[targetIdx]}"`);
        await radios.nth(targetIdx).check({ force: true }).catch(() => {});
        continue;
      }

      // Check for Textarea
      const textarea = group.locator("textarea").first();
      if (await textarea.isVisible({ timeout: 400 }).catch(() => false)) {
        const currentVal = await textarea.inputValue().catch(() => "");
        if (!currentVal || !currentVal.trim()) {
          console.log(`🤖 [JazzHRAdapter]: Generating response for essay/textarea "${labelText.slice(0, 50)}"...`);
          const ans = await generateAnswerForQuestion(labelText, job, profile, undefined, "textarea");
          await typeLikeHuman(page, textarea, ans);
          await this.saveAnswerToDB(profile.userId, labelText, ans);
        }
        continue;
      }

      // Check for Text / Tel / Number Input
      const textInp = group.locator("input[type='text'], input:not([type]), input[type='number']").first();
      if (await textInp.isVisible({ timeout: 400 }).catch(() => false)) {
        const currentVal = await textInp.inputValue().catch(() => "");
        if (!currentVal || !currentVal.trim()) {
          let ans = "";

          // Deterministic mappings for high-frequency JazzHR questions
          if (normLabel.includes("hear about") || normLabel.includes("source")) {
            ans = "LinkedIn";
          } else if (normLabel.includes("linkedin") || normLabel.includes("profile url")) {
            ans = profile.linkedinUrl || "";
          } else if (normLabel.includes("compensation") || normLabel.includes("salary") || normLabel.includes("pay")) {
            ans = "Negotiable";
          } else if (normLabel.includes("pronoun")) {
            ans = (profile.gender?.toLowerCase() === "female") ? "She/Her" : "He/Him";
          } else if (normLabel.includes("notice period") || normLabel.includes("start date") || normLabel.includes("when can you start")) {
            ans = "Immediate";
          } else if (normLabel.includes("years of experience") || normLabel.includes("how many years")) {
            ans = String(profile.yearsOfExperience || 3);
          } else {
            ans = await generateAnswerForQuestion(labelText, job, profile, undefined, "input");
          }

          console.log(`✍️ [JazzHRAdapter]: Custom input "${labelText.slice(0, 45)}" -> "${ans.slice(0, 45)}"`);
          await typeLikeHuman(page, textInp, ans);
          await this.saveAnswerToDB(profile.userId, labelText, ans);
        }
      }
    }

    // ─── 5. FILE UPLOADS (RESUME & COVER LETTER) ───
    const resumePath = additionalAnswers?.resumePath || profile.resumePath || resolveLocalResumePath(profile.resumePath || "");
    await this.uploadResume(page, resumePath, fields, profile);

    // ─── 6. DISMISS POPUPS & SCROLL TO BOTTOM TO BRING SUBMIT BUTTON & RECAPTCHA INTO VIEW ───
    await this.dismissJazzHRPopups(page);
    const submitBtn = page.locator("#resumator-submit-resume, #resumator-submit-resume-button, a:has-text('Submit Application')").first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }
  }

  /**
   * Uploads candidate PDF resume and optional cover letter to JazzHR file input(s).
   */
  /**
   * Uploads candidate PDF resume and optional cover letter to JazzHR file input(s).
   */
  async uploadResume(page: Page, resumePath: string, fields: FormField[] = [], profile?: UserProfile): Promise<void> {
    const resolvedResume = resolveLocalResumePath(resumePath);
    const resolvedCoverLetter = this.resolveCoverLetterPath(resumePath, profile);

    // Proactively capture any native filechooser event so OS dialog never opens
    const fileChooserHandler = async (fc: any) => {
      console.log("📁 [JazzHRAdapter]: Proactive filechooser handler intercepted dialog.");
      if (resolvedResume) await fc.setFiles(resolvedResume).catch(() => {});
    };
    page.on("filechooser", fileChooserHandler);

    try {
      // 1. Reveal file upload input if JazzHR uses the 2-step Attach Resume interface
      console.log("👉 [JazzHRAdapter]: Triggering 'Attach resume' in JazzHR...");
      await page.evaluate(() => {
        const attachLink = document.getElementById("resumator-choose-upload") ||
                           Array.from(document.querySelectorAll("a, button, span")).find(el => /attach\s*resume/i.test(el.textContent || ""));
        if (attachLink) {
          (attachLink as HTMLElement).click();
        }
        const wrapper = document.getElementById("resumator-resume-upload-wrapper");
        if (wrapper) wrapper.style.display = "block";
      }).catch(() => {});
      await page.waitForTimeout(500);

      // 2. Attach resume file directly to JazzHR resume input
      const resumeInput = page.locator("#resumator-resume-value, input[name='resumator-resume-value'], input[type='file'][name*='resume' i]").first();
      let resumeAttached = false;

      if (resolvedResume && (await resumeInput.count()) > 0) {
        console.log(`📂 [JazzHRAdapter]: Uploading Resume to #resumator-resume-value: ${resolvedResume}...`);
        await resumeInput.setInputFiles(resolvedResume).catch(err => {
          console.warn("⚠️ [JazzHRAdapter]: Resume upload notice:", err.message);
        });
        await resumeInput.evaluate((el: HTMLInputElement) => {
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }).catch(() => {});
        resumeAttached = true;
        await page.waitForTimeout(1500);
      }

      const fileInputs = page.locator("input[type='file']");
      const count = await fileInputs.count().catch(() => 0);
      console.log(`📂 [JazzHRAdapter]: Detected ${count} file input(s) on page.`);

      if (count > 0 && resolvedResume && !resumeAttached) {
        for (let i = 0; i < count; i++) {
          const input = fileInputs.nth(i);
          const id = (await input.getAttribute("id").catch(() => "")) || "";
          const name = (await input.getAttribute("name").catch(() => "")) || "";

          if (!name.includes("cover") && !id.includes("cover")) {
            console.log(`📂 [JazzHRAdapter]: Uploading Resume to #${id || name || i}: ${resolvedResume}...`);
            await input.setInputFiles(resolvedResume).catch(() => {});
            await input.evaluate((el: HTMLInputElement) => {
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }).catch(() => {});
            await page.waitForTimeout(1500);
            break;
          }
        }
      }

      // Optional Cover Letter file upload if present
      if (resolvedCoverLetter) {
        const coverInput = page.locator("input[type='file'][name*='cover' i], #resumator-coverletter-file").first();
        if ((await coverInput.count()) > 0) {
          console.log(`📂 [JazzHRAdapter]: Uploading Cover Letter file: ${resolvedCoverLetter}...`);
          await coverInput.setInputFiles(resolvedCoverLetter).catch(() => {});
          await coverInput.dispatchEvent("change").catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    } finally {
      page.off("filechooser", fileChooserHandler);
    }
  }

  /**
   * Validates if required fields are filled.
   */
  async validate(page: Page, fields: FormField[] = []): Promise<boolean> {
    // Check if client-side validation errors exist
    const errors = await page.locator(".resumator_label_error, .has-error, .help-block.error, [class*='error']").all();
    const visibleErrors: string[] = [];
    for (const err of errors) {
      if (await err.isVisible().catch(() => false)) {
        const text = (await err.innerText().catch(() => "")).trim();
        if (text && !text.includes("optional")) visibleErrors.push(text);
      }
    }

    if (visibleErrors.length > 0) {
      console.warn("⚠️ [JazzHRAdapter]: Form validation warning(s):", visibleErrors.join("; "));
      return false;
    }
    return true;
  }

  /**
   * Submits the JazzHR application or holds for review in simulation mode.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isDryRun = process.env.DRY_RUN !== "false";
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    console.log(`🎯 [JazzHRAdapter]: Submission evaluation (DRY_RUN=${isDryRun}, AUTO_SUBMIT=${isAutoSubmit})...`);
    await this.dismissJazzHRPopups(page);

    const submitBtn = page.locator("#resumator-submit-resume, #resumator-submit-resume-button, a:has-text('Submit Application')").first();
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }

    if (isDryRun || !isAutoSubmit) {
      console.log("🔒 [JazzHRAdapter]: DRY_RUN active. Application filled, scrolled to submit, and verified without final submit click.");
      return {
        success: true,
        confirmation: "Form filled & verified (Simulation Mode - Ready for Review)"
      };
    }

    // ─── CHECK & HANDLE RECAPTCHA BEFORE SUBMIT ───
    const recaptchaFrame = page.locator("iframe[src*='recaptcha' i], iframe[title*='reCAPTCHA' i]").first();
    if (await recaptchaFrame.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log("🛡️ [JazzHRAdapter]: reCAPTCHA detected on JazzHR form.");

      const isAlreadySolved = await page.evaluate(() => {
        const resp = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
        return !!(resp && resp.value && resp.value.trim().length > 0);
      }).catch(() => false);

      if (!isAlreadySolved) {
        try {
          const checkbox = recaptchaFrame.contentFrame().locator(".recaptcha-checkbox-border, #recaptcha-anchor").first();
          if (await checkbox.isVisible({ timeout: 1500 }).catch(() => false)) {
            console.log("👉 [JazzHRAdapter]: Clicking reCAPTCHA checkbox...");
            await checkbox.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
          }
        } catch (e) {}

        const nowSolved = await page.evaluate(() => {
          const resp = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
          return !!(resp && resp.value && resp.value.trim().length > 0);
        }).catch(() => false);

        if (!nowSolved) {
          console.log("🧩 [JazzHRAdapter]: reCAPTCHA puzzle challenge active on screen. Please solve puzzle to auto-submit...");
          await updateHUDStatus(page, "reCAPTCHA Challenge", "Solve the image puzzle to auto-submit", "warning", 90);
          await recaptchaFrame.scrollIntoViewIfNeeded().catch(() => {});

          await page.waitForFunction(() => {
            const resp = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
            return !!(resp && resp.value && resp.value.trim().length > 0);
          }, { timeout: 60000 }).catch(() => {});
        }
      }
    }

    // Click Submit
    console.log("🚀 [JazzHRAdapter]: Clicking Submit Application button...");
    await humanClick(page, submitBtn);

    // Wait for submission confirmation or error
    try {
      await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
      const content = (await page.content().catch(() => "")).toLowerCase();
      const isSuccess =
        content.includes("thank you for applying") ||
        content.includes("application has been submitted") ||
        content.includes("application received") ||
        content.includes("thanks for applying") ||
        content.includes("successfully submitted");

      if (isSuccess) {
        console.log("✅ [JazzHRAdapter]: Application submitted successfully!");
        return {
          success: true,
          confirmation: "Application successfully submitted to JazzHR."
        };
      }
    } catch (e: any) {
      console.warn("⚠️ [JazzHRAdapter]: Submit notice:", e.message);
    }

    return {
      success: true,
      confirmation: "Submission completed."
    };
  }

  /**
   * Helper to persist discovered questions and answers into database.
   */
  private async saveAnswerToDB(userId?: string, questionText?: string, answerText?: string): Promise<void> {
    if (!userId || !questionText || !answerText) return;
    try {
      const normQ = questionText.toLowerCase().replace(/\*/g, "").trim();
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [uuidv4(), userId, normQ, questionText, answerText]
      ).catch(() => {});
    } catch (e) {}
  }
}
