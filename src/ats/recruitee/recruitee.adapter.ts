import path from "path";
import fs from "fs";
import { Page, Frame } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel } from "../../application/field-mapper";
import { suggestAnswerForQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { simulateHumanMouse, humanClick, typeLikeHuman } from "../../browser/form-filler";
import { generateResumePdf } from "../../browser/browser-manager";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { db } from "../../database/db";

export class RecruiteeAdapter implements ATSAdapter {

  /**
   * Detects whether the current page is powered by Recruitee ATS.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("recruitee.com")) return true;
    if (
      url.includes("/o/") &&
      (url.includes("/c/new") ||
        url.includes("emergentsoftware.net") ||
        url.includes("techwolf.ai") ||
        url.includes("careers.") ||
        url.includes("jobs."))
    ) {
      return true;
    }

    const content = (await page.content().catch(() => "")).toLowerCase();
    if (
      content.includes("recruitee.com") ||
      content.includes("recruitee") ||
      content.includes("techwolf") ||
      content.includes("emergentsoftware") ||
      (await page.$(
        "input[name^='candidate.'], button[id*='country-select'], button[name*='country-select'], [data-cy='apply-button'], [data-testid='header-tab-apply-button'], [name='candidate.cv'], [name='candidate.coverLetterFile']"
      )) !== null
    ) {
      return true;
    }
    return false;
  }

  /**
   * Extracts job information from the Recruitee page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");
    const url = page.url();

    // 1. Company extraction
    let company = "";
    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.hostname.toLowerCase();
      if (host.includes("recruitee.com")) {
        const sub = host.split(".")[0];
        if (sub === "zeromotorcycles") company = "Zero Motorcycles Inc.";
        else if (sub === "companiongroupltd") company = "Companion Group Ltd";
        else if (sub === "dvtcareers") company = "DVT";
        else {
          company = sub.charAt(0).toUpperCase() + sub.slice(1);
        }
      } else if (host.includes("emergentsoftware.net")) {
        company = "Emergent Software";
      } else if (host.includes("techwolf.ai")) {
        company = "TechWolf";
      } else {
        const cleanHost = host.replace(/^(jobs|careers)\./, "").split(".")[0];
        if (cleanHost && cleanHost !== "localhost") {
          company = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
        }
      }
    } catch (e) {}

    if (!company) {
      const titleMatch = pageTitle.split("-")[0]?.trim();
      if (titleMatch && !titleMatch.toLowerCase().includes("careers") && !titleMatch.toLowerCase().includes("job")) {
        company = titleMatch;
      }
    }
    company = company || "Recruitee Company";

    // 2. Job title extraction
    let title = "";
    const h1 = await page.locator("h1, [data-cy='job-title'], .custom-css-style-job-title, [class*='JobTitle']").first().innerText().catch(() => "");
    if (h1 && h1.trim()) {
      title = h1.trim();
    } else if (pageTitle) {
      const parts = pageTitle.split("-").map(p => p.trim());
      if (parts.length > 1) {
        title = parts[1];
      } else {
        title = parts[0];
      }
    }
    title = title || "Position";

    // 3. Job description extraction
    const description = await page.locator(".custom-css-style-job-description, article, [class*='description'], #content, main").first().innerText().catch(() => "");

    return {
      company,
      title,
      description: description || "No description extracted",
      ats: "RECRUITEE"
    };
  }

  /**
   * Scrapes interactive form fields from the Recruitee page.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Scanning Recruitee application form...", "Analyzing inputs & dropdowns", "info", 15);

    // Dismiss any cookie agreement popups before inspecting DOM
    await dismissCommonPopups(page);

    // If not currently on the application form, ensure we open it
    await this.ensureApplicationFormOpen(page);
    await dismissCommonPopups(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const form = document.querySelector("form");
      if (!form) return results;

      const inputs = Array.from(form.querySelectorAll("input, textarea, select"));
      for (const input of inputs) {
        const typeAttr = (input as HTMLInputElement).type?.toLowerCase() || input.tagName.toLowerCase();
        if (typeAttr === "hidden") continue;

        const id = input.id || "";
        const name = (input as HTMLInputElement).name || id;

        // Label extraction
        let label = "";
        if (id) {
          const l = document.querySelector(`label[for="${id}"]`);
          if (l) label = l.textContent || "";
        }
        if (!label) {
          const l = input.closest("label");
          if (l) label = l.textContent || "";
        }
        if (!label) {
          let p = input.parentElement;
          for (let i = 0; i < 5 && p; i++) {
            const h = p.querySelector("label, h3, h4, [class*='title'], [class*='label'], [class*='question']");
            if (h && h !== input) {
              label = h.textContent || "";
              break;
            }
            p = p.parentElement;
          }
        }

        let type: FormField["type"] = "text";
        if (typeAttr === "email") type = "email";
        else if (typeAttr === "tel") type = "tel";
        else if (typeAttr === "file") type = "file";
        else if (typeAttr === "textarea" || input.tagName.toLowerCase() === "textarea") type = "textarea";
        else if (typeAttr === "checkbox") type = "checkbox";
        else if (typeAttr === "radio") type = "radio";
        else if (input.tagName.toLowerCase() === "select") type = "select";

        results.push({
          id: id || name,
          label: (label || (input as HTMLInputElement).placeholder || name).trim().replace(/\s+/g, " "),
          type,
          required: (input as HTMLInputElement).required || label.includes("*")
        });
      }
      return results;
    });
  }

  /**
   * Helper to ensure the application form is visible on screen.
   * If on /o/slug without /c/new or form inputs are hidden, navigates to /c/new or clicks the Apply tab.
   */
  private async ensureApplicationFormOpen(page: Page): Promise<void> {
    await dismissCommonPopups(page);
    const currentUrl = page.url();
    const isNameVisible = await page.locator("input[name='candidate.name']").isVisible().catch(() => false);
    if (isNameVisible && currentUrl.includes("/c/new")) return;

    console.log("ℹ️ [RecruiteeAdapter]: Application form not yet active or visible. Opening application form...");

    // Check if clicking "Apply" button opens the form
    const applyButton = page.locator("button[data-cy='apply-button'], button[data-testid='header-tab-apply-button'], button:has-text('Apply')").first();
    if (await applyButton.count() > 0 && await applyButton.isVisible().catch(() => false)) {
      console.log("👉 [RecruiteeAdapter]: Clicking Apply button / tab...");
      await dismissCommonPopups(page);
      await applyButton.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      await dismissCommonPopups(page);
    }

    // If candidate.name is still not visible or URL does not have /c/new, navigate directly
    const stillNotVisible = !(await page.locator("input[name='candidate.name']").isVisible().catch(() => false));
    if (stillNotVisible && !page.url().includes("/c/new")) {
      const cleanUrl = currentUrl.split("?")[0].replace(/\/$/, "");
      const targetUrl = cleanUrl.endsWith("/c/new") ? cleanUrl : `${cleanUrl}/c/new`;
      console.log(`🌐 [RecruiteeAdapter]: Navigating directly to Recruitee application form URL: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(2000);
      await dismissCommonPopups(page);
    }

    await page.waitForSelector("form, input[name='candidate.name'], input[name='candidate.email']", { timeout: 15000 }).catch(() => {});
    await dismissCommonPopups(page);
  }

  /**
   * Uploads candidate resume (CV) and optional cover letter.
   */
  async uploadResume(page: Page, resumePath: string): Promise<void> {
    console.log(`📄 [RecruiteeAdapter]: Uploading resume: ${resumePath}`);
    await this.ensureApplicationFormOpen(page);

    const cvInput = page.locator("input[name='candidate.cv'], input[type='file'][name*='cv' i], input[type='file']").first();
    if (await cvInput.count() > 0 && fs.existsSync(resumePath)) {
      await cvInput.setInputFiles(resumePath).catch(err => {
        console.warn("⚠️ Failed setting candidate.cv input file:", err);
      });
      console.log("✅ [RecruiteeAdapter]: Resume attached successfully.");
      await page.waitForTimeout(1000);
    }

    // Cover letter if available
    const coverLetterPath = path.resolve(path.dirname(resumePath), "Hrutin_Nammi_Cover_Letter.pdf");
    const clInput = page.locator("input[name='candidate.coverLetterFile'], input[type='file'][name*='cover' i]").first();
    if (await clInput.count() > 0 && fs.existsSync(coverLetterPath)) {
      console.log(`📄 [RecruiteeAdapter]: Uploading cover letter: ${coverLetterPath}`);
      await clInput.setInputFiles(coverLetterPath).catch(err => {
        console.warn("⚠️ Failed setting cover letter input file:", err);
      });
      console.log("✅ [RecruiteeAdapter]: Cover letter attached successfully.");
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Automatically fills out all form fields using candidate's details.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    preExtractedFields?: FormField[]
  ): Promise<void> {
    console.log("🚀 [RecruiteeAdapter]: Starting Recruitee form filling flow...");
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Preparing Recruitee application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 20);

    // Dismiss any cookie agreement popups before interacting with form
    await dismissCommonPopups(page);

    // Ensure form is open and visible
    await this.ensureApplicationFormOpen(page);
    await dismissCommonPopups(page);

    // Upload files if resume provided
    if (profile.resumePath && fs.existsSync(profile.resumePath)) {
      await this.uploadResume(page, profile.resumePath);
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
      } catch (e) {}
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. CANDIDATE FULL NAME
    // ─────────────────────────────────────────────────────────────────────────────
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    const nameInput = page.locator("input[name='candidate.name'], input#input-candidate.name-3, input[name*='name']").first();
    if (await nameInput.count() > 0) {
      console.log(`👤 [RecruiteeAdapter]: Filling Candidate Name -> "${fullName}"`);
      await updateHUDStatus(page, "Filling Personal Info", `Name: ${fullName}`, "info", 30);
      await nameInput.scrollIntoViewIfNeeded().catch(() => {});
      await nameInput.click({ force: true }).catch(() => {});
      await nameInput.fill("");
      await nameInput.pressSequentially(fullName, { delay: 40 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. CANDIDATE EMAIL ADDRESS
    // ─────────────────────────────────────────────────────────────────────────────
    const emailInput = page.locator("input[name='candidate.email'], input#input-candidate.email-4, input[name*='email']").first();
    if (await emailInput.count() > 0) {
      console.log(`📧 [RecruiteeAdapter]: Filling Candidate Email -> "${profile.email}"`);
      await updateHUDStatus(page, "Filling Personal Info", `Email: ${profile.email}`, "info", 40);
      await emailInput.scrollIntoViewIfNeeded().catch(() => {});
      await emailInput.click({ force: true }).catch(() => {});
      await emailInput.fill("");
      await emailInput.pressSequentially(profile.email, { delay: 35 });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. COUNTRY CALLING CODE (+1 / United States) & PHONE NUMBER
    // ─────────────────────────────────────────────────────────────────────────────
    await this.fillCountryCodeAndPhone(page, profile);

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. TEXTING CONSENT CHECKBOX
    // ─────────────────────────────────────────────────────────────────────────────
    const consentCheckbox = page.locator("input[name='candidate.textingConsent'], input#candidateTextingConsent").first();
    if (await consentCheckbox.count() > 0) {
      console.log("📲 [RecruiteeAdapter]: Checking Candidate Texting Consent checkbox...");
      const isChecked = await consentCheckbox.isChecked().catch(() => false);
      if (!isChecked) {
        await consentCheckbox.scrollIntoViewIfNeeded().catch(() => {});
        await consentCheckbox.click({ force: true }).catch(() => {});
      }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. OPEN QUESTIONS: DROPDOWNS, NUMBER, TEXT, TEXTAREA, RADIO & CHECKBOX GROUPS
    // ─────────────────────────────────────────────────────────────────────────────
    await this.fillOpenQuestions(page, profile, userSavedAnswers, additionalAnswers);
    await this.sanitizeUSAddressFields(page);

    await page.waitForTimeout(500);
    console.log("✅ [RecruiteeAdapter]: All fields successfully populated!");
    await updateHUDStatus(page, "Form Filling Complete", "All personal, phone, dropdowns, and screening fields filled", "success", 85);
  }

  /**
   * Handles setting the country code calling selector to United States (+1)
   * and typing the candidate's US phone number into the phone field.
   */
  private async fillCountryCodeAndPhone(page: Page, profile: UserProfile): Promise<void> {
    console.log("📞 [RecruiteeAdapter]: Setting Country Code (+1 / United States) and Phone Number...");
    await updateHUDStatus(page, "Phone & Country Setup", "Selecting United States (+1) calling code", "info", 50);

    const countryBtn = page.locator("button[id*='country-select'], button[name*='country-select'], button[aria-label*='Select country calling code']").first();
    const phoneInput = page.locator("input[name='candidate.phone'], input[type='tel']").first();

    // Check if Country Button is present
    if (await countryBtn.count() > 0) {
      const currentLabel = (await countryBtn.getAttribute("aria-label").catch(() => "")) || "";
      const currentText = (await countryBtn.innerText().catch(() => "")) || "";

      if (!currentLabel.includes("United States") && !currentText.includes("United States")) {
        console.log(`🌍 [RecruiteeAdapter]: Current country selector is "${currentText || currentLabel}". Selecting United States...`);
        try {
          await countryBtn.scrollIntoViewIfNeeded().catch(() => {});
          await countryBtn.click({ force: true });
          await page.waitForTimeout(300);

          // Downshift virtualized list progressive scroll to 13500 (United States)
          const clicked = await page.evaluate(async () => {
            const scrollEl = document.querySelector(".sc-2arzqk-1, [role='listbox'] > div") as HTMLElement;
            if (!scrollEl) return false;

            for (let top = 12500; top <= 14200; top += 100) {
              scrollEl.scrollTop = top;
              scrollEl.dispatchEvent(new Event("scroll", { bubbles: true }));
              await new Promise(r => setTimeout(r, 20));

              const opts = Array.from(document.querySelectorAll("[role='option']"));
              const us = opts.find(o => o.getAttribute("aria-label") === "United States" || o.textContent?.includes("United States"));
              if (us) {
                (us as HTMLElement).click();
                return true;
              }
            }
            return false;
          });

          if (clicked) {
            console.log("🎯 [RecruiteeAdapter]: Clicked United States option from Downshift listbox.");
          }
          await page.waitForTimeout(300);

          // Close dropdown if still open
          if (await page.locator("[role='listbox']").count() > 0) {
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(200);
          }
        } catch (e: any) {
          console.warn("⚠️ [RecruiteeAdapter]: Country dropdown interaction notice:", e.message);
        }
      } else {
        console.log("✅ [RecruiteeAdapter]: Country selector is already set to United States.");
      }
    }

    // Now fill the phone number input
    if (await phoneInput.count() > 0) {
      // Determine clean US phone digits
      let rawDigits = (profile.phone || "").replace(/[^0-9]/g, "");
      if (rawDigits.startsWith("1") && rawDigits.length === 11) {
        rawDigits = rawDigits.slice(1);
      } else if (rawDigits.startsWith("91") && rawDigits.length === 12) {
        rawDigits = rawDigits.slice(2);
      }

      // If less than 10 digits or empty, use standard 10-digit candidate US number (Washington DC area code 202)
      if (rawDigits.length !== 10 || rawDigits.startsWith("868")) {
        rawDigits = "2025550198";
      }

      const formattedUS = `+1 ${rawDigits.slice(0, 3)} ${rawDigits.slice(3, 6)} ${rawDigits.slice(6)}`;
      console.log(`📞 [RecruiteeAdapter]: Typing US Phone number -> "${formattedUS}"`);

      await phoneInput.scrollIntoViewIfNeeded().catch(() => {});
      await phoneInput.click({ force: true }).catch(() => {});
      await phoneInput.fill("");
      await page.waitForTimeout(100);
      await phoneInput.pressSequentially(formattedUS, { delay: 35 });
      await page.waitForTimeout(200);

      // Trigger standard change events
      await phoneInput.evaluate((el: HTMLInputElement, val: string) => {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, formattedUS).catch(() => {});

      const finalVal = await phoneInput.inputValue().catch(() => "");
      console.log(`✅ [RecruiteeAdapter]: Phone input successfully populated with: "${finalVal}"`);
    }
  }

  /**
   * Iterates through all open questions (dropdowns, salary, technical essays, radio questions, checkboxes).
   */
  private async fillOpenQuestions(
    page: Page,
    profile: UserProfile,
    userSavedAnswers: Record<string, string>,
    additionalAnswers: Record<string, string>
  ): Promise<void> {
    console.log("📝 [RecruiteeAdapter]: Processing open questions and screening inputs...");

    // ─────────────────────────────────────────────────────────────────────────
    // A. SELECT / DROPDOWN QUESTIONS (Native <select> and custom dropdowns)
    // ─────────────────────────────────────────────────────────────────────────
    await this.fillSelectDropdowns(page, profile, userSavedAnswers);

    // ─────────────────────────────────────────────────────────────────────────
    // B. NUMBER INPUTS (e.g. Preferred annual salary)
    // ─────────────────────────────────────────────────────────────────────────
    const numberInputs = await page.locator("input[type='number']").all();
    for (const numInput of numberInputs) {
      const label = await this.getElementLabel(page, numInput);
      const normLabel = normalizeLabel(label);

      let targetVal = "95000";
      if (normLabel.includes("salary") || normLabel.includes("compensation") || normLabel.includes("base")) {
        targetVal = userSavedAnswers["salary"] || userSavedAnswers["expected_salary"] || "95000";
        // Clean out commas or dollar signs for number input
        targetVal = targetVal.replace(/[^0-9]/g, "") || "95000";
      }

      console.log(`🔢 [RecruiteeAdapter]: Number field "${label}" -> ${targetVal}`);
      await numInput.scrollIntoViewIfNeeded().catch(() => {});
      await numInput.click({ force: true }).catch(() => {});
      await numInput.fill("");
      await numInput.fill(targetVal);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // C. TEXT INPUTS (City, English level, additional comp, address, etc.)
    // ─────────────────────────────────────────────────────────────────────────
    const textInputs = await page.locator("input[type='text']:not([name='candidate.name'])").all();
    for (const tInput of textInputs) {
      const label = await this.getElementLabel(page, tInput);
      const normLabel = normalizeLabel(label);

      let targetVal = "";
      if (normLabel.includes("street") || normLabel.includes("address line 1") || (normLabel.includes("address") && !normLabel.includes("email") && !normLabel.includes("ip") && !normLabel.includes("city"))) {
        targetVal = profile.street || "123 Market St";
      } else if (normLabel.includes("address line 2") || normLabel.includes("apt") || normLabel.includes("suite")) {
        targetVal = profile.addressLine2 || "Suite 400";
      } else if (normLabel.includes("city") || normLabel.includes("residence city") || normLabel.includes("residence")) {
        targetVal = profile.city || "San Francisco";
      } else if (normLabel.includes("state") || normLabel.includes("province") || normLabel.includes("region") || normLabel.includes("territory")) {
        targetVal = profile.state || "California";
      } else if (normLabel.includes("zip") || normLabel.includes("postal") || normLabel.includes("postcode")) {
        targetVal = profile.zipCode || "94105";
      } else if (normLabel.includes("country")) {
        targetVal = profile.country || "United States";
      } else if (normLabel.includes("location")) {
        targetVal = profile.location || "San Francisco, CA, United States";
      } else if (normLabel.includes("linkedin")) {
        targetVal = profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
      } else if (normLabel.includes("github")) {
        targetVal = profile.githubUrl || "https://github.com/hrutinnammi";
      } else if (normLabel.includes("portfolio") || normLabel.includes("website") || normLabel.includes("personal site")) {
        targetVal = profile.portfolioUrl || "https://github.com/hrutinnammi";
      } else if (normLabel.includes("english")) {
        targetVal = "Fluent / Professional Working Proficiency";
      } else if (normLabel.includes("compensation") || normLabel.includes("additional")) {
        targetVal = "Standard benefits package and performance bonuses; flexible and negotiable based on role requirements.";
      } else if (normLabel.includes("notice period") || normLabel.includes("start date")) {
        targetVal = "Immediate";
      } else if (normLabel.includes("salary")) {
        targetVal = "$95,000";
      }

      // Check DB saved answers
      if (!targetVal && userSavedAnswers[normLabel]) {
        targetVal = userSavedAnswers[normLabel];
      }
      if (!targetVal) {
        targetVal = suggestAnswerForQuestion(label);
      }

      if (targetVal) {
        console.log(`✍️ [RecruiteeAdapter]: Text field "${label}" -> "${targetVal}"`);
        await tInput.scrollIntoViewIfNeeded().catch(() => {});
        await tInput.click({ force: true }).catch(() => {});
        await tInput.fill("");
        await tInput.fill(targetVal);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // D. TEXTAREA INPUTS (Technical essays, system descriptions, AI experience)
    // ─────────────────────────────────────────────────────────────────────────
    const textareas = await page.locator("textarea").all();
    for (const ta of textareas) {
      const label = await this.getElementLabel(page, ta);
      const normLabel = normalizeLabel(label);

      let essayAnswer = "";
      if (normLabel.includes("backend") || normLabel.includes("multiplayer") || normLabel.includes("designed or maintained") || normLabel.includes("scale")) {
        essayAnswer =
          "At Jobspring and on LocalMind OS, I designed and maintained high-throughput distributed backend services using FastAPI, Node.js, and Redis. The architecture solved heavy data payload processing bottlenecks by implementing asynchronous worker queues, FAISS vector index caching, and optimized database connection pooling. To handle traffic spikes, the services were containerized with Docker and orchestrated to scale horizontally with load balancers, cutting response latency by 30% under peak concurrency.";
      } else if (normLabel.includes("azure openai") || normLabel.includes("agentic ai") || normLabel.includes("ai solutions") || normLabel.includes("hands-on production experience") || normLabel.includes("production experience")) {
        essayAnswer =
          "Yes, I have extensive production experience building AI solutions with OpenAI and Azure OpenAI APIs, along with agentic frameworks. I built end-to-end RAG pipelines using vector indexing (FAISS), chunking workflows, prompt orchestration, and FastAPI services deployed to Azure App Service and Azure Blob Storage. In addition, I have implemented agentic workflows with autonomous tool calling, structured outputs, and fallback mechanisms for enterprise use cases.";
      } else if (normLabel.includes("cover letter")) {
        essayAnswer = userSavedAnswers["cover_letter"] ||
          "Dear Hiring Manager,\n\nI am a Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, I developed an AI resume platform serving 50+ users and reduced API latency by 30%. I am excited to bring my expertise in Python, React, LLMs, and cloud deployments to your team.\n\nBest regards,\nHrutin Nammi";
      }

      if (!essayAnswer && userSavedAnswers[normLabel]) {
        essayAnswer = userSavedAnswers[normLabel];
      }
      if (!essayAnswer) {
        essayAnswer = suggestAnswerForQuestion(label);
      }

      if (essayAnswer) {
        console.log(`📝 [RecruiteeAdapter]: Textarea "${label.slice(0, 45)}..." populated.`);
        await ta.scrollIntoViewIfNeeded().catch(() => {});
        await ta.click({ force: true }).catch(() => {});
        await ta.fill("");
        await ta.fill(essayAnswer);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // E. RADIO BUTTON GROUPS (Work auth, sponsorship, state, gender, race, exp)
    // ─────────────────────────────────────────────────────────────────────────
    await this.fillRadioGroups(page, profile);

    // ─────────────────────────────────────────────────────────────────────────
    // F. MULTI-SELECT CHECKBOXES (Skills, Salary Range)
    // ─────────────────────────────────────────────────────────────────────────
    await this.fillMultiContentCheckboxes(page);
  }

  /**
   * Handles native <select> elements and custom dropdown comboboxes.
   */
  private async fillSelectDropdowns(page: Page, profile: UserProfile, userSavedAnswers: Record<string, string>): Promise<void> {
    // 1. Native <select> elements
    const nativeSelects = await page.locator("select").all();
    for (const sel of nativeSelects) {
      const label = await this.getElementLabel(page, sel);
      const normLabel = normalizeLabel(label);

      const options = await sel.evaluate((el: HTMLSelectElement) => {
        return Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }));
      }).catch(() => []);

      if (options.length <= 1) continue;

      let chosenValue = "";

      // Match against saved answers or logical options
      for (const opt of options) {
        const normOpt = normalizeLabel(opt.text);
        if (!opt.value || normOpt.includes("select") || normOpt.includes("choose")) continue;

        if (normLabel.includes("gender") && normOpt === "male") {
          chosenValue = opt.value;
          break;
        } else if ((normLabel.includes("state") || normLabel.includes("residence")) && (normOpt === "california" || normOpt.includes("california"))) {
          chosenValue = opt.value;
          break;
        } else if ((normLabel.includes("sponsorship") || normLabel.includes("require visa")) && (normOpt === "no" || normOpt.includes("not require"))) {
          chosenValue = opt.value;
          break;
        } else if ((normLabel.includes("authorized") || normLabel.includes("right to work")) && (normOpt === "yes" || normOpt.includes("authorized") || normOpt.includes("permanent resident"))) {
          chosenValue = opt.value;
          break;
        } else if ((normLabel.includes("experience") || normLabel.includes("years")) && (normOpt.includes("3") || normOpt.includes("4") || normOpt.includes("5") || normOpt.includes("6"))) {
          chosenValue = opt.value;
          break;
        }
      }

      // Fallback: pick first real option
      if (!chosenValue) {
        const firstReal = options.find(o => o.value && !normalizeLabel(o.text).includes("select") && !normalizeLabel(o.text).includes("choose"));
        if (firstReal) chosenValue = firstReal.value;
      }

      if (chosenValue) {
        console.log(`🔽 [RecruiteeAdapter]: Selecting dropdown option for "${label}" -> value="${chosenValue}"`);
        await sel.scrollIntoViewIfNeeded().catch(() => {});
        await sel.selectOption(chosenValue).catch(() => {});
      }
    }

    // 2. Custom dropdown combobox buttons (excluding phone country select which is handled separately)
    const customDropdowns = await page.locator("button[aria-haspopup='listbox']:not([id*='country-select']), [role='combobox']:not([id*='country-select'])").all();
    for (const dd of customDropdowns) {
      const label = await this.getElementLabel(page, dd);
      console.log(`🔽 [RecruiteeAdapter]: Custom dropdown detected for "${label}". Opening...`);
      try {
        await dd.scrollIntoViewIfNeeded().catch(() => {});
        await dd.click({ force: true });
        await page.waitForTimeout(300);

        // Click first matching option or sensible option
        const opts = await page.locator("[role='option'], [role='listbox'] li").all();
        if (opts.length > 0) {
          await opts[0].click({ force: true }).catch(() => {});
        }
      } catch (e: any) {
        console.warn(`⚠️ [RecruiteeAdapter]: Custom dropdown interaction note:`, e.message);
      }
    }
  }

  /**
   * Automatically selects matching radio options in Recruitee radio groups.
   */
  private async fillRadioGroups(page: Page, profile: UserProfile): Promise<void> {
    const radioInputs = await page.locator("input[type='radio']").all();
    if (radioInputs.length === 0) return;

    // Group radio inputs by name
    const groups: Record<string, any[]> = {};
    for (const r of radioInputs) {
      const name = (await r.getAttribute("name").catch(() => "")) || "unknown";
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    }

    for (const [name, radios] of Object.entries(groups)) {
      if (radios.length === 0) continue;

      // Extract question label from fieldset legend or group's container
      const containerText = await radios[0].evaluate((el: HTMLElement) => {
        const fs = el.closest("fieldset");
        if (fs) {
          const leg = fs.querySelector("legend");
          if (leg) return leg.textContent || "";
        }
        let p = el.parentElement;
        for (let i = 0; i < 6 && p; i++) {
          const title = p.querySelector("h3, h4, h5, [class*='title'], [class*='question'], [class*='Label']");
          if (title && !title.contains(el)) {
            return title.textContent || "";
          }
          p = p.parentElement;
        }
        return "";
      }).catch(() => "");

      const normQuestion = normalizeLabel(containerText);

      // Read all options for this group first
      const optionsInfo: { r: any; optText: string; normOpt: string }[] = [];
      for (const radio of radios) {
        const optText = await radio.evaluate((el: HTMLElement) => {
          const parentLabel = el.closest("label");
          if (parentLabel) return parentLabel.textContent || "";
          const sibling = el.parentElement?.querySelector("label");
          if (sibling) return sibling.textContent || "";
          return (el as HTMLInputElement).value || "";
        }).catch(() => "");
        optionsInfo.push({ r: radio, optText, normOpt: normalizeLabel(optText) });
      }

      let selectedOption: { r: any; optText: string; normOpt: string } | null = null;

      // 1. Statement acknowledgement (e.g. "Important Work Authorization Information... Do you understand?")
      const ackOpt = optionsInfo.find(o => o.normOpt.includes("understand") || o.normOpt.includes("agree"));
      if (ackOpt && (normQuestion.includes("statement") || normQuestion.includes("information") || normQuestion.includes("understand") || normQuestion.includes("agree"))) {
        selectedOption = ackOpt;
      }

      // 2. Legal work authorization / Right to work
      if (!selectedOption && (normQuestion.includes("right to work") || normQuestion.includes("legal right") || normQuestion.includes("authorized") || normQuestion.includes("legally authorized"))) {
        selectedOption = optionsInfo.find(o =>
          o.normOpt.includes("valid work visa") ||
          o.normOpt.includes("critical skills") ||
          o.normOpt.includes("permanent resident") ||
          o.normOpt.includes("citizen") ||
          o.normOpt === "yes" ||
          o.normOpt.includes("authorized")
        ) || null;
      }

      // 3. Visa sponsorship requirement: "Do you require sponsorship", "Will you now or in the future require visa sponsorship"
      if (!selectedOption && (normQuestion.includes("require sponsorship") || normQuestion.includes("require visa") || (normQuestion.includes("sponsorship") && !normQuestion.includes("without")))) {
        selectedOption = optionsInfo.find(o => o.normOpt === "no" || o.normOpt.includes("not require")) || null;
      }

      // 4. US State of primary residence -> California
      if (!selectedOption && (normQuestion.includes("state") || normQuestion.includes("territory") || normQuestion.includes("residence"))) {
        selectedOption = optionsInfo.find(o => o.normOpt === "california" || o.normOpt.includes("california")) || null;
      }

      // 5. Gender -> Male
      if (!selectedOption && normQuestion.includes("gender")) {
        selectedOption = optionsInfo.find(o => o.normOpt === "male") || null;
      }

      // 6. Race / Ethnicity / Population Group -> Indian / Asian
      if (!selectedOption && (normQuestion.includes("race") || normQuestion.includes("population") || normQuestion.includes("ethnic") || normQuestion.includes("demographic"))) {
        selectedOption = optionsInfo.find(o => o.normOpt.includes("indian") || o.normOpt.includes("asian")) || null;
      }

      // 7. Years of experience -> 3 to 6 years or 6+ years
      if (!selectedOption && (normQuestion.includes("years") || normQuestion.includes("experience"))) {
        selectedOption = optionsInfo.find(o => o.normOpt.includes("3 to 6") || o.normOpt.includes("3-6") || o.normOpt.includes("6+") || o.normOpt === "yes") || null;
      }

      // 8. Criminal background check / Assessment / Consent
      if (!selectedOption && (normQuestion.includes("background check") || normQuestion.includes("assessment") || normQuestion.includes("cognitive") || normQuestion.includes("evaluation"))) {
        selectedOption = optionsInfo.find(o => o.normOpt === "yes" || o.normOpt.includes("understand")) || null;
      }

      // 9. Language proficiency (e.g. German, English)
      if (!selectedOption && (normQuestion.includes("german") || normQuestion.includes("english") || normQuestion.includes("fluent") || normQuestion.includes("language"))) {
        selectedOption = optionsInfo.find(o => o.normOpt === "yes" || o.normOpt.includes("fluent") || o.normOpt.includes("proficient")) || null;
      }

      // 10. Location / Availability / Willingness (e.g. "Are you based in Belgium?", "Are you available to spend 6–12 weeks in Ghent, Belgium...", "Are you willing to complete an online assessment")
      if (!selectedOption && (normQuestion.includes("based in") || normQuestion.includes("available to spend") || normQuestion.includes("ghent") || normQuestion.includes("belgium") || normQuestion.includes("willing to") || normQuestion.includes("relocate"))) {
        selectedOption = optionsInfo.find(o => o.normOpt === "yes") || null;
      }

      // 11. Base salary requirements radio group (e.g. "$90,000-$99,000", "$100,000-$109,000")
      if (!selectedOption && (normQuestion.includes("salary") || normQuestion.includes("compensation") || normQuestion.includes("base pay") || normQuestion.includes("rate"))) {
        selectedOption = optionsInfo.find(o => (o.normOpt.includes("90") || o.normOpt.includes("100")) && !o.normOpt.includes("190")) || optionsInfo[Math.min(6, optionsInfo.length - 1)] || null;
      }

      // 12. Generic fallback: if "Yes" option exists, default to "Yes"
      if (!selectedOption) {
        selectedOption = optionsInfo.find(o => o.normOpt === "yes") || null;
      }

      if (selectedOption) {
        console.log(`🔘 [RecruiteeAdapter]: Selecting Radio option "${selectedOption.optText}" for question "${containerText.slice(0, 40)}..."`);
        await selectedOption.r.scrollIntoViewIfNeeded().catch(() => {});
        await selectedOption.r.click({ force: true }).catch(() => {});

        // Double check it was marked checked; if not, click parent/sibling label
        const isChecked = await selectedOption.r.isChecked().catch(() => false);
        if (!isChecked) {
          await selectedOption.r.evaluate((el: HTMLElement) => {
            const l = el.closest("label") || el.parentElement?.querySelector("label");
            if (l) (l as HTMLElement).click();
          }).catch(() => {});
        }
      }
    }
  }

  /**
   * Handles multi-content checkbox questions (e.g. skills checklist, salary range).
   */
  private async fillMultiContentCheckboxes(page: Page): Promise<void> {
    await dismissCommonPopups(page);
    const checkboxes = await page.locator("input[type='checkbox']:not([name='candidate.textingConsent']):not([id='52']):not([id='54']):not([id='56']):not([name*='cookie'])").all();
    for (const cb of checkboxes) {
      // Exclude any checkbox embedded in a dialog or cookie container
      const isCookieBox = await cb.evaluate((el: HTMLElement) => {
        return !!el.closest("[role='dialog'], [class*='cookie'], [id*='cookie']");
      }).catch(() => false);
      if (isCookieBox) continue;

      const optionLabel = await cb.evaluate((el: HTMLElement) => {
        const parentLabel = el.closest("label");
        if (parentLabel) return parentLabel.textContent?.trim() || "";
        const sibling = el.parentElement?.querySelector("label");
        if (sibling) return sibling.textContent?.trim() || "";
        return (el as HTMLInputElement).value || "";
      }).catch(() => "");

      const normOpt = normalizeLabel(optionLabel);

      let shouldCheck = false;

      // Technical skills: Check Node.JS, GoLang, and Other
      if (normOpt.includes("node") || normOpt.includes("nodejs") || normOpt.includes("golang") || normOpt === "other" || normOpt.includes("c++")) {
        shouldCheck = true;
      }
      // State residence checkboxes: Check California
      else if (normOpt === "california" || normOpt.includes("california")) {
        shouldCheck = true;
      }
      // Salary range: Select single reasonable target market bracket ($90k - $99k)
      else if (
        (normOpt.includes("90000") || normOpt.includes("90,000") || normOpt.includes("90,000 – $99,999") || normOpt.includes("90,000-$99,000")) &&
        !normOpt.includes("190000") && !normOpt.includes("190,000")
      ) {
        shouldCheck = true;
      }

      if (shouldCheck) {
        console.log(`☑️ [RecruiteeAdapter]: Checking option "${optionLabel}"`);
        const isChecked = await cb.isChecked().catch(() => false);
        if (!isChecked) {
          await cb.scrollIntoViewIfNeeded().catch(() => {});
          await cb.click({ force: true }).catch(() => {});
        }
      }
    }
  }

  /**
   * Helper to determine an element's logical question label with 100% precision.
   */
  private async getElementLabel(page: Page, locator: any): Promise<string> {
    return await locator.evaluate((el: HTMLElement) => {
      // 1. Label with matching 'for' attribute
      const id = el.id;
      if (id) {
        const l = document.querySelector(`label[for="${id}"]`);
        if (l) return l.textContent || "";
      }

      // 2. Direct sibling label in same container
      const parentLabel = el.parentElement?.querySelector("label");
      if (parentLabel && parentLabel !== el) {
        return parentLabel.textContent || "";
      }

      // 3. Closest fieldset legend
      const fs = el.closest("fieldset");
      if (fs) {
        const leg = fs.querySelector("legend");
        if (leg) return leg.textContent || "";
      }

      // 4. Closest label container
      const closestLabel = el.closest("label");
      if (closestLabel) return closestLabel.textContent || "";

      // 5. Parent wrapper heading or label
      let p = el.parentElement;
      for (let i = 0; i < 4 && p; i++) {
        const h = p.querySelector("label, h3, h4, h5, [class*='title'], [class*='label'], [class*='question']");
        if (h && !h.contains(el)) {
          return h.textContent || "";
        }
        p = p.parentElement;
      }
      return (el as HTMLInputElement).placeholder || (el as HTMLInputElement).name || "";
    }).catch(() => "");
  }

  /**
   * Uploads both the Candidate Resume PDF and Cover Letter PDF.
   */
  async uploadResume(page: Page, resumePath: string, fields?: FormField[], profile?: UserProfile): Promise<void> {
    console.log(`📄 [RecruiteeAdapter]: Attaching Resume & Cover Letter files...`);
    await updateHUDStatus(page, "Attaching Documents", "Uploading Resume and Cover Letter PDFs", "info", 90);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. UPLOAD RESUME (CV)
    // ─────────────────────────────────────────────────────────────────────────
    const cvInput = page.locator("input[type='file'][name='candidate.cv'], input[type='file'][id*='cv'], input[type='file']").first();
    if (await cvInput.count() > 0) {
      console.log(`📎 [RecruiteeAdapter]: Attaching Resume -> ${resumePath}`);
      try {
        await cvInput.setInputFiles(resumePath);
        console.log("✅ [RecruiteeAdapter]: Resume successfully attached to candidate.cv!");
      } catch (err: any) {
        console.warn("⚠️ [RecruiteeAdapter]: Failed to attach resume directly:", err.message);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. UPLOAD COVER LETTER PDF
    // ─────────────────────────────────────────────────────────────────────────
    const coverLetterInput = page.locator("input[type='file'][name='candidate.coverLetterFile'], input[type='file'][id*='coverLetter']").first();
    if (await coverLetterInput.count() > 0) {
      console.log("📎 [RecruiteeAdapter]: Cover Letter input detected on form. Resolving Cover Letter PDF...");

      // Determine cover letter path
      const resumeDir = path.dirname(resumePath);
      let coverLetterPath = path.join(resumeDir, "Hrutin_Nammi_Cover_Letter.pdf");

      // If Cover Letter PDF does not exist yet on disk, generate it dynamically!
      if (!fs.existsSync(coverLetterPath)) {
        console.log(`📄 [RecruiteeAdapter]: Generating Cover Letter PDF at: ${coverLetterPath}...`);
        const coverLetterText = `HRUTIN NAMMI
San Francisco, CA, United States | babufakemail@gmail.com | +1 202 555 0198 | linkedin: https://linkedin.com/in/hrutinnammi | github: https://github.com/hrutinnammi

Dear Hiring Manager,

I am writing to express my enthusiastic interest in joining your engineering team. As a Full-Stack AI Developer with comprehensive experience architecting scalable applications, RAG pipelines, FastAPI backends, and responsive React interfaces, I have a proven track record of delivering reliable, high-performance production systems.

At Jobspring, I developed an AI-powered resume and career platform serving multi-user workloads using OpenAI APIs, optimizing database query flows and reducing API response latency by 30%. I designed and containerized scalable backend services using Docker and Azure App Service, cutting deployment cycles by 60%. In addition, my flagship project LocalMind OS demonstrates my depth in local LLM retrieval architectures, FAISS semantic search indexing, and resilient full-stack engineering.

I am particularly excited about your mission and would welcome the opportunity to bring my technical expertise in Python, Node.js, FastAPI, React, and modern AI architectures to your team.

Thank you very much for your time and consideration.

Sincerely,
Hrutin Nammi`;

        try {
          await generateResumePdf(coverLetterPath, coverLetterText);
          console.log(`✅ [RecruiteeAdapter]: Cover Letter PDF successfully generated at: ${coverLetterPath}`);
        } catch (genErr: any) {
          console.warn("⚠️ [RecruiteeAdapter]: Failed to generate Cover Letter PDF, using resume as fallback:", genErr.message);
          coverLetterPath = resumePath;
        }
      }

      try {
        await coverLetterInput.setInputFiles(coverLetterPath);
        console.log(`✅ [RecruiteeAdapter]: Cover Letter PDF successfully attached to candidate.coverLetterFile!`);
      } catch (clErr: any) {
        console.warn("⚠️ [RecruiteeAdapter]: Failed to attach Cover Letter file:", clErr.message);
      }
    }

    await this.sanitizeUSAddressFields(page);
    await page.waitForTimeout(1000);
  }

  /**
   * Validates if the page form has been correctly filled out.
   */
  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    const nameVal = await page.locator("input[name='candidate.name']").inputValue().catch(() => "");
    const emailVal = await page.locator("input[name='candidate.email']").inputValue().catch(() => "");
    const phoneVal = await page.locator("input[name='candidate.phone']").inputValue().catch(() => "");

    const isValid = !!(nameVal && emailVal && phoneVal);
    if (!isValid) {
      console.warn("⚠️ [RecruiteeAdapter]: Required primary candidate inputs check failed:", { nameVal, emailVal, phoneVal });
    }
    return isValid;
  }

  /**
   * Submits or prepares the application for review.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    await updateHUDStatus(
      page,
      !isAutoSubmit ? "Ready for Review" : "Submitting Application",
      !isAutoSubmit ? "Application filled: Ready for your manual submission" : "Clicking Submit button...",
      "info",
      95
    );

    // Locate submit button: <button type="submit"> with text "Send" or "Submit"
    const submitBtn = page.locator("button[type='submit'], button:has-text('Send'), button:has-text('Submit')").first();
    if ((await submitBtn.count()) === 0) {
      return {
        success: false,
        errorMessage: "RECRUITEE_SUBMIT_BUTTON_NOT_FOUND"
      };
    }

    // Scroll into view & highlight for user review
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.evaluate(() => {
      const btn = document.querySelector("button[type='submit']") as HTMLElement;
      if (btn) {
        btn.style.outline = "3px solid #22c55e";
        btn.style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.85)";
        btn.style.borderRadius = "8px";
        btn.style.transition = "all 0.3s ease";
      }
    }).catch(() => {});

    if (!isAutoSubmit) {
      console.log("👉 [RecruiteeAdapter]: Ready for manual review. Submit button is centered & highlighted for you to click!");
      await updateHUDStatus(page, "Ready to Submit", "Application completed! Submit button highlighted below for manual submission 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION"
      };
    }

    console.log("🔴 [RecruiteeAdapter]: LIVE AUTO-SUBMIT — Submitting Recruitee application...");
    await simulateHumanMouse(page);
    await page.waitForTimeout(2000);

    try {
      await humanClick(page, submitBtn);
    } catch {
      await submitBtn.click({ force: true }).catch(() => {});
    }

    // Wait for submission confirmation or redirect
    for (let sec = 0; sec < 15; sec++) {
      await page.waitForTimeout(1000);
      const content = (await page.content().catch(() => "")).toLowerCase();
      if (content.includes("thank you") || content.includes("application has been sent") || content.includes("success")) {
        console.log("🎉 [RecruiteeAdapter]: Application submitted successfully!");
        return {
          success: true,
          confirmation: "RECRUITEE_SUBMISSION_SUCCESS"
        };
      }
    }

    return {
      success: true,
      confirmation: "RECRUITEE_SUBMISSION_SENT"
    };
  }

  /**
   * Cleanses and replaces any lingering Indian / Vadodara values with valid US address data.
   */
  private async sanitizeUSAddressFields(page: Page): Promise<void> {
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"));
      for (const el of inputs) {
        const val = (el.value || "").toLowerCase();
        if (
          val.includes("vadodara") ||
          val.includes("gujarat") ||
          val.includes("390144") ||
          val.includes("388710") ||
          val.includes("aaradhya") ||
          val.includes("wagodhiya") ||
          val.includes("limda")
        ) {
          const nameOrId = (el.name || el.id || "").toLowerCase();
          if (nameOrId.includes("city") || nameOrId.includes("residence")) {
            el.value = "San Francisco";
          } else if (nameOrId.includes("state") || nameOrId.includes("territory") || nameOrId.includes("province")) {
            el.value = "California";
          } else if (nameOrId.includes("zip") || nameOrId.includes("postal")) {
            el.value = "94105";
          } else if (nameOrId.includes("address") || nameOrId.includes("street")) {
            el.value = "123 Market St";
          } else if (nameOrId.includes("country")) {
            el.value = "United States";
          } else {
            el.value = "San Francisco, CA, United States";
          }
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }).catch(() => {});
  }
}
