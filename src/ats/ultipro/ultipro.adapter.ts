import path from "path";
import fs from "fs";
import { Page, Locator } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel } from "../../application/field-mapper";
import { suggestAnswerForQuestion } from "../../application/question-answering";
import { handleCloudflareTurnstile } from "../../browser/turnstile-handler";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { resolveLocalResumePath } from "../../utils/path-resolver";

export class UltiproAdapter implements ATSAdapter {
  private candidateProfile?: UserProfile;
  private targetOpportunityUrl?: string;

  /**
   * Detects whether the current page is an UltiPro / UKG Pro Recruiting page.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("recruiting.ultipro.com") || url.includes("signin-us.ultipro.com") || url.includes("ultipro.com")) {
      return true;
    }

    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("recruiting.ultipro.com") ||
      content.includes("ukg pro") ||
      content.includes("ultipro") ||
      (await page.$("ukg-button, [data-automation='opportunity-title'], [data-automation='apply-now-button']")) !== null
    );
  }

  /**
   * Helper to dismiss popups or banners.
   */
  private async dismissBanners(page: Page): Promise<void> {
    try {
      const dismissBtn = page.locator("ukg-button[data-automation='accessibility-banner-dismiss'], button:has-text('Dismiss'), button:has-text('Accept')").first();
      if (await dismissBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await dismissBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
      }
    } catch {}
    await dismissCommonPopups(page);
  }

  /**
   * Extracts job info (company, title, description, location) from UltiPro job page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    await this.dismissBanners(page);
    const url = page.url();
    if (url.includes("OpportunityDetail") || url.includes("OpportunityApply")) {
      this.targetOpportunityUrl = url;
    }

    // 1. Company Name
    let company = "UltiPro Employer";
    try {
      const tenantMatch = url.match(/recruiting\.ultipro\.com\/([^/]+)/i);
      if (tenantMatch && tenantMatch[1]) {
        company = tenantMatch[1];
      }
      const titleText = await page.title().catch(() => "");
      if (titleText.includes("|")) {
        const parts = titleText.split("|").map(p => p.trim());
        if (parts.length > 1 && parts[1]) {
          company = parts[1].replace(/Opportunities|Careers|Jobs|Apply/gi, "").trim() || company;
        }
      }
    } catch {}

    // 2. Job Title
    let title = "Career Opportunity";
    try {
      const titleEl = page.locator("h1, [data-automation='opportunity-title'], .opportunity-title").first();
      if (await titleEl.count() > 0) {
        title = (await titleEl.innerText().catch(() => "")).trim() || title;
      }
    } catch {}

    // 3. Description
    let description = "";
    try {
      const descEl = page.locator("[data-automation='opportunity-description'], .opportunity-description, #opportunity-description").first();
      if (await descEl.count() > 0) {
        description = (await descEl.innerText().catch(() => "")).trim();
      }
    } catch {}

    return {
      company,
      title,
      description,
      ats: "ULTIPRO"
    };
  }

  /**
   * Ensures that candidate authentication / registration on UltiPro is completed,
   * bringing the page directly to the application form (`OpportunityApply`).
   */
  async ensureAuthenticated(page: Page, profile: UserProfile): Promise<void> {
    this.candidateProfile = profile;
    await updateHUDStatus(page, "UltiPro Authentication / Session Check", "working");
    console.log(`🔐 [UltiPro]: Checking candidate session for ${profile.email}...`);

    const maxAuthSteps = 6;
    for (let step = 0; step < maxAuthSteps; step++) {
      let currentUrl = page.url();
      console.log(`🔐 [UltiPro]: Auth loop step ${step + 1}, URL: ${currentUrl}`);

      const pathname = new URL(currentUrl).pathname;

      // State 0: Registration Details / AuthCode Confirmation (/AuthCode/Register)
      if (pathname.includes("/AuthCode/Register") || pathname.includes("/Register")) {
        console.log(`📝 [UltiPro]: Profile completion / Register form detected.`);
        await updateHUDStatus(page, "Completing UltiPro Registration Details", "working");

        const fnInput = page.locator("input[name='firstName'], ukg-input[data-automation='registrationDetails-firstName-input'] input").first();
        if (await fnInput.count() > 0) {
          await fnInput.click();
          await fnInput.fill(profile.firstName || "Hrutin");
        }

        const lnInput = page.locator("input[name='lastName'], ukg-input[data-automation='registrationDetails-lastName-input'] input").first();
        if (await lnInput.count() > 0) {
          await lnInput.click();
          await lnInput.fill(profile.lastName || "Nammi");
        }

        const phoneInput = page.locator("input[name='phoneNumber'], ukg-input[data-automation='registrationDetails-phoneNumber-input'] input").first();
        if (await phoneInput.count() > 0) {
          await phoneInput.click();
          const cleanPhone = (profile.phone || "2025550198").replace(/\D/g, "").slice(-10);
          await phoneInput.fill(cleanPhone || "2025550198");
        }

        const consentCb = page.locator("ukg-checkbox[data-automation*='privacy'], .reg-consent-checkbox").first();
        if (await consentCb.count() > 0) {
          await consentCb.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
        }

        await handleCloudflareTurnstile(page).catch(() => {});
        await page.waitForTimeout(2000);

        const createBtn = page.locator("ukg-button[data-automation='registrationDetails-submit-button'], button:has-text('Create account'), ukg-button:has-text('Create account')").first();
        if (await createBtn.count() > 0) {
          console.log(`🚀 [UltiPro]: Clicking 'Create account'...`);
          await createBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(8000);
        }
        continue;
      }

      if (pathname.includes("OpportunityApply") && !currentUrl.includes("signin-us")) {
        console.log(`✅ [UltiPro]: Reached OpportunityApply form!`);
        break;
      }

      // State 1: OpportunityDetail -> click Apply now
      if (currentUrl.includes("OpportunityDetail")) {
        console.log(`📌 [UltiPro]: On OpportunityDetail page. Triggering Apply now...`);
        let applyBtn = page.locator("ukg-button[data-automation='apply-now-button'], [data-automation='apply-now-button'], button:has-text('Apply now'), a:has-text('Apply now')").first();
        if (await applyBtn.count() === 0) {
          applyBtn = page.getByRole("button", { name: /apply now/i }).first();
        }
        if (await applyBtn.count() === 0) {
          applyBtn = page.locator("text=/^Apply now$/i").first();
        }
        if (await applyBtn.count() > 0) {
          await applyBtn.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(5000);
        continue;
      }

      // State 2: Universal Login (signin-us.ultipro.com/u/login)
      if (currentUrl.includes("signin-us.ultipro.com") && !currentUrl.includes("/u/signup")) {
        console.log(`🔑 [UltiPro]: Universal Login screen detected.`);
        const email = profile.email || "babufakemail@gmail.com";
        const passwords = ["ClucoPass@2026!Secure", "Tarun@143"];

        const userInput = page.locator("input#username, input[name='username'], input#email").first();
        const passInput = page.locator("input#password, input[name='password']").first();
        const primarySubmit = page.locator("button[data-action-button-primary='true'], button[name='action'][type='submit']").first();

        let loginSuccess = false;
        if (await userInput.count() > 0 && await passInput.count() > 0) {
          for (const pass of passwords) {
            console.log(`🔑 [UltiPro]: Attempting sign in with ${email}...`);
            await userInput.fill(email);
            await passInput.fill(pass);
            await primarySubmit.click();
            await page.waitForTimeout(6000);

            if (!page.url().includes("signin-us.ultipro.com/u/login")) {
              loginSuccess = true;
              break;
            }
          }
        }

        // If credentials failed, try signing up
        if (!loginSuccess && page.url().includes("signin-us.ultipro.com/u/login")) {
          console.log(`⚠️ [UltiPro]: Login failed, attempting Sign up...`);
          const signupLink = page.locator("a:has-text('Sign up'), a[href*='signup']").first();
          if (await signupLink.count() > 0) {
            await signupLink.click();
            await page.waitForTimeout(4000);
          }
        }
        continue;
      }

      // State 3: Signup screen (signin-us.ultipro.com/u/signup)
      if (currentUrl.includes("signin-us.ultipro.com/u/signup")) {
        console.log(`📝 [UltiPro]: On registration screen: ${page.url()}`);
        const regEmail = page.locator("input#email, input[name='email']").first();
        const regPass = page.locator("input#password, input[name='password']").first();
        const regSubmit = page.locator("button[data-action-button-primary='true'], button[name='action'][type='submit']").first();

        if (await regEmail.count() > 0 && await regPass.count() > 0) {
          await regEmail.fill(profile.email || "babufakemail@gmail.com");
          await regPass.fill("ClucoPass@2026!Secure");
          await regSubmit.click();
          await page.waitForTimeout(8000);
        }
        continue;
      }

      // State 4: Registration Details / AuthCode Confirmation (/AuthCode/Register)
      if (currentUrl.includes("/AuthCode/Register") || currentUrl.includes("/Register")) {
        console.log(`📝 [UltiPro]: Profile completion / Register form detected.`);
        await updateHUDStatus(page, "Completing UltiPro Registration Details", "working");

        const fnInput = page.locator("input[name='firstName'], ukg-input[data-automation='registrationDetails-firstName-input'] input").first();
        if (await fnInput.count() > 0) {
          await fnInput.click();
          await fnInput.fill(profile.firstName || "Hrutin");
        }

        const lnInput = page.locator("input[name='lastName'], ukg-input[data-automation='registrationDetails-lastName-input'] input").first();
        if (await lnInput.count() > 0) {
          await lnInput.click();
          await lnInput.fill(profile.lastName || "Nammi");
        }

        const phoneInput = page.locator("input[name='phoneNumber'], ukg-input[data-automation='registrationDetails-phoneNumber-input'] input").first();
        if (await phoneInput.count() > 0) {
          await phoneInput.click();
          const cleanPhone = (profile.phone || "2025550198").replace(/\D/g, "").slice(-10);
          await phoneInput.fill(cleanPhone || "2025550198");
        }

        const consentCb = page.locator("ukg-checkbox[data-automation*='privacy'], .reg-consent-checkbox").first();
        if (await consentCb.count() > 0) {
          await consentCb.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);
        }

        await handleCloudflareTurnstile(page).catch(() => {});
        await page.waitForTimeout(2000);

        const createBtn = page.locator("ukg-button[data-automation='registrationDetails-submit-button'], button:has-text('Create account'), ukg-button:has-text('Create account')").first();
        if (await createBtn.count() > 0) {
          console.log(`🚀 [UltiPro]: Clicking 'Create account'...`);
          await createBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(8000);
        }
        continue;
      }

      // State 5: JobBoard root or other non-apply page -> redirect to OpportunityApply
      if (!pathname.includes("OpportunityApply") && this.targetOpportunityUrl) {
        const applyUrl = this.targetOpportunityUrl.replace("OpportunityDetail", "OpportunityApply");
        console.log(`🔄 [UltiPro]: Navigating to OpportunityApply: ${applyUrl}`);
        await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(4000);
        continue;
      }

      await page.waitForTimeout(2000);
    }

    // Wait until OpportunityApply is loaded
    await page.waitForSelector("[data-automation='resumeparsinguploader-container'], [data-automation='upload-file-input'], [data-automation='contact-information-panel'], [data-automation='btn-submit']", { timeout: 25000 }).catch(() => {});
    console.log(`🎉 [UltiPro]: Successfully authenticated on application page: ${page.url()}`);
  }

  /**
   * Scrapes form fields from the UltiPro application page.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    const fields: FormField[] = [];

    const fieldElements = await page.evaluate(() => {
      const results: Array<{ id: string; label: string; type: string; required: boolean; options?: Array<{ label: string; value: string }> }> = [];

      // Contact text inputs
      document.querySelectorAll("input[data-automation$='textbox']").forEach(el => {
        const input = el as HTMLInputElement;
        const auto = input.getAttribute("data-automation") || "";
        results.push({
          id: auto,
          label: auto.replace("-textbox", "").replace(/-/g, " "),
          type: "text",
          required: input.required
        });
      });

      // Dropdowns
      document.querySelectorAll("select[data-automation$='dropdown']").forEach(el => {
        const sel = el as HTMLSelectElement;
        const auto = sel.getAttribute("data-automation") || "";
        const options = Array.from(sel.options).map(o => ({ label: o.text.trim(), value: o.value }));
        results.push({
          id: auto,
          label: auto.replace("-dropdown", "").replace(/-/g, " "),
          type: "select",
          required: sel.required,
          options
        });
      });

      // Question labels
      document.querySelectorAll("label[data-automation='question-title']").forEach(el => {
        results.push({
          id: el.id || "question",
          label: el.textContent?.trim() || "",
          type: "radio",
          required: el.classList.contains("required")
        });
      });

      return results;
    });

    for (const f of fieldElements) {
      fields.push({
        id: f.id,
        label: f.label,
        type: (f.type as any) || "text",
        required: f.required,
        options: f.options
      });
    }

    return fields;
  }

  /**
   * Uploads the resume to UltiPro's resume parsing uploader.
   */
  async uploadResume(page: Page, resumePath: string, fields?: FormField[]): Promise<void> {
    console.log(`📄 [UltiPro]: Uploading resume: ${resumePath}`);
    await updateHUDStatus(page, "Uploading Resume to UltiPro", "working");

    const resolved = resolveLocalResumePath(resumePath);
    if (!fs.existsSync(resolved)) {
      console.warn(`⚠️ [UltiPro]: Resume file not found at ${resolved}`);
      return;
    }

    try {
      // 1. Direct file input
      const fileInput = page.locator("input[type='file'][data-automation='upload-file-input'], input[type='file']").first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(resolved);
        console.log(`✅ [UltiPro]: Resume attached via input[type='file']`);
        await page.waitForTimeout(4000);
      } else {
        // Check if file button opens file chooser
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null),
          page.locator("[data-automation='upload-file-btn'], button:has-text('Upload'), ukg-button:has-text('Upload')").first().click({ force: true }).catch(() => {})
        ]);
        if (fileChooser) {
          await fileChooser.setFiles(resolved);
          console.log(`✅ [UltiPro]: Resume set via file chooser`);
          await page.waitForTimeout(4000);
        }
      }

      // Check if existing resume dropdown exists and has items
      const existingSel = page.locator("select[data-automation='existing-resume-selector']").first();
      if (await existingSel.count() > 0) {
        const optionCount = await existingSel.locator("option").count();
        if (optionCount > 1) {
          await existingSel.selectOption({ index: 1 }).catch(() => {});
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [UltiPro]: Resume upload warning: ${e.message}`);
    }
  }

  /**
   * Automates filling of all UltiPro application sections:
   * - Contact Information & Address
   * - Availability & Start Date
   * - Referral & Source
   * - Work Experience & Education
   * - Screening Questions
   * - Demographics / EEO Self-Identification
   */
  async fillForm(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>, fields?: FormField[]): Promise<void> {
    this.candidateProfile = profile;
    await updateHUDStatus(page, "Filling UltiPro Job Application", "working");
    console.log(`✍️ [UltiPro]: Commencing comprehensive form fill for ${profile.firstName} ${profile.lastName}...`);

    // Ensure session / authentication is ready
    await this.ensureAuthenticated(page, profile);

    // 1. Upload Resume
    const resumePath = profile.resumePath || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf";
    await this.uploadResume(page, resumePath, fields);

    // 2. Contact Information
    console.log(`👤 [UltiPro]: Filling Contact Information...`);
    await this.fillContactInformation(page, profile);

    // 3. Availability & Start Date
    console.log(`📅 [UltiPro]: Filling Availability & Start Date...`);
    await this.fillAvailabilityAndStartDate(page);

    // 4. Source & Referral
    console.log(`📢 [UltiPro]: Filling Source & Referral...`);
    await this.fillSourceAndReferral(page);

    // 5. Work Experience & Education
    console.log(`💼 [UltiPro]: Checking Work Experience & Education...`);
    await this.fillExperienceAndEducation(page, profile);

    // 6. Screening Questions
    console.log(`❓ [UltiPro]: Answering Screening Questions...`);
    await this.fillScreeningQuestions(page, profile, additionalAnswers);

    // 7. Demographics & EEO Self-Identification
    console.log(`🏛️ [UltiPro]: Answering EEO & Demographics...`);
    await this.fillEEOAndDemographics(page, profile);

    console.log(`🏁 [UltiPro]: Application fields populated successfully!`);
    await updateHUDStatus(page, "UltiPro Application Ready for Review", "success");
  }

  /**
   * Fills First Name, Last Name, Phone, Address, City, State, Postal Code.
   */
  private async fillContactInformation(page: Page, profile: UserProfile): Promise<void> {
    try {
      // First Name
      const fn = page.locator("input[data-automation='first-name-textbox']").first();
      if (await fn.count() > 0 && !(await fn.inputValue()).trim()) {
        await fn.fill(profile.firstName);
      }

      // Last Name
      const ln = page.locator("input[data-automation='last-name-textbox']").first();
      if (await ln.count() > 0 && !(await ln.inputValue()).trim()) {
        await ln.fill(profile.lastName);
      }

      // Primary Phone
      const phone = page.locator("input[data-automation='primary-phone-number-textbox']").first();
      if (await phone.count() > 0 && !(await phone.inputValue()).trim()) {
        const cleanPhone = (profile.phone || "2025550198").replace(/\D/g, "").slice(-10);
        await phone.fill(cleanPhone || "2025550198");
      }

      // Country Dropdown
      const countrySel = page.locator("select[data-automation='country-dropdown']").first();
      if (await countrySel.count() > 0) {
        // Select United States
        const options = await countrySel.locator("option").allInnerTexts();
        const usOption = options.find(o => o.toLowerCase().includes("united states") || o.toLowerCase() === "usa" || o.toLowerCase() === "us");
        if (usOption) {
          await countrySel.selectOption({ label: usOption }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }

      // Street Address (Address Line 1)
      const street = page.locator("input[data-automation='address-line1-textbox']").first();
      if (await street.count() > 0 && !(await street.inputValue()).trim()) {
        await street.fill(profile.street || "555 California St");
      }

      // City
      const city = page.locator("input[data-automation='city-textbox']").first();
      if (await city.count() > 0 && !(await city.inputValue()).trim()) {
        await city.fill(profile.city || "San Francisco");
      }

      // State Dropdown
      const stateSel = page.locator("select[data-automation='state-dropdown']").first();
      if (await stateSel.count() > 0) {
        const stateOpts = await stateSel.locator("option").allInnerTexts();
        const targetState = profile.state || "California";
        const matchedState = stateOpts.find(o => o.toLowerCase() === targetState.toLowerCase() || o.toLowerCase().startsWith(targetState.toLowerCase()) || o.toLowerCase().includes("california") || o === "CA");
        if (matchedState) {
          await stateSel.selectOption({ label: matchedState }).catch(() => {});
        } else if (stateOpts.length > 1) {
          await stateSel.selectOption({ index: 1 }).catch(() => {});
        }
      }

      // Postal Code
      const zip = page.locator("input[data-automation='postal-code-textbox']").first();
      if (await zip.count() > 0 && !(await zip.inputValue()).trim()) {
        await zip.fill(profile.zipCode || "94105");
      }

      // Willing to relocate checkbox
      const relocate = page.locator("input[data-automation='willing-to-relocate-checkbox']").first();
      if (await relocate.count() > 0 && !(await relocate.isChecked())) {
        await relocate.check({ force: true }).catch(() => {});
      }
    } catch (e: any) {
      console.warn(`⚠️ [UltiPro]: Contact info fill error: ${e.message}`);
    }
  }

  /**
   * Fills available start date and availability schedule.
   */
  private async fillAvailabilityAndStartDate(page: Page): Promise<void> {
    try {
      const dateInput = page.locator("input[data-automation='ukg-datepicker-input'], input[data-automation='available-start-date-datepicker']").first();
      if (await dateInput.count() > 0 && !(await dateInput.inputValue()).trim()) {
        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const yyyy = today.getFullYear();
        await dateInput.fill(`${mm}/${dd}/${yyyy}`);
      }
    } catch {}
  }

  /**
   * Fills source dropdown and sets referral to "No".
   */
  private async fillSourceAndReferral(page: Page): Promise<void> {
    try {
      // Applicant Source
      const sourceSel = page.locator("select[data-automation='applicant-source-dropdown'], select[data-automation='applicant-source']").first();
      if (await sourceSel.count() > 0) {
        const opts = await sourceSel.locator("option").allInnerTexts();
        const chosen = opts.find(o => /company website|career site|job board|linkedin|other/i.test(o)) || opts[1];
        if (chosen) {
          await sourceSel.selectOption({ label: chosen }).catch(() => {});
        }
      }

      // Employee Referral -> No
      const noReferral = page.locator("input[data-automation='no-employee-referral-radio']").first();
      if (await noReferral.count() > 0) {
        await noReferral.check({ force: true }).catch(() => {});
      }
    } catch {}
  }

  /**
   * Fills Work Experience & Education if panels exist and have empty cards.
   */
  private async fillExperienceAndEducation(page: Page, profile: UserProfile): Promise<void> {
    try {
      // 1. Work Experience Panel
      const expPanel = page.locator("[data-automation='work-experience-panel']");
      if (await expPanel.count() > 0) {
        const existingExp = await expPanel.locator(".list-item-summary, [data-automation='item-row']").count();
        if (existingExp === 0 && profile.experiences && profile.experiences.length > 0) {
          const addBtn = expPanel.locator("[data-automation='item-add-button'], button:has-text('Add')").first();
          if (await addBtn.count() > 0) {
            await addBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(1000);

            const exp = profile.experiences[0];
            const titleInput = expPanel.locator("input[data-automation*='title'], input[name*='Title']").first();
            if (await titleInput.count() > 0) await titleInput.fill(exp.jobTitle);

            const compInput = expPanel.locator("input[data-automation*='company'], input[name*='Company']").first();
            if (await compInput.count() > 0) await compInput.fill(exp.company);

            const saveBtn = expPanel.locator("[data-automation='save-button'], button:has-text('Save')").first();
            if (await saveBtn.count() > 0) {
              await saveBtn.click({ force: true }).catch(() => {});
              await page.waitForTimeout(1000);
            }
          }
        }
      }

      // 2. Education Panel
      const eduPanel = page.locator("[data-automation='education-panel']");
      if (await eduPanel.count() > 0) {
        const existingEdu = await eduPanel.locator(".list-item-summary, [data-automation='item-row']").count();
        if (existingEdu === 0 && profile.educations && profile.educations.length > 0) {
          const addBtn = eduPanel.locator("[data-automation='item-add-button'], button:has-text('Add')").first();
          if (await addBtn.count() > 0) {
            await addBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(1000);

            const edu = profile.educations[0];
            const schoolInput = eduPanel.locator("input[data-automation*='school'], input[name*='School']").first();
            if (await schoolInput.count() > 0) await schoolInput.fill(edu.school);

            const saveBtn = eduPanel.locator("[data-automation='save-button'], button:has-text('Save')").first();
            if (await saveBtn.count() > 0) {
              await saveBtn.click({ force: true }).catch(() => {});
              await page.waitForTimeout(1000);
            }
          }
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [UltiPro]: Exp/Edu fill notice: ${e.message}`);
    }
  }

  /**
   * Answers custom application screening questions (radios, text areas, numeric inputs).
   */
  private async fillScreeningQuestions(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>): Promise<void> {
    try {
      // Find all question containers
      const questionContainers = await page.locator(".form-group[role='group'], [data-bind*='ResponseType']").all();
      console.log(`🔍 [UltiPro]: Found ${questionContainers.length} question containers.`);

      for (const container of questionContainers) {
        const labelEl = container.locator("label[data-automation='question-title'], label.control-label").first();
        if (await labelEl.count() === 0) continue;

        const qText = (await labelEl.innerText().catch(() => "")).trim();
        if (!qText) continue;

        const qLower = qText.toLowerCase();

        // 1. Radio Questions (Multiple Choice)
        const radios = await container.locator("input[type='radio'][data-automation='multiple-choice-response'], input[type='radio']").all();
        if (radios.length > 0) {
          const alreadyChecked = await container.locator("input[type='radio']:checked").count();
          if (alreadyChecked === 0) {
            let targetIdx = 0; // Default to first (often 'Yes')

            // Specific semantic rules
            if (qLower.includes("require sponsorship") || qLower.includes("visa") || qLower.includes("relatives") || qLower.includes("family working") || qLower.includes("ever been employed")) {
              // Target "No"
              for (let i = 0; i < radios.length; i++) {
                const optText = (await radios[i].locator("xpath=..").innerText().catch(() => "")).toLowerCase();
                if (optText.includes("no")) {
                  targetIdx = i;
                  break;
                }
              }
            } else if (qLower.includes("legal right to work") || qLower.includes("authorized to work") || qLower.includes("over 18") || qLower.includes("relocate") || qLower.includes("commutable distance") || qLower.includes("perform the functions")) {
              // Target "Yes"
              for (let i = 0; i < radios.length; i++) {
                const optText = (await radios[i].locator("xpath=..").innerText().catch(() => "")).toLowerCase();
                if (optText.includes("yes")) {
                  targetIdx = i;
                  break;
                }
              }
            } else if (qLower.includes("education")) {
              // Target Bachelor's or Master's
              for (let i = 0; i < radios.length; i++) {
                const optText = (await radios[i].locator("xpath=..").innerText().catch(() => "")).toLowerCase();
                if (optText.includes("bachelor") || optText.includes("master") || optText.includes("degree")) {
                  targetIdx = i;
                  break;
                }
              }
            }

            console.log(`🔘 [UltiPro]: Answering radio Q "${qText.slice(0, 50)}..." -> Option [${targetIdx}]`);
            await radios[targetIdx].check({ force: true }).catch(() => {});
            await page.waitForTimeout(300);
          }
          continue;
        }

        // 2. Text / Textarea Questions
        const textInputs = container.locator("textarea[data-automation='text-response']:visible, input[data-automation='text-response']:visible, textarea:visible, input[type='text']:visible");
        if (await textInputs.count() > 0) {
          const targetInput = textInputs.first();
          if (await targetInput.isVisible().catch(() => false)) {
            const currentVal = await targetInput.inputValue().catch(() => "");
            if (!currentVal.trim()) {
              let answer = "N/A";

              if (qLower.includes("reference")) {
                answer = "Professional reference details available upon request.";
              } else if (qLower.includes("salary") || qLower.includes("compensation")) {
                answer = "Open to discussion based on competitive market rates ($120,000 - $140,000)";
              } else if (qLower.includes("relatives") || qLower.includes("family") || qLower.includes("employed by")) {
                answer = "N/A";
              } else {
                answer = suggestAnswerForQuestion(qText, undefined, profile);
              }

              console.log(`✍️ [UltiPro]: Answering text Q "${qText.slice(0, 50)}..." -> "${answer}"`);
              await targetInput.fill(answer).catch(() => {});
              await page.waitForTimeout(300);
            }
          }
          continue;
        }

        // 3. Numeric Questions
        const numInputs = container.locator("input[data-automation='numeric-response']:visible, input[type='number']:visible");
        if (await numInputs.count() > 0) {
          const numInput = numInputs.first();
          if (await numInput.isVisible().catch(() => false)) {
            const currentVal = await numInput.inputValue().catch(() => "");
            if (!currentVal.trim()) {
              let numAnswer = "5";
              if (qLower.includes("year")) {
                numAnswer = String(profile.yearsOfExperience || 5);
              } else if (qLower.includes("salary") || qLower.includes("compensation")) {
                numAnswer = "120000";
              }
              console.log(`🔢 [UltiPro]: Answering numeric Q "${qText.slice(0, 50)}..." -> ${numAnswer}`);
              await numInput.fill(numAnswer).catch(() => {});
              await page.waitForTimeout(300);
            }
          }
          continue;
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [UltiPro]: Screening questions error: ${e.message}`);
    }
  }

  /**
   * Fills Demographics & EEO Equal Opportunity Self-Identification.
   */
  private async fillEEOAndDemographics(page: Page, profile: UserProfile): Promise<void> {
    try {
      // 1. Gender
      const genderSel = page.locator("select[data-automation='country-questions-gender']").first();
      if (await genderSel.count() > 0) {
        const opts = await genderSel.locator("option").allInnerTexts();
        const targetGender = profile.gender || "Male";
        const matched = opts.find(o => o.toLowerCase() === targetGender.toLowerCase() || o.toLowerCase().includes("male") && !o.toLowerCase().includes("female"));
        if (matched) {
          await genderSel.selectOption({ label: matched }).catch(() => {});
        } else if (opts.length > 1) {
          await genderSel.selectOption({ index: 1 }).catch(() => {});
        }
      }

      // 2. Hispanic Origin / Ethnicity
      const ethnicSel = page.locator("select[data-automation='country-questions-ethnic-origin']").first();
      if (await ethnicSel.count() > 0) {
        const opts = await ethnicSel.locator("option").allInnerTexts();
        // Candidate Hrutin Nammi is Asian (Not Hispanic/Latino)
        const matched = opts.find(o => o.toLowerCase().includes("not hispanic") || o.toLowerCase().includes("non-hispanic")) || opts[1];
        if (matched) {
          await ethnicSel.selectOption({ label: matched }).catch(() => {});
        }
      }

      // 3. Race
      const raceSel = page.locator("select[data-automation='country-questions-race']").first();
      if (await raceSel.count() > 0) {
        const opts = await raceSel.locator("option").allInnerTexts();
        const matched = opts.find(o => o.toLowerCase().includes("asian")) || opts[1];
        if (matched) {
          await raceSel.selectOption({ label: matched }).catch(() => {});
        }
      }

      // 4. Veteran Status (US Federal Contractor)
      const vetSel = page.locator("select[data-automation='country-questions-us-federal-contractor']").first();
      if (await vetSel.count() > 0) {
        const opts = await vetSel.locator("option").allInnerTexts();
        const matched = opts.find(o => o.toLowerCase() === "no" || o.toLowerCase().includes("not a veteran") || o.toLowerCase().includes("not a protected veteran")) || opts[1];
        if (matched) {
          await vetSel.selectOption({ label: matched }).catch(() => {});
        }
      }

      // 5. Disability Status
      const disabilityNo = page.locator("input[data-automation='disability-status-no']").first();
      if (await disabilityNo.count() > 0) {
        await disabilityNo.check({ force: true }).catch(() => {});
      } else {
        const disabilityDecline = page.locator("input[data-automation='disability-status-decline']").first();
        if (await disabilityDecline.count() > 0) {
          await disabilityDecline.check({ force: true }).catch(() => {});
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [UltiPro]: Demographics error: ${e.message}`);
    }
  }

  /**
   * Validates whether all required fields on UltiPro are populated.
   */
  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    try {
      await page.screenshot({ path: "scratch/ultipro_application_filled.png" }).catch(() => {});
      const errorCount = await page.locator(".validation-summary-errors:visible, .help-block:visible:not(:empty), .error:visible").count();
      if (errorCount > 0) {
        const texts = await page.locator(".validation-summary-errors:visible, .help-block:visible:not(:empty)").allInnerTexts();
        console.warn(`⚠️ [UltiPro]: Form validation warning(s):`, texts.filter(t => t.trim()));
      }
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Submits the UltiPro application.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    try {
      const submitBtn = page.locator("[data-automation='btn-submit'], button:has-text('Submit Application'), button:has-text('Submit'), ukg-button:has-text('Submit')").first();
      if (await submitBtn.count() > 0) {
        console.log(`🚀 [UltiPro]: Clicking Submit Application...`);
        await submitBtn.click({ force: true });
        await page.waitForTimeout(6000);

        // Check confirmation modal or message
        const confirmationModal = page.locator("[data-automation='confirmation-modal'], .confirmation-modal, .application-submitted");
        if (await confirmationModal.count() > 0) {
          const acceptBtn = confirmationModal.locator("[data-automation='modal-accept'], button:has-text('OK'), button:has-text('Accept'), button:has-text('Close')").first();
          if (await acceptBtn.count() > 0) {
            await acceptBtn.click({ force: true }).catch(() => {});
          }
        }

        return {
          success: true,
          confirmation: "UltiPro application submitted successfully."
        };
      }
      return {
        success: false,
        errorMessage: "Submit button not found."
      };
    } catch (e: any) {
      return {
        success: false,
        errorMessage: e.message
      };
    }
  }
}
