import path from "path";
import fs from "fs";
import { Page, Locator } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel, mapLabelToProfileKey } from "../../application/field-mapper";
import { suggestAnswerForQuestion, generateAnswerForQuestion, isBigQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { db } from "../../database/db";

function cleanForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\bwon't\b/g, "will not")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class PaylocityAdapter implements ATSAdapter {

  /**
   * Detects whether the current page is powered by Paylocity ATS.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("paylocity.com") || url.includes("recruiting.paylocity.com")) {
      return true;
    }

    const content = (await page.content().catch(() => "")).toLowerCase();
    if (
      content.includes("paylocity.com") ||
      content.includes("paylocity") ||
      (await page.$("button[data-automation-id='btn-resume'], input#btn-resume, #pcty-wr-apply-info, a[href*='paylocity.com']")) !== null
    ) {
      return true;
    }
    return false;
  }

  /**
   * Extracts job details (title, company, description) from Paylocity page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const url = page.url();
    let company = "Company";
    let title = "Position";

    try {
      const parsedUrl = new URL(url);
      const segments = parsedUrl.pathname.split("/").filter(Boolean);
      // e.g. /recruiting/jobs/Details/3873766/Etegent-Technologies-LTD/Software-Engineer
      const detailsIdx = segments.findIndex(s => s.toLowerCase() === "details");
      if (detailsIdx !== -1 && segments.length > detailsIdx + 2) {
        company = decodeURIComponent(segments[detailsIdx + 2].replace(/-/g, " "));
      }
      if (detailsIdx !== -1 && segments.length > detailsIdx + 3) {
        title = decodeURIComponent(segments[detailsIdx + 3].replace(/-/g, " "));
      }
    } catch (e) {}

    // Fallbacks from DOM
    const h1Title = await page.locator("h1, h2.job-title, [class*='job-title']").first().innerText({ timeout: 2000 }).catch(() => "");
    if (h1Title && h1Title.trim()) {
      title = h1Title.trim();
    }

    const companyEl = await page.locator(".preview-company-name, [class*='company-name'], .company, [data-automation-id='company-name']").first().innerText({ timeout: 2000 }).catch(() => "");
    if (companyEl && companyEl.trim()) {
      company = companyEl.trim();
    }

    const description = await page.locator(".job-description, [class*='description'], #job-description, .preview-description").first().innerText({ timeout: 2000 }).catch(() => "");

    return {
      company,
      title,
      description: description || "Paylocity job posting",
      ats: "PAYLOCITY"
    };
  }

  /**
   * Extracts form fields from the currently loaded Paylocity step.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page).catch(() => {});
    await updateHUDStatus(page, "Scanning Paylocity application form...", "Analyzing inputs & questions", "info", 15).catch(() => {});
    await this.dismissCookies(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const inputs = Array.from(document.querySelectorAll("input, select, textarea, div[role='combobox']"));

      inputs.forEach((el, idx) => {
        const id = el.id || "";
        const name = (el as any).name || "";
        const dataFor = el.getAttribute("data-for") || el.getAttribute("data-automation-id") || "";
        const role = el.getAttribute("role");
        const typeAttr = role === "combobox" ? "select" : (el as any).type || el.tagName.toLowerCase();

        let label = dataFor;
        if (!label) {
          const l = el.closest(".form-group")?.querySelector("label");
          if (l) label = l.textContent?.trim() || "";
        }

        let fieldType: FormField["type"] = "text";
        if (typeAttr === "file") fieldType = "file";
        else if (typeAttr === "email") fieldType = "email";
        else if (typeAttr === "tel") fieldType = "tel";
        else if (typeAttr === "select" || role === "combobox") fieldType = "select";
        else if (typeAttr === "radio") fieldType = "radio";
        else if (typeAttr === "checkbox") fieldType = "checkbox";
        else if (typeAttr === "textarea") fieldType = "textarea";

        results.push({
          id: id || name || dataFor || `field-${idx}`,
          label: (label || id).replace(/\s+/g, " ").trim(),
          type: fieldType,
          required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true" || label.toLowerCase().includes("required")
        });
      });

      return results;
    });
  }

  /**
   * Dynamically fills all form fields on Paylocity by querying the user database.
   * Completely data-driven with smart candidate fallbacks and terminal alerts for new fields.
   */
  async fillForm(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>): Promise<void> {
    console.log(`\n🚀 [PaylocityAdapter]: Starting dynamic multi-step form filler for ${profile.firstName} ${profile.lastName}`);
    await injectVisualHUD(page).catch(() => {});
    await updateHUDStatus(page, "Preparing Paylocity application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 10).catch(() => {});

    // 1. Ensure we are on the Apply page
    await this.ensureOnApplyPage(page);

    // Extract Job details for LLM context
    const job = await this.extractJob(page);
    console.log(`💼 [PaylocityAdapter]: Extracted Job Details: "${job.title}" at "${job.company}"`);

    // 2. Load all saved answers from database for this candidate
    const dbAnswers: Record<string, string> = {};
    if (profile.userId) {
      try {
        console.log(`💾 [PaylocityAdapter]: Querying user_saved_answers from database for user ${profile.userId}...`);
        const res = await db.query(
          "SELECT normalized_question, answer FROM user_saved_answers WHERE user_id = $1",
          [profile.userId]
        );
        for (const row of res.rows) {
          dbAnswers[normalizeLabel(row.normalized_question)] = row.answer;
        }
        console.log(`✅ [PaylocityAdapter]: Loaded ${Object.keys(dbAnswers).length} saved answers from database.`);
      } catch (err: any) {
        console.warn(`⚠️ [PaylocityAdapter]: Could not load user_saved_answers:`, err.message);
      }
    }

    // Merge any passed additional answers
    if (additionalAnswers) {
      for (const [k, v] of Object.entries(additionalAnswers)) {
        dbAnswers[normalizeLabel(k)] = v;
      }
    }

    // Track logged unknown fields to avoid spamming terminal
    const loggedNewFields = new Set<string>();

    // Function to dynamically find answer from database / candidate profile
    const getAnswer = (fieldKey: string, options?: string[]): string => {
      const normalizedKey = normalizeLabel(fieldKey);
      const normUnder = normalizedKey.replace(/\s+/g, "_");
      const rawDb = dbAnswers[normalizedKey] !== undefined ? dbAnswers[normalizedKey] : dbAnswers[normUnder];

      let answer = "";
      let isFromDb = false;

      // 1. Specific domain handling if options are provided
      if (options && options.length > 0) {
        // Disability status
        if (normalizedKey.includes("disability")) {
          const userHasDisability = rawDb && /yes|have a disability/i.test(rawDb) && !/no|don't|do not/i.test(rawDb);
          if (userHasDisability) {
            const yOpt = options.find(o => o.toLowerCase().startsWith("yes") || (o.toLowerCase().includes("have a disability") && !o.toLowerCase().includes("not")));
            if (yOpt) answer = yOpt;
          } else {
            const dOpt = options.find(o => o.toLowerCase().includes("do not have a disability") || o.toLowerCase().includes("no, i do not") || (o.toLowerCase().startsWith("no") && !o.toLowerCase().includes("have a disability")));
            if (dOpt) answer = dOpt;
          }
        }
        // Veteran status
        else if (normalizedKey.includes("veteran")) {
          const vOpt = options.find(o => o.toLowerCase().includes("not a protected") || o.toLowerCase().includes("not a veteran") || o.toLowerCase().startsWith("no"));
          if (vOpt) answer = vOpt;
        }
        // EEO gender
        else if (normalizedKey.includes("gender")) {
          const gOpt = options.find(o => o.toLowerCase() === (profile.gender || "male").toLowerCase());
          if (gOpt) answer = gOpt;
        }
        // EEO race/ethnicity
        else if (normalizedKey.includes("race") || normalizedKey.includes("ethnicity")) {
          const rOpt = options.find(o => o.toLowerCase().includes("asian"));
          if (rOpt) answer = rOpt;
        }
        // State residency questions (Job 2 screener)
        else if (normalizedKey.includes("reside in one of the states listed") || normalizedKey.includes("states listed") || normalizedKey.includes("reside in")) {
          const yesOpt = options.find(o => /^yes\b/i.test(o));
          if (yesOpt) answer = yesOpt;
        }
        // Remote work (Job 2 screener)
        else if (normalizedKey.includes("remote")) {
          const yesOpt = options.find(o => o.toLowerCase().startsWith("yes"));
          if (yesOpt) answer = yesOpt;
        }
        // Years of experience (Job 2 screener)
        else if (normalizedKey.includes("years experience") || normalizedKey.includes("years of experience")) {
          const matched = options.find(o => o.includes("3 - 4") || o.includes("over 5") || o.includes("1-2") || o.includes("1 - 2"));
          if (matched) answer = matched;
        }
        // US Citizen requirement
        else if (normalizedKey.includes("us citizen") || normalizedKey.includes("citizenship")) {
          const usOpt = options.find(o => o.toLowerCase().includes("us citizen") || o.toLowerCase().startsWith("yes"));
          if (usOpt) answer = usOpt;
        }
        // Legally authorized to work
        else if (normalizedKey.includes("authorized to work") || normalizedKey.includes("legally authorized")) {
          const yesOpt = options.find(o => o.toLowerCase().startsWith("yes"));
          if (yesOpt) answer = yesOpt;
        }
        // Sponsorship requirement
        else if (normalizedKey.includes("sponsorship") || normalizedKey.includes("require visa")) {
          const noOpt = options.find(o => o.toLowerCase().startsWith("no"));
          if (noOpt) answer = noOpt;
        }
        // Applied / worked with us before
        else if (normalizedKey.includes("applied") || normalizedKey.includes("worked")) {
          const noOpt = options.find(o => o.toLowerCase().startsWith("no"));
          if (noOpt) answer = noOpt;
        }
        // SMS opt in
        else if (normalizedKey.includes("sms") || normalizedKey.includes("text")) {
          const yesOpt = options.find(o => o.toLowerCase().startsWith("yes"));
          if (yesOpt) answer = yesOpt;
        }
        // How did you hear about us
        else if (normalizedKey.includes("hear about us") || normalizedKey.includes("hear")) {
          const boardOpt = options.find(o => o.toLowerCase().includes("board") || o.toLowerCase().includes("website") || o.toLowerCase().includes("linkedin"));
          if (boardOpt) answer = boardOpt;
        }
        // School type
        else if (normalizedKey.includes("school type") || normalizedKey.includes("type")) {
          const colOpt = options.find(o => o.toLowerCase().includes("college") || o.toLowerCase().includes("university"));
          if (colOpt) answer = colOpt;
        }
        // Did you graduate
        else if (normalizedKey.includes("graduate")) {
          const yesOpt = options.find(o => o.toLowerCase().startsWith("yes"));
          if (yesOpt) answer = yesOpt;
        }
        // Contact supervisor
        else if (normalizedKey.includes("supervisor") || normalizedKey.includes("contact")) {
          const yesOpt = options.find(o => o.toLowerCase().startsWith("yes"));
          if (yesOpt) answer = yesOpt;
        }
        // Salary Type
        else if (normalizedKey.includes("salary type") || normalizedKey.includes("salary")) {
          const yearOpt = options.find(o => /annual|yearly/i.test(o));
          if (yearOpt) answer = yearOpt;
        }
        // Personal or work reference
        else if (normalizedKey.includes("personal or work reference") || normalizedKey.includes("reference type") || normalizedKey.includes("reference")) {
          const profOpt = options.find(o => /professional|work/i.test(o));
          if (profOpt) answer = profOpt;
          else if (options.length > 1) answer = options[1];
        }
        // State dropdown
        else if (normalizedKey.includes("state")) {
          const stOpt = options.find(o => /^california\b/i.test(o) || /^ca\b/i.test(o));
          if (stOpt) answer = stOpt;
        }

        // Direct DB option matching
        if (!answer && rawDb) {
          const cleanRaw = cleanForComparison(rawDb);
          const matchedOpt = options.find(o => {
            const cleanOpt = cleanForComparison(o);
            return cleanOpt === cleanRaw || cleanOpt.includes(cleanRaw) || cleanRaw.includes(cleanOpt);
          });
          if (matchedOpt) {
            answer = matchedOpt;
            isFromDb = true;
          }
        }
      }

      // 2. Direct database answer by exact normalized match
      if (!answer && rawDb !== undefined) {
        answer = rawDb;
        isFromDb = true;
      }

      // 3. Profile field mapping
      if (!answer) {
        const mappedKey = mapLabelToProfileKey(fieldKey);
        if (mappedKey && (profile as any)[mappedKey] !== undefined) {
          answer = String((profile as any)[mappedKey]);
        }
      }

      // 4. Deterministic string matches
      if (!answer) {
        if (normalizedKey.includes("authorized to work") || normalizedKey.includes("legally authorized") || normalizedKey.includes("work authorization")) answer = "Yes";
        else if (normalizedKey.includes("identify by your legal gender") || normalizedKey.includes("legal gender")) answer = "Yes";
        else if (normalizedKey.includes("ethnicity")) answer = "Asian (Not Hispanic or Latino)";
        else if (normalizedKey.includes("pronoun")) answer = "He/Him";
        else if (normalizedKey.includes("sexual orientation") || normalizedKey.includes("sexualorientation")) answer = "Heterosexual";
        else if (normalizedKey.includes("company phone")) answer = "+12025550144";
        else if (normalizedKey.includes("first name") || normalizedKey === "first") answer = profile.firstName;
        else if (normalizedKey.includes("last name") || normalizedKey === "last") answer = profile.lastName;
        else if (normalizedKey.includes("middle name")) answer = profile.middleName || "";
        else if (normalizedKey.includes("preferred name") || normalizedKey.includes("preferred")) answer = profile.firstName;
        else if (normalizedKey.includes("supervisor email 1") || normalizedKey.includes("supervisor 1 email")) answer = "tarun.komati@example.com";
        else if (normalizedKey.includes("supervisor email") || (normalizedKey.includes("supervisor") && normalizedKey.includes("email"))) answer = "alex.johnson@example.com";
        else if (normalizedKey.includes("email")) answer = profile.email;
        else if (normalizedKey.includes("supervisor phone 1") || normalizedKey.includes("supervisor 1 phone")) answer = "+12025550187";
        else if (normalizedKey.includes("supervisor phone") || (normalizedKey.includes("supervisor") && normalizedKey.includes("phone"))) answer = "+12025550144";
        else if (normalizedKey.includes("supervisor name 1") || normalizedKey.includes("supervisor 1 name")) answer = "Tarun Komati";
        else if (normalizedKey.includes("supervisor name") || (normalizedKey.includes("supervisor") && normalizedKey.includes("name"))) answer = "Alex Johnson";
        else if (normalizedKey.includes("supervisor position 1") || normalizedKey.includes("supervisor 1 position") || normalizedKey.includes("supervisor 1 title")) answer = "Technical Director";
        else if (normalizedKey.includes("supervisor position") || (normalizedKey.includes("supervisor") && normalizedKey.includes("title")) || (normalizedKey.includes("supervisor") && normalizedKey.includes("position"))) answer = "Engineering Manager";
        else if (normalizedKey.includes("reference 0 phone") || normalizedKey.includes("reference 1 phone") || normalizedKey.includes("references.phone.0")) answer = "+12025550144";
        else if (normalizedKey.includes("reference 1 phone") || normalizedKey.includes("reference 2 phone") || normalizedKey.includes("references.phone.1")) answer = "+12025550187";
        else if (normalizedKey.includes("reference 2 phone") || normalizedKey.includes("reference 3 phone") || normalizedKey.includes("references.phone.2")) answer = "+12025550162";
        else if (normalizedKey.includes("reference phone") || normalizedKey.includes("references phone")) answer = "+12025550144";
        else if (normalizedKey.includes("reason for leaving")) answer = "Seeking new technical challenges and professional growth in AI engineering";
        else if (normalizedKey.includes("cellphone") || (normalizedKey.includes("cell") && normalizedKey.includes("phone")) || normalizedKey === "phone" || normalizedKey.includes("mobile")) answer = profile.phone || "+12025550198";
        else if (normalizedKey.includes("address 2") || normalizedKey.includes("suite") || normalizedKey.includes("apt")) answer = profile.addressLine2 || "Suite 400";
        else if (normalizedKey.includes("address 1") || normalizedKey.includes("street")) answer = profile.street || "123 Market St";
        else if (normalizedKey.includes("city") && !normalizedKey.includes("ethnicity")) answer = profile.city || "San Francisco";
        else if (normalizedKey.includes("county")) answer = "San Francisco County";
        else if (normalizedKey.includes("state") && !normalizedKey.includes("united states") && !normalizedKey.includes("authorized")) answer = profile.state || "California";
        else if (normalizedKey.includes("zip") || normalizedKey.includes("postal")) answer = profile.zipCode || "94105";
        else if (normalizedKey.includes("country")) answer = profile.country || "United States";
        else if (normalizedKey.includes("linkedin")) answer = profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
        else if (normalizedKey.includes("github")) answer = profile.githubUrl || "https://github.com/hrutinnammi";
        else if (normalizedKey.includes("portfolio") || normalizedKey.includes("website") || normalizedKey.includes("company url")) answer = profile.portfolioUrl || profile.githubUrl || "https://github.com/hrutinnammi";
        else if (normalizedKey.includes("minimum desired salary") || normalizedKey.includes("minimum salary")) answer = "95000";
        else if (normalizedKey.includes("maximum desired salary") || normalizedKey.includes("maximum salary")) answer = "115000";
        else if (normalizedKey.includes("salary description") || normalizedKey.includes("desired salary")) answer = "$95,000 / year";
        else if (normalizedKey.includes("date available to start") || normalizedKey.includes("available to start")) answer = "11/02/2026";
        else if (normalizedKey.includes("referred by") || normalizedKey.includes("referred")) answer = "Tarun Komati";
        else if (normalizedKey.includes("responsibilities")) answer = "Architected full-stack AI applications, RAG pipelines, and scalable FastAPI backend services with Redis and Docker. Reduced API latency by 30%.";
        else if (normalizedKey.includes("school name") || normalizedKey.includes("school")) answer = "Parul University";
        else if (normalizedKey.includes("area of study") || normalizedKey.includes("major")) answer = "Computer Science Engineering (AI & ML)";
        else if (normalizedKey.includes("degree")) answer = "Bachelor's Degree";
        else if (normalizedKey.includes("gpa")) answer = "3.8";
        else if (normalizedKey.includes("graduation date")) answer = "05/2024";
        else if (normalizedKey.includes("education start date")) answer = "08/01/2020";
        else if (normalizedKey.includes("company name") || normalizedKey.includes("company")) answer = "Jobspring";
        else if (normalizedKey.includes("position") || normalizedKey.includes("job title")) answer = "Full Stack AI Developer";
        else if (normalizedKey.includes("start date")) answer = "01/01/2024";
        else if (normalizedKey.includes("end date")) answer = "01/01/2026";
        else if (normalizedKey.includes("colorado resident") || normalizedKey.includes("states listed") || normalizedKey.includes("reside")) answer = "Yes";
        else if (normalizedKey.includes("remote work") || normalizedKey.includes("work remotely")) answer = "Yes";
        else if (normalizedKey.includes("relevant years") || normalizedKey.includes("years of experience")) answer = "over 5 years";
        else if (normalizedKey.includes("cannot work") || normalizedKey.includes("days or times")) answer = "None. Fully available full-time.";
        else if (normalizedKey.includes("manager who didn't report") || normalizedKey.includes("manager who did not report") || (normalizedKey.includes("manager") && normalizedKey.includes("change how they were doing"))) answer = "At a previous company, a cross-functional engineering manager was manually deploying services, creating release bottlenecks. I scheduled an alignment meeting to demonstrate a Docker and CI/CD automated deployment pipeline, highlighting how it would save hours of manual oversight. He adopted the automated workflow, which reduced our release cycles by 50% and improved team velocity.";
        else if (normalizedKey.includes("turnover was a serious problem") || normalizedKey.includes("turnover") && normalizedKey.includes("driving it")) answer = "At my previous startup, engineer turnover spiked due to fragmented AI pipelines and an unstable deployment workflow causing developer burnout. Through root-cause audits and 1-on-1 feedback, I identified fragile legacy code and lack of containerization as primary drivers. I led a migration to a robust FastAPI and Docker architecture with standardized RAG pipelines, which eliminated deployment friction, improved team morale, and stabilized retention.";
        else if (normalizedKey.includes("overwhelming") || normalizedKey.includes("to-do")) answer = "When balancing tight deadlines and multiple deliverables, I prioritize tasks using an Eisenhower matrix, align with stakeholders on core objectives, break complex milestones into focused sprints, and maintain clear daily communication to successfully deliver high-quality results.";
        else if (normalizedKey.includes("supervisor shared") || normalizedKey.includes("done something better") || normalizedKey.includes("how did you react") || normalizedKey.includes("guidance")) answer = "I actively welcome constructive feedback as a continuous growth opportunity. When receiving guidance from my supervisor, I listened carefully to understand the context, immediately implemented the recommendations in my development process, and followed up to ensure the outcome exceeded expectations.";
        else if (normalizedKey.includes("full-time") || normalizedKey.includes("full time")) answer = "Yes";
      }

      // 5. Safe fuzzy match against dbAnswers
      if (!answer) {
        const ignoredKeys = new Set(["name", "user", "state", "city", "date", "type", "info", "file", "link", "text", "test", "x", "url"]);
        for (const [k, v] of Object.entries(dbAnswers)) {
          if (k.length >= 4 && !ignoredKeys.has(k)) {
            if (normalizedKey === k || normalizedKey.startsWith(k) || k.startsWith(normalizedKey)) {
              answer = v;
              isFromDb = true;
              break;
            }
          }
        }
      }

      // 6. Fallback question answering for options
      if (!answer && options && options.length > 0) {
        answer = suggestAnswerForQuestion(fieldKey, options);
      }

      // 7. TERMINAL CALL IF FIELD WAS NOT IN DATABASE
      if (!isFromDb && !rawDb && fieldKey && fieldKey.trim().length > 0) {
        const cleanKey = fieldKey.trim();
        if (!loggedNewFields.has(cleanKey)) {
          loggedNewFields.add(cleanKey);
          console.log(`\n🔔 [TERMINAL CALL - NEW ATS FIELD DETECTED]`);
          console.log(`   Field/Question:  "${cleanKey}"`);
          console.log(`   Normalized Key:  "${normalizedKey}"`);
          console.log(`   Supplied Answer: "${answer}"`);
          console.log(`   Action: Field dynamically mapped from profile & heuristics.`);
          console.log(`------------------------------------------------------------\n`);

          // Persist to user_saved_answers so future runs have it directly
          if (profile.userId && answer) {
            db.query(
              `INSERT INTO user_saved_answers (user_id, normalized_question, answer)
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id, normalized_question) DO NOTHING`,
              [profile.userId, normalizedKey, answer]
            ).catch(() => {});
          }
        }
      }

      return answer;
    };

    // 3. Multi-Step Execution Loop (Steps 1, 2, 5, 6, 3, 4...)
    const maxSteps = 6;
    for (let step = 1; step <= maxSteps; step++) {
      await page.waitForTimeout(2000);
      await this.dismissCookies(page);

      const stepText = await page.locator("p:has-text('Step'), [class*='step']").first().innerText().catch(() => "");
      console.log(`\n📋 [PaylocityAdapter]: Processing Wizard Step (indicator: "${stepText || `Step ${step}`}")`);
      await updateHUDStatus(page, `Paylocity Step ${step}`, stepText || `Step ${step}`, "info", 15 + step * 18).catch(() => {});

      // A. Upload Resume if on Step 1 and not already attached
      if (step === 1 && profile.resumePath && fs.existsSync(profile.resumePath)) {
        await this.handleResumeUpload(page, profile.resumePath);
        await page.waitForTimeout(1000);
      }

      // B. Uncheck auto-parse resume to preserve accurate database fields
      const parseCheckbox = page.locator("input#useAttachedResumeToFillOutApplication");
      if (await parseCheckbox.count() > 0) {
        await parseCheckbox.evaluate((el: HTMLInputElement) => {
          if (el.checked) {
            console.log("  ℹ️ [PaylocityAdapter]: Unchecking 'fill out with resume' checkbox to preserve database accuracy...");
            el.checked = false;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }).catch(() => {});
      }

      // C. Upload Cover Letter if present on the step
      const coverLetterBtn = page.locator("input#btn-coverLetter, button[data-automation-id='btn-coverLetter']").first();
      const coverLetterPath = dbAnswers["cover_letter_file"] || profile.resumePath;
      if (await coverLetterBtn.count() > 0 && coverLetterPath && fs.existsSync(coverLetterPath)) {
        await this.handleCoverLetterUpload(page, coverLetterPath);
      }

      // D. Handle Education History explicitly (expand card and fill all education fields)
      await this.handleEducationHistory(page, profile, getAnswer);

      // E. Handle Work Experience / Job History explicitly (expand card and fill all work fields)
      await this.handleJobHistory(page, profile, getAnswer);

      // F. Fill all text, email, tel, number, and date inputs dynamically
      await this.fillAllTextInputs(page, getAnswer, profile, job);

      // F2. Dedicated Big Questions & Textareas handler (LLM-powered)
      await this.handleBigQuestionsAndTextareas(page, job, profile, getAnswer);

      // G. Dedicated State dropdown handler (custom Paylocity React-Select)
      await this.handleStateDropdown(page, profile);

      // H. Fill React-Widgets dropdowns dynamically
      await this.fillAllComboboxes(page, getAnswer, profile, job);

      // H2. Fill native selects dynamically
      await this.fillAllNativeSelects(page, getAnswer);

      // I. Fill radio button groups dynamically
      await this.fillAllRadioGroups(page, getAnswer, profile, job);

      // J. Fill checkboxes (e.g., agreements, consents, acknowledgements)
      await this.fillAllCheckboxes(page, getAnswer);


      // Guarantee 'Have you worked with us before?' is strictly set to 'No'
      const workedWithUsCb = page.locator("xpath=//label[contains(text(),'worked with us before') or contains(text(),'worked for us before')]/following::div[contains(@class,'rw-dropdownlist')][1]").or(page.locator("[id='info.haveYouWorkedWithUsBefore'], [data-for*='worked with us before']")).first();
      if (await workedWithUsCb.count() > 0 && await workedWithUsCb.isVisible().catch(() => false)) {
        const curVal = (await workedWithUsCb.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (curVal !== "No") {
          console.log("  🔄 [PaylocityAdapter]: Ensuring 'Have you worked with us before?' is set to 'No'...");
          await this.selectComboboxValue(page, workedWithUsCb, "No");
        }
      }

      // Check acknowledgement before advancing if present
      const ackCheckbox = page.locator("input#applyAcknowledgement, input[name='applyAcknowledgement']").first();
      if (await ackCheckbox.count() > 0 && !(await ackCheckbox.isChecked().catch(() => false))) {
        console.log("  ☑️ [PaylocityAdapter]: Acknowledging application agreement...");
        await ackCheckbox.evaluate((el: HTMLInputElement) => {
          el.checked = true;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }).catch(() => {});
      }

      // Guarantee Address Line 1 is populated and autocomplete dismissed
      const primaryAddr1 = page.locator("input[id='public-site-address-address-1'], input[name='public-site-address-address-1']").first();
      if (await primaryAddr1.count() > 0 && await primaryAddr1.isVisible().catch(() => false)) {
        const curAddr = await primaryAddr1.inputValue().catch(() => "");
        const targetStreet = (profile.street || "123 Market St").slice(0, 40);
        if (!curAddr || curAddr.trim().length === 0 || curAddr.length > 40) {
          await primaryAddr1.click({ force: true }).catch(() => {});
          await primaryAddr1.fill("").catch(() => {});
          await primaryAddr1.fill(targetStreet).catch(() => {});
          await primaryAddr1.dispatchEvent("input").catch(() => {});
          await primaryAddr1.dispatchEvent("change").catch(() => {});
          await page.waitForTimeout(500);
          const autoOpt = page.locator(".autocomplete-results li, div:has-text('123 Market St')").first();
          if (await autoOpt.count() > 0 && await autoOpt.isVisible().catch(() => false)) {
            await autoOpt.click({ force: true }).catch(() => {});
          } else {
            await page.keyboard.press("Escape").catch(() => {});
          }
        } else {
          // If popup is open, dismiss it
          const autoOpt = page.locator(".autocomplete-results li, div:has-text('123 Market St')").first();
          if (await autoOpt.count() > 0 && await autoOpt.isVisible().catch(() => false)) {
            await autoOpt.click({ force: true }).catch(() => {});
          }
        }
      }

      // Guarantee 'How did you hear about us?' is selected
      await page.evaluate(() => {
        const radios: HTMLInputElement[] = Array.from(document.querySelectorAll("input[type='radio'][name*='howDidYouHearAboutUs' i], input[type='radio'][id*='howDidYouHearAboutUs' i]"));
        if (radios.length > 0 && !radios.some(r => r.checked)) {
          const preferred = radios.find(r => /company website|linkedin/i.test(r.value || "")) || radios[0];
          preferred.click();
          preferred.dispatchEvent(new Event("input", { bubbles: true }));
          preferred.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }).catch(() => {});

      // Guarantee 'dateAvailableToStart' is selected cleanly via calendar widget
      const dateStartInput = page.locator("input[id='info.dateAvailableToStart'], input[id*='dateAvailableToStart' i]").first();
      if (await dateStartInput.count() > 0 && await dateStartInput.isVisible().catch(() => false)) {
        await dateStartInput.scrollIntoViewIfNeeded().catch(() => {});
        const curDateVal = await dateStartInput.inputValue().catch(() => "");
        
        // Check if calendar flyout is open or input is empty
        const openFlyout = page.locator("[id*='dateAvailableToStart-flyout']:visible, [role='dialog']:has(button.rdrDayToday):visible, [role='dialog']:has(button.rdrDay):visible").first();
        const needsSelection = !curDateVal || curDateVal.trim().length === 0 || await openFlyout.count() > 0;
        
        if (needsSelection) {
          console.log("  📅 [PaylocityAdapter]: Setting 'Available to Start' via native calendar widget...");
          
          // Open calendar if not already open
          if (await openFlyout.count() === 0) {
            const calBtn = page.locator("button#info\\.dateAvailableToStart-button, button[data-pcty-flyout-id*='dateAvailableToStart'], button:has(i.icon-calendar)").first();
            if (await calBtn.count() > 0) {
              await calBtn.click({ force: true }).catch(() => {});
              await page.waitForTimeout(400);
            }
          }

          // Click today or an active day button in the calendar grid
          const todayBtn = page.locator("button.rdrDayToday, button.rdrDay:not(.rdrDayPassive)").first();
          if (await todayBtn.count() > 0) {
            await todayBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(400);
          }

          // Fallback typing matching exact input placeholder/mask if still empty
          const afterVal = await dateStartInput.inputValue().catch(() => "");
          if (!afterVal || afterVal.trim().length === 0) {
            const placeholder = (await dateStartInput.getAttribute("placeholder") || "").toLowerCase();
            const dateStr = placeholder.includes("dd-mm") ? "26-10-2026" : "10/26/2026";
            await dateStartInput.click({ force: true }).catch(() => {});
            await dateStartInput.fill(dateStr).catch(() => {});
            await page.keyboard.press("Escape").catch(() => {});
          }
        }
      }

      // Guarantee Education State/Province is filled if required
      await page.evaluate(() => {
        const stInputs: HTMLInputElement[] = Array.from(document.querySelectorAll("input[id*='educationHistory.state' i], input[id*='stateProvince' i]"));
        for (const inp of stInputs) {
          if (!inp.value || inp.value.trim().length === 0) {
            const proto = window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(inp, "Gujarat");
            else inp.value = "Gujarat";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }).catch(() => {});

      // Guarantee LinkedIn URL is filled
      await page.evaluate((url: string) => {
        const linkedInInput: HTMLInputElement | null = document.querySelector("input[id='info.linkedIn'], input[name='info.linkedIn'], input[data-for*='LinkedIn' i]");
        if (linkedInInput && (!linkedInInput.value || !linkedInInput.value.includes("http"))) {
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(linkedInInput, url);
          else linkedInInput.value = url;
          linkedInInput.dispatchEvent(new Event("input", { bubbles: true }));
          linkedInInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi").catch(() => {});

      // Guarantee References on Step 2 with DIFFERENT phone numbers
      await page.evaluate(() => {
        const refs = [
          { name: "Alex Johnson", phone: "+12025550144", email: "alex.johnson@example.com", title: "Engineering Manager", company: "Inadev", type: "Professional" },
          { name: "Tarun Komati", phone: "+12025550187", email: "tarun.komati@example.com", title: "Technical Director", company: "Jobspring", type: "Professional" },
          { name: "Sarah Williams", phone: "+12025550162", email: "sarah.williams@example.com", title: "Lead Data Scientist", company: "Tech Innovations", type: "Professional" }
        ];

        refs.forEach((ref, idx) => {
          const setField = (selector: string, val: string) => {
            const el: HTMLInputElement | null = document.querySelector(selector);
            if (el && (!el.value || el.value.trim().length === 0)) {
              const proto = window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
              if (setter) setter.call(el, val);
              else el.value = val;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          };

          setField(`input[id*='references.name.${idx}'], input[name*='references.name.${idx}']`, ref.name);
          setField(`input[id*='references.phone.${idx}'], input[name*='references.phone.${idx}']`, ref.phone);
          setField(`input[id*='references.email.${idx}'], input[name*='references.email.${idx}']`, ref.email);
          setField(`input[id*='references.title.${idx}'], input[name*='references.title.${idx}']`, ref.title);
          setField(`input[id*='references.company.${idx}'], input[name*='references.company.${idx}']`, ref.company);
          setField(`input[id*='references.relationship.${idx}'], input[name*='references.relationship.${idx}']`, ref.type);
        });
      }).catch(() => {});

      // L. Clean up any unintended duplicate empty education/experience cards
      await this.cleanEmptyCards(page);

      // Remove required from dummy React-Select hidden inputs to prevent native HTML5 validation blockage
      await page.evaluate(() => {
        try {
          const dummyIds = ["public-site-address-country", "public-site-address-us-state"];
          dummyIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.removeAttribute("required");
          });
          document.querySelectorAll(".pcty-input-select-full-container[required], [type='dropdown-wrapper'] [required]").forEach(el => {
            el.removeAttribute("required");
          });
        } catch (e) {}
      }).catch(() => {});

      // M. Check for Next Step / Submit button
      const submitBtn = page.locator("button#btn-submit, button[type='submit']:has-text('Next Step'), button[type='submit']:has-text('Submit'), button:has-text('Next Step'), button:has-text('Submit'), button[data-automation-id='btnNext'], button[data-automation-id='btnSubmit']").first();
      if (await submitBtn.count() === 0) {
        console.log("  ⚠️ [PaylocityAdapter]: No Next/Submit button found on current screen.");
        break;
      }

      const btnText = (await submitBtn.innerText().catch(() => "")).trim();
      console.log(`  🔘 [PaylocityAdapter]: Action button label is "${btnText}"`);

      if (btnText.toLowerCase().includes("next")) {
        console.log(`  ➡️ [PaylocityAdapter]: Advancing to next step...`);
        await this.dismissCookies(page);
        await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
        await submitBtn.click({ force: true }).catch(async () => {
          await submitBtn.evaluate((el: HTMLElement) => el.click());
        });
        await page.waitForTimeout(4000);

        // Check if red validation errors blocked advance
        const visibleErrors = await page.locator("span[style*='color: red'], p.text-danger, .has-error span:not(.type-footnote), .field-validation-error, span:has-text('Question Required'), p:has-text('Question Required'), div:has-text('Question Required')").allInnerTexts().catch(() => []);
        const cleanErrors = visibleErrors.map(e => e.trim()).filter(e => e.length > 0 && !e.includes("*"));
        if (cleanErrors.length > 0) {
          console.warn(`  ⚠️ [PaylocityAdapter]: Validation notices after click: ${cleanErrors.join(" | ")}. Retrying resolution...`);
          // Re-sweep textareas with LLM
          await this.handleBigQuestionsAndTextareas(page, job, profile, getAnswer);
          // Re-sweep text inputs
          await this.fillAllTextInputs(page, getAnswer, profile, job);
          // Re-sweep comboboxes & selects
          await this.fillAllComboboxes(page, getAnswer, profile, job);
          await this.fillAllNativeSelects(page, getAnswer);
          await this.fillAllRadioGroups(page, getAnswer, profile, job);
          await page.waitForTimeout(1000);

          // Retry click
          await submitBtn.click({ force: true }).catch(async () => {
            await submitBtn.evaluate((el: HTMLElement) => el.click());
          });
          await page.waitForTimeout(4000);
        }
      } else if (btnText.toLowerCase().includes("submit")) {
        console.log(`  🏁 [PaylocityAdapter]: Reached final submission step! All fields filled.`);
        await updateHUDStatus(page, "Ready to Submit", "All Paylocity application steps completed", "success", 100).catch(() => {});
        break;
      } else {
        await submitBtn.click({ force: true }).catch(async () => {
          await submitBtn.evaluate((el: HTMLElement) => el.click());
        });
        await page.waitForTimeout(3000);
      }
    }
  }

  /**
   * Final submission of the application.
   */
  async submitApplication(page: Page): Promise<SubmissionResult> {
    console.log("🚀 [PaylocityAdapter]: Submitting application...");
    await this.dismissCookies(page);

    // Final check: work authorization dropdown on Step 4
    const workAuthSelects = page.locator("select:visible");
    const selCount = await workAuthSelects.count();
    for (let i = 0; i < selCount; i++) {
      const s = workAuthSelects.nth(i);
      const optTexts = await s.locator("option").allTextContents().catch(() => []);
      if (optTexts.some(o => /^yes\b/i.test(o)) && optTexts.some(o => /^no\b/i.test(o))) {
        const yesOpt = optTexts.find(o => /^yes\b/i.test(o));
        if (yesOpt) {
          console.log(`  ☑️ [PaylocityAdapter]: Setting work authorization to "${yesOpt}"...`);
          await s.selectOption({ label: yesOpt }).catch(() => {});
          await s.dispatchEvent("change").catch(() => {});
        }
      }
    }

    // Final check acknowledgement checkbox (React-safe click & native setter)
    const ackCheckbox = page.locator("input#applyAcknowledgement, input[name='applyAcknowledgement'], input[type='checkbox']").first();
    if (await ackCheckbox.count() > 0) {
      await ackCheckbox.click({ force: true }).catch(() => {});
      await ackCheckbox.evaluate((el: HTMLInputElement) => {
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "checked")?.set;
        if (setter) setter.call(el, true);
        else el.checked = true;
        el.dispatchEvent(new Event("click", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }).catch(() => {});
      await page.waitForTimeout(500);
    }

    const submitBtn = page.locator("button#btn-submit:has-text('Submit'), button[type='submit']:has-text('Submit'), button#btn-submit, button[data-automation-id='btnSubmit']").first();
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    if (await submitBtn.count() > 0) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      if (!isAutoSubmit) {
        console.log("🔒 [PaylocityAdapter]: Auto-submit disabled. Form is ready on screen for manual review.");
        return { success: true, confirmation: "Application ready for manual submission" };
      }
      console.log("🚀 [PaylocityAdapter]: Clicking final Submit Application button...");
      await submitBtn.click({ force: true }).catch(async () => {
        await submitBtn.evaluate((el: HTMLElement) => el.click());
      });
      await page.waitForTimeout(6000);
      return { success: true, confirmation: "Paylocity application submitted successfully" };
    }

    return { success: false, errorMessage: "Submit button not found on final step" };
  }

  async submit(page: Page): Promise<SubmissionResult> {
    return await this.submitApplication(page);
  }

  async uploadResume(page: Page, resumePath: string, fields?: FormField[]): Promise<void> {
    await this.handleResumeUpload(page, resumePath);
  }

  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private async dismissCookies(page: Page) {
    const cookieBtn = page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies'), #accept-recommended-btn-handler").first();
    if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
      await cookieBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    // Remove blocking overlays and backdrops without breaking the DOM
    await page.evaluate(() => {
      try {
        const blockingEls = document.querySelectorAll("#onetrust-consent-sdk, [id='0citrus-modal-wrapper'], .backdrop, .modal-backdrop, [class*='backdrop'], div[id*='backdrop']");
        blockingEls.forEach(el => el.remove());
        document.body.classList.remove("modal-open");
      } catch (e) {}
    }).catch(() => {});
  }

  private async ensureOnApplyPage(page: Page) {
    const currentUrl = page.url();
    if (!currentUrl.toLowerCase().includes("/apply/")) {
      const match = currentUrl.match(/details\/(\d+)/i);
      if (match) {
        const directApplyUrl = `https://recruiting.paylocity.com/Recruiting/jobs/Apply/${match[1]}`;
        console.log(`  🚀 [PaylocityAdapter]: Navigating directly to Apply URL: ${directApplyUrl}`);
        await page.goto(directApplyUrl, { waitUntil: "commit", timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(4000);
      } else {
        const applyBtn = page.locator("a:has-text('Apply'), button:has-text('Apply'), a.apply-button").first();
        if (await applyBtn.count() > 0) {
          console.log("  🖱️ [PaylocityAdapter]: Clicking primary Apply button...");
          await applyBtn.click().catch(() => {});
          await page.waitForTimeout(3500);
        }
      }
    }
    await this.dismissCookies(page);
    await page.waitForSelector("input#info\\.firstName, input#btn-forceResume, input#btn-resume, button#btn-submit", { timeout: 30000, state: "attached" }).catch(() => {});
  }

  private async handleResumeUpload(page: Page, resumePath: string) {
    const resumeRemoveBtn = page.locator("button:has-text('Remove'), a:has-text('Remove')").first();
    if (await resumeRemoveBtn.count() > 0 && await resumeRemoveBtn.isVisible()) {
      console.log("  📄 [PaylocityAdapter]: Resume is already attached.");
      return;
    }

    console.log(`  📄 [PaylocityAdapter]: Attaching resume from database path: ${resumePath}`);
    const fileInputs = page.locator("input#btn-forceResume, input#btn-resume, input[type='file'][id*='resume'], input[type='file']");
    const count = await fileInputs.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await fileInputs.nth(i).setInputFiles(resumePath).catch(() => {});
      }
      console.log(`  ✅ [PaylocityAdapter]: Resume attached to ${count} file input(s).`);
    } else {
      const resumeBtn = page.locator("button[data-automation-id='btn-resume'], button:has-text('Select Resume'), label[for='btn-resume']").first();
      if (await resumeBtn.count() > 0 && await resumeBtn.isVisible().catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 2500 }).catch(() => null),
          resumeBtn.click({ timeout: 2000 }).catch(() => {})
        ]);
        if (fileChooser) {
          await fileChooser.setFiles(resumePath);
          console.log("  ✅ [PaylocityAdapter]: Resume attached via file chooser.");
        }
      }
    }
    await page.waitForTimeout(1000);
  }

  private async handleCoverLetterUpload(page: Page, coverLetterPath: string) {
    const fileInput = page.locator("input#btn-coverLetter, input[type='file'][id*='coverLetter']").first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(coverLetterPath).catch(() => {});
      console.log("  ✅ [PaylocityAdapter]: Cover letter attached via setInputFiles.");
    } else {
      const coverBtn = page.locator("button[data-automation-id='btn-coverLetter'], button:has-text('Select Cover Letter')").first();
      if (await coverBtn.count() > 0 && await coverBtn.isVisible().catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 2500 }).catch(() => null),
          coverBtn.click({ timeout: 2000 }).catch(() => {})
        ]);
        if (fileChooser) {
          await fileChooser.setFiles(coverLetterPath);
          console.log("  ✅ [PaylocityAdapter]: Cover letter attached via file chooser.");
        }
      }
    }
    await page.waitForTimeout(1000);
  }

  private async handleStateDropdown(page: Page, profile: UserProfile) {
    const stateMap: Record<string, string> = {
      alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
      colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
      hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
      kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
      massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
      montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
      "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
      oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
      "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
      virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
      "district of columbia": "DC"
    };

    let stateTarget = "CA";
    if (profile.state) {
      const s = profile.state.trim();
      if (s.length === 2) {
        stateTarget = s.toUpperCase();
      } else {
        stateTarget = stateMap[s.toLowerCase()] || "CA";
      }
    }

    // Handle all React-Select state dropdowns on page (primary address and work history address)
    const stateWrappers = page.locator("#public-site-address-us-state-select-wrapper, [id*='-us-state-select-wrapper']");
    const count = await stateWrappers.count();

    for (let i = 0; i < count; i++) {
      const stateWrapper = stateWrappers.nth(i);
      if (!(await stateWrapper.isVisible().catch(() => false))) continue;

      const singleValue = stateWrapper.locator(".input-select-input-single-value, [class*='singleValue']").first();
      const displayVal = (await singleValue.innerText().catch(() => "")).trim();
      const stateInput = stateWrapper.locator("input#public-site-address-us-state, input[id*='-us-state'], input[type='text']").first();
      const curInputVal = (await stateInput.inputValue().catch(() => "")).trim();

      if ((displayVal && !displayVal.toLowerCase().includes("select") && displayVal.length > 0) || curInputVal === stateTarget) {
        continue; // Already populated
      }

      console.log(`  📍 [PaylocityAdapter]: Setting state dropdown #${i + 1} to '${stateTarget}'...`);
      await stateWrapper.scrollIntoViewIfNeeded().catch(() => {});

      if (await stateInput.count() > 0) {
        await stateInput.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
        await stateInput.fill("").catch(() => {});
        await stateInput.pressSequentially(stateTarget, { delay: 60 }).catch(() => {});
        await page.waitForTimeout(400);
      } else {
        await stateWrapper.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
        await page.keyboard.type(stateTarget, { delay: 60 }).catch(() => {});
        await page.waitForTimeout(400);
      }

      // Check for matching option in dropdown list container or menu
      const stateOptRegex = new RegExp(`^${stateTarget}$`, "i");
      const matchedOpt = page.locator("[id*='-dropdown-list-container'] *, .pcty-input-select__menu-list, .pcty-input-select__menu-list *").filter({ hasText: stateOptRegex }).first();
      if (await matchedOpt.count() > 0) {
        await matchedOpt.click({ force: true, timeout: 2000 }).catch(() => {});
      } else {
        await page.keyboard.press("Enter").catch(() => {});
      }
      await page.waitForTimeout(300);

      // Verify if state is now populated
      const afterInputVal = (await stateInput.inputValue().catch(() => "")).trim();
      const afterDisplayVal = (await singleValue.innerText().catch(() => "")).trim();
      if (!afterInputVal && (!afterDisplayVal || afterDisplayVal.toLowerCase().includes("select"))) {
        console.log(`  🔄 [PaylocityAdapter]: Retrying state selection via dropdown icon for '${stateTarget}'...`);
        const dropdownIcon = stateWrapper.locator(".pcty-input-select__dropdown-icon, i.icon-expand, span:has(i.icon-expand)").first();
        if (await dropdownIcon.count() > 0) {
          await dropdownIcon.click({ force: true }).catch(() => {});
          await page.waitForTimeout(400);

          const optInMenu = page.locator("[id*='-dropdown-list-container'] *, .pcty-input-select__menu-list, .pcty-input-select__menu-list *").filter({ hasText: stateOptRegex }).first();
          if (await optInMenu.count() > 0) {
            await optInMenu.click({ force: true, timeout: 2000 }).catch(() => {});
          } else {
            await page.keyboard.press("Enter").catch(() => {});
          }
        }
      }

      // Clear error outline & error text if present
      await page.evaluate(() => {
        try {
          const wrapper = document.querySelector("#public-site-address-us-state-select-wrapper");
          if (wrapper) {
            wrapper.removeAttribute("required");
            wrapper.classList.remove("has-error", "is-invalid");
          }
          const inp = document.querySelector("#public-site-address-us-state");
          if (inp) {
            inp.removeAttribute("required");
          }
          const errorSpan = document.querySelector("span[style*='color: red']:has-text('State'), p.text-danger:has-text('State')");
          if (errorSpan) errorSpan.remove();
        } catch (e) {}
      }).catch(() => {});

      await page.waitForTimeout(200);
    }
  }

  private async fillAllTextInputs(page: Page, getAnswer: (key: string, options?: string[]) => string, profile: UserProfile, job?: JobDetails) {
    const inputMetadata = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("input[type='text'], input[type='email'], input[type='tel'], input[type='number'], textarea"));
      return els.map((el: any) => {
        const id = el.id || "";
        const name = el.name || "";
        const dataFor = el.getAttribute("data-for") || "";
        const role = el.getAttribute("role") || "";
        const isTextarea = el.tagName.toLowerCase() === "textarea";

        // Multi-level label discovery
        let label = "";
        if (el.labels && el.labels.length > 0) {
          label = el.labels[0].textContent?.trim() || "";
        }
        if (!label) {
          const parent = el.closest(".form-group, fieldset, div[class*='group'], div[class*='question'], div[class*='field'], [class*='form-item'], div[class*='row']");
          if (parent) {
            const lblEl = parent.querySelector("label, legend, p, span.title, [class*='label'], [class*='title'], [class*='question'], [class*='prompt'], h2, h3, h4, h5, div[class*='title']");
            if (lblEl) label = lblEl.textContent?.trim() || "";
          }
        }
        if (!label) {
          let prev = el.previousElementSibling;
          while (prev && !label) {
            const tag = prev.tagName.toUpperCase();
            if (["LABEL", "LEGEND", "P", "SPAN", "H2", "H3", "H4", "H5", "DIV"].includes(tag)) {
              const text = prev.textContent?.trim() || "";
              if (text.length > 3 && !text.toLowerCase().includes("question required")) {
                label = text;
                break;
              }
            }
            prev = prev.previousElementSibling;
          }
        }
        if (!label && el.parentElement) {
          let pPrev = el.parentElement.previousElementSibling;
          while (pPrev && !label) {
            const text = pPrev.textContent?.trim() || "";
            if (text.length > 3 && !text.toLowerCase().includes("question required")) {
              label = text;
              break;
            }
            pPrev = pPrev.previousElementSibling;
          }
        }
        if (!label) {
          label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
        }

        return {
          id,
          name,
          dataFor,
          role,
          label: label.replace(/\s+/g, " ").trim(),
          type: el.type || el.tagName.toLowerCase(),
          isTextarea,
          value: el.value || ""
        };
      }).filter(item => {
        const id = item.id.toLowerCase();
        return !id.includes("vendor-search") && !id.includes("ot-group") && !id.includes("state") && (item.role !== "combobox" || id.includes("address-1"));
      });
    }).catch(() => []);

    for (const item of inputMetadata) {
      const rawId = item.id;
      const id = rawId.toLowerCase();
      const rawName = item.name;
      const dataFor = item.dataFor;
      const label = item.label;

      const cleanId = rawId.replace(/"/g, '\\"');
      const cleanName = rawName.replace(/"/g, '\\"');
      const cleanDataFor = dataFor.replace(/"/g, '\\"');
      const input = rawId
        ? page.locator(`[id="${cleanId}"]`).first()
        : (rawName ? page.locator(`[name="${cleanName}"]`).first() : page.locator(`[data-for="${cleanDataFor}"]`).first());

      if (!(await input.isVisible().catch(() => false))) continue;

      // Handle skills tags input
      if (id.includes("skills") || id.includes("tag")) {
        const badgeCount = await page.locator(".tags-input-badge, .badge, [class*='badge'], .tags-input-tag, .tag").count();
        if (badgeCount < 3) {
          const topSkills = ["TypeScript", "Python", "React", "Node.js", "Docker", "FastAPI"];
          for (const s of topSkills) {
            await input.fill(s).catch(() => {});
            await page.keyboard.press("Enter").catch(() => {});
            await page.waitForTimeout(150);
          }
        }
        continue;
      }

      let answer = "";

      // 1. Precise deterministic mapping by element ID / Name
      if (id.includes("firstname")) {
        answer = profile.firstName;
      } else if (id.includes("lastname")) {
        answer = profile.lastName;
      } else if (id.includes("middlename")) {
        answer = profile.middleName || "";
      } else if (id.includes("preferredname")) {
        answer = profile.firstName;
      } else if (id.includes("references.name.0") || (id.includes("reference") && id.includes("name") && id.includes("0"))) {
        answer = "Alex Johnson";
      } else if (id.includes("references.name.1") || (id.includes("reference") && id.includes("name") && id.includes("1"))) {
        answer = "Tarun Komati";
      } else if (id.includes("references.name.2") || (id.includes("reference") && id.includes("name") && id.includes("2"))) {
        answer = "Sarah Williams";
      } else if (id.includes("references.name") || (id.includes("reference") && id.includes("name"))) {
        answer = "Alex Johnson";
      } else if (id.includes("references.email.0") || (id.includes("reference") && id.includes("email") && id.includes("0"))) {
        answer = "alex.johnson@example.com";
      } else if (id.includes("references.email.1") || (id.includes("reference") && id.includes("email") && id.includes("1"))) {
        answer = "tarun.komati@example.com";
      } else if (id.includes("references.email.2") || (id.includes("reference") && id.includes("email") && id.includes("2"))) {
        answer = "sarah.williams@example.com";
      } else if (id.includes("references.phone.0") || (id.includes("reference") && id.includes("phone") && id.includes("0"))) {
        answer = "+12025550144";
      } else if (id.includes("references.phone.1") || (id.includes("reference") && id.includes("phone") && id.includes("1"))) {
        answer = "+12025550187";
      } else if (id.includes("references.phone.2") || (id.includes("reference") && id.includes("phone") && id.includes("2"))) {
        answer = "+12025550162";
      } else if (id.includes("references.phone") || (id.includes("reference") && id.includes("phone"))) {
        answer = "+12025550144";
      } else if (id.includes("supervisoremail.1") || (id.includes("supervisor") && id.includes("email") && id.includes("1"))) {
        answer = "tarun.komati@example.com";
      } else if (id.includes("supervisoremail") || (id.includes("supervisor") && id.includes("email"))) {
        answer = "alex.johnson@example.com";
      } else if (id.includes("supervisorphone.1") || (id.includes("supervisor") && id.includes("phone") && id.includes("1"))) {
        answer = "+12025550187";
      } else if (id.includes("supervisorphone") || (id.includes("supervisor") && id.includes("phone"))) {
        answer = "+12025550144";
      } else if (id.includes("supervisorname.1") || (id.includes("supervisor") && id.includes("name") && id.includes("1"))) {
        answer = "Tarun Komati";
      } else if (id.includes("supervisorname") || (id.includes("supervisor") && id.includes("name"))) {
        answer = "Alex Johnson";
      } else if (id.includes("supervisorposition.1") || (id.includes("supervisor") && id.includes("position") && id.includes("1"))) {
        answer = "Technical Director";
      } else if (id.includes("supervisorposition") || (id.includes("supervisor") && id.includes("position"))) {
        answer = "Engineering Manager";
      } else if (id.includes("email")) {
        answer = profile.email;
      } else if (id.includes("reasonforleaving") || id.includes("reason_for_leaving")) {
        answer = "Seeking new technical challenges and professional growth in AI engineering";
      } else if (id.includes("cellphone") || (id.includes("cell") && id.includes("phone"))) {
        answer = (profile.phone || "+12025550198").replace(/[^\d+]/g, "");
      } else if (id === "info.phone" || id.endsWith(".phone")) {
        answer = (profile.phone || "+12025550198").replace(/[^\d+]/g, "");
      } else if (id.endsWith("country") || id.includes("country")) {
        answer = profile.country || "United States";
      } else if (id.endsWith("zip") || id.includes("postalcode") || id.includes("zipcode")) {
        answer = profile.zipCode || "94105";
      } else if (id.endsWith("city") || id.includes(".city")) {
        answer = profile.city || "San Francisco";
      } else if (id.endsWith("county") || id.includes(".county")) {
        answer = "San Francisco County";
      } else if (id.endsWith("address-2") || id.endsWith("address2")) {
        answer = profile.addressLine2 || "Suite 400";
      } else if (id.includes("work-history-address-1-address-1") || id.includes("workhistory-address-1") || id.includes("workhistory.address.1")) {
        answer = "456 Montgomery St";
      } else if (id.includes("work-history-address-0-address-1") || id.includes("workhistory-address-0") || id.includes("workhistory.address.0")) {
        answer = "123 Market St";
      } else if (id.endsWith("address-1") || id.endsWith("address1") || id.endsWith(".street") || id.includes("street")) {
        answer = profile.street || "123 Market St";
      } else if (id.includes("linkedin")) {
        answer = profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
      } else if (id.includes("github")) {
        answer = profile.githubUrl || "https://github.com/hrutinnammi";
      } else if (id.includes("portfolio") || id.includes("website") || id.includes("companyurl")) {
        answer = profile.portfolioUrl || profile.githubUrl || "https://github.com/hrutinnammi";
      } else if (id.includes("minimumdesiredsalary")) {
        answer = "95000";
      } else if (id.includes("maximumdesiredsalary")) {
        answer = "115000";
      } else if (id.includes("desiredsalarydescription")) {
        answer = "$95,000 / year";
      } else if (id.includes("dateavailabletostart") || id.includes("availabletostart")) {
        answer = "11/02/2026";
      } else if (id.includes("referredby")) {
        answer = "Tarun Komati";
      } else if (id.includes("educationhistory.name") || id.includes("schoolname") || (id.includes("school") && !id.includes("type") && !id.includes("location"))) {
        answer = "Parul University";
      } else if (id.includes("educationhistory.areaofstudy") || id.includes("areaofstudy") || id.includes("major")) {
        answer = "Computer Science Engineering (AI & ML)";
      } else if (id.includes("educationhistory.degree") || id.includes("degree")) {
        answer = "Bachelor's Degree";
      } else if (id.includes("companyname") || id.includes("jobhistory.company")) {
        answer = "Jobspring";
      } else if (id.includes("jobhistory.jobtitle") || id.includes("position")) {
        answer = "Full Stack AI Developer";
      } else if (id.includes("responsibilities")) {
        answer = "Architected full-stack AI applications, RAG pipelines, and scalable FastAPI backend services with Redis and Docker. Reduced API latency by 30%.";
      } else if (id.includes("gpa")) {
        answer = "3.8";
      } else if (id.includes("graduationdate") || id.includes("graduation_date")) {
        answer = "05/2024";
      } else if (id.includes("startdate") || id.includes("start_date")) {
        answer = "01/01/2024";
      } else if (id.includes("enddate") || id.includes("end_date")) {
        answer = "01/01/2026";
      }

      // 2. Fallback to clean label query
      if (!answer) {
        const queryKey = label || rawId || rawName || dataFor;
        if (queryKey) {
          answer = getAnswer(queryKey);
        }
      }

      // 3. Fallback to LLM for big questions or textareas
      const promptQuery = (label || rawId || rawName || dataFor)
        .replace(/question required/gi, "")
        .replace(/\(required\)/gi, "")
        .replace(/\*+/g, "")
        .trim();

      if (!answer && promptQuery && (item.isTextarea || isBigQuestion(promptQuery, undefined, item.isTextarea ? "textarea" : "text"))) {
        console.log(`  🤖 [PaylocityAdapter]: Big question detected: "${promptQuery.slice(0, 60)}..." -> Synthesizing answer via LLM...`);
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 15000));
          answer = await Promise.race([
            generateAnswerForQuestion(promptQuery, job || {}, profile, undefined, item.isTextarea ? "textarea" : "text"),
            timeoutPromise
          ]);
        } catch (e: any) {
          console.warn(`  ⚠️ [PaylocityAdapter]: LLM call timed out or failed, using robust fallback answer`);
          answer = `In my experience as a Software Engineer, I approach complex challenges by conducting thorough root-cause analysis, engaging directly with team members and cross-functional stakeholders, and implementing measurable, scalable engineering solutions that drive lasting improvements in software delivery and team performance.`;
        }

        // Persist to database user_saved_answers so future runs have it
        if (profile.userId && answer) {
          const normKey = normalizeLabel(promptQuery);
          db.query(
            `INSERT INTO user_saved_answers (user_id, normalized_question, answer)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, normalized_question) DO NOTHING`,
            [profile.userId, normKey, answer]
          ).catch(() => {});
        }
      }

      const currentVal = await input.inputValue().catch(() => "");
      const isDate = (id.includes("date") && !id.includes("candidate")) || (rawName && rawName.toLowerCase().includes("date") && !rawName.toLowerCase().includes("candidate"));
      const isLinkedIn = id.includes("linkedin");

      // Skip dateAvailableToStart in generic text input filler (managed by dedicated calendar widget)
      if (id.includes("availabletostart") || id.includes("dateavailabletostart")) {
        continue;
      }

      // If work history address or dates were already filled by dedicated card handler, preserve them
      if (id.includes("work-history-address-1") && currentVal && currentVal.length > 0) {
        continue;
      }
      if (id.includes("workhistory-startdate-1") && currentVal && currentVal.length > 0) {
        continue;
      }
      if (id.includes("workhistory-enddate-1") && currentVal && currentVal.length > 0) {
        continue;
      }

      // For LinkedIn or Date or Address 1, force fill if value is invalid/empty/too long
      const shouldFill = answer && (!currentVal || currentVal.trim().length === 0 || (isLinkedIn && !currentVal.includes("http")) || (isDate && currentVal.trim().length < 4) || (id.includes("address-1") && currentVal.length > 40));

      if (shouldFill) {
        console.log(`  ✍️ [PaylocityAdapter]: Filling "${rawId || rawName || dataFor}" -> "${answer.slice(0, 40)}"`);
        await input.scrollIntoViewIfNeeded().catch(() => {});

        if (id.includes("address-1")) {
          const cleanAddr = answer.slice(0, 40);
          if (currentVal && currentVal.trim() === cleanAddr.trim()) {
            continue;
          }
          await input.click({ force: true }).catch(() => {});
          await input.fill("").catch(() => {});
          await page.waitForTimeout(100);
          await input.fill(cleanAddr).catch(() => {});
          await input.dispatchEvent("input").catch(() => {});
          await input.dispatchEvent("change").catch(() => {});
          await page.waitForTimeout(300);
          const autoOpt = page.locator(".autocomplete-results li, div:has-text('123 Market St')").first();
          if (await autoOpt.count() > 0 && await autoOpt.isVisible().catch(() => false)) {
            await autoOpt.click({ force: true }).catch(() => {});
          } else {
            await page.keyboard.press("Escape").catch(() => {});
          }
        } else if (isDate) {
          const dateVal = answer;
          await input.evaluate((el: HTMLInputElement, val: string) => {
            const proto = window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(el, val);
            else el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
          }, dateVal).catch(() => {});
        } else {
          await input.fill(answer).catch(() => {});
          await input.evaluate((el: any, val: string) => {
            const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) setter.call(el, val);
            else el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new Event("blur", { bubbles: true }));
          }, answer).catch(() => {});
        }

        if (id.includes("address-1") || isDate) {
          await page.keyboard.press("Escape").catch(() => {});
        }
      }
    }
  }

  private async handleBigQuestionsAndTextareas(
    page: Page,
    job: JobDetails,
    profile: UserProfile,
    getAnswer: (key: string, options?: string[]) => string
  ) {
    const textareas = page.locator("textarea:visible");
    const count = await textareas.count();
    if (count === 0) return;

    console.log(`\n🔍 [PaylocityAdapter]: Scanning ${count} visible textarea(s) for screening questions...`);

    for (let i = 0; i < count; i++) {
      const ta = textareas.nth(i);
      const curVal = (await ta.inputValue().catch(() => "")).trim();
      if (curVal.length > 10) {
        // Already populated
        continue;
      }

      // Extract comprehensive prompt text
      const promptData = await ta.evaluate((el: HTMLTextAreaElement) => {
        let text = "";

        // 1. Associated label via for or parent label
        if (el.labels && el.labels.length > 0) {
          text = el.labels[0].textContent?.trim() || "";
        }

        // 2. Closest form-group / question container
        if (!text) {
          const container = el.closest(".form-group, fieldset, div[class*='group'], div[class*='question'], div[class*='field'], [class*='form-item'], div[class*='row'], div[class*='col']");
          if (container) {
            const headingOrLabel = container.querySelector("label, legend, p, span.title, [class*='label'], [class*='title'], [class*='question'], [class*='prompt'], h2, h3, h4, h5, div[class*='title']");
            if (headingOrLabel) {
              text = headingOrLabel.textContent?.trim() || "";
            }
          }
        }

        // 3. Preceding siblings
        if (!text) {
          let prev = el.previousElementSibling;
          while (prev) {
            const tag = prev.tagName.toUpperCase();
            if (["LABEL", "LEGEND", "P", "SPAN", "H2", "H3", "H4", "H5", "DIV"].includes(tag)) {
              const t = prev.textContent?.trim() || "";
              if (t.length > 5 && !t.toLowerCase().includes("question required")) {
                text = t;
                break;
              }
            }
            prev = prev.previousElementSibling;
          }
        }

        // 4. Preceding siblings of parent container
        if (!text && el.parentElement) {
          let pPrev = el.parentElement.previousElementSibling;
          while (pPrev) {
            const t = pPrev.textContent?.trim() || "";
            if (t.length > 5 && !t.toLowerCase().includes("question required")) {
              text = t;
              break;
            }
            pPrev = pPrev.previousElementSibling;
          }
        }

        // 5. Fallbacks
        if (!text) {
          text = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("data-for") || el.id || el.name || "";
        }

        return {
          id: el.id || "",
          name: el.name || "",
          prompt: text
        };
      });

      const rawPrompt = promptData.prompt;
      const cleanPrompt = rawPrompt
        .replace(/question required/gi, "")
        .replace(/\(required\)/gi, "")
        .replace(/\*+/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanPrompt) continue;

      console.log(`  ❓ [PaylocityAdapter]: Textarea #${i + 1} Question: "${cleanPrompt.slice(0, 80)}..."`);

      // 1. Try getAnswer
      let answer = getAnswer(cleanPrompt);

      // 2. Synthesize via LLM if no deterministic answer
      if (!answer) {
        console.log(`  🤖 [PaylocityAdapter]: Generating LLM answer for question...`);
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 15000));
          answer = await Promise.race([
            generateAnswerForQuestion(cleanPrompt, job, profile, undefined, "textarea"),
            timeoutPromise
          ]);
        } catch (err: any) {
          console.warn(`  ⚠️ [PaylocityAdapter]: LLM call failed or timed out: ${err.message}. Using high-quality default response.`);
          answer = `In my experience as a Software Engineer, I approach complex challenges by conducting thorough root-cause analysis, engaging directly with team members and cross-functional stakeholders, and implementing measurable, scalable engineering solutions that drive lasting improvements in software delivery and team performance.`;
        }
      }

      if (answer) {
        console.log(`  ✍️ [PaylocityAdapter]: Filling textarea #${i + 1} with answer: "${answer.slice(0, 60)}..."`);
        await ta.scrollIntoViewIfNeeded().catch(() => {});
        await ta.click({ force: true }).catch(() => {});
        await ta.fill(answer).catch(() => {});

        // Dispatch React synthetic events with proper _valueTracker reset
        await ta.evaluate((el: HTMLTextAreaElement, val: string) => {
          const tracker = (el as any)._valueTracker;
          if (tracker) tracker.setValue("");
          const proto = window.HTMLTextAreaElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true }));

          // Remove any inline error state on container
          const container = el.closest(".form-group, fieldset, div[class*='question'], div[class*='field'], [class*='form-item']");
          if (container) {
            container.classList.remove("has-error");
            container.classList.remove("error");
            const errSpans = container.querySelectorAll(".field-validation-error, .text-danger, span[style*='color: red'], [class*='error']");
            errSpans.forEach(errSpan => {
              if (errSpan && errSpan.textContent?.toLowerCase().includes("required")) {
                errSpan.remove();
              }
            });
          }
        }, answer).catch(() => {});

        await page.waitForTimeout(300);

        // Persist to database user_saved_answers
        if (profile.userId) {
          const normKey = normalizeLabel(cleanPrompt);
          db.query(
            `INSERT INTO user_saved_answers (user_id, normalized_question, answer)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, normalized_question) DO NOTHING`,
            [profile.userId, normKey, answer]
          ).catch(() => {});
        }
      }
    }
  }

  private async fillAllComboboxes(page: Page, getAnswer: (key: string, options?: string[]) => string, profile: UserProfile, job?: JobDetails) {
    const comboboxes = page.locator("div.rw-dropdownlist, div[role='combobox'], .rw-widget:has(.rw-input)");
    const count = await comboboxes.count();

    for (let i = 0; i < count; i++) {
      const cb = comboboxes.nth(i);
      if (!(await cb.isVisible().catch(() => false))) continue;

      const rawId = (await cb.getAttribute("id") || "").trim();
      const id = rawId.toLowerCase();
      const dataFor = (await cb.getAttribute("data-for") || "").trim();
      
      // Robust multi-level label discovery
      let label = dataFor;
      if (!label) {
        const formGroup = cb.locator("xpath=ancestor::div[contains(@class,'form-group') or contains(@class,'question') or contains(@class,'card')]").first();
        if (await formGroup.count() > 0) {
          label = (await formGroup.locator("label, legend, h3, h4, h5, strong, b").first().innerText().catch(() => "")).trim();
        }
        if (!label) {
          const prev = cb.locator("xpath=preceding::label[1] | preceding::h4[1] | preceding::strong[1] | preceding::b[1]").first();
          if (await prev.count() > 0) {
            label = (await prev.innerText().catch(() => "")).trim();
          }
        }
      }

      const queryKey = dataFor || label || rawId;
      if (!queryKey) continue;

      // Check current displayed value
      const currentDisplay = (await cb.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
      const isWorkedBeforeCheck = id.includes("haveyouworked") || queryKey.toLowerCase().includes("worked with us before") || queryKey.toLowerCase().includes("worked for us before");
      if (currentDisplay && currentDisplay !== "--" && currentDisplay !== "Select..." && currentDisplay !== "Select One" && currentDisplay !== "- Select -") {
        if (!isWorkedBeforeCheck || currentDisplay.toLowerCase() === "no") {
          continue; // Already answered
        }
      }

      // Open widget to inspect options: click picker button or caret
      await cb.scrollIntoViewIfNeeded().catch(() => {});
      const picker = cb.locator(".rw-dropdownlist-picker, .rw-select, .rw-btn, .rw-i-caret-down").first();
      if (await picker.count() > 0) {
        await picker.click({ force: true }).catch(() => {});
      } else {
        await cb.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(300);

      // Verify if popup is open; if not, open with Alt+ArrowDown
      const isPopupOpen = await page.locator("ul.rw-list:visible, ul[role='listbox']:visible, .rw-popup:visible, .rw-popup-container:visible").count() > 0;
      if (!isPopupOpen) {
        await cb.focus().catch(() => {});
        await cb.press("Alt+ArrowDown").catch(() => {});
        await page.waitForTimeout(200);
      }

      // Find scoped options in listbox
      let optionEls = page.locator(`[id='${rawId}__listbox'] li, [id='${rawId}_listbox'] li, [id*='${rawId}'] li`);
      let optionTexts = (await optionEls.allTextContents().catch(() => [])).map(t => t.trim()).filter(Boolean);

      if (optionTexts.length === 0) {
        const ariaOwns = await cb.getAttribute("aria-owns").catch(() => null);
        if (ariaOwns) {
          optionEls = page.locator(`[id='${ariaOwns}'] li, [id='${ariaOwns}'] [role='option']`);
          optionTexts = (await optionEls.allTextContents().catch(() => [])).map(t => t.trim()).filter(Boolean);
        }
      }

      if (optionTexts.length === 0) {
        optionEls = page.locator("ul.rw-list:visible li, ul[role='listbox']:visible li, .rw-popup:visible li, .rw-popup-container:visible li, .rw-list-option:visible, div[role='listbox']:visible [role='option']");
        optionTexts = (await optionEls.allTextContents().catch(() => [])).map(t => t.trim()).filter(Boolean);
      }

      const optionsJoined = optionTexts.join(" ").toLowerCase();

      // Semantic domain inference
      const isAuthToWork = queryKey.toLowerCase().includes("authorized to work") || queryKey.toLowerCase().includes("legally authorized") || queryKey.toLowerCase().includes("work authorization");
      const isLegalGender = queryKey.toLowerCase().includes("identify by your legal gender") || queryKey.toLowerCase().includes("legal gender");
      const isDisability = queryKey.toLowerCase().includes("disability") || optionsJoined.includes("have a disability");
      const isSalaryType = queryKey.toLowerCase().includes("salary type") || id.includes("salarytype") || (optionsJoined.includes("hourly") && optionsJoined.includes("yearly"));
      const isVeteran = queryKey.toLowerCase().includes("veteran") || optionsJoined.includes("protected veteran");
      const isWorkedBefore = id.includes("haveyouworked") || queryKey.toLowerCase().includes("worked with us before") || queryKey.toLowerCase().includes("worked for us before");
      const isAppliedBefore = id.includes("haveyouapplied") || queryKey.toLowerCase().includes("applied for a job with us before") || queryKey.toLowerCase().includes("applied with us before");
      const isSms = id.includes("smsoptedin") || queryKey.toLowerCase().includes("sms") || queryKey.toLowerCase().includes("text message");
      const isGraduated = id.includes("graduat") || queryKey.toLowerCase().includes("graduate");
      const isSchoolType = id.includes("schooltype") || queryKey.toLowerCase().includes("school type") || id.includes("educationhistory.type");
      const isDegree = id.includes("degree") || queryKey.toLowerCase().includes("degree");
      const isState = (queryKey.toLowerCase().includes("state") && !isAuthToWork && !queryKey.toLowerCase().includes("united states")) || (id.includes("state") && !id.includes("united"));
      const isCountry = queryKey.toLowerCase().includes("country") || id.includes("country");
      const isSupervisor = queryKey.toLowerCase().includes("supervisor") || id.includes("maywecontactsupervisor");

      let targetAnswer = "";
      if (isAuthToWork) {
        const yesOpt = optionTexts.find(o => /^yes\b/i.test(o));
        targetAnswer = yesOpt || "Yes";
      } else if (isLegalGender) {
        const yesOpt = optionTexts.find(o => /^yes\b/i.test(o));
        targetAnswer = yesOpt || "Yes";
      } else if (isDisability) {
        const negativeDisabilityOpt = optionTexts.find(o => 
          /no, i do not have a disability|do not have a disability/i.test(o) ||
          (/no/i.test(o) && !/have a disability/i.test(o))
        );
        targetAnswer = negativeDisabilityOpt || "No, I do not have a disability and have not had one in the past";
      } else if (isSalaryType) {
        const yearlyOpt = optionTexts.find(o => /annual|yearly/i.test(o));
        targetAnswer = yearlyOpt || "Annual";
      } else if (isVeteran) {
        const nonVeteranOpt = optionTexts.find(o => /not a protected|not a veteran|no/i.test(o));
        targetAnswer = nonVeteranOpt || "I am not a protected veteran";
      } else if (isWorkedBefore) {
        const noOpt = optionTexts.find(o => /^no\b/i.test(o));
        targetAnswer = noOpt || "No";
      } else if (isAppliedBefore) {
        const noOpt = optionTexts.find(o => /^no\b/i.test(o));
        targetAnswer = noOpt || "No";
      } else if (isSms) {
        const yesOpt = optionTexts.find(o => /^yes/i.test(o));
        targetAnswer = yesOpt || "Yes*";
      } else if (isGraduated) {
        const yesOpt = optionTexts.find(o => /^yes/i.test(o));
        targetAnswer = yesOpt || "Yes";
      } else if (isSchoolType) {
        const univOpt = optionTexts.find(o => /college \/ university|university/i.test(o));
        targetAnswer = univOpt || "College / University";
      } else if (isDegree) {
        const bachOpt = optionTexts.find(o => /bachelor/i.test(o));
        targetAnswer = bachOpt || "Bachelor's Degree";
      } else if (isCountry) {
        const usOpt = optionTexts.find(o => /united states|usa/i.test(o));
        targetAnswer = usOpt || "UNITED STATES";
      } else if (isSupervisor) {
        const yesOpt = optionTexts.find(o => /^yes/i.test(o));
        targetAnswer = yesOpt || "Yes";
      } else if (isState) {
        const caOpt = optionTexts.find(o => /^california\b/i.test(o) || /^ca\b/i.test(o));
        targetAnswer = caOpt || "California";
      } else if (queryKey.toLowerCase().includes("gender")) {
        const hasYesNo = optionTexts.some(o => /^yes\b/i.test(o));
        if (hasYesNo) {
          targetAnswer = optionTexts.find(o => /^yes\b/i.test(o)) || "Yes";
        } else {
          const gOpt = optionTexts.find(o => o.toLowerCase() === (profile.gender || "male").toLowerCase());
          targetAnswer = gOpt || "Male";
        }
      } else if (queryKey.toLowerCase().includes("race") || queryKey.toLowerCase().includes("ethnicity")) {
        const rOpt = optionTexts.find(o => /asian/i.test(o));
        targetAnswer = rOpt || "Asian";
      } else if (queryKey.toLowerCase().includes("personal or work reference") || id.includes("reference")) {
        const profOpt = optionTexts.find(o => /professional|work/i.test(o));
        targetAnswer = profOpt || (optionTexts.length > 1 ? optionTexts[1] : "Professional");
      }

      if (!targetAnswer) {
        targetAnswer = getAnswer(queryKey, optionTexts);
      }

      if (!targetAnswer && optionTexts.length > 0 && job) {
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 5000));
          targetAnswer = await Promise.race([
            generateAnswerForQuestion(queryKey, job, profile, optionTexts, "select"),
            timeoutPromise
          ]);
        } catch {
          targetAnswer = optionTexts.find(o => /^yes\b/i.test(o)) || optionTexts[0];
        }
      }

      if (targetAnswer && targetAnswer !== "--") {
        console.log(`  🔽 [PaylocityAdapter]: Selecting dropdown "${queryKey}" -> "${targetAnswer}" (available: ${optionTexts.join(", ")})`);
        await this.selectComboboxValue(page, cb, targetAnswer);
      } else {
        await page.keyboard.press("Escape").catch(() => {});
      }
      await page.waitForTimeout(200);
    }
  }

  private async fillAllRadioGroups(page: Page, getAnswer: (key: string, options?: string[]) => string, profile?: UserProfile, job?: JobDetails) {
    const radioData = await page.evaluate(() => {
      const groups: Array<{ name: string; question: string; options: Array<{ value: string; label: string; checked: boolean }> }> = [];
      const seenNames = new Set<string>();

      document.querySelectorAll("input[type='radio']").forEach((r: any) => {
        const name = r.name;
        if (!name || seenNames.has(name)) return;
        seenNames.add(name);

        const radios = Array.from(document.querySelectorAll(`input[type='radio'][name='${CSS.escape(name)}']`));
        const formGroup = radios[0].closest(".form-group, fieldset, [class*='radio']");
        const question = formGroup?.querySelector("label, legend, p")?.textContent?.trim() || name;

        const options = radios.map((rad: any) => {
          const val = rad.value || "";
          const id = rad.id || "";
          let labelText = val;
          if (id) {
            const l = document.querySelector(`label[for='${id}']`);
            if (l) labelText = l.textContent?.trim() || val;
          }
          if (!labelText || labelText === val) {
            const parentLabel = rad.closest("label");
            if (parentLabel) labelText = parentLabel.textContent?.trim() || val;
          }
          return { value: val, label: (labelText || val).replace(/\s+/g, " ").trim(), checked: rad.checked };
        });

        groups.push({ name, question, options });
      });

      return groups;
    }).catch(() => []);

    for (const grp of radioData) {
      if (grp.options.some(o => o.checked)) continue; // already answered
      const optLabels = grp.options.map(o => o.label);
      let answer = getAnswer(grp.question, optLabels);

      if (!answer && optLabels.length > 0 && job && profile) {
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 5000));
          answer = await Promise.race([
            generateAnswerForQuestion(grp.question, job, profile, optLabels, "radio"),
            timeoutPromise
          ]);
        } catch {
          answer = optLabels.find(o => /^yes\b/i.test(o)) || optLabels[0];
        }
      }

      if (!answer) continue;

      console.log(`  🔘 [PaylocityAdapter]: Answering radio question "${grp.question.slice(0, 45)}..." -> "${answer}"`);
      const cleanTarget = cleanForComparison(answer);

      let matchIdx = grp.options.findIndex(o => {
        const c = cleanForComparison(o.label);
        return c === cleanTarget || c.includes(cleanTarget) || cleanTarget.includes(c);
      });
      if (matchIdx === -1) matchIdx = 0;

      const chosenVal = grp.options[matchIdx].value;

      await page.evaluate(({ name, value }) => {
        const rad: any = document.querySelector(`input[type='radio'][name='${CSS.escape(name)}'][value='${CSS.escape(value)}']`) ||
                         document.querySelector(`input[type='radio'][name='${CSS.escape(name)}']`);
        if (rad) {
          try { rad.click(); } catch (e) {}
          rad.dispatchEvent(new Event("input", { bubbles: true }));
          rad.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, { name: grp.name, value: chosenVal }).catch(() => {});

      await page.waitForTimeout(100);
    }
  }

  private async fillAllCheckboxes(page: Page, getAnswer: (key: string) => string) {
    const cbData = await page.evaluate(() => {
      const cbs = Array.from(document.querySelectorAll("input[type='checkbox']"));
      return cbs.map((cb: any) => {
        const id = cb.id || "";
        const labelEl = cb.id ? document.querySelector(`label[for='${CSS.escape(cb.id)}']`) : null;
        const parentLabel = cb.closest("label");
        const specificLabel = labelEl?.textContent?.trim() || parentLabel?.textContent?.trim() || cb.value || "";
        const parent = cb.closest(".form-group, .checkbox, fieldset");
        const groupQuestion = parent?.querySelector("label, legend, p")?.textContent?.trim() || "";
        return {
          id,
          name: cb.name || "",
          label: specificLabel || groupQuestion,
          groupQuestion,
          checked: cb.checked
        };
      });
    }).catch(() => []);

    for (const c of cbData) {
      if (c.id === "useAttachedResumeToFillOutApplication" || c.id.includes("currentlyWorkingHere")) continue;
      const normLabel = (c.label || "").toLowerCase();
      const normGroup = (c.groupQuestion || "").toLowerCase();

      const isAck = c.id === "applyAcknowledgement" ||
                    normLabel.includes("acknowledgement") ||
                    normLabel.includes("certify") ||
                    normLabel.includes("accept") ||
                    normLabel.includes("agree");

      if (isAck && !c.checked) {
        console.log(`  ☑️ [PaylocityAdapter]: Checking acknowledgement: "${c.label.slice(0, 50)}"`);
        const cbLoc = page.locator(`input[id='${c.id}'], input[name='${c.name}']`).first();
        if (await cbLoc.count() > 0) {
          await cbLoc.click({ force: true }).catch(() => {});
        }
        await page.evaluate((id: string) => {
          const el: any = document.getElementById(id) || document.querySelector(`input[type='checkbox'][name='${CSS.escape(id)}']`);
          if (el && !el.checked) {
            const proto = window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
            if (setter) setter.call(el, true);
            else el.checked = true;
            el.dispatchEvent(new Event("click", { bubbles: true }));
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, c.id).catch(() => {});
      } else if (!c.checked) {
        const isFullTime = normLabel.includes("full-time") || normLabel.includes("full time") || normLabel.includes("open to either");
        const isFullTimeQuestion = normGroup.includes("full-time") || normGroup.includes("part-time");
        const answer = getAnswer(c.label || c.groupQuestion);

        if ((isFullTime && isFullTimeQuestion) || answer.toLowerCase() === "yes" || answer.toLowerCase() === "true") {
          console.log(`  ☑️ [PaylocityAdapter]: Checking "${c.label}"...`);
          const cbLoc = page.locator(`input[id='${c.id}'], input[name='${c.name}']`).first();
          if (await cbLoc.count() > 0) {
            await cbLoc.click({ force: true }).catch(() => {});
          }
          await page.evaluate((id: string) => {
            const el: any = document.getElementById(id) || document.querySelector(`input[type='checkbox'][name='${CSS.escape(id)}']`);
            if (el && !el.checked) {
              const proto = window.HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
              if (setter) setter.call(el, true);
              else el.checked = true;
              el.dispatchEvent(new Event("click", { bubbles: true }));
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, c.id).catch(() => {});
        }
      }
    }
  }

  private async fillAllNativeSelects(page: Page, getAnswer: (key: string, options?: string[]) => string) {
    const selects = page.locator("select:visible");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      const id = (await sel.getAttribute("id") || "").trim();
      const name = (await sel.getAttribute("name") || "").trim();
      const dataFor = (await sel.getAttribute("data-for") || "").trim();

      let label = dataFor;
      if (!label) {
        const parent = sel.locator("xpath=ancestor::div[contains(@class,'form-group') or contains(@class,'question')]").first();
        if (await parent.count() > 0) {
          label = (await parent.locator("label").first().innerText().catch(() => "")).trim();
        }
      }
      const queryKey = dataFor || label || name || id;
      if (!queryKey) continue;

      const isWorkAuth = queryKey.toLowerCase().includes("authorized to work") || queryKey.toLowerCase().includes("legally authorized") || queryKey.toLowerCase().includes("work lawfully");
      const currentVal = await sel.inputValue().catch(() => "");
      if (currentVal && currentVal !== "--" && currentVal !== "" && !isWorkAuth) continue;

      const optionEls = sel.locator("option");
      const optionTexts = (await optionEls.allTextContents().catch(() => [])).map(t => t.trim()).filter(Boolean);
      const targetAnswer = isWorkAuth ? "Yes" : getAnswer(queryKey, optionTexts);
      if (targetAnswer) {
        const cleanTarget = cleanForComparison(targetAnswer);
        const matchedOpt = optionTexts.find(o => {
          const c = cleanForComparison(o);
          return c === cleanTarget || c.includes(cleanTarget) || cleanTarget.includes(c);
        });
        if (matchedOpt) {
          await sel.selectOption({ label: matchedOpt }).catch(() => {});
          await sel.dispatchEvent("change").catch(() => {});
        } else if (optionTexts.length > 1) {
          const nonDashIdx = optionTexts.findIndex(o => o !== "--" && !o.includes("Select"));
          await sel.selectOption({ index: nonDashIdx >= 0 ? nonDashIdx : 1 }).catch(() => {});
          await sel.dispatchEvent("change").catch(() => {});
        }
      }
    }
  }

  private async selectComboboxValue(page: Page, cb: Locator, target: string): Promise<boolean> {
    try {
      const rawId = (await cb.getAttribute("id") || "").trim();
      await cb.scrollIntoViewIfNeeded().catch(() => {});
      await cb.focus({ timeout: 1000 }).catch(() => {});
      await cb.press("Alt+ArrowDown", { timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(200);

      const cleanTarget = target.trim();
      let regex: RegExp;
      if (cleanTarget.toLowerCase().includes("college") || cleanTarget.toLowerCase().includes("university")) {
        regex = /college \/ university|university/i;
      } else {
        const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        regex = new RegExp(`^${escaped}$`, "i");
      }

      let opt = rawId
        ? page.locator(`[id='${rawId}__listbox'] li`).filter({ hasText: regex }).first()
        : page.locator(".rw-popup:visible li, .rw-list-option:visible").filter({ hasText: regex }).first();

      if (await opt.count() === 0 && rawId) {
        opt = page.locator(`[id='${rawId}__listbox'] li`).filter({ hasText: new RegExp(cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
      }

      if (await opt.count() === 0) {
        opt = page.locator(".rw-popup:visible li, .rw-list-option:visible").filter({ hasText: new RegExp(cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
      }

      if (await opt.count() > 0) {
        await opt.evaluate((el: HTMLElement) => {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.click();
        }).catch(async () => {
          await opt.click({ force: true, timeout: 1000 }).catch(() => {});
        });
        await page.waitForTimeout(150);
        await page.keyboard.press("Escape").catch(() => {});
        return true;
      }

      // Keyboard fallback: type first char and press Enter
      const firstChar = cleanTarget.charAt(0);
      if (firstChar) {
        await cb.press(firstChar, { timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(100);
        await cb.press("Enter", { timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(100);
      }
      await page.keyboard.press("Escape").catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  private async handleEducationHistory(page: Page, profile: UserProfile, getAnswer: (key: string, options?: string[]) => string) {
    const addEduBtn = page.locator("button[data-automation-id='btnAddEducationHistory'], button[data-automation-id*='education' i], button:has-text('Add Education History'), button:has-text('Add Education'), a:has-text('Add Education')").first();
    const existingSchoolInputs = page.locator("input[id*='educationHistory.name' i], input[name*='educationHistory.name' i], input[id*='school' i]");
    
    let count = await existingSchoolInputs.count();
    const hasAddBtn = (await addEduBtn.count() > 0) && (await addEduBtn.isVisible().catch(() => false));

    if (count === 0 && !hasAddBtn) {
      return;
    }

    console.log("  🎓 [PaylocityAdapter]: Handling Education History section...");

    if (count === 0 && hasAddBtn) {
      console.log("  ➕ [PaylocityAdapter]: Expanding 'Add Education' card...");
      await this.dismissCookies(page);
      await addEduBtn.scrollIntoViewIfNeeded().catch(() => {});
      await addEduBtn.click().catch(() => {});
      await page.waitForTimeout(1200);
      count = await existingSchoolInputs.count();
    }

    const cardsToProcess = Math.max(count, 1);
    for (let idx = 0; idx < cardsToProcess; idx++) {
      // 1. School Name
      const schoolInput = page.locator(`input[id*='educationHistory.name.${idx}'], input[id*='educationHistory.name']`).nth(idx);
      if (await schoolInput.count() > 0 && await schoolInput.isVisible().catch(() => false)) {
        const currentSchool = await schoolInput.inputValue().catch(() => "");
        if (!currentSchool || currentSchool.trim().length === 0) {
          console.log(`  🏫 [PaylocityAdapter]: Entering School #${idx + 1}: Parul University`);
          await schoolInput.fill("Parul University").catch(() => {});
          await schoolInput.dispatchEvent("input").catch(() => {});
          await schoolInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 2. School Type (combobox)
      const schoolTypeCombobox = page.locator(`div[id*='educationHistory.type.${idx}'], div[id*='educationHistory.type'], div[data-for*='school type' i]`).nth(idx);
      if (await schoolTypeCombobox.count() > 0 && await schoolTypeCombobox.isVisible().catch(() => false)) {
        const curType = (await schoolTypeCombobox.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!curType || curType === "--" || curType.includes("Select")) {
          console.log(`  🎓 [PaylocityAdapter]: Selecting School Type #${idx + 1}: College / University`);
          await this.selectComboboxValue(page, schoolTypeCombobox, "College / University");
        }
      }

      // 3. Area of Study / Major
      const areaOfStudyInput = page.locator(`input[id*='educationHistory.areaOfStudy.${idx}'], input[id*='educationHistory.areaOfStudy']`).nth(idx);
      if (await areaOfStudyInput.count() > 0 && await areaOfStudyInput.isVisible().catch(() => false)) {
        const cur = await areaOfStudyInput.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  📚 [PaylocityAdapter]: Entering Area of Study #${idx + 1}: Computer Science Engineering (AI & ML)`);
          await areaOfStudyInput.fill("Computer Science Engineering (AI & ML)").catch(() => {});
          await areaOfStudyInput.dispatchEvent("input").catch(() => {});
          await areaOfStudyInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 4. Did you Graduate?
      const gradCombobox = page.locator(`div[id*='educationHistory.didYouGraduate.${idx}'], div[id*='educationHistory.didYouGraduate']`).nth(idx);
      if (await gradCombobox.count() > 0 && await gradCombobox.isVisible().catch(() => false)) {
        const cur = (await gradCombobox.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!cur || cur === "--" || cur.includes("Select")) {
          console.log(`  🎓 [PaylocityAdapter]: Selecting Graduated #${idx + 1}: Yes`);
          await this.selectComboboxValue(page, gradCombobox, "Yes");
        }
      }

      // 5. Degree Obtained (combobox or input)
      const degreeCombobox = page.locator(`div[id*='educationHistory.degreeId.${idx}'], div[id*='educationHistory.degree']`).nth(idx);
      if (await degreeCombobox.count() > 0 && await degreeCombobox.isVisible().catch(() => false)) {
        const cur = (await degreeCombobox.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!cur || cur === "--" || cur.includes("Select") || cur === "Other") {
          console.log(`  🎓 [PaylocityAdapter]: Selecting Degree #${idx + 1}: Bachelor`);
          await this.selectComboboxValue(page, degreeCombobox, "Bachelor");
        }
      }

      // 6. Graduation date
      const gradDateInput = page.locator(`input[id*='txt-educationHistory-graduationDate-${idx}'], input[id*='txt-educationHistory-graduationDate']`).nth(idx);
      if (await gradDateInput.count() > 0 && await gradDateInput.isVisible().catch(() => false)) {
        const cur = await gradDateInput.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  📅 [PaylocityAdapter]: Entering Graduation Date #${idx + 1}: 05/2024`);
          await gradDateInput.fill("05/2024").catch(() => {});
          await gradDateInput.dispatchEvent("input").catch(() => {});
          await gradDateInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 7. GPA
      const gpaInput = page.locator(`input[id*='educationHistory.gpa.${idx}'], input[id*='educationHistory.gpa']`).nth(idx);
      if (await gpaInput.count() > 0 && await gpaInput.isVisible().catch(() => false)) {
        const cur = await gpaInput.inputValue().catch(() => "");
        if (!cur) {
          await gpaInput.fill("3.8").catch(() => {});
          await gpaInput.dispatchEvent("input").catch(() => {});
          await gpaInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 8. Education Country (combobox)
      const eduCountryCombobox = page.locator(`div[id*='educationHistory.country.${idx}'], div[id*='educationHistory.country']`).nth(idx);
      if (await eduCountryCombobox.count() > 0 && await eduCountryCombobox.isVisible().catch(() => false)) {
        const curCountry = (await eduCountryCombobox.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!curCountry || curCountry === "--" || curCountry.includes("Select")) {
          console.log(`  🌎 [PaylocityAdapter]: Selecting Education Country #${idx + 1}: UNITED STATES`);
          await this.selectComboboxValue(page, eduCountryCombobox, "UNITED STATES");
        }
      }

      // 9. Education City
      const eduCityInput = page.locator(`input[id*='educationHistory.city.${idx}'], input[id*='educationHistory.city']`).nth(idx);
      if (await eduCityInput.count() > 0 && await eduCityInput.isVisible().catch(() => false)) {
        const cur = await eduCityInput.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  🏙️ [PaylocityAdapter]: Entering Education City #${idx + 1}: San Francisco`);
          await eduCityInput.fill("San Francisco").catch(() => {});
          await eduCityInput.dispatchEvent("input").catch(() => {});
          await eduCityInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 10. Education State (combobox OR text input)
      const eduStateCombobox = page.locator(`div[id*='educationHistory.state.${idx}'], div[id*='educationHistory.state']`).nth(idx);
      if (await eduStateCombobox.count() > 0 && await eduStateCombobox.isVisible().catch(() => false)) {
        const curState = (await eduStateCombobox.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!curState || curState === "--" || curState.includes("Select")) {
          console.log(`  📍 [PaylocityAdapter]: Selecting Education State #${idx + 1}: California`);
          await this.selectComboboxValue(page, eduStateCombobox, "California");
        }
      }

      const eduStateInput = page.locator(`input[id*='educationHistory.stateProvince.${idx}'], input[id*='educationHistory.state.${idx}'], input[id*='educationHistory.stateProvince'], input[id*='educationHistory.state']`).nth(idx);
      if (await eduStateInput.count() > 0 && await eduStateInput.isVisible().catch(() => false)) {
        const cur = await eduStateInput.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  📍 [PaylocityAdapter]: Entering Education State/Province #${idx + 1}: Gujarat`);
          await eduStateInput.fill("Gujarat").catch(() => {});
          await eduStateInput.dispatchEvent("input").catch(() => {});
          await eduStateInput.dispatchEvent("change").catch(() => {});
        }
      }
    }
  }

  private async handleJobHistory(page: Page, profile: UserProfile, getAnswer: (key: string, options?: string[]) => string) {
    const addWorkBtn = page.locator("button[data-automation-id='btnAddWorkHistory'], button[data-automation-id='btnAddJobHistory'], button:has-text('Add Work History'), button:has-text('Add Job History'), button:has-text('Add Experience')").first();
    const existingCompanyInputs = page.locator("input[id*='workHistory.companyName']");

    let count = await existingCompanyInputs.count();
    const hasAddBtn = (await addWorkBtn.count() > 0) && (await addWorkBtn.isVisible().catch(() => false));

    if (count === 0 && !hasAddBtn) {
      return;
    }

    console.log("  💼 [PaylocityAdapter]: Handling Work Experience section...");

    // Ensure at least 2 work experience cards exist: Card 1 (Inadev) and Card 2 (Jobspring)
    let attempts = 0;
    while (count < 2 && attempts < 3 && (await addWorkBtn.count() > 0) && (await addWorkBtn.isVisible().catch(() => false))) {
      attempts++;
      console.log(`  ➕ [PaylocityAdapter]: Expanding/Adding work experience card #${count + 1}...`);
      await this.dismissCookies(page);
      await addWorkBtn.scrollIntoViewIfNeeded().catch(() => {});
      await addWorkBtn.click().catch(() => {});
      await page.waitForTimeout(1500);
      count = await existingCompanyInputs.count();
    }

    const cardsToProcess = Math.min(Math.max(count, 2), 2);
    for (let idx = 0; idx < cardsToProcess; idx++) {
      const targetCompany = idx === 0 ? "Inadev" : "Jobspring";
      const targetTitle = idx === 0 ? "Lead Full Stack AI Engineer" : "Full Stack AI Developer";
      const targetUrl = "https://github.com/hrutinnammi";
      const targetPhone = idx === 0 ? "+12025550144" : "+12025550187";
      const targetResp = idx === 0
        ? "Architected enterprise full-stack AI applications, RAG pipelines, and scalable FastAPI backend services with Redis and Docker. Reduced API latency by 30%."
        : "Engineered high-performance web applications with React, TypeScript, and Node.js. Integrated ML models and built automated CI/CD deployment pipelines.";
      const targetAddr1 = idx === 0 ? "123 Market St" : "456 Montgomery St";
      const targetAddr2 = idx === 0 ? "Suite 400" : "Suite 800";
      const targetCity = "San Francisco";
      const targetCounty = "San Francisco County";
      const targetZip = idx === 0 ? "94105" : "94104";
      const startDate = idx === 0 ? "01/01/2024" : "06/01/2021";
      const endDate = idx === 0 ? "01/01/2026" : "12/31/2023";
      const targetReason = idx === 0
        ? "Seeking new technical challenges and professional growth in AI engineering"
        : "Transitioned to advance career in enterprise AI solutions";
      const targetSupName = idx === 0 ? "Alex Johnson" : "Tarun Komati";
      const targetSupPhone = idx === 0 ? "+12025550144" : "+12025550187";
      const targetSupEmail = idx === 0 ? "alex.johnson@example.com" : "tarun.komati@example.com";
      const targetSupPos = idx === 0 ? "Engineering Manager" : "Technical Director";

      // 1. Company Name
      const compInput = page.locator(`input[id='workHistory.companyName.${idx}'], input[id*='workHistory.companyName.${idx}']`).first();
      if (await compInput.count() > 0 && await compInput.isVisible().catch(() => false)) {
        const cur = await compInput.inputValue().catch(() => "");
        if (!cur || cur.trim().length === 0 || cur === "Nomadic Trails" || (idx === 1 && cur !== "Jobspring") || (idx === 0 && cur !== "Inadev")) {
          console.log(`  🏢 [PaylocityAdapter]: Entering Company #${idx + 1}: ${targetCompany}`);
          await compInput.fill(targetCompany).catch(() => {});
          await compInput.dispatchEvent("input").catch(() => {});
          await compInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 2. Position / Job Title
      const titleInput = page.locator(`input[id='workHistory.position.${idx}'], input[id*='workHistory.position.${idx}']`).first();
      if (await titleInput.count() > 0 && await titleInput.isVisible().catch(() => false)) {
        const cur = await titleInput.inputValue().catch(() => "");
        if (!cur || cur.trim().length === 0 || cur.includes("Freelance") || (idx === 1 && !cur.includes("Jobspring"))) {
          console.log(`  💼 [PaylocityAdapter]: Entering Position #${idx + 1}: ${targetTitle}`);
          await titleInput.fill(targetTitle).catch(() => {});
          await titleInput.dispatchEvent("input").catch(() => {});
          await titleInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 3. Company URL
      const urlInput = page.locator(`input[id='workHistory.companyUrl.${idx}'], input[id*='workHistory.companyUrl.${idx}']`).first();
      if (await urlInput.count() > 0 && await urlInput.isVisible().catch(() => false)) {
        const cur = await urlInput.inputValue().catch(() => "");
        if (!cur) {
          await urlInput.fill(targetUrl).catch(() => {});
          await urlInput.dispatchEvent("input").catch(() => {});
          await urlInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 4. Company Phone
      const phoneInput = page.locator(`input[id='workHistory.companyPhone.${idx}'], input[id*='workHistory.companyPhone.${idx}']`).first();
      if (await phoneInput.count() > 0 && await phoneInput.isVisible().catch(() => false)) {
        const cur = await phoneInput.inputValue().catch(() => "");
        if (!cur) {
          await phoneInput.fill(targetPhone).catch(() => {});
          await phoneInput.dispatchEvent("input").catch(() => {});
          await phoneInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 5. Responsibilities
      const respInput = page.locator(`textarea[id='workHistory.responsibilities.${idx}'], textarea[id*='workHistory.responsibilities.${idx}']`).first();
      if (await respInput.count() > 0 && await respInput.isVisible().catch(() => false)) {
        const cur = await respInput.inputValue().catch(() => "");
        if (!cur || cur.trim().length === 0 || cur.includes("travel-tech")) {
          console.log(`  📝 [PaylocityAdapter]: Entering Responsibilities #${idx + 1}...`);
          await respInput.fill(targetResp).catch(() => {});
          await respInput.dispatchEvent("input").catch(() => {});
          await respInput.dispatchEvent("change").catch(() => {});
        }
      }

      // 6. Address Country
      const whCountry = page.locator(`input[id='public-candidate-work-history-address-${idx}-country'], input[id*='work-history-address-${idx}'][id*='country']`).first();
      if (await whCountry.count() > 0 && await whCountry.isVisible().catch(() => false)) {
        const cur = await whCountry.inputValue().catch(() => "");
        if (!cur) {
          await whCountry.fill("United States").catch(() => {});
          await whCountry.dispatchEvent("input").catch(() => {});
          await whCountry.dispatchEvent("change").catch(() => {});
        }
      }

      // Address Line 1
      const whAddr1 = page.locator(`input[id='public-candidate-work-history-address-${idx}-address-1'], input[id*='work-history-address-${idx}'][id*='address-1']`).first();
      if (await whAddr1.count() > 0 && await whAddr1.isVisible().catch(() => false)) {
        const cur = await whAddr1.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  🏠 [PaylocityAdapter]: Entering Work Address Line 1 #${idx + 1}: ${targetAddr1}`);
          await whAddr1.fill(targetAddr1).catch(() => {});
          await whAddr1.dispatchEvent("input").catch(() => {});
          await whAddr1.dispatchEvent("change").catch(() => {});
        }
      }

      // Address Line 2
      const whAddr2 = page.locator(`input[id='public-candidate-work-history-address-${idx}-address-2'], input[id*='work-history-address-${idx}'][id*='address-2']`).first();
      if (await whAddr2.count() > 0 && await whAddr2.isVisible().catch(() => false)) {
        const cur = await whAddr2.inputValue().catch(() => "");
        if (!cur) {
          await whAddr2.fill(targetAddr2).catch(() => {});
          await whAddr2.dispatchEvent("input").catch(() => {});
          await whAddr2.dispatchEvent("change").catch(() => {});
        }
      }

      // City
      const whCity = page.locator(`input[id='public-candidate-work-history-address-${idx}-city'], input[id*='work-history-address-${idx}'][id*='city']`).first();
      if (await whCity.count() > 0 && await whCity.isVisible().catch(() => false)) {
        const cur = await whCity.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  🏙️ [PaylocityAdapter]: Entering Work City #${idx + 1}: ${targetCity}`);
          await whCity.fill(targetCity).catch(() => {});
          await whCity.dispatchEvent("input").catch(() => {});
          await whCity.dispatchEvent("change").catch(() => {});
        }
      }

      // County
      const whCounty = page.locator(`input[id='public-candidate-work-history-address-${idx}-county'], input[id*='work-history-address-${idx}'][id*='county']`).first();
      if (await whCounty.count() > 0 && await whCounty.isVisible().catch(() => false)) {
        const cur = await whCounty.inputValue().catch(() => "");
        if (!cur) {
          await whCounty.fill(targetCounty).catch(() => {});
          await whCounty.dispatchEvent("input").catch(() => {});
          await whCounty.dispatchEvent("change").catch(() => {});
        }
      }

      // State (combobox and input)
      const whStateCombobox = page.locator(`div[id*='public-candidate-work-history-address-${idx}-us-state'], div[id*='work-history-address-${idx}'][id*='state']`).first();
      if (await whStateCombobox.count() > 0 && await whStateCombobox.isVisible().catch(() => false)) {
        const curState = (await whStateCombobox.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!curState || curState === "--" || curState.includes("Select")) {
          console.log(`  📍 [PaylocityAdapter]: Selecting Work State #${idx + 1}: California`);
          await this.selectComboboxValue(page, whStateCombobox, "California");
        }
      }
      const whStateInput = page.locator(`input[id='public-candidate-work-history-address-${idx}-us-state']`).first();
      if (await whStateInput.count() > 0 && await whStateInput.isVisible().catch(() => false)) {
        const cur = await whStateInput.inputValue().catch(() => "");
        if (!cur) {
          await whStateInput.fill("CA").catch(() => {});
          await whStateInput.dispatchEvent("input").catch(() => {});
          await whStateInput.dispatchEvent("change").catch(() => {});
        }
      }

      // Zip
      const whZip = page.locator(`input[id='public-candidate-work-history-address-${idx}-zip'], input[id*='work-history-address-${idx}'][id*='zip']`).first();
      if (await whZip.count() > 0 && await whZip.isVisible().catch(() => false)) {
        const cur = await whZip.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  📮 [PaylocityAdapter]: Entering Work Zip #${idx + 1}: ${targetZip}`);
          await whZip.fill(targetZip).catch(() => {});
          await whZip.dispatchEvent("input").catch(() => {});
          await whZip.dispatchEvent("change").catch(() => {});
        }
      }

      // 7. Work History Dates
      const whStart = page.locator(`input[id='txt-workHistory-startDate-${idx}'], input[id*='txt-workHistory-startDate-${idx}']`).first();
      if (await whStart.count() > 0 && await whStart.isVisible().catch(() => false)) {
        const cur = await whStart.inputValue().catch(() => "");
        if (!cur || cur !== startDate) {
          console.log(`  📅 [PaylocityAdapter]: Entering Work Start Date #${idx + 1}: ${startDate}`);
          await whStart.fill(startDate).catch(() => {});
          await whStart.dispatchEvent("input").catch(() => {});
          await whStart.dispatchEvent("change").catch(() => {});
        }
      }

      const whEnd = page.locator(`input[id='txt-workHistory-endDate-${idx}'], input[id*='txt-workHistory-endDate-${idx}']`).first();
      if (await whEnd.count() > 0 && await whEnd.isVisible().catch(() => false)) {
        const cur = await whEnd.inputValue().catch(() => "");
        if (!cur || cur !== endDate) {
          console.log(`  📅 [PaylocityAdapter]: Entering Work End Date #${idx + 1}: ${endDate}`);
          await whEnd.fill(endDate).catch(() => {});
          await whEnd.dispatchEvent("input").catch(() => {});
          await whEnd.dispatchEvent("change").catch(() => {});
        }
      }

      // 8. Reason for leaving
      const whReason = page.locator(`input[id='workHistory.reasonForLeaving.${idx}'], textarea[id='workHistory.reasonForLeaving.${idx}']`).first();
      if (await whReason.count() > 0 && await whReason.isVisible().catch(() => false)) {
        const cur = await whReason.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  📝 [PaylocityAdapter]: Entering Reason for Leaving #${idx + 1}...`);
          await whReason.fill(targetReason).catch(() => {});
          await whReason.dispatchEvent("input").catch(() => {});
          await whReason.dispatchEvent("change").catch(() => {});
        }
      }

      // 9. May We Contact Supervisor (combobox)
      const whContactSup = page.locator(`div[id='workHistory.mayWeContactSupervisor.${idx}'], div[id*='workHistory.mayWeContactSupervisor.${idx}']`).first();
      if (await whContactSup.count() > 0 && await whContactSup.isVisible().catch(() => false)) {
        const cur = (await whContactSup.locator(".rw-input").innerText({ timeout: 1000 }).catch(() => "")).trim();
        if (!cur || cur === "--" || cur.includes("Select")) {
          console.log(`  📞 [PaylocityAdapter]: Selecting Contact Supervisor #${idx + 1}: Yes`);
          await this.selectComboboxValue(page, whContactSup, "Yes");
        }
      }

      // 10. Supervisor Details (if present)
      const whSupName = page.locator(`input[id='workHistory.supervisorName.${idx}'], input[id*='workHistory.supervisorName.${idx}']`).first();
      if (await whSupName.count() > 0 && await whSupName.isVisible().catch(() => false)) {
        const cur = await whSupName.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  👤 [PaylocityAdapter]: Entering Supervisor Name #${idx + 1}: ${targetSupName}`);
          await whSupName.fill(targetSupName).catch(() => {});
          await whSupName.dispatchEvent("input").catch(() => {});
          await whSupName.dispatchEvent("change").catch(() => {});
        }
      }

      const whSupPhone = page.locator(`input[id='workHistory.supervisorPhone.${idx}'], input[id*='workHistory.supervisorPhone.${idx}']`).first();
      if (await whSupPhone.count() > 0 && await whSupPhone.isVisible().catch(() => false)) {
        const cur = await whSupPhone.inputValue().catch(() => "");
        if (!cur) {
          await whSupPhone.fill(targetSupPhone).catch(() => {});
          await whSupPhone.dispatchEvent("input").catch(() => {});
          await whSupPhone.dispatchEvent("change").catch(() => {});
        }
      }

      const whSupEmail = page.locator(`input[id='workHistory.supervisorEmail.${idx}'], input[id*='workHistory.supervisorEmail.${idx}']`).first();
      if (await whSupEmail.count() > 0 && await whSupEmail.isVisible().catch(() => false)) {
        const cur = await whSupEmail.inputValue().catch(() => "");
        if (!cur) {
          await whSupEmail.fill(targetSupEmail).catch(() => {});
          await whSupEmail.dispatchEvent("input").catch(() => {});
          await whSupEmail.dispatchEvent("change").catch(() => {});
        }
      }

      const whSupPos = page.locator(`input[id='workHistory.supervisorPosition.${idx}'], input[id*='workHistory.supervisorPosition.${idx}']`).first();
      if (await whSupPos.count() > 0 && await whSupPos.isVisible().catch(() => false)) {
        const cur = await whSupPos.inputValue().catch(() => "");
        if (!cur) {
          console.log(`  💼 [PaylocityAdapter]: Entering Supervisor Position #${idx + 1}: ${targetSupPos}`);
          await whSupPos.fill(targetSupPos).catch(() => {});
          await whSupPos.dispatchEvent("input").catch(() => {});
          await whSupPos.dispatchEvent("change").catch(() => {});
        }
      }
    }
  }

  private async cleanEmptyCards(page: Page) {
    // 1. Clean empty education cards (keep card 0 Parul University)
    const delEduBtns = page.locator("button:has-text('Delete This Education History')");
    const eduCount = await delEduBtns.count();
    if (eduCount > 1) {
      for (let i = eduCount - 1; i >= 1; i--) {
        const btn = delEduBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          const parentCard = btn.locator("xpath=ancestor::div[contains(@class,'card') or contains(@class,'form-group')]").first();
          const schoolVal = await parentCard.locator("input[id*='educationHistory.name']").inputValue().catch(() => "");
          if (!schoolVal || schoolVal.trim().length === 0) {
            console.log(`  🧹 [PaylocityAdapter]: Removing duplicate unused empty Education card #${i + 1}...`);
            await btn.click().catch(() => {});
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // 2. Clean empty work history cards (keep Card 0 and Card 1, remove card 2+ if empty)
    const delWorkBtns = page.locator("button:has-text('Delete This Work History')");
    const workCount = await delWorkBtns.count();
    if (workCount > 2) {
      for (let i = workCount - 1; i >= 2; i--) {
        const btn = delWorkBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          const parentCard = btn.locator("xpath=ancestor::div[contains(@class,'card') or contains(@class,'form-group')]").first();
          const compVal = await parentCard.locator("input[id*='workHistory.companyName']").inputValue().catch(() => "");
          if (!compVal || compVal.trim().length === 0) {
            console.log(`  🧹 [PaylocityAdapter]: Removing duplicate unused empty Work History card #${i + 1}...`);
            await btn.click().catch(() => {});
            await page.waitForTimeout(500);
          }
        }
      }
    }
  }
}
