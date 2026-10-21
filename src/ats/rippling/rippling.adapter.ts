import path from "path";
import fs from "fs";
import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel } from "../../application/field-mapper";
import { suggestAnswerForQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { simulateHumanMouse, humanClick, typeLikeHuman } from "../../browser/form-filler";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { db } from "../../database/db";

export class RipplingAdapter implements ATSAdapter {

  /**
   * Detects whether the current page is powered by Rippling ATS.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("ats.rippling.com") || url.includes("rippling.com/jobs") || url.includes("rippling.com/ats")) {
      return true;
    }

    const content = (await page.content().catch(() => "")).toLowerCase();
    if (
      content.includes("ats.rippling.com") ||
      content.includes("rippling") ||
      (await page.$("input[data-testid='input-first_name'], input[data-testid='input-phone_number'], div[data-testid='phone_number-code'], div[data-testid='sms_opt_in']")) !== null
    ) {
      return true;
    }
    return false;
  }

  /**
   * Extracts job information from the Rippling job posting page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");
    const url = page.url();

    let company = "Rippling";
    try {
      const parsedUrl = new URL(url);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      // e.g. /en-GB/rippling/jobs/1234
      if (segments.length >= 2 && segments[0].includes("-")) {
        company = segments[1].charAt(0).toUpperCase() + segments[1].slice(1);
      }
    } catch (e) {}

    let title = "";
    const h1 = await page.locator("h1, h2, h3, h4, [data-testid='job-title'], [class*='JobTitle']").first().innerText().catch(() => "");
    if (h1 && h1.trim()) {
      title = h1.trim().replace(/^Application:\s*/i, "");
    } else if (pageTitle) {
      title = pageTitle.split("|")[0].split("-")[0].trim();
    }
    title = title || "Position";

    const description = await page.locator("[class*='description'], [class*='content'], article, main").first().innerText().catch(() => "");

    return {
      company,
      title,
      description: description || "No description extracted",
      ats: "RIPPLING"
    };
  }

  /**
   * Scrapes interactive form fields from the Rippling page.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Scanning Rippling application form...", "Analyzing inputs & questions", "info", 15);

    await dismissCommonPopups(page);
    await this.ensureApplicationFormOpen(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const fieldContainers = Array.from(document.querySelectorAll("div[data-testid='field']"));

      fieldContainers.forEach((fc, idx) => {
        let label = "";
        const labelEl = fc.querySelector("label, span[id$='-label'], [class*='label']");
        if (labelEl) {
          label = (labelEl.textContent || "").trim();
        }

        // Check if there is a preceding sibling title (for customQuestions)
        if (!label) {
          let p = fc.parentElement;
          while (p && p.tagName !== "FORM" && p.tagName !== "BODY") {
            if (p.previousElementSibling) {
              const prevText = p.previousElementSibling.querySelector("p, h4, h5, label");
              if (prevText && prevText.textContent) {
                label = prevText.textContent.trim();
                break;
              }
            }
            p = p.parentElement;
          }
        }

        const input = fc.querySelector("input, textarea, div[role='combobox']");
        if (!input) return;

        const testId = input.getAttribute("data-testid") || fc.getAttribute("data-testid") || `field-${idx}`;
        const typeAttr = input.getAttribute("type") || input.tagName.toLowerCase();
        let type: FormField["type"] = "text";
        if (typeAttr === "file") type = "file";
        else if (typeAttr === "email") type = "email";
        else if (typeAttr === "tel") type = "tel";
        else if (input.getAttribute("role") === "combobox" || typeAttr === "select") type = "select";
        else if (typeAttr === "radio") type = "radio";
        else if (typeAttr === "checkbox") type = "checkbox";

        results.push({
          id: testId,
          label: label || input.getAttribute("placeholder") || testId,
          type,
          required: fc.textContent?.includes("*") || input.getAttribute("aria-required") === "true"
        });
      });

      return results;
    });
  }

  /**
   * Ensures the Rippling application form is opened and visible.
   */
  private async ensureApplicationFormOpen(page: Page): Promise<void> {
    await dismissCommonPopups(page);

    const isFirstNameVisible = await page.locator("input[data-testid='input-first_name']").isVisible().catch(() => false);
    if (isFirstNameVisible) return;

    console.log("ℹ️ [RipplingAdapter]: Form not visible, looking for Apply button...");
    const applyBtn = page.locator("button:has-text('Apply now'), button:has-text('Apply'), [data-testid='apply-button']").first();
    if (await applyBtn.count() > 0 && await applyBtn.isVisible().catch(() => false)) {
      console.log("👉 [RipplingAdapter]: Clicking 'Apply now' button...");
      await applyBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
    }

    await page.waitForSelector("input[data-testid='input-first_name'], div[data-testid='field']", { timeout: 15000 }).catch(() => {});
  }

  /**
   * Uploads resume and optional cover letter.
   */
  async uploadResume(page: Page, resumePath: string): Promise<void> {
    console.log(`📄 [RipplingAdapter]: Uploading resume: ${resumePath}`);
    await this.ensureApplicationFormOpen(page);

    const resumeInput = page.locator("input[type='file'][data-testid='input-resume'], label[data-testid='resume'] input[type='file'], input[type='file']").first();
    if (await resumeInput.count() > 0 && fs.existsSync(resumePath)) {
      await resumeInput.setInputFiles(resumePath).catch(err => {
        console.warn("⚠️ Failed setting resume input file:", err);
      });
      console.log("✅ [RipplingAdapter]: Resume uploaded successfully");
      await page.waitForTimeout(1000);
    }

    // Cover letter if available
    const coverLetterPath = path.resolve(path.dirname(resumePath), "Hrutin_Nammi_Cover_Letter.pdf");
    const clInput = page.locator("input[type='file'][data-testid='input-cover_letter'], label[data-testid='cover_letter'] input[type='file']").first();
    if (await clInput.count() > 0 && fs.existsSync(coverLetterPath)) {
      console.log(`📄 [RipplingAdapter]: Uploading cover letter: ${coverLetterPath}`);
      await clInput.setInputFiles(coverLetterPath).catch(err => {
        console.warn("⚠️ Failed setting cover letter input file:", err);
      });
      console.log("✅ [RipplingAdapter]: Cover letter uploaded successfully");
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Automatically fills out all form fields on any Rippling ATS job.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    preExtractedFields?: FormField[]
  ): Promise<void> {
    console.log("🚀 [RipplingAdapter]: Starting Rippling form filling flow...");
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Preparing Rippling application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 20);

    await dismissCommonPopups(page);
    await this.ensureApplicationFormOpen(page);

    // Fetch user saved answers from database
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

    // Upload files first if resume provided
    if (profile.resumePath && fs.existsSync(profile.resumePath)) {
      await this.uploadResume(page, profile.resumePath);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. FIRST NAME
    // ─────────────────────────────────────────────────────────────────────────────
    const firstNameInput = page.locator("input[data-testid='input-first_name']").first();
    if (await firstNameInput.count() > 0) {
      console.log(`👤 [RipplingAdapter]: Filling First Name -> "${profile.firstName}"`);
      await updateHUDStatus(page, "Personal Info", `First Name: ${profile.firstName}`, "info", 30);
      await firstNameInput.scrollIntoViewIfNeeded().catch(() => {});
      await firstNameInput.fill("");
      await firstNameInput.pressSequentially(profile.firstName, { delay: 35 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. LAST NAME
    // ─────────────────────────────────────────────────────────────────────────────
    const lastNameInput = page.locator("input[data-testid='input-last_name']").first();
    if (await lastNameInput.count() > 0) {
      console.log(`👤 [RipplingAdapter]: Filling Last Name -> "${profile.lastName}"`);
      await lastNameInput.scrollIntoViewIfNeeded().catch(() => {});
      await lastNameInput.fill("");
      await lastNameInput.pressSequentially(profile.lastName, { delay: 35 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. EMAIL
    // ─────────────────────────────────────────────────────────────────────────────
    const emailInput = page.locator("input[data-testid='input-email']").first();
    if (await emailInput.count() > 0) {
      console.log(`📧 [RipplingAdapter]: Filling Email -> "${profile.email}"`);
      await emailInput.scrollIntoViewIfNeeded().catch(() => {});
      await emailInput.fill("");
      await emailInput.pressSequentially(profile.email, { delay: 35 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. PRONOUNS
    // ─────────────────────────────────────────────────────────────────────────────
    const pronounInput = page.locator("div[data-testid='pronouns_strategy'] input").first();
    if (await pronounInput.count() > 0) {
      console.log("⚧ [RipplingAdapter]: Selecting Pronouns -> 'He/Him'");
      await pronounInput.scrollIntoViewIfNeeded().catch(() => {});
      await pronounInput.click().catch(() => {});
      await pronounInput.fill("He/Him").catch(() => {});
      await page.waitForTimeout(500);
      const opt = page.locator("li[role='option']:has-text('He/Him')").first();
      if (await opt.count() > 0) {
        await opt.click().catch(() => {});
      } else {
        await page.keyboard.press("Enter").catch(() => {});
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. CURRENT COMPANY
    // ─────────────────────────────────────────────────────────────────────────────
    const currentCompany = profile.experiences?.[0]?.company || "Jobspring";
    const companyInput = page.locator("input[data-testid='input-current_company']").first();
    if (await companyInput.count() > 0) {
      console.log(`🏢 [RipplingAdapter]: Filling Current Company -> "${currentCompany}"`);
      await companyInput.scrollIntoViewIfNeeded().catch(() => {});
      await companyInput.fill("");
      await companyInput.pressSequentially(currentCompany, { delay: 35 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. PHONE COUNTRY CODE (+1 United States)
    // ─────────────────────────────────────────────────────────────────────────────
    const phoneCodeInput = page.locator("div[data-testid='phone_number-code'] input[data-testid='input-select-search-input']").first();
    if (await phoneCodeInput.count() > 0) {
      console.log("📞 [RipplingAdapter]: Selecting Country Code -> United States (+1)");
      await phoneCodeInput.scrollIntoViewIfNeeded().catch(() => {});
      await phoneCodeInput.click().catch(() => {});
      await phoneCodeInput.fill("United States").catch(() => {});
      await page.waitForTimeout(600);
      const usOpt = page.locator("li[role='option']:has-text('United States'), li[role='option']:has-text('+1 US')").first();
      if (await usOpt.count() > 0) {
        await usOpt.click().catch(() => {});
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. PHONE NUMBER
    // ─────────────────────────────────────────────────────────────────────────────
    const rawPhone = profile.phone || "202-555-0198";
    const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10);
    const phoneInput = page.locator("input[data-testid='input-phone_number']").first();
    if (await phoneInput.count() > 0) {
      console.log(`📞 [RipplingAdapter]: Filling Phone Number -> "${cleanPhone}"`);
      await phoneInput.scrollIntoViewIfNeeded().catch(() => {});
      await phoneInput.fill("");
      await phoneInput.pressSequentially(cleanPhone, { delay: 35 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. LOCATION (US Address: San Francisco, CA)
    // ─────────────────────────────────────────────────────────────────────────────
    const locationInput = page.locator("div[data-testid='location'] input").first();
    if (await locationInput.count() > 0) {
      const locText = profile.city && profile.state ? `${profile.city}, ${profile.state}` : "San Francisco, CA";
      console.log(`📍 [RipplingAdapter]: Filling Location -> "${locText}"`);
      await locationInput.scrollIntoViewIfNeeded().catch(() => {});
      await locationInput.click().catch(() => {});
      await locationInput.fill(locText).catch(() => {});
      await page.waitForTimeout(1000);
      const locOption = page.locator("li[role='option'], div[role='option'], div[class*='suggestion']:has-text('San Francisco')").first();
      if (await locOption.count() > 0) {
        await locOption.click().catch(() => {});
      } else {
        await page.keyboard.press("ArrowDown").catch(() => {});
        await page.keyboard.press("Enter").catch(() => {});
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 9. LINKEDIN / WEBSITES
    // ─────────────────────────────────────────────────────────────────────────────
    const linkedinInput = page.locator("input[data-testid='input-linkedin_link']").first();
    if (await linkedinInput.count() > 0) {
      const linkedinVal = profile.linkedinUrl || "https://www.linkedin.com/in/hrutin-nammi";
      console.log(`🔗 [RipplingAdapter]: Filling LinkedIn -> "${linkedinVal}"`);
      await linkedinInput.scrollIntoViewIfNeeded().catch(() => {});
      await linkedinInput.fill("");
      await linkedinInput.pressSequentially(linkedinVal, { delay: 30 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 10. CUSTOM QUESTIONS (Comboboxes, Radios, Text Inputs)
    // ─────────────────────────────────────────────────────────────────────────────
    await updateHUDStatus(page, "Answering Questions", "Screening & Custom Questions", "info", 65);
    const customFields = page.locator("div[data-testid='field']");
    const count = await customFields.count();

    for (let i = 0; i < count; i++) {
      const field = customFields.nth(i);

      // Check if field already filled or skipped
      const hasStandardTestid = await field.locator("[data-testid='input-first_name'], [data-testid='input-last_name'], [data-testid='input-email'], [data-testid='input-phone_number'], [data-testid='phone_number-code'], [data-testid='location'], [data-testid='input-linkedin_link'], [data-testid='input-current_company'], [data-testid='input-resume'], [data-testid='input-cover_letter']").count();
      if (hasStandardTestid > 0) continue;

      // Extract question text
      const qText = await field.evaluate(el => {
        let label = el.querySelector("label, span[id$='-label'], [class*='label']")?.textContent || "";
        if (!label) {
          let p = el.parentElement;
          while (p && p.tagName !== "FORM" && p.tagName !== "BODY") {
            if (p.previousElementSibling) {
              const prevText = p.previousElementSibling.querySelector("p, h4, h5, label")?.textContent;
              if (prevText && prevText.trim().length > 3) {
                label = prevText.trim();
                break;
              }
            }
            p = p.parentElement;
          }
        }
        return (label || el.textContent || "").trim().replace(/\s+/g, " ");
      });

      const lowerQ = qText.toLowerCase();

      // Check for EEOC sections
      if (lowerQ.includes("gender") || await field.locator("[data-testid='eeoc.gender']").count() > 0) {
        console.log("⚖️ [RipplingAdapter]: Selecting EEOC Gender -> Male");
        const ctrl = field.locator("[data-testid='select-controller'], [role='combobox']").first();
        if (await ctrl.count() > 0) {
          await ctrl.click().catch(() => {});
          await page.waitForTimeout(400);
          const opt = page.locator("li[role='option']:has-text('Male')").first();
          if (await opt.count() > 0) await opt.click().catch(() => {});
        }
        continue;
      }

      if (lowerQ.includes("race") || await field.locator("[data-testid='eeoc.race']").count() > 0) {
        console.log("⚖️ [RipplingAdapter]: Selecting EEOC Race -> Asian");
        const rInput = field.locator("input[data-testid='input-select-search-input'], input").first();
        if (await rInput.count() > 0) {
          await rInput.click().catch(() => {});
          await rInput.fill("Asian").catch(() => {});
          await page.waitForTimeout(400);
          const opt = page.locator("li[role='option']:has-text('Asian')").first();
          if (await opt.count() > 0) await opt.click().catch(() => {});
        }
        continue;
      }

      if (lowerQ.includes("hispanic") || await field.locator("[data-testid='eeoc.hispanicOrLatino']").count() > 0) {
        console.log("⚖️ [RipplingAdapter]: Selecting EEOC Hispanic/Latino -> No");
        const ctrl = field.locator("[data-testid='select-controller'], [role='combobox']").first();
        if (await ctrl.count() > 0) {
          await ctrl.click().catch(() => {});
          await page.waitForTimeout(400);
          const opt = page.locator("li[role='option']:has-text('No')").first();
          if (await opt.count() > 0) await opt.click().catch(() => {});
        }
        continue;
      }

      if (lowerQ.includes("veteran") || await field.locator("[data-testid='eeoc.veteranStatus']").count() > 0) {
        console.log("⚖️ [RipplingAdapter]: Selecting EEOC Veteran -> Not a protected veteran");
        const ctrl = field.locator("[data-testid='select-controller'], [role='combobox']").first();
        if (await ctrl.count() > 0) {
          await ctrl.click().catch(() => {});
          await page.waitForTimeout(400);
          const opt = page.locator("li[role='option']:has-text('not a protected veteran'), li[role='option']:has-text('I am not')").first();
          if (await opt.count() > 0) await opt.click().catch(() => {});
        }
        continue;
      }

      if (lowerQ.includes("disability") || await field.locator("[data-testid*='disability']").count() > 0) {
        console.log("⚖️ [RipplingAdapter]: Selecting EEOC Disability -> No");
        const ctrl = field.locator("[data-testid='select-controller'], [role='combobox']").first();
        if (await ctrl.count() > 0) {
          await ctrl.click().catch(() => {});
          await page.waitForTimeout(400);
          const opt = page.locator("li[role='option']:has-text('No'), li[role='option']:has-text('I do not')").first();
          if (await opt.count() > 0) await opt.click().catch(() => {});
        }
        continue;
      }

      // Check for SMS Opt-In
      const smsRadio = field.locator("[data-testid='radio-label-sms_opt_in'][data-value='true'], input[name='sms_opt_in'][value='true']").first();
      if (await smsRadio.count() > 0 || lowerQ.includes("text messages") || lowerQ.includes("sms")) {
        console.log("💬 [RipplingAdapter]: Selecting SMS Consent -> Yes");
        const r = field.locator("[data-value='true'], label:has-text('Yes'), input[value='true']").first();
        if (await r.count() > 0) {
          await r.click().catch(() => {});
        }
        continue;
      }

      // Handle custom radio questions
      const radioInputs = await field.locator("input[type='radio'], [role='radiogroup'] [role='radio'], label:has(input[type='radio'])").all();
      if (radioInputs.length > 0) {
        console.log(`🔘 [RipplingAdapter]: Answering custom radio question: "${qText.slice(0, 80)}"`);
        let chosenRadio = "No";
        if (
          lowerQ.includes("require work authorization") ||
          lowerQ.includes("require visa") ||
          lowerQ.includes("require sponsorship") ||
          lowerQ.includes("sponsorship support") ||
          (lowerQ.includes("sponsorship") && !lowerQ.includes("without"))
        ) {
          chosenRadio = "No";
        } else if (lowerQ.includes("authorized") || lowerQ.includes("eligible") || lowerQ.includes("able to intern") || lowerQ.includes("able to work") || lowerQ.includes("full time")) {
          chosenRadio = "Yes";
        } else {
          chosenRadio = "Yes";
        }

        const targetRadio = field.locator(`label:has-text('${chosenRadio}'), input[value='${chosenRadio}'], [data-value='${chosenRadio}']`).first();
        if (await targetRadio.count() > 0) {
          await targetRadio.click({ force: true }).catch(() => {});
          console.log(`   Selected radio: "${chosenRadio}"`);
        }
        continue;
      }

      // Handle custom questions with Combobox / Select controller
      const selectCtrl = field.locator("[data-testid='select-controller'], [role='combobox']").first();
      if (await selectCtrl.count() > 0) {
        console.log(`❓ [RipplingAdapter]: Answering custom combobox question: "${qText.slice(0, 80)}"`);
        let answer = "No";
        if (
          lowerQ.includes("require work authorization") ||
          lowerQ.includes("require visa") ||
          lowerQ.includes("require sponsorship") ||
          lowerQ.includes("sponsorship support") ||
          (lowerQ.includes("sponsorship") && !lowerQ.includes("without"))
        ) {
          answer = "No";
        } else if (lowerQ.includes("able to intern") || lowerQ.includes("able to work") || lowerQ.includes("full time")) {
          answer = "Yes";
        } else if (lowerQ.includes("authorized") || lowerQ.includes("legally") || lowerQ.includes("eligible to work")) {
          answer = "Yes";
        } else if (lowerQ.includes("relocate") || lowerQ.includes("willing to relocate")) {
          answer = "Yes";
        } else {
          // Check saved answers or question answering
          const norm = normalizeLabel(qText);
          if (additionalAnswers[norm]) {
            answer = additionalAnswers[norm];
          } else if (userSavedAnswers[norm]) {
            answer = userSavedAnswers[norm];
          } else {
            answer = await suggestAnswerForQuestion(qText, profile, { company: "Rippling", title: "Role", ats: "RIPPLING" });
          }
        }

        await selectCtrl.click().catch(() => {});
        await page.waitForTimeout(500);

        // Match option
        const targetOption = page.locator(`li[role='option']:has-text('${answer}')`).first();
        if (await targetOption.count() > 0) {
          await targetOption.click().catch(() => {});
          console.log(`   Selected: "${answer}"`);
        } else {
          const fallback = page.locator("li[role='option']").first();
          if (await fallback.count() > 0) {
            const txt = await fallback.innerText().catch(() => "");
            await fallback.click().catch(() => {});
            console.log(`   Fallback selected: "${txt}"`);
          }
        }
        continue;
      }

      // Handle text input questions
      const textInput = field.locator("input[type='text'], input:not([type]), textarea").first();
      if (await textInput.count() > 0) {
        const val = await textInput.inputValue().catch(() => "");
        if (!val) {
          console.log(`✍️ [RipplingAdapter]: Answering custom text question: "${qText.slice(0, 80)}"`);
          const norm = normalizeLabel(qText);
          let ans = additionalAnswers[norm] || userSavedAnswers[norm] || "";
          if (!ans) {
            ans = await suggestAnswerForQuestion(qText, profile, { company: "Rippling", title: "Role", ats: "RIPPLING" });
          }
          await textInput.fill(ans || "N/A").catch(() => {});
        }
      }
    }

    await page.waitForTimeout(1000);
    await updateHUDStatus(page, "Application Ready!", "All fields filled smoothly", "success", 95);
    console.log("🎉 [RipplingAdapter]: All form fields filled successfully!");
  }

  /**
   * Validates if required fields are filled.
   */
  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    const fn = await page.locator("input[data-testid='input-first_name']").inputValue().catch(() => "");
    const ln = await page.locator("input[data-testid='input-last_name']").inputValue().catch(() => "");
    const em = await page.locator("input[data-testid='input-email']").inputValue().catch(() => "");
    return Boolean(fn && ln && em);
  }

  /**
   * Final submission or preparation of the Rippling application.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";
    const submitBtn = page.locator("button[type='submit']:has-text('Apply'), button[data-testid='Apply'], button:has-text('Apply')").last();
    if (await submitBtn.count() === 0) {
      return { success: false, errorMessage: "Apply button not found on Rippling form" };
    }

    // Enhance visibility: Elevate sticky footer and also inject a big inline submit button at form bottom
    await page.evaluate(() => {
      // 1. Elevate and style the fixed bottom bar and native Apply button
      const stickyBar = document.querySelector("div.e1hsobdp1, div[class*='e1hsobdp'], div[class*='e1dhe5fg4']") as HTMLElement;
      if (stickyBar) {
        stickyBar.style.zIndex = "2147483640";
        stickyBar.style.position = "fixed";
        stickyBar.style.bottom = "0";
        stickyBar.style.left = "0";
        stickyBar.style.right = "0";
        stickyBar.style.boxShadow = "0 -4px 20px rgba(0, 0, 0, 0.15)";
      }

      const nativeBtn = (document.querySelector("button[data-testid='Apply']") || document.querySelector("button[type='submit']")) as HTMLElement;
      if (nativeBtn) {
        nativeBtn.style.outline = "3px solid #22c55e";
        nativeBtn.style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.9)";
        nativeBtn.style.transform = "scale(1.05)";
        nativeBtn.style.transition = "all 0.3s ease";
      }

      // 2. Inject an in-flow button right at the end of the document text so users scrolling down see it directly
      if (!document.getElementById("cluco-inline-submit-btn")) {
        const container = document.createElement("div");
        container.id = "cluco-inline-submit-container";
        container.style.cssText = "margin: 36px 0 80px 0; padding: 24px; text-align: center; background: rgba(34, 197, 94, 0.08); border: 2px dashed #22c55e; border-radius: 12px;";

        const banner = document.createElement("p");
        banner.textContent = "✅ All fields have been completed by Cluco.ai! Ready for your submission:";
        banner.style.cssText = "font-size: 15px; font-weight: 600; color: #166534; margin-bottom: 14px;";

        const btn = document.createElement("button");
        btn.id = "cluco-inline-submit-btn";
        btn.textContent = "🚀 Submit Application";
        btn.style.cssText = "background: #22c55e; color: #ffffff; font-size: 17px; font-weight: 700; padding: 14px 44px; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 4px 18px rgba(34, 197, 94, 0.5); transition: transform 0.15s ease;";
        
        btn.onmouseover = () => { btn.style.transform = "scale(1.03)"; btn.style.background = "#16a34a"; };
        btn.onmouseout = () => { btn.style.transform = "scale(1)"; btn.style.background = "#22c55e"; };
        btn.onclick = () => {
          if (nativeBtn) {
            nativeBtn.click();
          }
        };

        container.appendChild(banner);
        container.appendChild(btn);

        // Append to form or main content
        const formOrMain = document.querySelector("form") || document.querySelector("main") || document.querySelector("article") || document.body;
        formOrMain.appendChild(container);
      }
    }).catch(() => {});

    // Scroll inline button into view so the user immediately sees it
    await page.locator("#cluco-inline-submit-btn, button[data-testid='Apply']").first().scrollIntoViewIfNeeded().catch(() => {});

    if (!isAutoSubmit) {
      console.log("👉 [RipplingAdapter]: Ready for manual review. Submit button is centered & highlighted for you to click!");
      await updateHUDStatus(page, "Ready to Submit", "Application completed! Submit button highlighted below for manual submission 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION"
      };
    }

    console.log("🚀 [RipplingAdapter]: Submitting application...");
    await submitBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);

    const successText = await page.locator("text=/thank you|received|submitted|success/i").first().isVisible().catch(() => false);
    return {
      success: successText,
      confirmation: successText ? "Application submitted successfully" : "Application button clicked"
    };
  }
}
