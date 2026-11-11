import path from "path";
import fs from "fs";
import { Page, Frame, Locator } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel } from "../../application/field-mapper";
import { suggestAnswerForQuestion } from "../../application/question-answering";
import { generateCoverLetterText } from "../../database/user-profile.service";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { db } from "../../database/db";

export class IcimsAdapter implements ATSAdapter {
  private candidateProfile?: UserProfile;

  /**
   * Detects whether the current page is powered by iCIMS ATS.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("icims.com") || url.includes("careers-") && url.includes(".icims.com")) {
      return true;
    }

    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("icims.com") ||
      content.includes("icims_content_iframe") ||
      content.includes("icims") ||
      content.includes("icims_header") ||
      (await page.$("iframe#icims_content_iframe, [class*='iCIMS_'], [id*='icims'], a[href*='mode=apply']")) !== null
    );
  }

  /**
   * Helper to retrieve the active iCIMS content frame (or top page if direct).
   */
  private getActiveFrame(page: Page): Page | Frame {
    const frame = page.frames().find(
      f => f.name() === "icims_content_iframe" || (f.url().includes("icims.com") && f !== page.mainFrame())
    );
    return frame || page;
  }

  /**
   * Helper to retrieve a Locator inside the iCIMS iframe or top-level page.
   */
  private getScopeLocator(page: Page, selector: string): Locator {
    const hasIframe = page.frames().some(f => f.name() === "icims_content_iframe" || f.url().includes("in_iframe=1"));
    if (hasIframe) {
      return page.frameLocator("iframe#icims_content_iframe, iframe[name='icims_content_iframe'], iframe[src*='icims']").first().locator(selector);
    }
    return page.locator(selector);
  }

  /**
   * Dismisses OneTrust and other standard cookie banners.
   */
  private async dismissCookies(page: Page): Promise<void> {
    try {
      const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies'), button:has-text('Accept'), button:has-text('Allow all')").first();
      if (await cookieBtn.isVisible().catch(() => false)) {
        await cookieBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch {}
    await dismissCommonPopups(page);
  }

  /**
   * Extracts job information from the iCIMS page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    await this.dismissCookies(page);
    const url = page.url();

    // 1. Company Extraction
    let company = "iCIMS Employer";
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes("careers-")) {
        const sub = host.split(".")[0].replace("careers-", "");
        if (sub) {
          company = sub.charAt(0).toUpperCase() + sub.slice(1);
          if (company.toLowerCase() === "beyondsoft") company = "Beyondsoft";
          if (company.toLowerCase() === "quantumsky") company = "Quantumsky";
          if (company.toLowerCase() === "teksystems") company = "TEKsystems";
        }
      }
    } catch {}

    const scope = this.getScopeLocator(page, "img[alt], .iCIMS_CompanyHeader img, .company-name");
    const logoAlt = await scope.first().getAttribute("alt").catch(() => "");
    if (logoAlt && logoAlt.trim() && !logoAlt.toLowerCase().includes("logo")) {
      company = logoAlt.trim();
    }

    // 2. Title Extraction
    let title = "";
    const titleLocator = this.getScopeLocator(page, "h1.iCIMS_Header, h1, .job-title, .iCIMS_JobTitle, [class*='JobHeader'] h1");
    const headingText = await titleLocator.first().innerText().catch(() => "");
    if (headingText && headingText.trim()) {
      title = headingText.trim().replace(/\s+/g, " ");
    } else {
      const pageTitle = await page.title().catch(() => "");
      if (pageTitle.includes("|")) {
        title = pageTitle.split("|")[0].trim();
      } else if (pageTitle.includes("-")) {
        title = pageTitle.split("-")[0].trim();
      } else {
        title = pageTitle.trim();
      }
    }

    // 3. Description Extraction
    const descLocator = this.getScopeLocator(page, ".iCIMS_JobContent, .job-description, .iCIMS_JobDetails, article, main, #content");
    const description = await descLocator.first().innerText().catch(() => "");

    return {
      company: company || "iCIMS Employer",
      title: title || "Position",
      description: description || "iCIMS Job Description",
      ats: "ICIMS"
    };
  }

  /**
   * Scrapes interactive form fields from the current iCIMS application step.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Scanning iCIMS application form...", "Analyzing inputs & fields", "info", 15);
    await this.dismissCookies(page);

    const frame = this.getActiveFrame(page);
    return await frame.evaluate(() => {
      const results: FormField[] = [];
      const elements = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));

      elements.forEach((el, idx) => {
        const input = el as HTMLInputElement;
        const tagName = el.tagName.toLowerCase();
        let type: FormField["type"] = "text";
        if (tagName === "textarea") type = "textarea";
        else if (tagName === "select") type = "select";
        else if (input.type === "email") type = "email";
        else if (input.type === "tel") type = "tel";
        else if (input.type === "file") type = "file";
        else if (input.type === "checkbox") type = "checkbox";
        else if (input.type === "radio") type = "radio";

        const id = input.id || input.name || `field_${idx}`;
        let label = "";

        if (input.id) {
          const lFor = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
          if (lFor) label = lFor.textContent?.trim() || "";
        }
        if (!label) {
          const container = input.closest(".form-group, .field, .iCIMS_FieldRow, tr, td, div");
          const lEl = container?.querySelector("label, .iCIMS_FieldLabel, [class*='Label'], [class*='title']");
          if (lEl) label = lEl.textContent?.trim() || "";
        }
        if (!label) {
          label = input.placeholder || input.getAttribute("aria-label") || id;
        }

        results.push({
          id,
          label: label.replace(/\s+/g, " ").trim(),
          type,
          required: input.required || input.getAttribute("aria-required") === "true" || label.includes("*")
        });
      });

      return results;
    });
  }

  /**
   * Automatically fills out all iCIMS form fields using candidate's details.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    preExtractedFields?: FormField[]
  ): Promise<void> {
    this.candidateProfile = profile;
    console.log(`🚀 [IcimsAdapter]: Starting iCIMS form filling flow for ${profile.firstName} ${profile.lastName}...`);
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Initializing iCIMS Autofill...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 10);

    await this.dismissCookies(page);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: INITIAL APPLY CLICK IF ON JOB VIEW PAGE
    // ─────────────────────────────────────────────────────────────────────────────
    await this.ensureApplyStarted(page);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: HANDLE WELCOME / EMAIL SUBMISSION SCREEN
    // ─────────────────────────────────────────────────────────────────────────────
    await this.handleEmailWelcomeScreen(page, profile);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: RESUME & FILE UPLOADS
    // ─────────────────────────────────────────────────────────────────────────────
    if (profile.resumePath && fs.existsSync(profile.resumePath)) {
      await this.uploadResume(page, profile.resumePath, undefined, profile);
    }

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
      } catch {}
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 4: MULTI-STEP WIZARD FORM FILLING (Profile, History, Questions, EEO)
    // ─────────────────────────────────────────────────────────────────────────────
    let maxSteps = 8;
    let step = 1;

    while (step <= maxSteps) {
      console.log(`📝 [IcimsAdapter]: Processing wizard step ${step}...`);
      await updateHUDStatus(page, `Filling Step ${step}...`, "Processing inputs & screening fields", "info", Math.min(30 + step * 10, 85));

      // Fill all personal information fields
      await this.fillPersonalInfoFields(page, profile);

      // Fill social profiles & links
      await this.fillSocialLinks(page, profile);

      // Fill work experience and education if present on current screen
      await this.fillWorkAndEducation(page, profile);

      // Fill screening questions (dropdowns, radios, textareas, number inputs)
      await this.fillScreeningQuestions(page, profile, userSavedAnswers, additionalAnswers);

      // Fill EEO / Voluntary Self-Identification
      await this.fillEEOC(page, profile);

      // Fill signature & agreements
      await this.fillSignaturesAndAgreements(page, profile);

      // Check if we reached the final Review / Submit page
      const submitBtn = this.getScopeLocator(
        page,
        "input[type='submit'][value*='Submit' i], button:has-text('Submit Application'), button:has-text('Submit'), input[value='Submit Application']"
      ).first();

      const hasSubmit = (await submitBtn.count().catch(() => 0)) > 0 && (await submitBtn.isVisible().catch(() => false));
      if (hasSubmit) {
        console.log("🎯 [IcimsAdapter]: Reached final Submit step!");
        break;
      }

      // Look for Next / Continue button to proceed to next wizard step
      const nextBtn = this.getScopeLocator(
        page,
        "input[type='submit'][value*='Next' i], input[type='submit'][value*='Continue' i], button:has-text('Next'), button:has-text('Continue'), button:has-text('Save and Continue'), input[value='Next']"
      ).first();

      if ((await nextBtn.count().catch(() => 0)) > 0 && (await nextBtn.isVisible().catch(() => false))) {
        console.log(`➡️ [IcimsAdapter]: Advancing from step ${step} with Next button...`);
        await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
        await nextBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(4000);
        await this.dismissCookies(page);
        step++;
      } else {
        console.log(`ℹ️ [IcimsAdapter]: No additional Next buttons found. Step ${step} is final.`);
        break;
      }
    }

    console.log("✅ [IcimsAdapter]: All form fields populated successfully!");
    await updateHUDStatus(page, "Form Filling Complete", "Ready for validation & submission review", "success", 90);
  }

  /**
   * Clicks 'Apply for this job online' if currently on the job posting view.
   */
  private async ensureApplyStarted(page: Page): Promise<void> {
    const applyBtn = this.getScopeLocator(
      page,
      "a:has-text('Apply for this job online'), a:has-text('Apply Online'), a[href*='mode=apply'], a:has-text('Apply'), button:has-text('Apply')"
    ).first();

    if ((await applyBtn.count().catch(() => 0)) > 0 && (await applyBtn.isVisible().catch(() => false))) {
      console.log("👉 [IcimsAdapter]: Clicking 'Apply for this job online'...");
      await applyBtn.scrollIntoViewIfNeeded().catch(() => {});
      await applyBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      await this.dismissCookies(page);
    }
  }

  /**
   * Handles the Welcome / Initial Email submission step with anti-bot challenge awareness.
   */
  private async handleEmailWelcomeScreen(page: Page, profile: UserProfile): Promise<void> {
    const emailInput = this.getScopeLocator(
      page,
      "input#email, input[name='css_loginName'], input[type='email']"
    ).first();

    if ((await emailInput.count().catch(() => 0)) > 0 && (await emailInput.isVisible().catch(() => false))) {
      console.log(`📧 [IcimsAdapter]: Entering email on login/welcome screen -> "${profile.email}"`);
      await emailInput.scrollIntoViewIfNeeded().catch(() => {});
      await emailInput.fill("");
      await emailInput.pressSequentially(profile.email, { delay: 35 });

      // GDPR / Consent checkbox
      const gdprCb = this.getScopeLocator(
        page,
        "input#accept_gdpr, input[name='accept_gdpr'], input[type='checkbox'][name*='gdpr' i], input[type='checkbox'][name*='consent' i]"
      ).first();
      if ((await gdprCb.count().catch(() => 0)) > 0 && (await gdprCb.isVisible().catch(() => false))) {
        console.log("☑️ [IcimsAdapter]: Checking GDPR / Privacy consent...");
        await gdprCb.check({ force: true }).catch(() => {});
      }

      // Submit Email Step
      const nextBtn = this.getScopeLocator(
        page,
        "input#enterEmailSubmitButton, button#enterEmailSubmitButton, input[type='submit'], button[type='submit'], button:has-text('Next')"
      ).first();

      if ((await nextBtn.count().catch(() => 0)) > 0) {
        console.log("👉 [IcimsAdapter]: Clicking Next on email entry step...");
        await nextBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(4000);

        // Check if an anti-bot challenge (hCaptcha) is displayed
        await this.handleCaptchaIfPresent(page);
      }
    }
  }

  /**
   * Gracefully detects anti-bot challenges (hCaptcha), alerts the user in HUD,
   * and waits for the verification to be completed.
   */
  private async handleCaptchaIfPresent(page: Page): Promise<void> {
    const frame = this.getActiveFrame(page);
    const captchaDetected = await frame.evaluate(() => {
      const hcaptcha = document.querySelector("iframe[src*='hcaptcha'], .h-captcha, [name='h-captcha-response']");
      const recaptcha = document.querySelector("iframe[src*='recaptcha'], .g-recaptcha");
      return !!(hcaptcha || recaptcha);
    }).catch(() => false);

    if (captchaDetected) {
      console.warn("⚠️ [IcimsAdapter]: Human verification challenge detected (hCaptcha). Waiting for verification...");
      await updateHUDStatus(
        page,
        "Action Required",
        "Please complete the security challenge in the browser window to continue",
        "warning",
        30
      );

      // Wait up to 60s for the user to complete the challenge and form to transition
      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(2000);
        const stillPresent = await frame.evaluate(() => {
          const resp = document.querySelector<HTMLTextAreaElement>("[name='h-captcha-response'], [name='g-recaptcha-response']");
          if (resp && resp.value) return false; // Token generated!
          const iframe = document.querySelector("iframe[src*='hcaptcha'], iframe[src*='recaptcha']");
          return !!(iframe && (iframe as HTMLElement).offsetParent !== null);
        }).catch(() => false);

        if (!stillPresent) {
          console.log("✅ [IcimsAdapter]: Security verification resolved! Resuming autofill...");
          await page.waitForTimeout(2000);
          break;
        }
      }
    }
  }

  /**
   * Fills personal candidate information fields.
   */
  private async fillPersonalInfoFields(page: Page, profile: UserProfile): Promise<void> {
    // First Name
    const fnInput = this.getScopeLocator(page, "input[name*='firstName' i], input#firstName, input[name*='fname' i], input[id*='first_name' i]").first();
    if (await fnInput.isVisible().catch(() => false)) {
      console.log(`👤 [IcimsAdapter]: First Name -> "${profile.firstName}"`);
      await fnInput.fill(profile.firstName);
    }

    // Middle Name
    const mnInput = this.getScopeLocator(page, "input[name*='middleName' i], input#middleName").first();
    if (await mnInput.isVisible().catch(() => false)) {
      if (profile.middleName) await mnInput.fill(profile.middleName);
    }

    // Last Name
    const lnInput = this.getScopeLocator(page, "input[name*='lastName' i], input#lastName, input[name*='lname' i], input[id*='last_name' i]").first();
    if (await lnInput.isVisible().catch(() => false)) {
      console.log(`👤 [IcimsAdapter]: Last Name -> "${profile.lastName}"`);
      await lnInput.fill(profile.lastName);
    }

    // Email (if present on profile page)
    const emInput = this.getScopeLocator(page, "input[name*='email' i]:not([id='email']), input#emailAddress").first();
    if (await emInput.isVisible().catch(() => false)) {
      await emInput.fill(profile.email);
    }

    // Phone Type
    const phoneTypeSelect = this.getScopeLocator(page, "select[name*='phoneType' i], select#phoneType, select[id*='phone_type' i]").first();
    if (await phoneTypeSelect.isVisible().catch(() => false)) {
      await phoneTypeSelect.selectOption({ label: "Mobile" }).catch(async () => {
        await phoneTypeSelect.selectOption({ label: "Cell" }).catch(() => {});
      });
    }

    // Phone Number
    const phoneInput = this.getScopeLocator(page, "input[name*='phone' i]:not([name*='type' i]), input[type='tel'], input#phone, input[id*='phone_number' i]").first();
    if (await phoneInput.isVisible().catch(() => false)) {
      const cleanDigits = (profile.phone || "2025550198").replace(/\D/g, "").slice(-10);
      const formatted = `+1 ${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3, 6)} ${cleanDigits.slice(6)}`;
      console.log(`📞 [IcimsAdapter]: Phone Number -> "${formatted}"`);
      await phoneInput.fill(formatted);
    }

    // Address
    const addrInput = this.getScopeLocator(page, "input[name*='address1' i], input[name*='address' i]:not([name*='2']), input#address, input[name*='street' i]").first();
    if (await addrInput.isVisible().catch(() => false)) {
      await addrInput.fill(profile.street || "123 Market St");
    }

    // Address Line 2
    const addr2Input = this.getScopeLocator(page, "input[name*='address2' i], input#address2, input[name*='apt' i], input[name*='suite' i]").first();
    if (await addr2Input.isVisible().catch(() => false)) {
      await addr2Input.fill(profile.addressLine2 || "Suite 400");
    }

    // City
    const cityInput = this.getScopeLocator(page, "input[name*='city' i], input#city").first();
    if (await cityInput.isVisible().catch(() => false)) {
      await cityInput.fill(profile.city || "San Francisco");
    }

    // State / Province (select or text)
    const stateSelect = this.getScopeLocator(page, "select[name*='state' i], select#state, select[id*='province' i]").first();
    if (await stateSelect.isVisible().catch(() => false)) {
      await stateSelect.selectOption({ label: "California" }).catch(async () => {
        await stateSelect.selectOption("CA").catch(() => {});
      });
    } else {
      const stateInput = this.getScopeLocator(page, "input[name*='state' i], input#state").first();
      if (await stateInput.isVisible().catch(() => false)) {
        await stateInput.fill(profile.state || "California");
      }
    }

    // Zip / Postal Code
    const zipInput = this.getScopeLocator(page, "input[name*='zip' i], input[name*='postal' i], input#zip").first();
    if (await zipInput.isVisible().catch(() => false)) {
      await zipInput.fill(profile.zipCode || "94105");
    }

    // Country
    const countrySelect = this.getScopeLocator(page, "select[name*='country' i], select#country").first();
    if (await countrySelect.isVisible().catch(() => false)) {
      await countrySelect.selectOption({ label: "United States" }).catch(async () => {
        await countrySelect.selectOption("US").catch(() => {});
      });
    }
  }

  /**
   * Fills social links (LinkedIn, GitHub, Portfolio).
   */
  private async fillSocialLinks(page: Page, profile: UserProfile): Promise<void> {
    // LinkedIn
    const liInput = this.getScopeLocator(page, "input[name*='linkedin' i], input#linkedin, input[id*='linkedin' i]").first();
    if (await liInput.isVisible().catch(() => false)) {
      const li = profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
      console.log(`🔗 [IcimsAdapter]: LinkedIn -> "${li}"`);
      await liInput.fill(li);
    }

    // GitHub
    const ghInput = this.getScopeLocator(page, "input[name*='github' i], input#github, input[id*='github' i]").first();
    if (await ghInput.isVisible().catch(() => false)) {
      const gh = profile.githubUrl || "https://github.com/hrutinnammi";
      console.log(`🔗 [IcimsAdapter]: GitHub -> "${gh}"`);
      await ghInput.fill(gh);
    }

    // Portfolio / Website
    const pfInput = this.getScopeLocator(page, "input[name*='portfolio' i], input[name*='website' i], input#website").first();
    if (await pfInput.isVisible().catch(() => false)) {
      const pf = profile.portfolioUrl || "https://hrutinnammi.dev";
      console.log(`🔗 [IcimsAdapter]: Portfolio -> "${pf}"`);
      await pfInput.fill(pf);
    }
  }

  /**
   * Fills work experience and education fields if displayed on current screen.
   */
  private async fillWorkAndEducation(page: Page, profile: UserProfile): Promise<void> {
    const exp = profile.experiences?.[0];
    if (exp) {
      // Employer / Company
      const compInp = this.getScopeLocator(page, "input[name*='employer' i], input[name*='company' i], input#employer").first();
      if (await compInp.isVisible().catch(() => false)) {
        await compInp.fill(exp.company || "Jobspring");
      }

      // Title
      const titleInp = this.getScopeLocator(page, "input[name*='jobTitle' i], input[name*='title' i], input#jobTitle").first();
      if (await titleInp.isVisible().catch(() => false)) {
        await titleInp.fill(exp.jobTitle || "Full Stack AI Developer");
      }

      // Currently Work Here
      const currentCb = this.getScopeLocator(page, "input[type='checkbox'][name*='current' i], input#currentJob").first();
      if (await currentCb.isVisible().catch(() => false)) {
        await currentCb.check({ force: true }).catch(() => {});
      }
    }

    const edu = profile.educations?.[0];
    if (edu) {
      // School
      const schoolInp = this.getScopeLocator(page, "input[name*='school' i], input[name*='institution' i], input#school").first();
      if (await schoolInp.isVisible().catch(() => false)) {
        await schoolInp.fill(edu.school || "Parul University");
      }

      // Degree
      const degreeSelect = this.getScopeLocator(page, "select[name*='degree' i], select#degree").first();
      if (await degreeSelect.isVisible().catch(() => false)) {
        await degreeSelect.selectOption({ label: "Bachelor of Technology" }).catch(async () => {
          await degreeSelect.selectOption({ label: "Bachelors" }).catch(() => {});
        });
      } else {
        const degreeInp = this.getScopeLocator(page, "input[name*='degree' i], input#degree").first();
        if (await degreeInp.isVisible().catch(() => false)) {
          await degreeInp.fill(edu.degree || "Bachelor of Technology");
        }
      }

      // Major
      const majorInp = this.getScopeLocator(page, "input[name*='major' i], input[name*='fieldOfStudy' i], input#major").first();
      if (await majorInp.isVisible().catch(() => false)) {
        await majorInp.fill(edu.fieldOfStudy || "Computer Science and Engineering");
      }

      // GPA
      const gpaInp = this.getScopeLocator(page, "input[name*='gpa' i], input#gpa").first();
      if (await gpaInp.isVisible().catch(() => false)) {
        await gpaInp.fill(edu.gpa || "7.1");
      }
    }
  }

  /**
   * Fills custom screening questions, dropdowns, radios, and textareas.
   */
  private async fillScreeningQuestions(
    page: Page,
    profile: UserProfile,
    userSavedAnswers: Record<string, string>,
    additionalAnswers: Record<string, string>
  ): Promise<void> {
    const frame = this.getActiveFrame(page);

    // 1. SELECT DROPDOWNS
    const selectElements = await this.getScopeLocator(
      page,
      "select:not([name*='country' i]):not([name*='state' i]):not([name*='phoneType' i])"
    ).all();

    for (const sel of selectElements) {
      if (!(await sel.isVisible().catch(() => false))) continue;
      const qText = await sel.evaluate((el: HTMLElement) => {
        const id = el.id;
        if (id) {
          const l = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (l) return l.textContent?.trim() || "";
        }
        return el.closest(".form-group, .field, tr, td, div")?.querySelector("label, .iCIMS_FieldLabel, [class*='Label']")?.textContent?.trim() || "";
      }).catch(() => "");

      const normQ = normalizeLabel(qText);
      const options = await sel.evaluate((el: HTMLSelectElement) => Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }))).catch(() => []);
      if (options.length <= 1) continue;

      let chosen = "";
      if (normQ.includes("authorized") || normQ.includes("legally authorized") || normQ.includes("eligible to work")) {
        chosen = options.find(o => /^yes$/i.test(o.text) || o.text.toLowerCase().includes("authorized"))?.value || "";
      } else if (normQ.includes("sponsorship") || normQ.includes("visa")) {
        chosen = options.find(o => /^no$/i.test(o.text) || o.text.toLowerCase().includes("not require"))?.value || "";
      } else if (normQ.includes("hear about") || normQ.includes("source")) {
        chosen = options.find(o => /website|job board|linkedin/i.test(o.text))?.value || "";
      } else if (normQ.includes("relocate") || normQ.includes("willing to relocate")) {
        chosen = options.find(o => /^yes$/i.test(o.text))?.value || "";
      } else if (normQ.includes("start") || normQ.includes("notice")) {
        chosen = options.find(o => /immediate|within 2 weeks/i.test(o.text))?.value || "";
      }

      if (!chosen) {
        // Match from saved answers or suggestions
        const suggestion = additionalAnswers[normQ] || userSavedAnswers[normQ] || suggestAnswerForQuestion(qText);
        const matched = options.find(o => o.text.toLowerCase().includes(suggestion.toLowerCase()) || suggestion.toLowerCase().includes(o.text.toLowerCase()));
        if (matched) chosen = matched.value;
      }

      if (!chosen) {
        const real = options.find(o => o.value && !/select|choose/i.test(o.text));
        if (real) chosen = real.value;
      }

      if (chosen) {
        await sel.selectOption(chosen).catch(() => {});
        console.log(`🔽 [IcimsAdapter]: Dropdown "${qText.slice(0, 40)}" -> value="${chosen}"`);
      }
    }

    // 2. RADIO BUTTON GROUPS
    const radioInputs = await this.getScopeLocator(page, "input[type='radio']").all();
    const radioGroups: Record<string, Locator[]> = {};

    for (const r of radioInputs) {
      const name = (await r.getAttribute("name").catch(() => "")) || "unknown";
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(r);
    }

    for (const [name, radios] of Object.entries(radioGroups)) {
      if (radios.length === 0) continue;
      const qText = await radios[0].evaluate((el: HTMLElement) => {
        const container = el.closest(".form-group, .field, tr, td, fieldset, div");
        return container?.querySelector("label, legend, .iCIMS_FieldLabel, [class*='title']")?.textContent?.trim() || "";
      }).catch(() => "");

      const normQ = normalizeLabel(qText);
      let targetText = "Yes";

      if (normQ.includes("sponsorship") || normQ.includes("visa")) {
        targetText = "No";
      } else if (normQ.includes("felony") || normQ.includes("convicted")) {
        targetText = "No";
      } else if (normQ.includes("authorized") || normQ.includes("eligible") || normQ.includes("18") || normQ.includes("relocate") || normQ.includes("background")) {
        targetText = "Yes";
      } else {
        const raw = suggestAnswerForQuestion(qText);
        targetText = /no|false/i.test(raw) ? "No" : "Yes";
      }

      for (const r of radios) {
        const rText = await r.evaluate((el: HTMLElement) => {
          return el.closest("label")?.textContent?.trim() || (el as HTMLInputElement).value || "";
        }).catch(() => "");

        if (rText.toLowerCase().includes(targetText.toLowerCase())) {
          await r.check({ force: true }).catch(() => {});
          console.log(`🔘 [IcimsAdapter]: Radio "${qText.slice(0, 40)}" -> "${rText}"`);
          break;
        }
      }
    }

    // 3. TEXT & TEXTAREA SCREENING INPUTS
    const textInputs = await this.getScopeLocator(
      page,
      "input[type='text']:not([name*='first' i]):not([name*='last' i]):not([name*='email' i]):not([name*='phone' i]):not([name*='address' i]):not([name*='city' i]):not([name*='zip' i]):not([name*='signature' i]), textarea"
    ).all();

    for (const tInput of textInputs) {
      if (!(await tInput.isVisible().catch(() => false))) continue;
      const curVal = await tInput.inputValue().catch(() => "");
      if (curVal && curVal.trim()) continue;

      const qText = await tInput.evaluate((el: HTMLElement) => {
        const id = el.id;
        if (id) {
          const l = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (l) return l.textContent?.trim() || "";
        }
        return el.closest(".form-group, .field, tr, td, div")?.querySelector("label, .iCIMS_FieldLabel, [class*='Label']")?.textContent?.trim() || "";
      }).catch(() => "");

      const normQ = normalizeLabel(qText);
      let answer = "";

      if (normQ.includes("salary") || normQ.includes("compensation") || normQ.includes("pay")) {
        answer = "$95,000";
      } else if (normQ.includes("start date") || normQ.includes("available")) {
        answer = "Immediate";
      } else if (normQ.includes("notice period")) {
        answer = "Immediate";
      } else if (normQ.includes("hear about") || normQ.includes("referral")) {
        answer = "Company Website";
      } else {
        answer = additionalAnswers[normQ] || userSavedAnswers[normQ] || suggestAnswerForQuestion(qText);
      }

      if (answer) {
        await tInput.fill(answer);
        console.log(`✍️ [IcimsAdapter]: Input "${qText.slice(0, 35)}..." -> "${answer.slice(0, 30)}..."`);
      }
    }
  }

  /**
   * Fills EEO / Voluntary Self-Identification fields.
   */
  private async fillEEOC(page: Page, profile: UserProfile): Promise<void> {
    // Gender
    const genderSelect = this.getScopeLocator(page, "select[name*='gender' i], select#gender, select[id*='eeoc_gender' i]").first();
    if (await genderSelect.isVisible().catch(() => false)) {
      await genderSelect.selectOption({ label: "Male" }).catch(() => {});
    }

    // Race / Ethnicity
    const raceSelect = this.getScopeLocator(page, "select[name*='race' i], select[name*='ethnicity' i], select#race, select[id*='eeoc_race' i]").first();
    if (await raceSelect.isVisible().catch(() => false)) {
      await raceSelect.selectOption({ label: "Asian (Not Hispanic or Latino)" }).catch(async () => {
        await raceSelect.selectOption({ label: "Asian" }).catch(() => {});
      });
    }

    // Veteran Status
    const vetSelect = this.getScopeLocator(page, "select[name*='veteran' i], select#veteran, select[id*='eeoc_veteran' i]").first();
    if (await vetSelect.isVisible().catch(() => false)) {
      await vetSelect.selectOption({ label: "I am not a protected veteran" }).catch(async () => {
        await vetSelect.selectOption({ label: "Not a veteran" }).catch(async () => {
          await vetSelect.selectOption({ label: "No" }).catch(() => {});
        });
      });
    }

    // Disability
    const disSelect = this.getScopeLocator(page, "select[name*='disability' i], select#disability, select[id*='eeoc_disability' i]").first();
    if (await disSelect.isVisible().catch(() => false)) {
      await disSelect.selectOption({ label: "No, I do not have a disability" }).catch(async () => {
        await disSelect.selectOption({ label: "No" }).catch(() => {});
      });
    }
  }

  /**
   * Fills electronic signatures, current date, and agreement checkboxes.
   */
  private async fillSignaturesAndAgreements(page: Page, profile: UserProfile): Promise<void> {
    // Signature text input
    const sigInput = this.getScopeLocator(page, "input[name*='signature' i], input#signature, input[id*='signature' i]").first();
    if (await sigInput.isVisible().catch(() => false)) {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      console.log(`✍️ [IcimsAdapter]: Digital Signature -> "${fullName}"`);
      await sigInput.fill(fullName);
    }

    // Signature Date
    const dateInput = this.getScopeLocator(page, "input[name*='signatureDate' i], input#signatureDate, input[name*='date' i][placeholder*='YYYY' i]").first();
    if (await dateInput.isVisible().catch(() => false)) {
      const today = new Date().toISOString().split("T")[0];
      await dateInput.fill(today);
    }

    // Certification & Agreement Checkboxes
    const checkboxes = await this.getScopeLocator(page, "input[type='checkbox']:not(#accept_gdpr)").all();
    for (const cb of checkboxes) {
      if (await cb.isVisible().catch(() => false)) {
        const isChecked = await cb.isChecked().catch(() => false);
        if (!isChecked) {
          await cb.check({ force: true }).catch(() => {});
        }
      }
    }
  }

  /**
   * Uploads candidate resume, cover letter, and photo.
   */
  async uploadResume(page: Page, resumePath: string, fields?: FormField[], profile?: UserProfile): Promise<void> {
    const prof = profile || this.candidateProfile;
    console.log(`📄 [IcimsAdapter]: Attaching candidate resume: ${resumePath}...`);
    await updateHUDStatus(page, "Attaching Documents", "Uploading Candidate Resume", "info", 50);

    // 1. RESUME ATTACHMENT
    const resumeInput = this.getScopeLocator(
      page,
      "input[type='file']#resume, input[type='file'][name*='resume' i], input[type='file'][name*='file' i], input[type='file']:not([name*='cover' i]):not([name*='photo' i])"
    ).first();

    if ((await resumeInput.count().catch(() => 0)) > 0 && fs.existsSync(resumePath)) {
      try {
        await resumeInput.setInputFiles(resumePath);
        console.log("✅ [IcimsAdapter]: Resume attached successfully.");
        await page.waitForTimeout(2000);
      } catch (err: any) {
        console.warn("⚠️ [IcimsAdapter]: Failed to attach resume:", err.message);
      }
    }

    // 2. COVER LETTER ATTACHMENT
    const coverLetterPath = prof?.coverLetterPath || (resumePath ? path.resolve(path.dirname(resumePath), `${prof?.firstName || 'Hrutin'}_${prof?.lastName || 'Nammi'}_Cover_Letter.pdf`) : "");
    if (coverLetterPath && fs.existsSync(coverLetterPath)) {
      const clInput = this.getScopeLocator(page, "input[type='file'][name*='cover' i], input[type='file']#coverLetter").first();
      if ((await clInput.count().catch(() => 0)) > 0) {
        console.log(`📄 [IcimsAdapter]: Attaching Cover Letter: ${coverLetterPath}`);
        await clInput.setInputFiles(coverLetterPath).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    // 3. CANDIDATE PHOTO ATTACHMENT
    const photoPath = prof?.photoPath || 
      (resumePath ? path.resolve(path.dirname(resumePath), `${prof?.firstName || 'Hrutin'}_${prof?.lastName || 'Nammi'}_Photo.png`) : "") ||
      path.resolve(process.cwd(), "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Photo.png");

    if (photoPath && fs.existsSync(photoPath)) {
      const photoInput = this.getScopeLocator(page, "input[type='file'][name*='photo' i], input[type='file'][name*='avatar' i], input[type='file'][accept*='image']").first();
      if ((await photoInput.count().catch(() => 0)) > 0) {
        console.log(`📸 [IcimsAdapter]: Attaching Candidate Photo: ${photoPath}`);
        await photoInput.setInputFiles(photoPath).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }
  }

  /**
   * Validates if required fields are properly populated.
   */
  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    console.log("🔍 [IcimsAdapter]: Validating filled application form...");
    // Check for standard error banners
    const errors = await this.getScopeLocator(page, ".iCIMS_ErrorMessage, .error, [class*='errorMessage'], .alert-danger").all();
    const visibleErrors: string[] = [];

    for (const err of errors) {
      if (await err.isVisible().catch(() => false)) {
        const txt = await err.innerText().catch(() => "");
        if (txt.trim()) visibleErrors.push(txt.trim());
      }
    }

    if (visibleErrors.length > 0) {
      console.warn("⚠️ [IcimsAdapter]: Detected validation notices:", visibleErrors);
      return false;
    }

    return true;
  }

  /**
   * Submits or prepares the application for final submission.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    await updateHUDStatus(
      page,
      !isAutoSubmit ? "Ready for Review" : "Submitting Application",
      !isAutoSubmit ? "Application filled: Ready for your review & submission 🎯" : "Submitting application to iCIMS...",
      "info",
      95
    );

    const submitBtn = this.getScopeLocator(
      page,
      "input[type='submit'][value*='Submit' i], button:has-text('Submit Application'), button:has-text('Submit'), input[value='Submit Application']"
    ).first();

    if ((await submitBtn.count().catch(() => 0)) === 0) {
      return {
        success: true,
        confirmation: "APPLICATION_FILLED_READY_FOR_REVIEW"
      };
    }

    // Scroll into view & highlight submit button with glowing outline
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    const frame = this.getActiveFrame(page);
    await frame.evaluate(() => {
      const btn = document.querySelector("input[value*='Submit' i], button[type='submit']") as HTMLElement;
      if (btn) {
        btn.style.outline = "3px solid #22c55e";
        btn.style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.85)";
        btn.style.borderRadius = "8px";
      }
    }).catch(() => {});

    if (!isAutoSubmit) {
      console.log("👉 [IcimsAdapter]: Ready for manual review. Submit button is centered & highlighted for you to click!");
      await updateHUDStatus(page, "Ready to Submit", "Application completed! Submit button highlighted for review 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION"
      };
    }

    console.log("🚀 [IcimsAdapter]: Auto-submitting application...");
    await submitBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(5000);

    const confirmed = await frame.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("thank you") || text.includes("application submitted") || text.includes("successfully submitted");
    }).catch(() => false);

    return {
      success: confirmed,
      confirmation: confirmed ? "ICIMS_APPLICATION_SUBMITTED_SUCCESSFULLY" : "SUBMIT_CLICKED"
    };
  }
}
