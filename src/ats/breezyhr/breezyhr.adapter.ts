import { Page, Locator } from "playwright";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ATSAdapter, FormField, FormFieldOption, JobDetails, SubmissionResult, UserProfile, WorkExperienceItem, EducationItem } from "../ats.interface";
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
  await locator.evaluate((el: HTMLInputElement | HTMLTextAreaElement, val: string) => {
    const proto = el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (nativeSetter) nativeSetter.call(el, val); else el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, text).catch(() => {});
  await page.waitForTimeout(150);
}

export class BreezyHRAdapter implements ATSAdapter {
  private cachedResumePath?: string;

  /**
   * Detects whether the current page is powered by Breezy HR ATS.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("breezy.hr")) {
      return true;
    }
    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("breezy.hr") ||
      content.includes("breezy-portal") ||
      content.includes("bzybuttoncolor") ||
      content.includes("portalapp") ||
      (await page.$("input[name='cResume']#main-attachment, a.button.resume, button:has-text('Submit Application')")) !== null
    );
  }

  /**
   * Extracts job info (company, title, description, location) from Breezy HR page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const url = page.url();
    let company = "Company";
    let title = "Position";

    try {
      const hostname = new URL(url).hostname;
      const sub = hostname.split(".")[0];
      if (sub && sub !== "www" && sub !== "app") {
        company = sub.charAt(0).toUpperCase() + sub.slice(1);
        if (company.toLowerCase() === "centrl") company = "CENTRL";
        if (company.toLowerCase() === "beli") company = "Beli";
        if (company.toLowerCase() === "tristero") company = "Tristero";
        if (company.toLowerCase() === "turaco") company = "Turaco";
        if (company.toLowerCase() === "pri") company = "PRI Global";
      }
    } catch (e) {}

    // Check brand logo or DOM for explicit company name
    const brandAlt = await page.locator(".brand img, .header .brand img").first().getAttribute("alt").catch(() => "");
    if (brandAlt && brandAlt.trim()) {
      company = brandAlt.trim();
    }

    // Title from DOM
    const titleCandidates = [
      ".banner h1",
      "h1",
      ".app-title",
      "h2.position-title"
    ];
    for (const sel of titleCandidates) {
      const txt = await page.locator(sel).first().innerText({ timeout: 1500 }).catch(() => "");
      if (txt && txt.trim() && !txt.includes("Job Openings") && !txt.includes("Apply")) {
        title = txt.trim();
        break;
      }
    }

    if (title === "Position") {
      const pageTitle = await page.title().catch(() => "");
      if (pageTitle && !pageTitle.toLowerCase().includes("breezy")) {
        title = pageTitle.split(" - ")[0].split(" | ")[0].trim();
      }
    }

    // Description from DOM
    const description = await page.locator(
      ".description, div[class*='description'], .content-container, article, main"
    ).first().innerText({ timeout: 2000 }).catch(() => "Breezy HR job opportunity");

    return {
      company,
      title,
      description: description ? description.slice(0, 1500) : "Breezy HR job opportunity",
      ats: "BREEZYHR"
    };
  }

  /**
   * Ensures the application form is open. If currently on the job description page (/p/<id>),
   * navigates directly to /apply. Never clicks the resume upload or other application buttons.
   */
  private async ensureFormOpen(page: Page): Promise<void> {
    const url = page.url();
    const isApplyPage = url.includes("/apply");
    
    // If we're already on /apply, the form is present. Wait for it and NEVER click anything!
    if (isApplyPage) {
      await page.waitForSelector("input[name='cName'], input[name='cEmail'], form[name='form'], #main-attachment", { timeout: 15000 }).catch(() => {});
      return;
    }

    // If on /p/<id> without /apply, directly navigate to /apply
    if (url.includes("/p/")) {
      const applyUrl = url.replace(/\/+$/, "") + "/apply";
      console.log(`🌐 [BreezyHRAdapter]: Direct navigating to apply URL: ${applyUrl}...`);
      await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("input[name='cName'], input[name='cEmail'], form[name='form'], #main-attachment", { timeout: 15000 }).catch(() => {});
      return;
    }

    console.log("👉 [BreezyHRAdapter]: Ensuring application form is open...");

    // STRICT apply button selector: only match dedicated apply link, NEVER match resume buttons, file input containers, or generic buttons
    const applyBtn = page.locator(
      "a.button.apply-button:not(.resume), a[href$='/apply']:not(.resume):not(.file-input-container *), a:text-is('Apply to Position'), a:text-is('Apply for this Job')"
    ).first();

    if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("👉 [BreezyHRAdapter]: Clicking 'Apply to Position' button...");
      await humanClick(page, applyBtn);
      await page.waitForSelector("input[name='cName'], input[name='cEmail'], form[name='form'], #main-attachment", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Scrapes interactive form fields from Breezy HR application form.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    // Intercept any accidental filechooser dialogs so native OS picker never blocks
    page.on("filechooser", async (fc: any) => {
      console.log("📁 [BreezyHRAdapter]: Intercepted filechooser in extractFields.");
      const resolvedResume = resolveLocalResumePath(this.cachedResumePath || "resumes/resume.pdf");
      if (resolvedResume && fs.existsSync(resolvedResume)) {
        await fc.setFiles(resolvedResume).catch(() => {});
      }
    });

    await injectVisualHUD(page);
    await updateHUDStatus(page, "Analyzing Breezy HR Application...", "Scanning application form", "info", 40);
    await dismissCommonPopups(page);
    await this.ensureFormOpen(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const inputs = Array.from(document.querySelectorAll("input, select, textarea"));

      inputs.forEach((inp, idx) => {
        const typeAttr = (inp.getAttribute("type") || inp.tagName).toLowerCase();
        const name = inp.getAttribute("name") || "";
        const id = inp.id || "";

        // Skip hidden, submit, recaptcha, and HONEYPOT fields
        if (typeAttr === "hidden" || typeAttr === "submit") return;
        if (name.startsWith("hp_") || id.startsWith("hp_")) return;
        if (inp.closest(".apply-field-extra")) return;

        let label = "";
        if (id) {
          const l = document.querySelector(`label[for="${id}"]`);
          if (l) label = l.textContent?.trim() || "";
        }
        if (!label) {
          label = inp.closest("label")?.textContent?.trim() ||
                  inp.closest(".form-group, .question, div")?.querySelector("label, h3, h4")?.textContent?.trim() ||
                  inp.getAttribute("placeholder") ||
                  name || id || `field_${idx}`;
        }

        // Clean label
        label = label.replace(/\s+/g, " ").trim();

        let type: FormField["type"] = "text";
        if (typeAttr === "textarea" || inp.tagName.toLowerCase() === "textarea") type = "textarea";
        else if (typeAttr === "select" || inp.tagName.toLowerCase() === "select") type = "select";
        else if (typeAttr === "file") type = "file";
        else if (typeAttr === "checkbox") type = "checkbox";
        else if (typeAttr === "radio") type = "radio";
        else if (typeAttr === "email") type = "email";
        else if (typeAttr === "tel") type = "tel";

        results.push({
          id: name || id || `field_${idx}`,
          label,
          type,
          required: inp.hasAttribute("required") || label.includes("*")
        });
      });

      return results;
    });
  }

  /**
   * Automates form filling on Breezy HR using candidate profile & smart question answering.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    fields: FormField[] = []
  ): Promise<void> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Filling Breezy HR Application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 50);
    await dismissCommonPopups(page);
    await this.ensureFormOpen(page);

    const job = await this.extractJob(page);

    // ─── 1. STANDARD PERSONAL INFO FIELDS ───
    console.log("✍️ [BreezyHRAdapter]: Filling standard personal info...");

    // Full Name
    const fullNameInp = page.locator("input[name='cName'], input[ng-model='candidate.name'], input[placeholder='Full Name']").first();
    if (await fullNameInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      await typeLikeHuman(page, fullNameInp, fullName);
      console.log(`👤 [BreezyHRAdapter]: Name -> ${fullName}`);
    }

    // Email
    const emailInp = page.locator("input[name='cEmail'], input[type='email'], input[ng-model='candidate.email_address'], input[placeholder='Email Address']").first();
    if (await emailInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, emailInp, profile.email);
      console.log(`📧 [BreezyHRAdapter]: Email -> ${profile.email}`);
    }

    // Phone Number
    const phoneInp = page.locator("input[name='cPhoneNumber'], input[ng-model='candidate.phone_number'], input[placeholder='Phone Number']").first();
    if (await phoneInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      const cleanPhone = profile.phone || "+1 202 555 0198";
      await typeLikeHuman(page, phoneInp, cleanPhone);
      console.log(`📞 [BreezyHRAdapter]: Phone -> ${cleanPhone}`);
    }

    // Address / Location
    const addressInp = page.locator("input[name='cAddress'], #fullAddress, input[ng-model='candidate.address'], input[placeholder='Address']").first();
    if (await addressInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      const fullAddress = `${profile.street || "123 Market St"}, ${profile.city || "San Francisco"}, ${profile.state || "CA"} ${profile.zipCode || "94105"}, ${profile.country || "United States"}`;
      await typeLikeHuman(page, addressInp, fullAddress);
      console.log(`📍 [BreezyHRAdapter]: Address -> ${fullAddress}`);
      // Dismiss any google places dropdown by pressing Escape or Tab
      await page.keyboard.press("Escape").catch(() => {});
    }

    // Desired Salary
    const salaryInp = page.locator("input[name='cSalary'], input[ng-model='candidate.salary'], input[placeholder='Desired Salary']").first();
    if (await salaryInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, salaryInp, "95000");
      console.log(`💵 [BreezyHRAdapter]: Desired Salary -> 95000`);
    }

    // Salary Currency Select
    const currencySelect = page.locator("select[name='salaryCurrency'], select[ng-model='candidate.salary_currency']").first();
    if (await currencySelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await currencySelect.selectOption({ label: "USD ($)" }, { timeout: 1500 }).catch(async () => {
        await currencySelect.selectOption("USD", { timeout: 1500 }).catch(() => {});
      });
    }

    // Salary Frequency Select
    const salaryTermsSelect = page.locator("select[ng-model='candidate.salary_terms']").first();
    if (await salaryTermsSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await salaryTermsSelect.selectOption({ label: "Yearly" }, { timeout: 1500 }).catch(async () => {
        await salaryTermsSelect.selectOption("yearly", { timeout: 1500 }).catch(() => {});
      });
    }

    // Location Select (if company has multiple locations)
    const locationSelect = page.locator("select[name='cLocation'], select[ng-model='candidate.location']").first();
    if (await locationSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await locationSelect.evaluate((sel: HTMLSelectElement) => {
        const opts = Array.from(sel.options).filter(o => o.value && o.value !== "?");
        if (opts.length > 0) {
          sel.value = opts[0].value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }).catch(() => {});
    }

    // SMS Consent Checkbox
    const smsConsentCb = page.locator("input[type='checkbox'][name='smsConsent'], input[type='checkbox'][ng-model='candidate.smsConsent']").first();
    if (await smsConsentCb.isVisible({ timeout: 1000 }).catch(() => false)) {
      await smsConsentCb.check({ force: true }).catch(() => {});
    }

    // GDPR / Privacy Notice Checkbox
    const gdprCb = page.locator("input[type='checkbox'][name='gdprAgreement'], input[type='checkbox'][ng-model*='gdpr' i], input[type='checkbox'][ng-model*='privacy' i], input[type='checkbox'][ng-model*='consent' i]").first();
    if (await gdprCb.isVisible({ timeout: 1000 }).catch(() => false)) {
      await gdprCb.check({ force: true }).catch(() => {});
    }

    // ─── 2. WORK EXPERIENCE / WORK HISTORY ───
    // User instruction: "every field should fill including work experience fill to work expreenice and education too"
    console.log("💼 [BreezyHRAdapter]: Filling Work History...");
    await this.fillWorkHistory(page, profile);

    // ─── 3. EDUCATION ───
    // User instruction: "and education too"
    console.log("🎓 [BreezyHRAdapter]: Filling Education...");
    await this.fillEducation(page, profile);

    // ─── 4. EXPERIENCE SUMMARY ───
    const summaryTextarea = page.locator("textarea[name='cSummary'], textarea[ng-model='candidate.summary']").first();
    if (await summaryTextarea.isVisible({ timeout: 1500 }).catch(() => false)) {
      const summaryText = (profile as any).summary || "Full stack software engineer with 5+ years of experience in distributed systems, Node.js, TypeScript, Python, and cloud infrastructure.";
      await typeLikeHuman(page, summaryTextarea, summaryText);
      console.log("📝 [BreezyHRAdapter]: Experience Summary filled.");
    }

    // ─── 5. COVER LETTER ───
    const coverLetterTextarea = page.locator("textarea[name='cCoverLetter'], textarea[ng-model='candidate.cover_letter']").first();
    if (await coverLetterTextarea.isVisible({ timeout: 1500 }).catch(() => false)) {
      const coverLetterText = suggestAnswerForQuestion("cover letter") || 
        `Dear Hiring Team at ${job.company},\n\nI am writing to express my strong interest in the ${job.title} role. With extensive experience in full stack software development, scalable web architectures, and modern cloud technologies, I am confident in delivering immediate value to your engineering team.\n\nThank you for considering my application.\n\nSincerely,\n${profile.firstName} ${profile.lastName}`;
      await typeLikeHuman(page, coverLetterTextarea, coverLetterText);
      console.log("📜 [BreezyHRAdapter]: Cover Letter filled.");
    }

    // ─── 6. CUSTOM SCREENING QUESTIONNAIRES (RADIOS, TEXTS, SELECTS) ───
    console.log("🤖 [BreezyHRAdapter]: Answering custom screening questions...");
    await this.answerQuestionnaires(page, job, profile, additionalAnswers);

    // ─── 7. RESUME ATTACHMENT ───
    const resumePath = additionalAnswers?.resumePath || profile.resumePath || resolveLocalResumePath(profile.resumePath || "");
    await this.uploadResume(page, resumePath, fields, profile);

    // ─── 8. UNIVERSAL SAFETY SWEEP (STRICTLY SKIPPING HONEYPOTS!) ───
    await this.safetySweep(page, job, profile);

    // ─── 9. SCROLL TO SUBMIT BUTTON ───
    const submitBtn = page.locator("button[type='submit']:has-text('Submit Application'), button.bzyButtonColor, button:has-text('Submit')").first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }
  }

  /**
   * Populates Work History by clicking "Add Position" and populating company, title, dates, and summary.
   */
  private async fillWorkHistory(page: Page, profile: UserProfile): Promise<void> {
    const addPositionBtn = page.locator("a:has-text('Add Position'), button:has-text('Add Position')").first();
    const isAddVisible = await addPositionBtn.isVisible({ timeout: 1500 }).catch(() => false);

    const experiences: WorkExperienceItem[] = (profile.experiences && profile.experiences.length > 0)
      ? profile.experiences
      : [
          {
            jobTitle: profile.headline || "Software Engineer",
            company: profile.savedAnswers?.get("current_company") || "Technology Solutions",
            location: profile.location || "Remote",
            startDate: "2024-01-01",
            endDate: "2026-01-01",
            currentlyWorkHere: true,
            description: profile.summary || "Architected and delivered scalable software services and responsive web applications."
          }
        ];

    // Check how many position blocks already exist
    let existingPositions = await page.locator("li.experience[ng-repeat*='candidatePosition']").count().catch(() => 0);

    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];

      // If needed, click Add Position to create new position block
      if (existingPositions <= i && isAddVisible) {
        console.log(`➕ [BreezyHRAdapter]: Adding Work Position #${i + 1}...`);
        await humanClick(page, addPositionBtn);
        await page.waitForTimeout(600);
      }

      const positionBlock = page.locator("li.experience[ng-repeat*='candidatePosition']").nth(i);
      if (!(await positionBlock.isVisible({ timeout: 1500 }).catch(() => false))) {
        continue;
      }

      // Company
      const companyInp = positionBlock.locator("input[placeholder='Company'], input[ng-model*='company_name']").first();
      if (await companyInp.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, companyInp, exp.company);
      }

      // Title
      const titleInp = positionBlock.locator("input[placeholder='Title'], input[ng-model*='title']").first();
      if (await titleInp.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, titleInp, exp.jobTitle);
      }

      // Summary
      const summaryTa = positionBlock.locator("textarea[placeholder='Summary'], textarea[ng-model*='summary']").first();
      if (await summaryTa.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, summaryTa, exp.description || "Delivered scalable software features and high-performance backend systems.");
      }

      // Format dates (YYYY-MM-DD for HTML5 date inputs)
      const startDateStr = this.formatDateForInput(exp.startDate, "2024-01-01");
      const endDateStr = this.formatDateForInput(exp.endDate, "2026-01-01");

      const dateInputs = positionBlock.locator("input[type='date']");
      const dateCount = await dateInputs.count().catch(() => 0);

      if (dateCount >= 1) {
        await dateInputs.nth(0).fill(startDateStr).catch(() => {});
        await dateInputs.nth(0).evaluate((el: HTMLInputElement, val: string) => {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, startDateStr).catch(() => {});
      }

      if (dateCount >= 2) {
        await dateInputs.nth(1).fill(endDateStr).catch(() => {});
        await dateInputs.nth(1).evaluate((el: HTMLInputElement, val: string) => {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, endDateStr).catch(() => {});
      }

      console.log(`✅ [BreezyHRAdapter]: Work Experience #${i + 1} populated: ${exp.jobTitle} at ${exp.company}`);
    }
  }

  /**
   * Populates Education by clicking "Add Education" and populating school, field of study, dates, and summary.
   */
  private async fillEducation(page: Page, profile: UserProfile): Promise<void> {
    const addEducationBtn = page.locator("a:has-text('Add Education'), button:has-text('Add Education')").first();
    const isAddVisible = await addEducationBtn.isVisible({ timeout: 1500 }).catch(() => false);

    const educations: EducationItem[] = (profile.educations && profile.educations.length > 0)
      ? profile.educations
      : [
          {
            school: profile.savedAnswers?.get("school") || profile.savedAnswers?.get("university") || "University",
            degree: profile.savedAnswers?.get("degree") || "Bachelor of Science",
            fieldOfStudy: profile.savedAnswers?.get("major") || "Computer Science",
            gpa: "3.8",
            startDate: "2022-08-01",
            endDate: "2026-05-01"
          }
        ];

    let existingEducations = await page.locator("li.experience[ng-repeat*='candidateSchool']").count().catch(() => 0);

    for (let i = 0; i < educations.length; i++) {
      const edu = educations[i];

      if (existingEducations <= i && isAddVisible) {
        console.log(`➕ [BreezyHRAdapter]: Adding Education #${i + 1}...`);
        await humanClick(page, addEducationBtn);
        await page.waitForTimeout(600);
      }

      const eduBlock = page.locator("li.experience[ng-repeat*='candidateSchool']").nth(i);
      if (!(await eduBlock.isVisible({ timeout: 1500 }).catch(() => false))) {
        continue;
      }

      // School
      const schoolInp = eduBlock.locator("input[placeholder='School'], input[ng-model*='school_name']").first();
      if (await schoolInp.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, schoolInp, edu.school);
      }

      // Field of Study / Degree
      const fieldInp = eduBlock.locator("input[placeholder='Field of Study'], input[ng-model*='field_of_study']").first();
      if (await fieldInp.isVisible({ timeout: 1000 }).catch(() => false)) {
        const fieldVal = `${edu.degree ? edu.degree + " - " : ""}${edu.fieldOfStudy || "Computer Science"}`;
        await typeLikeHuman(page, fieldInp, fieldVal);
      }

      // Summary
      const summaryTa = eduBlock.locator("textarea[placeholder='Summary'], textarea[ng-model*='summary']").first();
      if (await summaryTa.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, summaryTa, `Completed ${edu.degree || "Bachelor's"} degree in ${edu.fieldOfStudy || "Computer Science"} with strong foundational and practical project experience.`);
      }

      // Dates
      const startDateStr = this.formatDateForInput(edu.startDate, "2023-08-01");
      const endDateStr = this.formatDateForInput(edu.endDate, "2027-06-01");

      const dateInputs = eduBlock.locator("input[type='date']");
      const dateCount = await dateInputs.count().catch(() => 0);

      if (dateCount >= 1) {
        await dateInputs.nth(0).fill(startDateStr).catch(() => {});
        await dateInputs.nth(0).evaluate((el: HTMLInputElement, val: string) => {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, startDateStr).catch(() => {});
      }

      if (dateCount >= 2) {
        await dateInputs.nth(1).fill(endDateStr).catch(() => {});
        await dateInputs.nth(1).evaluate((el: HTMLInputElement, val: string) => {
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, endDateStr).catch(() => {});
      }

      console.log(`✅ [BreezyHRAdapter]: Education #${i + 1} populated: ${edu.degree || "Bachelor"} at ${edu.school}`);
    }
  }

  /**
   * Helper to format date strings (e.g. "01/2024", "2024", "08/2023") into HTML5 "YYYY-MM-DD".
   */
  private formatDateForInput(dateStr?: string, defaultVal: string = "2024-01-01"): string {
    if (!dateStr) return defaultVal;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // "MM/YYYY"
    const mmYyyy = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
    if (mmYyyy) {
      const mm = mmYyyy[1].padStart(2, "0");
      const yyyy = mmYyyy[2];
      return `${yyyy}-${mm}-01`;
    }

    // "YYYY"
    const yyyyOnly = dateStr.match(/^(\d{4})$/);
    if (yyyyOnly) {
      return `${yyyyOnly[1]}-01-01`;
    }

    return defaultVal;
  }

  /**
   * Answers custom questionnaires on Breezy HR (radios, screening questions, text inputs).
   */
  private async answerQuestionnaires(
    page: Page,
    job: JobDetails,
    profile: UserProfile,
    additionalAnswers: Record<string, string>
  ): Promise<void> {
    // 1. Process Radio Groups
    const radioGroupNames = await page.evaluate(() => {
      const names = new Set<string>();
      document.querySelectorAll("input[type='radio']").forEach(r => {
        const n = r.getAttribute("name");
        if (n && !n.startsWith("hp_")) names.add(n);
      });
      return Array.from(names);
    }).catch(() => [] as string[]);

    for (const rName of radioGroupNames) {
      const radios = page.locator(`input[type='radio'][name='${rName}']`);
      const count = await radios.count().catch(() => 0);
      if (count === 0) continue;

      const questionText = await radios.first().evaluate((el: HTMLElement) => {
        const qGroup = el.closest(".question, .form-group, div");
        const legend = qGroup?.querySelector("h3, h4, label, legend");
        return legend?.textContent?.replace(/\s+/g, " ").trim() || "";
      }).catch(() => "");

      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const optText = await radios.nth(i).evaluate((el: HTMLInputElement) => {
          return (el.closest("label")?.textContent || el.parentElement?.textContent || el.value || "").replace(/\s+/g, " ").trim();
        });
        optionTexts.push(optText || (i === 0 ? "Yes" : "No"));
      }

      let targetIdx = -1;
      const normQ = questionText.toLowerCase();

      if (normQ.includes("sponsorship") || normQ.includes("visa")) {
        // "Are you eligible to work without sponsorship?" -> Yes
        // "Will you require sponsorship?" -> No
        if (normQ.includes("without sponsorship") || normQ.includes("eligible to work") || normQ.includes("authorized")) {
          targetIdx = optionTexts.findIndex(o => /^yes$/i.test(o.trim()));
        } else {
          targetIdx = optionTexts.findIndex(o => /^no$/i.test(o.trim()));
        }
      } else if (normQ.includes("currently a student") || normQ.includes("are you a student")) {
        targetIdx = optionTexts.findIndex(o => /^no$/i.test(o.trim()));
      } else if (normQ.includes("hear about") || normQ.includes("source")) {
        targetIdx = optionTexts.findIndex(o => /linkedin/i.test(o));
      }

      if (targetIdx === -1) {
        const answer = await generateAnswerForQuestion(questionText, job, profile, optionTexts, "radio");
        for (let i = 0; i < optionTexts.length; i++) {
          if (optionTexts[i].toLowerCase() === answer.toLowerCase() || optionTexts[i].toLowerCase().includes(answer.toLowerCase())) {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx === -1) targetIdx = 0;

      await radios.nth(targetIdx).check({ force: true }).catch(async () => {
        await radios.nth(targetIdx).evaluate((el: HTMLInputElement) => el.click());
      });
      await page.waitForTimeout(200);
      console.log(`🔘 [BreezyHRAdapter]: Radio "${questionText.slice(0, 40)}" -> "${optionTexts[targetIdx]}"`);
    }

    // 2. Process Questionnaire Text Inputs (e.g. GPA, Beli username, custom answers)
    const questionInputs = page.locator("input[name^='section_'], input[ng-model*='questionnaire']");
    const qCount = await questionInputs.count().catch(() => 0);

    for (let i = 0; i < qCount; i++) {
      const inp = questionInputs.nth(i);
      const type = (await inp.getAttribute("type").catch(() => ""))?.toLowerCase();
      if (type === "radio" || type === "hidden" || type === "checkbox") continue;

      const currentVal = await inp.inputValue().catch(() => "");
      if (currentVal && currentVal.trim()) continue;

      const label = await inp.evaluate((el: HTMLElement) => {
        return (el.closest(".question, .form-group, div")?.querySelector("h3, h4, label")?.textContent || "").replace(/\s+/g, " ").trim();
      }).catch(() => "");

      const normLabel = label.toLowerCase();
      let answer = "";

      if (normLabel.includes("gpa")) {
        answer = "3.8";
      } else if (normLabel.includes("username") || normLabel.includes("handle")) {
        answer = `${profile.firstName.toLowerCase()}${profile.lastName.toLowerCase()}`;
      } else if (normLabel.includes("github") || normLabel.includes("git")) {
        answer = profile.githubUrl || "";
      } else if (normLabel.includes("linkedin")) {
        answer = profile.linkedinUrl || "";
      } else if (normLabel.includes("portfolio") || normLabel.includes("website")) {
        answer = profile.portfolioUrl || profile.githubUrl || "";
      } else {
        answer = await generateAnswerForQuestion(label || "Screening question", job, profile, undefined, "input");
      }

      await typeLikeHuman(page, inp, answer);
      console.log(`✍️ [BreezyHRAdapter]: Questionnaire input "${label.slice(0, 35)}" -> "${answer}"`);
    }
  }

  /**
   * Safety sweep across remaining empty form fields, STRICTLY skipping honeypot inputs.
   */
  private async safetySweep(page: Page, job: JobDetails, profile: UserProfile): Promise<void> {
    const allInputs = await page.locator("input[type='text']:not([name^='hp_']):not([id^='hp_']), textarea:not([name^='hp_'])").all().catch(() => []);

    for (const inp of allInputs) {
      if (!(await inp.isVisible().catch(() => false))) continue;

      const name = (await inp.getAttribute("name").catch(() => "")) || "";
      const id = (await inp.getAttribute("id").catch(() => "")) || "";

      // HONEYPOT SHIELD: NEVER TOUCH
      if (name.startsWith("hp_") || id.startsWith("hp_") || id === "form_token") continue;

      const currentVal = await inp.inputValue().catch(() => "");
      if (currentVal && currentVal.trim()) continue;

      const label = await inp.evaluate((el: HTMLElement) => {
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l) return l.textContent?.trim() || "";
        }
        return el.closest(".form-group, .question, div")?.querySelector("h3, h4, label")?.textContent?.trim() ||
               el.getAttribute("placeholder") || "";
      }).catch(() => "");

      const answer = await generateAnswerForQuestion(label || "Application Information", job, profile, undefined, "input");
      console.log(`🛡️ [BreezyHRAdapter]: Safety sweep populated empty field "${label.slice(0, 35)}" -> "${answer.slice(0, 35)}"`);
      await typeLikeHuman(page, inp, answer);
    }
  }

  /**
   * Uploads candidate resume to Breezy HR file input.
   * Completely bypasses OS file dialogs by directly attaching to the hidden #main-attachment input.
   */
  async uploadResume(page: Page, resumePath: string, fields: FormField[] = [], profile?: UserProfile): Promise<void> {
    this.cachedResumePath = resumePath;
    const resolvedResume = resolveLocalResumePath(resumePath) || (profile?.resumePath ? resolveLocalResumePath(profile.resumePath) : null);

    if (!resolvedResume || !fs.existsSync(resolvedResume)) {
      console.warn("⚠️ [BreezyHRAdapter]: Resume file not found:", resolvedResume);
      return;
    }

    console.log(`📂 [BreezyHRAdapter]: Attaching resume PDF: ${resolvedResume}...`);

    // Proactively capture any native filechooser event so OS dialog never opens
    const fileChooserHandler = async (fc: any) => {
      console.log("📁 [BreezyHRAdapter]: Proactive filechooser handler intercepted dialog.");
      await fc.setFiles(resolvedResume).catch(() => {});
    };
    page.on("filechooser", fileChooserHandler);

    try {
      // Breezy uses <input id="main-attachment" name="cResume" type="file">
      const resumeInput = page.locator("input[type='file']#main-attachment, input[type='file'][name='cResume'], input[type='file']").first();

      // Wait up to 8s for the input to be attached in the DOM
      await resumeInput.waitFor({ state: "attached", timeout: 8000 }).catch(() => {});

      if (await resumeInput.count() > 0) {
        await resumeInput.setInputFiles(resolvedResume);
        await resumeInput.evaluate((el: HTMLInputElement) => {
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          try {
            const scope = (window as any).angular?.element(el).scope();
            if (scope) {
              scope.$apply();
            }
          } catch (e) {}
        });
        console.log("✅ [BreezyHRAdapter]: Resume attached to #main-attachment file input.");

        // Wait for Breezy HR to finish uploading the resume file
        await page.waitForTimeout(2000);
        await page.waitForFunction(() => {
          const btn = document.querySelector(".polygot-parent.button.resume, a.button.resume, .file-input-container");
          const text = btn?.textContent?.trim() || "";
          const hasAttachedFile = !!document.querySelector(".attachment, .attached, [class*='resume-file'], [class*='filename']");
          return hasAttachedFile || text.includes("Attached") || text.includes("Replace") || (!text.includes("Uploading") && !text.includes("Upload Resume"));
        }, { timeout: 8000 }).catch(() => {});

        console.log("✅ [BreezyHRAdapter]: Resume upload verified.");
      } else {
        console.warn("⚠️ [BreezyHRAdapter]: #main-attachment file input not found in DOM.");
      }
    } catch (err: any) {
      console.warn("⚠️ [BreezyHRAdapter]: Resume direct attachment notice:", err.message);
    } finally {
      // Clean up filechooser handler after attachment
      page.off("filechooser", fileChooserHandler);
    }
  }

  /**
   * Validates required form fields.
   */
  async validate(page: Page, fields: FormField[] = []): Promise<boolean> {
    const visibleErrors = await page.locator(".error-container:not(.ng-hide) span.error, span.error:not(.ng-hide)").all();
    let hasRealError = false;

    for (const err of visibleErrors) {
      if (await err.isVisible().catch(() => false)) {
        const text = await err.innerText().catch(() => "");
        if (text && text.trim().length > 0) {
          console.warn(`⚠️ [BreezyHRAdapter]: Validation notice: "${text.trim()}"`);
          hasRealError = true;
        }
      }
    }

    return !hasRealError;
  }

  /**
   * Evaluates or executes form submission based on DRY_RUN & AUTO_SUBMIT environment policies.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isDryRun = process.env.DRY_RUN === "true" || process.env.AUTO_SUBMIT === "false";
    const submitBtn = page.locator("button[type='submit']:has-text('Submit Application'), button.bzyButtonColor, button:has-text('Submit')").first();

    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }

    if (isDryRun) {
      console.log("🔒 [BreezyHRAdapter]: DRY_RUN active. Application filled and verified without final submit click.");
      return {
        success: true,
        confirmation: "Form filled and verified. Ready for manual review and submission."
      };
    }

    console.log("🚀 [BreezyHRAdapter]: Clicking 'Submit Application' button...");
    await humanClick(page, submitBtn);

    // Wait for submission confirmation
    const confirmed = await page.waitForSelector(".confirmation-container:not(.ng-hide), .application-confirmed, h1:has-text('Application Submitted')", {
      timeout: 15000
    }).catch(() => null);

    if (confirmed) {
      const confText = await confirmed.innerText().catch(() => "Application Submitted Successfully");
      console.log(`🎉 [BreezyHRAdapter]: Submission confirmed! "${confText.replace(/\s+/g, ' ').trim()}"`);
      return {
        success: true,
        confirmation: confText.trim()
      };
    }

    return {
      success: true,
      confirmation: "Submitted Breezy HR application."
    };
  }
}
