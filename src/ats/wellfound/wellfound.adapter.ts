import { Page, BrowserContext } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import {
  DEFAULT_HRUTIN_WELLFOUND_PROFILE,
  DEFAULT_HRUTIN_WELLFOUND_LINKS,
  DEFAULT_HRUTIN_WELLFOUND_PITCH
} from "./wellfound-account-store";
import { ensureWellfoundSession, syncWellfoundProfile, isWellfoundLoggedIn } from "./wellfound-auth";
import { generateAnswerForQuestion } from "./wellfound-llm";
import { humanClick, typeLikeHuman, simulateHumanMouse } from "../../browser/form-filler";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { resolveLocalResumePath } from "../../utils/path-resolver";
import { detectAndGetAdapter } from "../ats-factory";

export class WellfoundAdapter implements ATSAdapter {

  /**
   * Checks if the active page is a Wellfound or AngelList job page.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("wellfound.com") || url.includes("angel.co")) {
      return true;
    }

    const content = (await page.content().catch(() => "")).toLowerCase();
    if (
      content.includes("wellfound") ||
      content.includes("angellist") ||
      (await page.$("meta[property='og:site_name'][content*='Wellfound' i]")) !== null ||
      (await page.$("[data-test='JobListing'], [class*='styles_jobListing']")) !== null
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extracts job info (company, title, description, location, salary) from Wellfound page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");
    const url = page.url();

    // 1. Company Name
    let company = "Startup";
    const companyEl = await page.locator(
      "h2[class*='styles_companyName'], [data-test='JobListing-CompanyName'], a[href*='/company/'], h1 span, [class*='company'] a"
    ).first().innerText().catch(() => "");

    if (companyEl && companyEl.trim()) {
      company = companyEl.trim().split("•")[0].trim();
    } else {
      const match = url.match(/\/company\/([^/]+)/);
      if (match && match[1]) {
        company = match[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
    }

    // 2. Job Title
    let title = "";
    const titleEl = await page.locator(
      "h1[class*='styles_jobTitle'], h1, [data-test='JobListing-Title'], [class*='JobHeader'] h1"
    ).first().innerText().catch(() => "");

    if (titleEl && titleEl.trim()) {
      title = titleEl.trim();
    } else if (pageTitle) {
      title = pageTitle.split("|")[0].split("at")[0].trim();
    }
    title = title || "Software Engineer";

    // If company is still "Startup", parse it from title if title contains " at "
    if ((company === "Startup" || !company) && title.includes(" at ")) {
      const parts = title.split(" at ");
      company = parts[parts.length - 1].trim();
    }

    // 3. Description
    const description = await page.locator(
      "[data-test='JobDescription'], [class*='styles_description'], [class*='JobDescription'], article, main"
    ).first().innerText().catch(() => "");

    return {
      company,
      title,
      description: description ? description.slice(0, 1500) : "Wellfound job opportunity",
      ats: "WELLFOUND"
    };
  }

  /**
   * Scrapes modal fields or application inputs on Wellfound.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Analyzing Wellfound Application...", "Scanning modal and questions", "info", 65);
    await dismissCommonPopups(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const inputs = Array.from(document.querySelectorAll("input, textarea, select"));
      inputs.forEach((inp, idx) => {
        const typeAttr = (inp.getAttribute("type") || inp.tagName).toLowerCase();
        if (typeAttr === "hidden" || typeAttr === "submit") return;

        let label = "";
        const parentLabel = inp.closest("label");
        if (parentLabel && parentLabel.textContent) {
          label = parentLabel.textContent.trim();
        }

        if (!label) {
          label = inp.getAttribute("aria-label") || inp.getAttribute("placeholder") || inp.getAttribute("name") || `field-${idx}`;
        }

        let type: FormField["type"] = "text";
        if (typeAttr === "textarea" || inp.tagName.toLowerCase() === "textarea") type = "textarea";
        else if (typeAttr === "email") type = "email";
        else if (typeAttr === "tel") type = "tel";
        else if (typeAttr === "file") type = "file";
        else if (typeAttr === "checkbox") type = "checkbox";
        else if (typeAttr === "radio") type = "radio";
        else if (typeAttr === "select" || inp.tagName.toLowerCase() === "select") type = "select";

        results.push({
          id: inp.id || inp.getAttribute("name") || `wf-field-${idx}`,
          label: label.replace(/\s+/g, " ").trim(),
          type,
          required: inp.hasAttribute("required") || inp.getAttribute("aria-required") === "true" || label.includes("*")
        });
      });

      return results;
    });
  }

  /**
   * Automates opening the application modal, filling the pitch/note,
   * answering custom screening questions, phone, linkedin, AI tools, and ensuring EVERY field is filled.
   */
  async fillForm(
    page: Page,
    profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE,
    additionalAnswers: Record<string, string> = {},
    fields: FormField[] = []
  ): Promise<void> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Processing Wellfound Application", `Filling details for ${profile.firstName} ${profile.lastName}`, "info", 70);

    // 1. Ensure user is logged in with the requested candidate profile
    console.log(`🔐 [WellfoundAdapter]: Ensuring active session matches candidate: ${profile.email}...`);
    const currentJobUrl = page.url();
    await ensureWellfoundSession(page, profile);
    if (currentJobUrl && currentJobUrl.includes("/jobs/") && page.url() !== currentJobUrl) {
      console.log(`👉 [WellfoundAdapter]: Returning directly to job: ${currentJobUrl}...`);
      await page.goto(currentJobUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(2000);
    }

    // 2. Check if already applied to this job
    const alreadyApplied = await this.checkIfAlreadyApplied(page);
    if (alreadyApplied) {
      console.log("ℹ️ [WellfoundAdapter]: Job is already applied on Wellfound! Skipping submission.");
      await updateHUDStatus(page, "Already Applied", "This job has previously been submitted", "success", 100);
      return;
    }

    // 3. Click the Apply / Quick Apply button
    console.log("👉 [WellfoundAdapter]: Locating and clicking the 'Apply' button...");
    const applyClicked = await this.clickApplyButton(page, profile, additionalAnswers);
    if (!applyClicked) {
      console.warn("⚠️ [WellfoundAdapter]: Unable to open application modal or apply button not interactable.");
      return;
    }

    // Wait for the application drawer / inputs to render
    await page.locator("textarea, input[name*='customQuestionAnswers'], input[type='tel'], input[type='text'], button:has-text('Send application')").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await dismissCommonPopups(page);

    // Auto-resolve "This job does not support the locations on your profile" banner & dropdown
    await this.handleLocationPreferencesBanner(page, profile);

    // 4. Extract job details for AI/LLM contextual question answering
    const jobDetails = await this.extractJob(page);

    // 5. Fill Pitch / Note to the Hiring Manager
    console.log("✍️ [WellfoundAdapter]: Checking for Note to Hiring Manager / Pitch...");
    const pitchTextarea = page.locator(
      "textarea[name*='userNote' i], textarea[name*='note' i], textarea[placeholder*='note' i], textarea[placeholder*='pitch' i], textarea[aria-label*='note' i]"
    ).first();

    if (await pitchTextarea.isVisible({ timeout: 2500 }).catch(() => false)) {
      let pitchText = additionalAnswers.pitch || additionalAnswers.cover_letter;
      if (!pitchText) {
        pitchText = await generateAnswerForQuestion(
          "Why are you interested in this role and company? Note to hiring manager",
          jobDetails,
          profile,
          undefined,
          "textarea"
        );
      }
      console.log(`📝 [WellfoundAdapter]: Typing personalized pitch (${pitchText.length} characters)...`);
      await typeLikeHuman(page, pitchTextarea, pitchText);
      await page.waitForTimeout(500);
    }

    // 6. FILL EVERY FIELD IN THE APPLICATION (EXPLICIT USER DIRECTIVE - NO "N/A"!)
    console.log("📝 [WellfoundAdapter]: Filling EVERY field in application form using LLM / Contextual Generator...");
    await this.fillAllApplicationFields(page, profile, additionalAnswers, jobDetails);

    await updateHUDStatus(page, "Application Ready", "All fields and links verified", "success", 85);
  }

  /**
   * Uploads resume PDF inside modal if a file input exists
   */
  async uploadResume(
    page: Page,
    resumePath: string = "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf",
    fields: FormField[] = []
  ): Promise<void> {
    const fileInput = page.locator(
      "input[type='file'][accept*='pdf' i], input[type='file']"
    ).first();

    if (await fileInput.isVisible().catch(() => false) || (await fileInput.count().catch(() => 0)) > 0) {
      const resolved = resolveLocalResumePath(resumePath);
      if (resolved) {
        console.log(`📂 [WellfoundAdapter]: Uploading resume: ${resolved}...`);
        await fileInput.setInputFiles(resolved).catch((err) => {
          console.warn("⚠️ [WellfoundAdapter]: Resume upload notice:", err.message);
        });
        await page.waitForTimeout(1500);
        await dismissCommonPopups(page);
        await this.dismissWellfoundModals(page);
      }
    }
  }

  /**
   * Validates if the application is filled and ready for submission
   */
  async validate(page: Page, fields: FormField[] = []): Promise<boolean> {
    await this.handleLocationPreferencesBanner(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE);
    await this.fillAllDropdowns(page);

    const errorEl = await page.locator("[class*='error'], [role='alert'], [data-test*='error']").first().isVisible().catch(() => false);
    if (errorEl) {
      const errText = await page.locator("[class*='error'], [role='alert']").first().innerText().catch(() => "");
      console.warn("⚠️ [WellfoundAdapter]: Form reported validation error:", errText);
      return false;
    }
    return true;
  }

  /**
   * Submits the Wellfound application or holds for review in dry-run mode
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isDryRun = process.env.DRY_RUN !== "false";
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    console.log(`🎯 [WellfoundAdapter]: Final submission evaluation (DRY_RUN=${isDryRun}, AUTO_SUBMIT=${isAutoSubmit})...`);

    if (isDryRun || !isAutoSubmit) {
      console.log("🔒 [WellfoundAdapter]: DRY_RUN active. Application filled and verified without final submit click.");
      return {
        success: true,
        confirmation: "Form filled & verified (Simulation Mode - Ready for Review)"
      };
    }

    console.log("🚀 [WellfoundAdapter]: Executing LIVE application submission on Wellfound...");
    await dismissCommonPopups(page);
    await this.dismissWellfoundModals(page);
    await this.handleLocationPreferencesBanner(page, DEFAULT_HRUTIN_WELLFOUND_PROFILE);
    await this.fillAllDropdowns(page);

    const submitBtn = page.locator(
      "button:has-text('Send application'), button:has-text('Submit application'), form button[type='submit'], [class*='drawer'] button:has-text('Send'), [class*='drawer'] button:has-text('Apply'), [data-test*='Submit'], button:has-text('Submit Application')"
    ).first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      const isDisabled = await submitBtn.isDisabled().catch(() => false);
      if (isDisabled) {
        console.warn("⚠️ [WellfoundAdapter]: Submit button is disabled! Checking required inputs...");
      }

      console.log("🖱️ [WellfoundAdapter]: Clicking final submit button...");
      try {
        await humanClick(page, submitBtn);
      } catch (err: any) {
        console.warn("⚠️ [WellfoundAdapter]: humanClick failed on submit, attempting direct DOM click:", err.message);
        await submitBtn.evaluate((el: HTMLElement) => el.click()).catch(() => {});
      }

      await page.waitForTimeout(4000);

      const isSuccess = await page.locator(
        ":has-text('Application sent'), :has-text('You applied'), :has-text('Success'), [data-test='ApplicationSuccess'], button:has-text('Applied')"
      ).first().isVisible({ timeout: 6000 }).catch(() => false);

      if (isSuccess) {
        console.log("✅ [WellfoundAdapter]: Application successfully submitted to employer!");
        return {
          success: true,
          confirmation: "Application sent successfully on Wellfound"
        };
      }
    } else {
      console.warn("⚠️ [WellfoundAdapter]: No explicit submit button found. Checking if application already sent...");
    }

    const appliedAfter = await this.checkIfAlreadyApplied(page);
    return {
      success: appliedAfter,
      confirmation: appliedAfter ? "Application submitted & confirmed on Wellfound" : "Submission attempted on Wellfound"
    };
  }

  /**
   * Checks whether the current user has already applied to this Wellfound job
   */
  private async checkIfAlreadyApplied(page: Page): Promise<boolean> {
    const appliedIndicator = page.locator(
      "[class*='actionBar'] button:has-text('Applied'), [class*='JobDetail'] button:has-text('Applied'), [data-test='JobListing-AppliedButton'], [class*='appliedBadge']"
    ).first();

    return await appliedIndicator.isVisible({ timeout: 1500 }).catch(() => false);
  }

  /**
   * Clicks the apply button and handles potential external ATS redirects
   */
  private async clickApplyButton(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string>
  ): Promise<boolean> {
    await dismissCommonPopups(page);
    await this.dismissWellfoundModals(page);

    const applyBtn = page.locator(
      "[class*='actionBar'] button:has-text('Apply'), [class*='applyButton'], button:has-text('Apply'), button:has-text('1-Click Apply'), button:has-text('Quick Apply'), [data-test='JobListing-ApplyButton'], a:has-text('Apply on company website')"
    ).first();

    if (!(await applyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }

    const context = page.context();
    const pagePromise = context.waitForEvent("page", { timeout: 4000 }).catch(() => null);

    await humanClick(page, applyBtn);

    const newPage = await pagePromise;
    if (newPage) {
      await newPage.waitForLoadState("domcontentloaded").catch(() => {});
      console.log(`🌐 [WellfoundAdapter]: Detected external application redirect -> ${newPage.url()}`);
      const { ats, adapter } = await detectAndGetAdapter(newPage, newPage.url());
      console.log(`🔄 [WellfoundAdapter]: Handing off execution to ${ats} adapter...`);
      const fields = await adapter.extractFields(newPage);
      await adapter.fillForm(newPage, profile, additionalAnswers, fields);
      if (profile.resumePath) {
        await adapter.uploadResume(newPage, profile.resumePath, fields);
      }
      return true;
    }

    return true;
  }

  /**
   * Automatically handles and dismisses Wellfound feature & interview popups.
   */
  private async dismissWellfoundModals(page: Page): Promise<void> {
    try {
      const featureModal = page.locator(
        "div:has-text('We want to feature you to recruiters'), [class*='ReactModal']:has-text('feature you'), [role='dialog']:has-text('feature you')"
      ).first();

      if (await featureModal.isVisible({ timeout: 600 }).catch(() => false)) {
        console.log("💎 [WellfoundAdapter]: Detected 'We want to feature you to recruiters!' popup. Dismissing...");
        const skipBtn = page.locator("button:has-text('Skip for now'), a:has-text('Skip for now'), :text('Skip for now')").first();
        if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await skipBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(300);
        } else {
          const cbs = page.locator(".ReactModalPortal input[type='checkbox']");
          const count = await cbs.count();
          for (let i = 0; i < count; i++) {
            await cbs.nth(i).check({ force: true }).catch(() => {});
          }
          const featBtn = page.locator("button:has-text('Feature my profile')").first();
          if (await featBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await featBtn.click({ force: true }).catch(() => {});
          }
        }
      }

      // Handle "We read your resume" banner/popup by clicking "Dismiss" (never delete layout DOM containers)
      try {
        const dismissBtn = page.locator(
          "div:has-text('We read your resume') button:has-text('Dismiss'), div:has-text('We read your resume') a:has-text('Dismiss'), :text('Dismiss')"
        ).first();
        if (await dismissBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log("📄 [WellfoundAdapter]: Clicking 'Dismiss' on 'We read your resume' toast...");
          await dismissBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(200);
        }
      } catch (e) {}

      // Cleanly remove only ReactModal overlays (NEVER touch layout divs like #__next or main)
      await page.evaluate(() => {
        document.querySelectorAll("body > .ReactModalPortal, body > .ReactModal__Overlay").forEach(el => {
          const text = (el.textContent || "").toLowerCase();
          if (text.includes("we want to feature you to recruiters") || text.includes("when will you be ready to interview")) {
            el.remove();
          }
        });
      }).catch(() => {});
    } catch (e) {}
  }

  /**
   * Inspects and fills EVERY field in the application form (custom questions, links, phones, radios)
   * using LLM or contextual question answering so that NO field is left as "N/A".
   */
  private async fillAllApplicationFields(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string>,
    jobDetails?: JobDetails
  ): Promise<void> {
    const links = {
      linkedin: profile.linkedinUrl || DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
      github: profile.githubUrl || DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
      twitter: DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
      portfolio: profile.portfolioUrl || DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio
    };

    const phone = profile.phone || "+1 202 555 0198";

    // 1. FILL TEXT INPUTS (Phone, LinkedIn, Website, Custom Questions)
    const textInputs = await page.locator("input[type='text'], input[type='tel'], input[type='url'], input:not([type])").all().catch(() => []);
    for (const inp of textInputs) {
      if (!(await inp.isVisible().catch(() => false))) continue;
      const currentVal = await inp.inputValue().catch(() => "");
      if (currentVal && currentVal.trim() && currentVal.trim().toUpperCase() !== "N/A") continue;
      if (currentVal && currentVal.trim().toUpperCase() === "N/A") {
        await inp.fill("").catch(() => {});
      }

      const labelText = await this.getAssociatedLabel(page, inp);
      const lower = labelText.toLowerCase();

      if (lower.includes("phone")) {
        console.log(`📞 [WellfoundAdapter]: Filling Phone Number -> ${phone}`);
        await typeLikeHuman(page, inp, phone);
      } else if (lower.includes("linkedin")) {
        console.log(`🔗 [WellfoundAdapter]: Filling LinkedIn URL -> ${links.linkedin}`);
        await typeLikeHuman(page, inp, links.linkedin);
      } else if (lower.includes("github")) {
        console.log(`🔗 [WellfoundAdapter]: Filling GitHub URL -> ${links.github}`);
        await typeLikeHuman(page, inp, links.github);
      } else if (lower.includes("twitter") || lower.includes(" x ")) {
        console.log(`🔗 [WellfoundAdapter]: Filling Twitter/X URL -> ${links.twitter}`);
        await typeLikeHuman(page, inp, links.twitter);
      } else if (lower.includes("portfolio") || lower.includes("website")) {
        console.log(`🔗 [WellfoundAdapter]: Filling Portfolio URL -> ${links.portfolio}`);
        await typeLikeHuman(page, inp, links.portfolio);
      } else if (lower.includes("search")) {
        // Skip global search bar
        continue;
      } else {
        // LLM / Contextual answer generation for custom text questions
        const answer = await generateAnswerForQuestion(labelText, jobDetails, profile);
        console.log(`🤖 [WellfoundAdapter]: Answering custom field: "${labelText}" -> "${answer.slice(0, 60)}..."`);
        await typeLikeHuman(page, inp, answer);
      }
      await page.waitForTimeout(300);
    }

    // 2. FILL TEXTAREAS (e.g. "What interests you about working for this company?")
    const textareas = await page.locator("textarea").all().catch(() => []);
    console.log(`📝 [WellfoundAdapter]: Found ${textareas.length} textarea(s) on application view.`);
    for (const ta of textareas) {
      const isVis = await ta.isVisible().catch(() => false);
      const currentVal = await ta.inputValue().catch(() => "");
      console.log(`   - Textarea isVisible=${isVis}, currentVal="${currentVal.slice(0, 30)}"`);
      if (!isVis) continue;
      if (currentVal && currentVal.trim() && currentVal.trim().toUpperCase() !== "N/A") continue;
      if (currentVal && currentVal.trim().toUpperCase() === "N/A") {
        await ta.fill("").catch(() => {});
      }

      const labelText = await this.getAssociatedLabel(page, ta);
      const lower = labelText.toLowerCase();
      if (lower.includes("note") || lower.includes("pitch") || lower.includes("cover letter")) {
        const pitchAnswer = await generateAnswerForQuestion("Why are you interested in this role and company? Note to hiring manager", jobDetails, profile, undefined, "textarea");
        await typeLikeHuman(page, ta, pitchAnswer);
      } else {
        // Generate high-impact customized answer via LLM / Context generator
        const answer = await generateAnswerForQuestion(labelText, jobDetails, profile, undefined, "textarea");
        console.log(`🤖 [WellfoundAdapter]: Filling textarea via LLM: "${labelText}" -> "${answer.slice(0, 80)}..."`);
        await typeLikeHuman(page, ta, answer);
      }
      await page.waitForTimeout(300);
    }

    // 3. ANSWER RADIO BUTTON GROUPS
    console.log("🔘 [WellfoundAdapter]: Detecting and answering radio question groups...");
    const groupNames = await page.evaluate(() => {
      const names = new Set<string>();
      document.querySelectorAll("input[type='radio']").forEach(r => {
        const n = r.getAttribute("name");
        if (n) names.add(n);
      });
      return Array.from(names);
    }).catch(e => {
      console.error("Error evaluating radio groups:", e);
      return [] as string[];
    });

    console.log(`🔘 [WellfoundAdapter]: Found ${groupNames.length} radio group(s):`, groupNames);

    for (const groupName of groupNames) {
      const radios = page.locator(`input[type='radio'][name='${groupName}']`);
      const count = await radios.count();
      if (count === 0) continue;

      // Find the group question text
      const questionText = await radios.first().evaluate(el => {
        const fieldset = el.closest("fieldset, [role='radiogroup'], div[class*='group'], div[class*='container']") || el.parentElement?.parentElement;
        return fieldset?.textContent || "";
      }).catch(() => "");

      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const optText = await radios.nth(i).evaluate(el => (el.nextElementSibling || el.parentElement)?.textContent || "");
        optionTexts.push(optText.trim());
      }

      console.log(`🔘 [WellfoundAdapter]: Radio question "${questionText.slice(0, 40)}" with options:`, optionTexts);
      const answer = await generateAnswerForQuestion(questionText, jobDetails, profile, optionTexts);
      console.log(`   👉 Selected radio answer: "${answer}"`);

      let targetIndex = 0;
      for (let i = 0; i < optionTexts.length; i++) {
        if (
          optionTexts[i].toLowerCase() === answer.toLowerCase() ||
          optionTexts[i].toLowerCase().includes(answer.toLowerCase()) ||
          answer.toLowerCase().includes(optionTexts[i].toLowerCase())
        ) {
          targetIndex = i;
          break;
        }
      }

      await radios.nth(targetIndex).evaluate(el => (el as HTMLInputElement).click()).catch(() => {});
      await page.waitForTimeout(200);
    }

    // 4. CHECK TERMS / AGREEMENTS CHECKBOXES
    const checkboxes = await page.locator("input[type='checkbox']").all().catch(() => []);
    for (const cb of checkboxes) {
      if (!(await cb.isVisible().catch(() => false))) continue;
      const isChecked = await cb.isChecked().catch(() => false);
      if (!isChecked) {
        await cb.check({ force: true }).catch(() => {});
      }
    }

    // 5. DROPDOWN SELECTS & LOCATION PREFERENCES
    console.log("🔽 [WellfoundAdapter]: Handling location preferences & dropdown selects with LLM...");
    await this.handleLocationPreferencesBanner(page, profile);
    await this.fillAllDropdowns(page, jobDetails, profile);
  }

  /**
   * Resolves all dropdowns (native <select> and custom styled dropdowns/comboboxes)
   * on the Wellfound application form using LLM synthesis & smart matching.
   */
  private async fillAllDropdowns(
    page: Page,
    jobDetails?: JobDetails,
    profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE
  ): Promise<void> {
    // 1. Native HTML <select> elements
    const selects = await page.locator("select").all().catch(() => []);
    for (const sel of selects) {
      try {
        const isVis = await sel.isVisible().catch(() => false);
        if (!isVis) continue;
        const optionCount = await sel.locator("option").count().catch(() => 0);
        if (optionCount <= 1) continue;

        const currentVal = await sel.inputValue().catch(() => "");
        if (!currentVal || currentVal === "" || currentVal === "-" || currentVal === "default") {
          const labelText = await this.getAssociatedLabel(page, sel);
          const optionTexts = await sel.evaluate((el: HTMLSelectElement) => {
            return Array.from(el.options).map(o => o.text.trim());
          }).catch(() => []);

          const answer = await generateAnswerForQuestion(labelText, jobDetails, profile, optionTexts);
          console.log(`🔽 [WellfoundAdapter]: Native dropdown "${labelText.slice(0, 30)}" -> Answer: "${answer}"`);

          let targetIdx = 1;
          for (let i = 0; i < optionTexts.length; i++) {
            if (
              optionTexts[i].toLowerCase() === answer.toLowerCase() ||
              optionTexts[i].toLowerCase().includes(answer.toLowerCase()) ||
              answer.toLowerCase().includes(optionTexts[i].toLowerCase())
            ) {
              targetIdx = i;
              break;
            }
          }

          await sel.evaluate((el: HTMLSelectElement, idx: number) => {
            el.selectedIndex = idx;
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }, targetIdx);
          await page.waitForTimeout(300);
        }
      } catch (err: any) {
        console.warn("⚠️ [WellfoundAdapter]: Error evaluating select dropdown:", err.message);
      }
    }

    // 2. Custom comboboxes / styled dropdowns with empty/dash value
    const customDropdowns = await page.locator(
      "[role='combobox'], [class*='select__control'], [class*='Select-control'], button:has-text('-'), div:has(> span:has-text('-')), button[role='combobox'], [data-test*='select']"
    ).all().catch(() => []);

    for (const cd of customDropdowns) {
      try {
        const isVis = await cd.isVisible().catch(() => false);
        if (!isVis) continue;
        const txt = (await cd.innerText().catch(() => "")).trim();
        const needsSelection = txt === "-" || txt.toLowerCase().includes("select") || txt.toLowerCase().includes("choose") || txt === "";
        if (needsSelection) {
          const labelText = await this.getAssociatedLabel(page, cd);
          console.log(`🔽 [WellfoundAdapter]: Opening custom dropdown for "${labelText.slice(0, 35)}"...`);
          await cd.scrollIntoViewIfNeeded().catch(() => {});
          await cd.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);

          const options = page.locator("[role='option'], [class*='option']:not([class*='is-disabled']), [id*='-option-'], li[role='option']");
          const optCount = await options.count().catch(() => 0);

          if (optCount > 0) {
            const optionTexts: string[] = [];
            for (let i = 0; i < optCount; i++) {
              const oText = (await options.nth(i).innerText().catch(() => "")).trim();
              if (oText) optionTexts.push(oText);
            }

            const answer = await generateAnswerForQuestion(labelText, jobDetails, profile, optionTexts);
            console.log(`🔽 [WellfoundAdapter]: Custom dropdown option selected -> "${answer}"`);

            let targetIdx = 0;
            for (let i = 0; i < optionTexts.length; i++) {
              if (
                optionTexts[i].toLowerCase() === answer.toLowerCase() ||
                optionTexts[i].toLowerCase().includes(answer.toLowerCase()) ||
                answer.toLowerCase().includes(optionTexts[i].toLowerCase())
              ) {
                targetIdx = i;
                break;
              }
            }

            await options.nth(targetIdx).click({ force: true }).catch(() => {});
            await page.waitForTimeout(400);
          } else {
            await page.keyboard.press("ArrowDown").catch(() => {});
            await page.waitForTimeout(100);
            await page.keyboard.press("Enter").catch(() => {});
          }
          await page.waitForTimeout(300);
        }
      } catch (err: any) {
        console.warn("⚠️ [WellfoundAdapter]: Error in custom dropdown:", err.message);
      }
    }
  }

  /**
   * Automatically resolves the "This job does not support the locations on your profile" warning banner
   * by selecting "I can relocate to..." (or "I am currently in...") and picking a supported location from the dropdown.
   */
  private async handleLocationPreferencesBanner(page: Page, profile: UserProfile): Promise<boolean> {
    try {
      const hasBanner = await page.evaluate(() => {
        const text = document.body.innerText || "";
        return (
          text.includes("This job does not support the locations on your profile") ||
          text.includes("Update your location preferences") ||
          text.includes("Please select a location")
        );
      }).catch(() => false);

      if (!hasBanner) {
        return false;
      }

      console.log("📍 [WellfoundAdapter]: Detected Location Preferences warning banner!");

      // ─── STEP 1: Select Radio Button ("I can relocate to..." or "I am currently in...") ───
      const radioCandidates = [
        page.locator("label:has-text('I can relocate to')").first(),
        page.locator(":text('I can relocate to')").first(),
        page.locator("input[type='radio'][value*='relocate' i]").first(),
        page.locator("[role='radio']:has-text('relocate')").first(),
        page.locator("label:has-text('I am currently in')").first(),
        page.locator(":text('I am currently in')").first()
      ];

      let radioClicked = false;
      for (const loc of radioCandidates) {
        if (await loc.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log("📍 [WellfoundAdapter]: Clicking relocation radio via Playwright locator...");
          await loc.scrollIntoViewIfNeeded().catch(() => {});
          await loc.click({ force: true }).catch(() => {});
          radioClicked = true;
          await page.waitForTimeout(400);
          break;
        }
      }

      if (!radioClicked) {
        // Deep DOM click fallback
        await page.evaluate(() => {
          const els = Array.from(document.querySelectorAll("label, input[type='radio'], [role='radio'], span, div, p"));
          for (const el of els) {
            const txt = (el.textContent || "").toLowerCase();
            if (txt.includes("i can relocate to") || txt.includes("relocate")) {
              (el as HTMLElement).click();
              const radio = el.querySelector("input[type='radio']") || el;
              if ((radio as HTMLInputElement).checked !== undefined) {
                (radio as HTMLInputElement).checked = true;
                radio.dispatchEvent(new Event("change", { bubbles: true }));
                radio.dispatchEvent(new Event("input", { bubbles: true }));
              }
              return true;
            }
          }
          return false;
        }).catch(() => false);
        await page.waitForTimeout(400);
      }

      // ─── STEP 2: Resolve Location Dropdown ───
      // A. Check for native HTML <select> element in banner
      const selectResolved = await page.evaluate(() => {
        const selects = Array.from(document.querySelectorAll("select"));
        for (const sel of selects) {
          if (sel.options.length > 1) {
            let targetIdx = 1;
            for (let i = 1; i < sel.options.length; i++) {
              const txt = sel.options[i].text.toLowerCase();
              if (
                txt.includes("united states") ||
                txt.includes("remote") ||
                txt.includes("san francisco") ||
                txt.includes("california")
              ) {
                targetIdx = i;
                break;
              }
            }
            sel.selectedIndex = targetIdx;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
            sel.dispatchEvent(new Event("input", { bubbles: true }));
            return sel.options[targetIdx].text;
          }
        }
        return null;
      }).catch(() => null);

      if (selectResolved) {
        console.log(`📍 [WellfoundAdapter]: Location dropdown selected via native <select> -> "${selectResolved}"`);
        await page.waitForTimeout(300);
        return true;
      }

      // B. Custom styled dropdown / Combobox right above "Please select a location"
      console.log("📍 [WellfoundAdapter]: Locating custom location dropdown container...");
      const dropdownLocators = [
        page.locator(":text('Please select a location')").locator("xpath=preceding-sibling::*[1]"),
        page.locator("div:has-text('Update your location preferences') ~ * [role='combobox']").first(),
        page.locator("div:has-text('Update your location preferences') ~ * div[class*='control']").first(),
        page.locator("[class*='select__control']").first(),
        page.locator("[class*='Select-control']").first(),
        page.locator("[role='combobox']").first(),
        page.locator("div:has(> span:has-text('-'))").first(),
        page.locator("button:has-text('-')").first()
      ];

      let dropdownTriggerClicked = false;
      for (const dLoc of dropdownLocators) {
        if (await dLoc.isVisible({ timeout: 800 }).catch(() => false)) {
          console.log("📍 [WellfoundAdapter]: Clicking dropdown container via Playwright locator...");
          await dLoc.scrollIntoViewIfNeeded().catch(() => {});
          await dLoc.click({ force: true }).catch(() => {});
          dropdownTriggerClicked = true;
          await page.waitForTimeout(500);
          break;
        }
      }

      if (!dropdownTriggerClicked) {
        // Fallback DOM click on trigger
        await page.evaluate(() => {
          const errEl = Array.from(document.querySelectorAll("*")).find(
            el => (el.textContent || "").trim() === "Please select a location" && el.children.length === 0
          );
          let target: HTMLElement | null = null;
          if (errEl) {
            let prev = errEl.previousElementSibling as HTMLElement | null;
            while (prev && !target) {
              if (prev.querySelector("svg, [class*='indicator'], [class*='control'], [role='combobox']") || prev.textContent?.includes("-")) {
                target = prev.querySelector("[class*='control'], [role='combobox']") as HTMLElement || prev;
                break;
              }
              prev = prev.previousElementSibling as HTMLElement | null;
            }
          }
          if (!target) {
            target = document.querySelector("[class*='select__control'], [class*='Select-control'], [role='combobox']") as HTMLElement;
          }
          if (target) {
            target.scrollIntoView({ block: "center" });
            target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
            target.click();
            return true;
          }
          return false;
        }).catch(() => false);
        await page.waitForTimeout(500);
      }

      // ─── STEP 3: Click Available Location Option from Open Menu ───
      const optionLocators = [
        "[role='option']",
        "[id*='-option-']",
        "[class*='option']:not([class*='is-disabled'])",
        "[class*='menu'] div",
        "li[role='option']"
      ];

      const options = page.locator(optionLocators.join(", "));
      const optCount = await options.count().catch(() => 0);

      if (optCount > 0) {
        console.log(`📍 [WellfoundAdapter]: Found ${optCount} option(s) in location dropdown!`);
        let selected = false;
        for (let i = 0; i < optCount; i++) {
          const opt = options.nth(i);
          const text = (await opt.innerText().catch(() => "")).toLowerCase();
          if (
            text.includes("united states") ||
            text.includes("remote") ||
            text.includes("san francisco") ||
            text.includes("california") ||
            text.includes("us") ||
            text.includes("anywhere")
          ) {
            console.log(`📍 [WellfoundAdapter]: Selected preferred location option -> "${await opt.innerText()}"`);
            await opt.click({ force: true }).catch(() => {});
            selected = true;
            await page.waitForTimeout(400);
            break;
          }
        }
        if (!selected) {
          const firstVal = await options.first().innerText().catch(() => "Location Option");
          console.log(`📍 [WellfoundAdapter]: Selected first available location option -> "${firstVal}"`);
          await options.first().click({ force: true }).catch(() => {});
          await page.waitForTimeout(400);
        }
      } else {
        // Fallback: keyboard navigation
        console.log("📍 [WellfoundAdapter]: Using keyboard ArrowDown + Enter to select location...");
        await page.keyboard.press("ArrowDown").catch(() => {});
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter").catch(() => {});
        await page.waitForTimeout(400);
      }

      // ─── STEP 4: Verification and Secondary Fallback ("I am currently in...") ───
      const errorStillVisible = await page.locator(":text('Please select a location')").first().isVisible({ timeout: 1000 }).catch(() => false);
      if (errorStillVisible) {
        console.log("📍 [WellfoundAdapter]: Warning: 'Please select a location' still showing. Trying 'I am currently in...' radio...");
        const currentInRadio = page.locator("label:has-text('I am currently in'), :text('I am currently in')").first();
        if (await currentInRadio.isVisible().catch(() => false)) {
          await currentInRadio.click({ force: true }).catch(() => {});
          await page.waitForTimeout(500);

          // Retry clicking dropdown and selecting
          for (const dLoc of dropdownLocators) {
            if (await dLoc.isVisible({ timeout: 800 }).catch(() => false)) {
              await dLoc.click({ force: true }).catch(() => {});
              await page.waitForTimeout(500);
              const retryOpts = page.locator(optionLocators.join(", "));
              if ((await retryOpts.count().catch(() => 0)) > 0) {
                await retryOpts.first().click({ force: true }).catch(() => {});
              } else {
                await page.keyboard.press("ArrowDown").catch(() => {});
                await page.keyboard.press("Enter").catch(() => {});
              }
              break;
            }
          }
        }
      }

      console.log("📍 [WellfoundAdapter]: Location preferences banner handling finished.");
      return true;
    } catch (e: any) {
      console.warn("⚠️ [WellfoundAdapter]: Notice during handleLocationPreferencesBanner:", e.message);
      return false;
    }
  }

  /**
   * Helper to retrieve label text or preceding header text for an input
   */
  private async getAssociatedLabel(page: Page, el: any): Promise<string> {
    return await el.evaluate((input: HTMLElement) => {
      // 1. Closest label
      const parentLabel = input.closest("label");
      if (parentLabel && parentLabel.textContent) return parentLabel.textContent.trim();

      // 2. Label with 'for' attribute matching input id
      if (input.id) {
        const forLabel = document.querySelector(`label[for='${input.id}']`);
        if (forLabel && forLabel.textContent) return forLabel.textContent.trim();
      }

      // 3. Ancestor form group or container text
      const container = input.closest("div[class*='field'], div[class*='group'], div[class*='question'], div[class*='Row'], div[class*='wrapper'], div[class*='customQuestion'], li, fieldset");
      if (container) {
        const titleEl = container.querySelector("label, h3, h4, h5, p, span, strong");
        if (titleEl && titleEl.textContent) return titleEl.textContent.trim();
      }

      // 4. Previous sibling text
      const prev = input.previousElementSibling || input.parentElement?.previousElementSibling;
      if (prev && prev.textContent) return prev.textContent.trim();

      // 4. Placeholder or aria-label
      return input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.getAttribute("name") || "";
    }).catch(() => "");
  }
}
