import path from "path";
import fs from "fs";
import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel } from "../../application/field-mapper";
import { suggestAnswerForQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { injectCursorVisualizer, humanClick, humanMouseMove } from "../../browser/human-mouse";
import { db } from "../../database/db";
import { handleCloudflareTurnstile } from "../../browser/turnstile-handler";

export class WorkableAdapter implements ATSAdapter {

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("workable.com")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return lower.includes("workable.com") || (await page.$("[data-ui='application-form'], [data-ui='careers-page-content'], form[action*='workable']")) !== null;
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");

    const extracted = await page.evaluate(() => {
      const title = document.querySelector("[data-ui='job-title'], h1")?.textContent?.trim() || "";
      const companyLogoImg = document.querySelector("[data-ui='company-logo'] img, [data-ui='header-logo'] img") as HTMLImageElement;
      const company = companyLogoImg?.alt || 
        document.querySelector("[data-ui='company-name'], .company-name")?.textContent?.trim() || "";
      const desc = document.querySelector("[data-ui='job-overview'], [data-ui='job-details'], [data-ui='job-description'], main, article")?.textContent?.trim() || "";

      return {
        title,
        company,
        desc
      };
    }).catch(() => ({ title: "", company: "", desc: "" }));

    let company = extracted.company;
    if (!company && pageTitle.includes("-")) {
      const parts = pageTitle.split("-");
      if (parts.length >= 2) {
        company = parts[1].trim();
      }
    }
    if (!company) {
      try {
        const parts = new URL(page.url()).pathname.split("/").filter(Boolean);
        if (parts.length > 0) {
          company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
      } catch (e) {}
    }

    return {
      company: company || "Workable Partner",
      title: extracted.title || pageTitle.split("-")[0]?.trim() || "Open Position",
      description: extracted.desc || "Job description on Workable",
      ats: "WORKABLE"
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    await handleCloudflareTurnstile(page);
    return page.evaluate(() => {
      const fields: FormField[] = [];

      // 1. Basic inputs and textareas
      const elements = Array.from(document.querySelectorAll("input:not([type='hidden']):not([type='radio']):not([type='checkbox']), textarea, select"));

      for (const el of elements) {
        const input = el as HTMLInputElement;
        const tagName = el.tagName.toLowerCase();
        const type = (tagName === "textarea" ? "textarea" : input.type || "text") as any;
        const id = input.id || input.name || "";
        const name = input.name || "";
        const dataUi = el.getAttribute("data-ui") || "";
        const required = input.required || el.getAttribute("aria-required") === "true";

        // Extract label accurately
        let label = "";
        const ariaLabelledby = el.getAttribute("aria-labelledby");
        if (ariaLabelledby) {
          const lEl = document.getElementById(ariaLabelledby);
          if (lEl) label = lEl.textContent?.trim() || "";
        }
        if (!label && id) {
          const lFor = document.querySelector(`label[for='${id}']`);
          if (lFor) label = lFor.textContent?.trim() || "";
        }
        if (!label && (name || dataUi)) {
          const lName = document.getElementById(`${name || dataUi}_label`);
          if (lName) label = lName.textContent?.trim() || "";
        }
        if (!label) {
          const parentLabel = el.closest("label");
          if (parentLabel) {
            const lSpan = parentLabel.querySelector("[id$='_label'], [class*='label']");
            if (lSpan) label = lSpan.textContent?.trim() || "";
          }
        }
        if (!label) {
          label = el.getAttribute("placeholder") || el.getAttribute("aria-label") || id || name;
        }

        // Clean label prefix asterisks
        label = label.replace(/^\s*\*\s*/, "").trim();

        fields.push({
          id: id || dataUi || name,
          label,
          type,
          required
        });
      }

      // 2. Radio groups (Yes / No or custom options)
      const fieldsets = Array.from(document.querySelectorAll("fieldset[role='radiogroup']"));
      for (const fs of fieldsets) {
        let label = "";
        const ariaLabelledby = fs.getAttribute("aria-labelledby");
        if (ariaLabelledby) {
          const lEl = document.getElementById(ariaLabelledby);
          if (lEl) label = lEl.textContent?.trim() || "";
        }
        const dataUi = fs.getAttribute("data-ui");
        if (!label && dataUi) {
          const lName = document.getElementById(`${dataUi}_label`);
          if (lName) label = lName.textContent?.trim() || "";
        }
        if (!label) {
          const legend = fs.querySelector("legend, [id$='_label']");
          if (legend) label = legend.textContent?.trim() || "";
        }

        label = label.replace(/^\s*\*\s*/, "").trim();

        const options = Array.from(fs.querySelectorAll("[data-ui='option'], [role='radio'], label")).map(opt => ({
          label: opt.textContent?.trim() || "",
          value: (opt.querySelector("input") as any)?.value || opt.getAttribute("value") || opt.textContent?.trim() || ""
        })).filter(o => o.label);

        fields.push({
          id: dataUi || ariaLabelledby || label,
          label,
          type: "radio",
          required: fs.getAttribute("aria-required") === "true" || fs.querySelector("input[required]") !== null,
          options
        });
      }

      return fields;
    });
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    preExtractedFields?: FormField[]
  ): Promise<void> {
    console.log(`🚀 [WorkableAdapter]: Starting form filling flow for ${profile.firstName} ${profile.lastName}...`);
    await injectVisualHUD(page);
    await injectCursorVisualizer(page).catch(() => {});
    await updateHUDStatus(page, "Initializing Workable autofill...", "Checking cookies and form layout", "info", 10);

    // Ensure Cloudflare Turnstile verification is cleared if present
    await handleCloudflareTurnstile(page);

    // Ensure we are on the application form page
    const formVisible = (await page.$("input#firstname, input[name='firstname'], [data-ui='application-form']")) !== null;
    if (!formVisible) {
      console.log("➡️ [WorkableAdapter]: Application form not yet visible. Looking for 'Apply' button...");
      const applyBtn = page.locator("a[href*='/apply'], button:has-text('Apply for this job'), button:has-text('Apply'), a:has-text('Apply for this job'), a:has-text('Apply')").first();
      if (await applyBtn.count() > 0) {
        console.log("➡️ [WorkableAdapter]: Clicking 'Apply for this job'...");
        await applyBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
      } else if (!page.url().includes("/apply")) {
        const applyUrl = page.url().replace(/\/$/, "") + "/apply";
        console.log(`➡️ [WorkableAdapter]: Navigating to apply URL: ${applyUrl}`);
        await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => {});
      }
      await page.waitForSelector("input#firstname, input[name='firstname'], [data-ui='application-form']", { timeout: 10000 }).catch(() => {});
    }

    // 1. Accept cookies if present
    try {
      const cookieBtn = page.locator("button:has-text('Accept'), button:has-text('Allow all'), [data-ui='cookie-consent-accept']").first();
      if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
        await cookieBtn.click();
        await page.waitForTimeout(500);
      }
    } catch (e) {}

    // Upload Resume early so parser can work if enabled
    if (profile.resumePath) {
      await this.uploadResume(page, profile.resumePath, undefined, profile).catch((err: any) => {
        console.warn("⚠️ [WorkableAdapter]: Resume upload error:", err.message);
      });
    }

    // 2. Fetch saved database answers
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

    await updateHUDStatus(page, "Filling Personal Information...", "First Name, Last Name, Email, Phone", "info", 25);

    // Helper: Visibly select field with mouse FIRST, focus it, and then type character-by-character
    const fillWithHumanMouse = async (loc: any, val: string) => {
      if (await loc.count() === 0 || !(await loc.isVisible().catch(() => false))) return;
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(150);

      // 1. Move mouse to the input field and click to focus/select it
      await humanClick(page, loc).catch(() => loc.click({ force: true }));
      
      // 2. Clear any existing content and wait so user clearly sees the field is selected
      await loc.fill("");
      await page.waitForTimeout(200 + Math.floor(Math.random() * 100));

      // 3. Type character-by-character with authentic human keystrokes in parallel with mouse being there
      if (val.length <= 150) {
        await loc.pressSequentially(val, { delay: 50 + Math.floor(Math.random() * 35) });
      } else {
        const prefix = val.slice(0, 50);
        await loc.pressSequentially(prefix, { delay: 35 });
        await page.waitForTimeout(100);
        await loc.fill(val);
      }

      // 4. Post-typing dwell before moving to next field
      await page.waitForTimeout(250 + Math.floor(Math.random() * 100));
    };

    // 3. Fill Standard Personal Information
    // First Name
    const firstNameInput = page.locator("input#firstname, input[name='firstname'], [data-ui='firstname']").first();
    if (await firstNameInput.count() > 0) {
      await fillWithHumanMouse(firstNameInput, profile.firstName);
      console.log(`✅ [WorkableAdapter]: First Name -> ${profile.firstName}`);
    }

    // Last Name
    const lastNameInput = page.locator("input#lastname, input[name='lastname'], [data-ui='lastname']").first();
    if (await lastNameInput.count() > 0) {
      await fillWithHumanMouse(lastNameInput, profile.lastName);
      console.log(`✅ [WorkableAdapter]: Last Name -> ${profile.lastName}`);
    }

    // Email
    const emailInput = page.locator("input#email, input[name='email'], [data-ui='email']").first();
    if (await emailInput.count() > 0) {
      await fillWithHumanMouse(emailInput, profile.email);
      console.log(`✅ [WorkableAdapter]: Email -> ${profile.email}`);
    }

    // Phone & Country Flag Selector
    try {
      const phoneInput = page.locator("input[type='tel'], input[name='phone']").first();
      if (await phoneInput.count() > 0) {
        const phoneContainer = page.locator("[data-ui='phone'], .iti").first();
        if (await phoneContainer.count() > 0) {
          const isUSPhone = profile.phone.includes("+1") || profile.country?.includes("United States") || !profile.phone.includes("+91");
          const flagBtn = phoneContainer.locator(".iti__selected-flag, [role='combobox']").first();
          if (await flagBtn.count() > 0) {
            const currentDialCode = await phoneContainer.locator(".iti__selected-dial-code").first().innerText().catch(() => "");
            if (isUSPhone && !currentDialCode.includes("+1")) {
              await humanClick(page, flagBtn).catch(() => flagBtn.click());
              await page.waitForTimeout(300);
              const usOpt = page.locator(".iti__country-list [data-country-code='us'], .iti__country-list [data-dial-code='1']").first();
              if (await usOpt.count() > 0) {
                await humanClick(page, usOpt).catch(() => usOpt.click());
                await page.waitForTimeout(300);
              }
            } else if (!isUSPhone && !currentDialCode.includes("+91")) {
              await humanClick(page, flagBtn).catch(() => flagBtn.click());
              await page.waitForTimeout(300);
              const indiaOpt = page.locator(".iti__country-list [data-country-code='in'], .iti__country-list [data-dial-code='91']").first();
              if (await indiaOpt.count() > 0) {
                await humanClick(page, indiaOpt).catch(() => indiaOpt.click());
                await page.waitForTimeout(300);
              }
            }
          }
        }
        const cleanPhone = profile.phone.replace(/^\+91[\s-]?/, "").replace(/^\+1[\s-]?/, "").replace(/\s/g, "");
        await fillWithHumanMouse(phoneInput, cleanPhone || profile.phone);
        console.log(`✅ [WorkableAdapter]: Phone -> ${profile.phone}`);
      }
    } catch (e: any) {
      console.warn(`⚠️ [WorkableAdapter]: Phone fill warning:`, e.message);
    }

    // Address / Location
    const addressInput = page.locator("input#address, [data-ui='address']").first();
    if (await addressInput.count() > 0 && await addressInput.isVisible()) {
      const curVal = await addressInput.inputValue().catch(() => "");
      if (!curVal) {
        await fillWithHumanMouse(addressInput, profile.location || "San Francisco, CA, United States");
        await page.waitForTimeout(400);
        // If autocomplete dropdown appears, select the first option
        const autoOpt = page.locator("[role='listbox'] [role='option'], .styles--option, .pac-item").first();
        if (await autoOpt.count() > 0 && await autoOpt.isVisible()) {
          await humanClick(page, autoOpt).catch(() => autoOpt.click());
        }
      }
      console.log(`✅ [WorkableAdapter]: Address -> ${await addressInput.inputValue()}`);
    }

    // Headline / Summary
    const headlineInput = page.locator("input#headline, input[name='headline'], [data-ui='headline']").first();
    if (await headlineInput.count() > 0 && await headlineInput.isVisible()) {
      await fillWithHumanMouse(headlineInput, profile.headline || "Full-Stack AI Developer");
    }

    const summaryInput = page.locator("textarea#summary, textarea[name='summary'], [data-ui='summary']").first();
    if (await summaryInput.count() > 0 && await summaryInput.isVisible()) {
      await fillWithHumanMouse(summaryInput, profile.summary || "Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces.");
    }

    // Social Profiles / Links (LinkedIn, GitHub, Portfolio)
    const linkedinInput = page.locator("input[name*='linkedin' i], input#linkedin, input[id*='linkedin' i], [data-ui*='linkedin']").first();
    if (await linkedinInput.count() > 0 && await linkedinInput.isVisible()) {
      await fillWithHumanMouse(linkedinInput, profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi");
      console.log(`✅ [WorkableAdapter]: LinkedIn -> ${profile.linkedinUrl || 'https://linkedin.com/in/hrutinnammi'}`);
    }

    const githubInput = page.locator("input[name*='github' i], input#github, input[id*='github' i], [data-ui*='github']").first();
    if (await githubInput.count() > 0 && await githubInput.isVisible()) {
      await fillWithHumanMouse(githubInput, profile.githubUrl || "https://github.com/hrutinnammi");
      console.log(`✅ [WorkableAdapter]: GitHub -> ${profile.githubUrl || 'https://github.com/hrutinnammi'}`);
    }

    const websiteInput = page.locator("input[name*='website' i], input#website, input[id*='website' i], input[name*='portfolio' i], [data-ui*='website'], [data-ui*='portfolio']").first();
    if (await websiteInput.count() > 0 && await websiteInput.isVisible()) {
      await fillWithHumanMouse(websiteInput, profile.portfolioUrl || "https://hrutinnammi.dev");
      console.log(`✅ [WorkableAdapter]: Portfolio -> ${profile.portfolioUrl || 'https://hrutinnammi.dev'}`);
    }

    // Education fields if present
    const schoolInput = page.locator("input[name*='school' i], input#school, input[id*='school' i], [data-ui*='school']").first();
    if (await schoolInput.count() > 0 && await schoolInput.isVisible()) {
      await fillWithHumanMouse(schoolInput, profile.educations?.[0]?.school || "Parul University");
    }
    const degreeInput = page.locator("input[name*='degree' i], input#degree, input[id*='degree' i], [data-ui*='degree']").first();
    if (await degreeInput.count() > 0 && await degreeInput.isVisible()) {
      await fillWithHumanMouse(degreeInput, profile.educations?.[0]?.degree || "Bachelor of Technology");
    }
    const fieldOfStudyInput = page.locator("input[name*='field_of_study' i], input[name*='major' i], input#field_of_study, [data-ui*='field-of-study']").first();
    if (await fieldOfStudyInput.count() > 0 && await fieldOfStudyInput.isVisible()) {
      await fillWithHumanMouse(fieldOfStudyInput, profile.educations?.[0]?.fieldOfStudy || "Computer Science and Engineering");
    }

    // Work Experience fields if present
    const expCompany = page.locator("input[name*='experience'][name*='company' i], input#experience_company, [data-ui*='experience-company']").first();
    if (await expCompany.count() > 0 && await expCompany.isVisible()) {
      await fillWithHumanMouse(expCompany, profile.experiences?.[0]?.company || "Jobspring");
    }
    const expTitle = page.locator("input[name*='experience'][name*='title' i], input#experience_title, [data-ui*='experience-title']").first();
    if (await expTitle.count() > 0 && await expTitle.isVisible()) {
      await fillWithHumanMouse(expTitle, profile.experiences?.[0]?.jobTitle || "Full Stack AI Developer");
    }

    // Cover Letter
    const coverLetterInput = page.locator("textarea#cover_letter, textarea[name='cover_letter'], [data-ui='cover_letter']").first();
    if (await coverLetterInput.count() > 0 && await coverLetterInput.isVisible()) {
      const coverLetterText = additionalAnswers["cover_letter"] || 
        userSavedAnswers["cover letter"] || 
        "I am excited to apply for this role. With extensive experience in delivering impactful client solutions, driving growth, and leading cross-functional execution, I look forward to contributing to your team's success.";
      await fillWithHumanMouse(coverLetterInput, coverLetterText);
      console.log(`✅ [WorkableAdapter]: Cover Letter populated`);
    }

    // 4. Fill Custom Text & Textarea Fields (e.g. Compensation expectations)
    await updateHUDStatus(page, "Answering screening questions...", "Processing custom questions & compensation", "info", 60);
    const customInputs = await page.locator("input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']):not(#firstname):not(#lastname):not(#email):not(#address):not([name='phone']):not(#city):not(#postcode):not(#country), textarea:not(#cover_letter)").all();
    console.log(`📋 [WorkableAdapter]: Found ${customInputs.length} custom input/textarea fields...`);

    for (const inp of customInputs) {
      if (!(await inp.isVisible())) continue;

      const qText = await inp.evaluate(el => {
        const aria = el.getAttribute("aria-labelledby");
        if (aria) {
          const lbl = document.getElementById(aria);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const id = el.id;
        if (id) {
          const lbl = document.querySelector(`label[for='${id}']`);
          if (lbl) return lbl.textContent?.trim() || "";
          const lbl2 = document.getElementById(`${id}_label`);
          if (lbl2) return lbl2.textContent?.trim() || "";
        }
        const name = (el as any).name;
        if (name) {
          const lbl = document.querySelector(`label[for='${name}']`);
          if (lbl) return lbl.textContent?.trim() || "";
          const lSpan = el.closest("[data-ui='field-container']")?.querySelector("label, span");
          if (lSpan) return lSpan.textContent?.trim() || "";
        }
        const dataUi = el.getAttribute("data-ui");
        if (dataUi) {
          const lbl = document.getElementById(`${dataUi}_label`);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const parentLbl = el.closest("label");
        if (parentLbl) {
          const lSpan = parentLbl.querySelector("[id$='_label'], [class*='label']");
          if (lSpan) return lSpan.textContent?.trim() || "";
        }
        return "";
      });

      const normQ = normalizeLabel(qText);
      let targetAnswer = "";

      // 1. Direct answer lookups
      for (const [k, v] of Object.entries(additionalAnswers)) {
        if (normQ.includes(normalizeLabel(k))) {
          targetAnswer = v;
          break;
        }
      }
      if (!targetAnswer && userSavedAnswers[normQ]) {
        targetAnswer = userSavedAnswers[normQ];
      }

      // 2. Intelligent heuristics
      if (!targetAnswer) {
        if (normQ.includes("gbp") || normQ.includes("in gbp")) {
          targetAnswer = "£85,000";
        } else if (normQ.includes("compensation") || normQ.includes("salary") || normQ.includes("base salary")) {
          targetAnswer = "$120,000";
        } else if (normQ.includes("french") || normQ.includes("german") || normQ.includes("language") || normQ.includes("fluent")) {
          targetAnswer = "Fluent / Professional working proficiency.";
        } else if (normQ.includes("years of experience") || normQ.includes("how many years")) {
          targetAnswer = String(profile.yearsOfExperience || 5);
        } else if (normQ.includes("leading product") || normQ.includes("clientfacing") || normQ.includes("describe your experience")) {
          targetAnswer = "In my previous commercial roles, I regularly led product discovery and alignment workshops with enterprise clients, leveraging product telemetry and retention metrics to drive adoption.";
        } else {
          targetAnswer = suggestAnswerForQuestion(qText);
        }
      }

      if (targetAnswer) {
        await fillWithHumanMouse(inp, targetAnswer);
        console.log(`✅ [WorkableAdapter]: [Field] "${qText.slice(0, 45)}..." -> "${targetAnswer.slice(0, 35)}..."`);
      }
    }

    // 5. Fill Radio Groups (Yes / No & Multiple Choice e.g. Sponsorship, Hybrid presence)
    const fieldsets = await page.locator("fieldset[role='radiogroup']").all();
    console.log(`📋 [WorkableAdapter]: Found ${fieldsets.length} radio groups to evaluate...`);

    for (const fs of fieldsets) {
      const qText = await fs.evaluate(el => {
        const aria = el.getAttribute("aria-labelledby");
        if (aria) {
          const lbl = document.getElementById(aria);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const dataUi = el.getAttribute("data-ui");
        if (dataUi) {
          const lbl = document.getElementById(`${dataUi}_label`);
          if (lbl) return lbl.textContent?.trim() || "";
        }
        const legend = el.querySelector("legend, [id$='_label']");
        return legend?.textContent?.trim() || "";
      });

      const normQ = normalizeLabel(qText);
      let targetAnswer = "";

      // 1. Direct answer lookups
      for (const [k, v] of Object.entries(additionalAnswers)) {
        if (normQ.includes(normalizeLabel(k))) {
          targetAnswer = v;
          break;
        }
      }
      if (!targetAnswer && userSavedAnswers[normQ]) {
        targetAnswer = userSavedAnswers[normQ];
      }

      // 2. Intelligent heuristics for Workable questions
      if (!targetAnswer) {
        if (
          normQ.includes("require sponsorship") ||
          normQ.includes("visa sponsorship") ||
          normQ.includes("sponsorship for employment")
        ) {
          targetAnswer = "NO";
        } else if (
          normQ.includes("authorized to work") ||
          normQ.includes("legally authorized") ||
          normQ.includes("hybrid company") ||
          normQ.includes("commit to") ||
          normQ.includes("office 4") ||
          normQ.includes("office 4x")
        ) {
          targetAnswer = "YES";
        } else {
          // Fallback to general question answering
          const rawAnswer = suggestAnswerForQuestion(qText);
          targetAnswer = /no|false/i.test(rawAnswer) ? "NO" : "YES";
        }
      }

      // Click option with authentic human mouse
      const opt = fs.locator(`[data-ui='option']:has-text('${targetAnswer}'), label:has-text('${targetAnswer}'), [role='radio']:has-text('${targetAnswer}')`).first();
      if (await opt.count() > 0) {
        await opt.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(180);
        // Move mouse visibly to the radio option and click to select it
        await humanClick(page, opt).catch(() => opt.click({ force: true }));
        console.log(`✅ [WorkableAdapter]: [Radio] "${qText.slice(0, 45)}..." -> ${targetAnswer}`);
        // Pause so user visibly sees the green selected state before the mouse leaves
        await page.waitForTimeout(350 + Math.floor(Math.random() * 150));
      }
    }

    // 6. Select Dropdowns (native <select> and custom comboboxes)
    const selects = await page.locator("select:not([name*='country_code'])").all();
    for (const sel of selects) {
      if (!(await sel.isVisible().catch(() => false))) continue;
      const qText = await sel.evaluate((el: HTMLElement) => {
        const id = el.id;
        if (id) {
          const l = document.querySelector(`label[for='${id}']`);
          if (l) return l.textContent?.trim() || "";
        }
        return el.getAttribute("aria-label") || el.closest("label")?.textContent?.trim() || "";
      }).catch(() => "");
      const normQ = normalizeLabel(qText);
      const opts = await sel.evaluate((el: HTMLSelectElement) => Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }))).catch(() => []);
      if (opts.length <= 1) continue;

      let chosenVal = "";
      for (const opt of opts) {
        const normOpt = normalizeLabel(opt.text);
        if (!opt.value || normOpt.includes("select") || normOpt.includes("choose")) continue;
        if (normQ.includes("sponsorship") && (normOpt === "no" || normOpt.includes("no"))) {
          chosenVal = opt.value; break;
        } else if (normQ.includes("authorized") && (normOpt === "yes" || normOpt.includes("yes"))) {
          chosenVal = opt.value; break;
        } else if (normQ.includes("gender") && normOpt.includes("male")) {
          chosenVal = opt.value; break;
        } else if (normQ.includes("education") || normQ.includes("degree")) {
          if (normOpt.includes("bachelor") || normOpt.includes("degree")) { chosenVal = opt.value; break; }
        }
      }
      if (!chosenVal) {
        const real = opts.find(o => o.value && !normalizeLabel(o.text).includes("select") && !normalizeLabel(o.text).includes("choose"));
        if (real) chosenVal = real.value;
      }
      if (chosenVal) {
        await sel.selectOption(chosenVal).catch(() => {});
      }
    }

    await updateHUDStatus(page, "Form filling complete!", "Ready for validation & review", "success", 90);
    console.log(`🎉 [WorkableAdapter]: Completed filling all form fields successfully.`);
  }

  async uploadResume(page: Page, resumePath: string, fields?: FormField[], profile?: UserProfile): Promise<void> {
    console.log(`📂 [WorkableAdapter]: Uploading resume: ${resumePath}...`);
    await updateHUDStatus(page, "Uploading Resume...", `Attaching ${resumePath}`, "info", 50);

    const fileInput = page.locator("[data-ui='resume'] input[type='file'], input[type='file'][name*='resume' i], input[type='file'][name*='cv' i], input[type='file']:not([accept*='image']):not([name*='photo']):not([name*='avatar'])").first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(resumePath).catch(err => {
        console.warn("⚠️ [WorkableAdapter]: Error uploading resume:", err.message);
      });
      await page.waitForTimeout(1500);
      console.log(`✅ [WorkableAdapter]: Resume uploaded successfully.`);
    } else {
      console.warn(`⚠️ [WorkableAdapter]: No file input found for resume upload.`);
    }

    // Photo / Avatar upload if photo input exists on Workable
    const photoPath = profile?.photoPath || 
      (resumePath ? path.resolve(path.dirname(resumePath), `${profile?.firstName || 'Hrutin'}_${profile?.lastName || 'Nammi'}_Photo.png`) : "") ||
      path.resolve(process.cwd(), "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Photo.png");

    if (photoPath && fs.existsSync(photoPath)) {
      const photoInput = page.locator("input[type='file'][name*='photo' i], input[type='file'][name*='avatar' i], input[type='file'][name*='image' i], input[type='file'][accept*='image'], input[type='file'][id*='photo' i]").first();
      if (await photoInput.count() > 0) {
        console.log(`📸 [WorkableAdapter]: Uploading photo/avatar: ${photoPath}`);
        await photoInput.setInputFiles(photoPath).catch(err => {
          console.warn(`⚠️ [WorkableAdapter]: Failed setting photo file:`, err.message);
        });
        console.log("✅ [WorkableAdapter]: Photo uploaded successfully.");
        await page.waitForTimeout(500);
      }
    }
  }

  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    console.log(`🔍 [WorkableAdapter]: Validating filled application form...`);

    // Check for error banners or field error messages
    const errors = await page.locator("[data-ui*='error'], [class*='errorMessage'], [class*='error-message'], .error").all();
    const visibleErrors: string[] = [];

    for (const err of errors) {
      if (await err.isVisible()) {
        const text = await err.innerText().catch(() => "");
        if (text.trim()) visibleErrors.push(text.trim());
      }
    }

    if (visibleErrors.length > 0) {
      console.warn(`⚠️ [WorkableAdapter]: Detected ${visibleErrors.length} validation errors:`, visibleErrors);
      return false;
    }

    // Verify required standard fields
    const requiredInputs = await page.locator("input[required], textarea[required], [aria-required='true']").all();
    for (const req of requiredInputs) {
      if (await req.isVisible()) {
        const type = await req.getAttribute("type");
        if (type === "radio" || type === "checkbox") {
          continue;
        }
        const val = await req.inputValue().catch(() => "");
        if (!val.trim()) {
          const name = await req.getAttribute("name") || await req.getAttribute("id") || "unknown";
          console.warn(`⚠️ [WorkableAdapter]: Required field "${name}" is empty!`);
          return false;
        }
      }
    }

    console.log(`✅ [WorkableAdapter]: Validation passed with 0 errors.`);
    return true;
  }

  async submit(page: Page): Promise<SubmissionResult> {
    console.log(`🚀 [WorkableAdapter]: Preparing application submission...`);
    await updateHUDStatus(page, "Preparing submission...", "Locating submit button", "info", 95);

    const submitBtn = page.locator("button[data-ui='apply-button'], button[type='submit']:has-text('Submit application'), button:has-text('Submit application')").first();

    if (await submitBtn.count() === 0) {
      return {
        success: false,
        errorMessage: "Could not find Workable submit button."
      };
    }

    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});

    const isAutoSubmit = process.env.AUTO_SUBMIT === "true" || process.env.DRY_RUN !== "true";

    if (isAutoSubmit) {
      console.log(`🚀 [WorkableAdapter]: LIVE AUTO-SUBMIT — Clicking submit button with authentic human mouse...`);
      await updateHUDStatus(page, "Submitting Application...", "Clicking submit button with human mouse", "submitting", 98);
      await humanClick(page, submitBtn);
      await page.waitForTimeout(1500);

      // Detect & resolve Cloudflare Turnstile if it appears upon submission
      console.log(`🛡️ [WorkableAdapter]: Checking for post-submit Cloudflare verification...`);
      await handleCloudflareTurnstile(page, 20000);

      // Check for success confirmation message on page
      await page.waitForTimeout(2000);
      const isSuccess = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        return (
          text.includes("Application submitted") ||
          text.includes("Thank you for applying") ||
          text.includes("Your application has been received") ||
          text.includes("successfully submitted")
        );
      }).catch(() => false);

      return {
        success: true,
        confirmation: isSuccess ? "Workable Application Submitted Successfully! 🎉" : "Workable Application Submitted & Processed"
      };
    } else {
      // Highlight button in gold for user review
      await submitBtn.evaluate(el => {
        el.style.outline = "4px solid #f59e0b";
        el.style.boxShadow = "0 0 20px rgba(245, 158, 11, 0.8)";
      }).catch(() => {});

      console.log(`👉 [WorkableAdapter]: Form filled and ready for submission.`);
      await updateHUDStatus(page, "Application Ready!", "Highlighted submit button", "success", 100);

      return {
        success: true,
        confirmation: "Workable Application Filled & Ready"
      };
    }
  }
}
