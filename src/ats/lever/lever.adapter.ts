import path from "path";
import fs from "fs";
import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { normalizeLabel } from "../../application/field-mapper";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { humanMouseMove, humanClick, simulateHumanMouse, simulateZigZagReview, injectCursorVisualizer, removeCursorVisualizer } from "../../browser/form-filler";
import { db } from "../../database/db";

/**
 * Fuzzy matches question label against user saved answers and additional parameter answers.
 */
function fuzzyFindAnswer(
  label: string,
  additionalAnswers: Record<string, string>,
  savedAnswers: Record<string, string>
): string | undefined {
  const norm = normalizeLabel(label);
  
  // 1. Exact match in additionalAnswers
  if (additionalAnswers[label]) return additionalAnswers[label];
  if (additionalAnswers[norm]) return additionalAnswers[norm];

  // 2. Exact match in savedAnswers
  if (savedAnswers[norm]) return savedAnswers[norm];

  // 3. Token overlap matching across combined answers
  const combined = { ...savedAnswers, ...additionalAnswers };
  const wordsLabel = norm.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (wordsLabel.length === 0) return undefined;
  const setLabel = new Set(wordsLabel);

  let bestMatch: string | undefined = undefined;
  let bestRatio = 0;

  for (const [key, val] of Object.entries(combined)) {
    const normKey = normalizeLabel(key);
    const wordsKey = normKey.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
    if (wordsKey.length === 0) continue;
    const setKey = new Set(wordsKey);
    let intersect = 0;
    setKey.forEach(w => {
      if (setLabel.has(w)) intersect++;
    });
    const ratio = intersect / Math.min(setKey.size, setLabel.size);
    if (ratio > bestRatio && ratio >= 0.55) {
      bestRatio = ratio;
      bestMatch = val;
    }
  }

  return bestMatch;
}


export class LeverAdapter implements ATSAdapter {

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("lever.co")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return lower.includes("lever.co") || (await page.$(".application-form, #application-form, .posting-headline")) !== null;
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title();
    
    // Extract title
    const titleText = await page.locator(".posting-headline h2, .main-header .posting-headline, h2").first().innerText().catch(() => "");
    
    // Extract company
    let companyText = await page.locator(".main-header-logo img, [class*='logo'] img").first().getAttribute("alt").catch(() => "");
    if (!companyText) {
      companyText = await page.locator(".posting-headline .company-name, [class*='company']").first().innerText().catch(() => "");
    }
    
    let company = companyText?.trim() || "";
    if (!company) {
      try {
        const parts = new URL(page.url()).pathname.split("/").filter(Boolean);
        if (parts.length > 0 && parts[0] !== "apply") {
          company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        }
      } catch (e) {}
    }

    if (!company) {
      const splitTitle = pageTitle.split("-");
      if (splitTitle.length > 1) {
        company = splitTitle[0].trim();
      }
    }

    // Extract description
    const description = await page.locator(".section-wrapper, .posting-page, #content").first().innerText().catch(() => "No description extracted");

    return {
      company: company || "Lever Partner",
      title: titleText.trim() || pageTitle.split("-")[1]?.trim() || "Open Position",
      description,
      ats: "LEVER"
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    return page.evaluate(() => {
      const results: FormField[] = [];

      // 1. Inputs
      const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea, select"));
      for (const el of inputs) {
        const input = el as HTMLInputElement;
        let label = "";

        // Find associated label
        if (input.id) {
          const l = document.querySelector(`label[for="${input.id}"]`);
          if (l) label = l.textContent?.trim() || "";
        }
        if (!label) {
          const parentLabel = input.closest("label");
          if (parentLabel) label = parentLabel.textContent?.trim() || "";
        }
        if (!label) {
          const parentQuestion = input.closest(".application-question, .custom-question");
          if (parentQuestion) {
            const l = parentQuestion.querySelector(".application-label, .text, label");
            if (l) label = l.textContent?.trim() || "";
          }
        }

        const tag = el.tagName.toLowerCase();
        let type: any = "text";
        if (tag === "textarea") type = "textarea";
        else if (tag === "select") type = "select";
        else if (input.type === "file") type = "file";
        else if (input.type === "radio") type = "radio";
        else if (input.type === "checkbox") type = "checkbox";

        results.push({
          id: input.name || input.id || "",
          label: label || input.name || "",
          type,
          required: input.required || input.getAttribute("aria-required") === "true",
        });
      }

      return results;
    });
  }

  async uploadResume(page: Page, resumePath: string, _fields?: FormField[]): Promise<void> {
    if (!fs.existsSync(resumePath)) {
      console.warn(`⚠️ [LeverAdapter]: Resume file not found at: ${resumePath}`);
      return;
    }

    const fileInput = page.locator("input[type='file'][name='resume'], #resume-upload-input, input[type='file']").first();
    if (await fileInput.count() === 0) {
      console.warn("⚠️ [LeverAdapter]: No resume file input found on page.");
      return;
    }

    console.log(`📄 [LeverAdapter]: Uploading resume from: ${path.basename(resumePath)}...`);
    await fileInput.setInputFiles(resumePath).catch((err: any) => {
      console.warn(`⚠️ [LeverAdapter]: Resume upload error: ${err.message}`);
    });

    // Wait for parseResume.js completion if present
    await page.waitForTimeout(2500);
    console.log("✅ [LeverAdapter]: Resume uploaded successfully.");
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    _fields?: FormField[]
  ): Promise<void> {
    console.log("🚀 [LeverAdapter]: Initiating Lever Form Filling...");
    await injectCursorVisualizer(page).catch(() => {});
    await injectVisualHUD(page).catch(() => {});
    await updateHUDStatus(page, "Filling Lever Application...", "Setting candidate details", "info", 20).catch(() => {});

    // Helper: humanType with natural inter-key delays and keystroke telemetry
    const fillTextInput = async (selector: string, value: string) => {
      const loc = page.locator(selector).first();
      if (await loc.count() === 0) return false;
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await humanClick(page, loc).catch(() => loc.click({ force: true }));
      await page.waitForTimeout(80);
      await loc.selectText().catch(() => {});
      await page.keyboard.press("Backspace").catch(() => {});
      await loc.fill("");
      
      // Generate genuine hardware-like keystroke intervals for text under 120 chars
      if (value.length <= 120) {
        await loc.pressSequentially(value, { delay: 15 + Math.floor(Math.random() * 20) });
      } else {
        await loc.fill(value);
      }
      
      await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!el) return;
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const s = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (s) s.call(el, val); else el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, { sel: selector, val: value });
      return true;
    };

    // 1. Full Name
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    await fillTextInput("input[name='name']", fullName);
    console.log(`  ✅ Full Name: "${fullName}"`);

    // 2. Pronouns (select He/him if present)
    const pronounCheckbox = page.locator("input[value='He/him'], input[name='pronouns'][value='He/him']").first();
    if (await pronounCheckbox.count() > 0) {
      const pLabel = pronounCheckbox.locator("xpath=ancestor::label").first();
      if (await pLabel.count() > 0) await humanClick(page, pLabel).catch(() => pLabel.click({ force: true }));
      else await humanClick(page, pronounCheckbox).catch(() => pronounCheckbox.check({ force: true }));
      console.log("  ✅ Pronouns: 'He/him' selected");
    }

    // 3. Email
    await fillTextInput("input[name='email']", profile.email);
    console.log(`  ✅ Email: "${profile.email}"`);

    // 4. Phone
    await fillTextInput("input[name='phone']", profile.phone);
    console.log(`  ✅ Phone: "${profile.phone}"`);

    // 5. Current Company (org)
    const company = additionalAnswers["current_company"] || additionalAnswers["Current company"] || "Jobspring";
    await fillTextInput("input[name='org']", company);
    console.log(`  ✅ Current Company: "${company}"`);

    // 6. Location Autocomplete Dropdown
    const cityQuery = profile.location.split(",")[0]?.trim() || "San Francisco";
    console.log(`  🔽 [Location Dropdown]: Resolving for query "${cityQuery}"...`);
    const locInput = page.locator("#location-input, input.location-input").first();
    if (await locInput.count() > 0) {
      await locInput.scrollIntoViewIfNeeded().catch(() => {});
      await page.evaluate(async (city) => {
        const inp = document.querySelector("#location-input, input.location-input") as HTMLInputElement;
        const hiddenInp = document.querySelector("#selected-location") as HTMLInputElement;
        if (!inp || !hiddenInp) return;

        const hcaptcha = (document.querySelector("#hcaptchaResponseInput") as HTMLInputElement)?.value || "";
        const url = `/searchLocations?text=${encodeURIComponent(city)}&hcaptchaResponse=${hcaptcha}`;

        let data: any[] = [];
        try {
          const res = await fetch(url);
          if (res.ok) data = await res.json();
        } catch (e) {}

        if (!data || !data.length) {
          try {
            const res2 = await fetch(`/searchLocations?text=India&hcaptchaResponse=${hcaptcha}`);
            if (res2.ok) data = await res2.json();
          } catch (e) {}
        }

        if (data && data.length > 0) {
          const match = data[0];
          inp.value = match.name;
          hiddenInp.value = JSON.stringify(match);
        } else {
          inp.value = city;
          hiddenInp.value = JSON.stringify({ id: city, name: city, secondaryText: "India" });
        }

        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));

        const container = document.querySelector(".dropdown-container") as HTMLElement;
        if (container) container.style.display = "none";
      }, cityQuery);
      console.log(`  ✅ Location Dropdown: Resolved and bound.`);
    }

    // 7. Social & Profile URLs
    if (profile.linkedinUrl) {
      await fillTextInput("input[name='urls[LinkedIn]'], input[name*='LinkedIn']", profile.linkedinUrl);
      console.log(`  ✅ LinkedIn: "${profile.linkedinUrl}"`);
    }

    if (profile.githubUrl) {
      await fillTextInput("input[name='urls[GitHub]'], input[name='urls[GitHub/Portfolio]'], input[name*='GitHub']", profile.githubUrl);
      console.log(`  ✅ GitHub: "${profile.githubUrl}"`);
    }

    if (profile.portfolioUrl) {
      await fillTextInput("input[name='urls[Portfolio]']", profile.portfolioUrl);
      console.log(`  ✅ Portfolio: "${profile.portfolioUrl}"`);
    }

    const twitterUrl = additionalAnswers["twitter"] || additionalAnswers["Twitter URL"] || "https://x.com/hrutin_dev";
    const twitterInput = page.locator("input[name='urls[Twitter]']").first();
    if (await twitterInput.count() > 0) {
      await fillTextInput("input[name='urls[Twitter]']", twitterUrl);
      console.log(`  ✅ Twitter: "${twitterUrl}"`);
    }

    // 8. Custom Screening Questions (Radios, Textareas, Inputs, Selects, Checkboxes)
    await updateHUDStatus(page, "Filling Custom Questions...", "Answering screening prompts", "info", 60).catch(() => {});

    // Fetch previously saved candidate answers from database for fuzzy matching
    const savedAnswers: Record<string, string> = {};
    if (profile.userId) {
      try {
        const res = await db.query(
          "SELECT normalized_question, answer FROM user_saved_answers WHERE user_id = $1",
          [profile.userId]
        );
        for (const row of res.rows) {
          savedAnswers[row.normalized_question] = row.answer;
        }
        if (res.rowCount && res.rowCount > 0) {
          console.log(`  💾 [LeverAdapter]: Loaded ${res.rowCount} candidate saved answers from database.`);
        }
      } catch (err: any) {
        console.warn("  ⚠️ [LeverAdapter]: Could not query user_saved_answers:", err.message);
      }
    }

    // Helper: Select radio by label click (ensures native HTML5 validation passes)
    const selectRadioByLabel = async (radioLocator: string) => {
      const r = page.locator(radioLocator).first();
      if (await r.count() === 0) return false;
      await r.scrollIntoViewIfNeeded().catch(() => {});
      const lbl = r.locator("xpath=ancestor::label").first();
      if (await lbl.count() > 0) await lbl.click({ force: true }).catch(() => {});
      else await r.click({ force: true }).catch(() => {});
      await r.evaluate((el: HTMLInputElement) => {
        el.checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }).catch(() => {});
      return true;
    };

    // Helper: Fill native <select>
    const fillSelect = async (sel: string, targetVal: string) => {
      const dropdown = page.locator(sel).first();
      if (await dropdown.count() === 0) return false;
      await dropdown.scrollIntoViewIfNeeded().catch(() => {});
      const opts = await page.evaluate((s) => {
        const el = document.querySelector(s) as HTMLSelectElement;
        return el ? Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() })) : [];
      }, sel);

      const matched = opts.find(o => o.value.toLowerCase() === targetVal.toLowerCase() || o.text.toLowerCase().includes(targetVal.toLowerCase()));
      const chosen = matched ? matched.value : (opts[1]?.value || "");
      if (chosen) {
        await dropdown.selectOption(chosen);
        await page.evaluate(({ s, v }) => {
          const el = document.querySelector(s) as HTMLSelectElement;
          if (el) el.dispatchEvent(new Event("change", { bubbles: true }));
        }, { s: sel, v: chosen });
        return true;
      }
      return false;
    };

    // Iterate through all custom questions on the page
    const customQuestions = page.locator(".custom-question, .application-question:not(.awli-application-row):not(.resume)");
    const qCount = await customQuestions.count();

    for (let i = 0; i < qCount; i++) {
      const q = customQuestions.nth(i);
      const labelText = (await q.locator(".application-label, label, .text").first().innerText().catch(() => "")).trim();
      if (!labelText) continue;
      const norm = normalizeLabel(labelText);

      // Check if candidate DB or parameters has a saved answer
      const matchedAnswer = fuzzyFindAnswer(labelText, additionalAnswers, savedAnswers);

      // 1. Check for Textarea
      const ta = q.locator("textarea").first();
      if (await ta.count() > 0 && !(await ta.inputValue().catch(() => ""))) {
        await ta.scrollIntoViewIfNeeded().catch(() => {});
        let answer = matchedAnswer;
        if (norm.includes("referral") || norm.includes("referred") || norm.includes("reference") || norm.includes("referred by") || norm.includes("who referred") || norm.includes("current employee") || norm.includes("specify the employee")) {
          answer = "Tarun Komati";
        } else if (!answer) {
          if (norm.includes("salary") || norm.includes("compensation") || norm.includes("range")) {
            answer = "$140,000 - $160,000 CAD";
          } else if (norm.includes("aws") || norm.includes("cloud") || norm.includes("services")) {
            answer = "Over 3+ years of building and deploying production cloud infrastructure using AWS services (EC2, S3, Lambda, API Gateway) and Azure App Service. Experienced in Docker containerization, cloud monitoring, microservices architecture, and automated CI/CD pipelines.";
          } else if (norm.includes("staff") || norm.includes("senior") || norm.includes("lead")) {
            answer = "Over several years of engineering end-to-end systems, I have led technical architectural decisions, designed resilient RAG and LLM ingestion pipelines, mentored engineering teams, and reduced production API response latencies by 30%. I focus on system reliability, scalable design, and high-impact business outcomes.";
          } else {
            answer = "Extensive experience delivering production full-stack software, AI agents, and scalable cloud architectures.";
          }
        }
        await ta.fill(answer);
        await ta.dispatchEvent("input");
        await ta.dispatchEvent("change");
        console.log(`  ✅ Question Textarea ("${labelText.slice(0, 30)}..."): Filled`);
        continue;
      }

      // 2. Check for Native Select
      const selectEl = q.locator("select").first();
      if (await selectEl.count() > 0) {
        let chosenVal = matchedAnswer || "USD";
        if (norm.includes("currency")) chosenVal = "USD";
        await fillSelect(`select[name='${await selectEl.getAttribute("name")}']`, chosenVal);
        console.log(`  ✅ Question Select ("${labelText.slice(0, 30)}..."): Selected "${chosenVal}"`);
        continue;
      }

      // 3. Check for Radio group
      const radios = q.locator("input[type='radio']");
      const rCount = await radios.count();
      if (rCount > 0) {
        let targetRadioVal = matchedAnswer;
        if (norm.includes("residing in canada") || norm.includes("sponsorship") || norm.includes("require visa") || norm.includes("need visa")) {
          targetRadioVal = "No";
        } else if (norm.includes("referral") || norm.includes("referred") || norm.includes("reference") || norm.includes("current employee")) {
          targetRadioVal = "Yes";
        } else if (norm.includes("how did you hear") || norm.includes("how did you learn")) {
          targetRadioVal = "Social media";
        } else if (norm.includes("notice period")) {
          targetRadioVal = "0 to 1 month";
        } else if (norm.includes("crypto") || norm.includes("production software") || norm.includes("authorized")) {
          targetRadioVal = "Yes";
        } else if (!targetRadioVal) {
          targetRadioVal = "Yes";
        }

        const matchingRadio = q.locator(`input[type='radio'][value*='${targetRadioVal}' i]`).first();
        if (await matchingRadio.count() > 0) {
          const lbl = matchingRadio.locator("xpath=ancestor::label").first();
          if (await lbl.count() > 0) await humanClick(page, lbl).catch(() => lbl.click({ force: true }));
          else await humanClick(page, matchingRadio).catch(() => matchingRadio.click({ force: true }));
        } else {
          // Try matching radio label text
          const matchingLbl = q.locator("label").filter({ hasText: new RegExp(targetRadioVal, "i") }).first();
          if (await matchingLbl.count() > 0) {
            await humanClick(page, matchingLbl).catch(() => matchingLbl.click({ force: true }));
          } else {
            // Fallback: click first radio
            const firstRadio = radios.first();
            const lbl = firstRadio.locator("xpath=ancestor::label").first();
            if (await lbl.count() > 0) await humanClick(page, lbl).catch(() => lbl.click({ force: true }));
          }
        }
        console.log(`  ✅ Question Radio ("${labelText.slice(0, 30)}..."): Selected "${targetRadioVal}"`);
        continue;
      }

      // 4. Check for Checkbox group or single agreement checkbox
      const checkboxes = q.locator("input[type='checkbox']");
      const cbCount = await checkboxes.count();
      if (cbCount > 0) {
        if (cbCount === 1 || norm.includes("agree") || norm.includes("consent") || norm.includes("certify") || norm.includes("confirm")) {
          const singleCb = checkboxes.first();
          const lbl = singleCb.locator("xpath=ancestor::label").first();
          if (await lbl.count() > 0) await humanClick(page, lbl).catch(() => lbl.click({ force: true }));
          else await humanClick(page, singleCb).catch(() => singleCb.check({ force: true }));
          console.log(`  ✅ Question Checkbox ("${labelText.slice(0, 30)}..."): Checked agreement`);
        } else {
          // Multi-checkbox group: check matching or first option
          let checkedAny = false;
          if (matchedAnswer) {
            const matchCb = q.locator("label").filter({ hasText: new RegExp(matchedAnswer, "i") }).first();
            if (await matchCb.count() > 0) {
              await humanClick(page, matchCb).catch(() => matchCb.click({ force: true }));
              checkedAny = true;
            }
          }
          if (!checkedAny) {
            const firstCb = checkboxes.first();
            const lbl = firstCb.locator("xpath=ancestor::label").first();
            if (await lbl.count() > 0) await humanClick(page, lbl).catch(() => lbl.click({ force: true }));
            else await humanClick(page, firstCb).catch(() => firstCb.check({ force: true }));
          }
          console.log(`  ✅ Question Multi-Checkbox ("${labelText.slice(0, 30)}..."): Selected`);
        }
        continue;
      }

      // 5. Check for single line text input (like referral, reference, or salary)
      if (norm.includes("pronoun")) continue; // Skip pronouns custom input unless visible and needed
      const textInput = q.locator("input[type='text']:not(.location-input):visible").first();
      if (await textInput.count() > 0 && (await textInput.isVisible().catch(() => false)) && !(await textInput.inputValue().catch(() => ""))) {
        let val = matchedAnswer;
        if (norm.includes("referral") || norm.includes("referred") || norm.includes("reference") || norm.includes("referred by") || norm.includes("who referred") || norm.includes("current employee") || norm.includes("specify the employee")) {
          val = "Tarun Komati";
        } else if (!val) {
          if (norm.includes("salary") || norm.includes("expectation") || norm.includes("annual")) {
            val = "120000";
          } else {
            val = "None";
          }
        }
        await textInput.fill(val, { timeout: 5000 }).catch(() => {});
        await textInput.dispatchEvent("input").catch(() => {});
        await textInput.dispatchEvent("change").catch(() => {});
        console.log(`  ✅ Question Input ("${labelText.slice(0, 30)}..."): Filled "${val}"`);
      }
    }

    // 9. Equal Employment Opportunity (EEO) Demographic Survey
    const eeoSelects = page.locator("select[name^='eeo['], .eeo-section select");
    const eeoCount = await eeoSelects.count();
    if (eeoCount > 0) {
      console.log(`  📋 [LeverAdapter]: Processing ${eeoCount} EEO demographic survey dropdowns...`);
      for (let i = 0; i < eeoCount; i++) {
        const sel = eeoSelects.nth(i);
        const selName = (await sel.getAttribute("name")) || "";
        const options = await sel.evaluate((el: HTMLSelectElement) => {
          return Array.from(el.options).map(o => ({ value: o.value, text: o.text.trim() }));
        });

        let targetTerm = "Decline";
        if (selName.includes("gender")) {
          targetTerm = profile.gender || "Male";
        } else if (selName.includes("race")) {
          targetTerm = "Asian";
        } else if (selName.includes("veteran")) {
          targetTerm = "not a protected veteran";
        } else if (selName.includes("disability")) {
          targetTerm = "do not have a disability";
        }

        let match = options.find(o => o.text.toLowerCase().includes(targetTerm.toLowerCase()) || o.value.toLowerCase().includes(targetTerm.toLowerCase()));
        if (!match) {
          match = options.find(o => o.text.toLowerCase().includes("decline") || o.text.toLowerCase().includes("prefer not"));
        }
        if (!match && options.length > 1) {
          match = options[1];
        }

        if (match && match.value) {
          await sel.selectOption(match.value).catch(() => {});
          await sel.evaluate((el: HTMLElement) => {
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }).catch(() => {});
          console.log(`  ✅ EEO [${selName}]: Selected "${match.text}"`);
        }
      }
    }

    await updateHUDStatus(page, "Form Filled!", "All fields and questions populated", "success", 100).catch(() => {});
    console.log("🎉 [LeverAdapter]: Form filling completed successfully.");
  }

  async validate(page: Page, _fields?: FormField[]): Promise<boolean> {
    const audit = await page.evaluate(() => {
      const form = document.querySelector("#application-form, form") as HTMLFormElement | null;
      const isValid = form ? form.checkValidity() : false;
      const invalidEls = Array.from(document.querySelectorAll(":invalid"));
      const invalidDetails = invalidEls.map(el => {
        const inp = el as HTMLInputElement;
        return inp.name || inp.id || inp.placeholder || el.tagName;
      });
      const locInput = document.querySelector("#location-input, input.location-input") as HTMLInputElement | null;
      const locVal = locInput?.value;
      const selectedLoc = (document.querySelector("#selected-location") as HTMLInputElement)?.value;
      const locationOk = !locInput || (!!locVal && !!selectedLoc);

      return {
        isValid: isValid && invalidEls.length === 0 && locationOk,
        invalidCount: invalidEls.length,
        invalidDetails
      };
    });

    if (audit.invalidDetails.length > 0) {
      console.warn(`⚠️ [LeverAdapter]: Invalid elements detected: ${audit.invalidDetails.join(", ")}`);
    }

    console.log(`📊 [LeverAdapter]: Form validation check: ${audit.isValid ? "✅ VALID" : "❌ INVALID"} (invalid count: ${audit.invalidCount})`);
    return audit.isValid;
  }

  async submit(page: Page): Promise<SubmissionResult> {
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";
    const isDryRun = process.env.DRY_RUN === "true" || !isAutoSubmit;

    await updateHUDStatus(
      page,
      !isAutoSubmit ? "Ready for Review" : "Submitting Application",
      !isAutoSubmit ? "Application filled: Ready for your manual submission" : "Preparing to click submit...",
      "info",
      92
    );

    // Locate submit button
    const submitBtnLocators = [
      "#btn-submit",
      "button[data-qa='btn-submit']",
      ".template-btn-submit",
      "button:has-text('Submit application')",
      "button:has-text('Submit Application')",
      "button:has-text('Submit')",
      "input[type='submit'][value*='Submit' i]"
    ];

    let submitBtn = null;
    for (const sel of submitBtnLocators) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        submitBtn = btn;
        break;
      }
    }

    if (!submitBtn) {
      console.error("❌ [LeverAdapter]: Submit button #btn-submit not found on page.");
      await updateHUDStatus(page, "Submission Failed", "Submit button not found", "error", 100);
      return {
        success: false,
        errorMessage: "LEVER_SUBMIT_BUTTON_NOT_FOUND: Submit button #btn-submit not visible on page."
      };
    }

    // Scroll to bottom and center submit button in viewport
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })).catch(() => {});
    await page.waitForTimeout(600);
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);

    // Visually highlight submit button with glowing green outline for manual submission
    await page.evaluate(() => {
      const btn = document.querySelector("#btn-submit, button[data-qa='btn-submit'], .template-btn-submit, button[type='submit']");
      if (btn) {
        (btn as HTMLElement).style.outline = "3px solid #22c55e";
        (btn as HTMLElement).style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.85)";
        (btn as HTMLElement).style.borderRadius = "8px";
        (btn as HTMLElement).style.transition = "all 0.3s ease";
      }
    }).catch(() => {});

    // Move the cursor in an organic zig-zag path onto the center of the submit button
    const btnBox = await submitBtn.boundingBox().catch(() => null);
    if (btnBox) {
      await humanMouseMove(page, btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2, {
        oscillations: 4,
        amplitude: 22,
        overshoot: true
      }).catch(() => {});
    }

    // If auto-submit is NOT explicitly requested, DO NOT click submit
    if (!isAutoSubmit) {
      console.log("👉 [LeverAdapter]: Ready for manual submission. Submit button is centered & highlighted for you to click!");
      await removeCursorVisualizer(page);
      await updateHUDStatus(page, "Ready to Submit", "Application completed! Submit button highlighted below for you to submit manually 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION"
      };
    }

    // 1. Audit validation before submit
    const isValid = await this.validate(page);
    if (!isValid) {
      console.warn("⚠️ [LeverAdapter]: Pre-submit validation detected incomplete fields. Attempting submission anyway so Lever triggers exact required fields.");
    }

    console.log("🔴 [LeverAdapter]: LIVE AUTO-SUBMIT — Preparing to click Lever submit button...");

    // 2. Pre-submit organic zig-zag review sweeps across the form
    await updateHUDStatus(page, "Reviewing Application", "Simulating natural human review & zig-zag mouse movement...", "info", 93);
    await simulateZigZagReview(page, 3000);

    // 4. Check if CapSolver or 2Captcha API key is available to solve hCaptcha proactively
    const capSolverKey = process.env.CAPSOLVER_API_KEY;
    const twoCaptchaKey = process.env["2CAPTCHA_API_KEY"] || process.env.TWOCAPTCHA_API_KEY;
    if (capSolverKey || twoCaptchaKey) {
      console.log(`🤖 [LeverAdapter]: Pre-solving hCaptcha via ${capSolverKey ? "CapSolver" : "2Captcha"} API before submit click...`);
      await updateHUDStatus(page, "Anti-Bot Verification", "Solving hCaptcha token via Solver API...", "info", 94);
      try {
        const siteKey = await page.evaluate(() => {
          const el = document.querySelector("[data-sitekey]");
          if (el) return el.getAttribute("data-sitekey");
          const iframes = Array.from(document.querySelectorAll("iframe"));
          for (const f of iframes) {
            const m = (f.src || "").match(/sitekey=([a-f0-9-]+)/i);
            if (m) return m[1];
          }
          return "e33f87f8-88ec-4e1a-9a13-df9bbb1d8120";
        });

        let token: string | null = null;
        if (capSolverKey) {
          token = await this.solveWithCapSolver(capSolverKey, page.url(), siteKey || "e33f87f8-88ec-4e1a-9a13-df9bbb1d8120");
        } else if (twoCaptchaKey) {
          token = await this.solveWith2Captcha(twoCaptchaKey, page.url(), siteKey || "e33f87f8-88ec-4e1a-9a13-df9bbb1d8120");
        }

        if (token) {
          await page.evaluate((tok) => {
            const inp = document.getElementById("hcaptchaResponseInput") as HTMLInputElement;
            if (inp) {
              inp.value = tok;
              inp.dispatchEvent(new Event("input", { bubbles: true }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
            }
            const textareas = document.querySelectorAll("textarea[name='h-captcha-response'], textarea[name='g-recaptcha-response']");
            textareas.forEach(t => { (t as HTMLTextAreaElement).value = tok; });
          }, token);
          console.log("✅ [LeverAdapter]: Solver token successfully injected into hCaptcha response!");
        }
      } catch (err: any) {
        console.warn("⚠️ [LeverAdapter]: CAPTCHA pre-solving failed, will rely on interactive execution:", err.message);
      }
    }

    // 4. Perform natural human click on submit button ONCE
    await updateHUDStatus(page, "Submitting Application", "Clicking submit button...", "info", 96);
    try {
      await humanClick(page, submitBtn);
    } catch (err: any) {
      console.warn("⚠️ [LeverAdapter]: humanClick fallback to direct click:", err.message);
      await submitBtn.click({ force: true }).catch(() => {});
    }

    // 5. Check if an interactive hCaptcha challenge appears and wait for resolution
    // Note: When hCaptcha is solved, Lever's own onSuccess callback automatically submits the form.
    // We must NEVER re-click #btn-submit, as tokens are single-use and re-clicking invalidates them.
    const captchaOutcome = await this.handleCaptchaIfPresent(page, 90000);
    if (!captchaOutcome) {
      console.warn("⚠️ [LeverAdapter]: hCaptcha challenge was not resolved.");
    }

    // 6. Polling check for up to 45 seconds for confirmation URL, thank-you text, or error banners
    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      await page.waitForTimeout(1500);

      // A. Check for successful URL redirect
      const currentUrl = page.url().toLowerCase();
      if (currentUrl.includes("/thanks") || currentUrl.includes("/confirmation") || currentUrl.includes("/applied")) {
        console.log("🎉 [LeverAdapter]: Application submission confirmed via URL redirect!");
        await updateHUDStatus(page, "Application Submitted", "Successfully submitted to Lever!", "success", 100);
        return {
          success: true,
          confirmation: "LEVER_SUBMISSION_SUCCESS"
        };
      }

      // B. Check for confirmation page body text
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase()).catch(() => "");
      if (
        bodyText.includes("thank you") ||
        bodyText.includes("application submitted") ||
        bodyText.includes("we have received your application") ||
        bodyText.includes("thanks for applying") ||
        bodyText.includes("your application has been submitted")
      ) {
        console.log("🎉 [LeverAdapter]: Application submission confirmed via page content!");
        await updateHUDStatus(page, "Application Submitted", "Successfully submitted to Lever!", "success", 100);
        return {
          success: true,
          confirmation: "LEVER_SUBMISSION_SUCCESS"
        };
      }

      // C. CRITICAL: Check for Lever's verification error banner
      // "* There was an error verifying your application. Please try again."
      const verificationError = await page.evaluate(() => {
        const fullText = document.body.innerText;
        if (
          fullText.includes("error verifying your application") ||
          fullText.includes("There was an error verifying your application") ||
          fullText.includes("verifying your application")
        ) {
          return "There was an error verifying your application. Please try again. (Lever anti-bot / hCaptcha validation failed)";
        }
        return null;
      }).catch(() => null);

      if (verificationError) {
        console.error(`❌ [LeverAdapter]: ${verificationError}`);
        await updateHUDStatus(page, "Verification Rejected", "Anti-bot verification failed on submit", "error", 100);
        return {
          success: false,
          errorMessage: `LEVER_VERIFICATION_REJECTED: ${verificationError}`
        };
      }

      // D. Check for client-side field validation errors
      const visibleErrors = await page.evaluate(() => {
        const errEls = Array.from(document.querySelectorAll(".error-message:not([style*='display: none']), .application-form-error:not([style*='display: none']), .form-error:not([style*='display: none']), [class*='error']:not([style*='display: none'])"));
        return errEls
          .map(el => (el as HTMLElement).innerText?.trim() || "")
          .filter(t => t.length > 0 && !t.includes("Resume") && !t.includes("LinkedIn") && !t.includes("error-boundary") && !t.includes("verifying") && !t.includes("upload size") && !t.includes("100MB"));
      }).catch(() => [] as string[]);

      if (visibleErrors.length > 0) {
        const errSummary = visibleErrors.slice(0, 3).join("; ");
        console.error(`❌ [LeverAdapter]: Submission blocked by client-side validation errors: ${errSummary}`);
        await updateHUDStatus(page, "Validation Error", errSummary, "error", 100);
        return {
          success: false,
          errorMessage: `LEVER_VALIDATION_ERROR: ${errSummary}`
        };
      }
    }

    // Final confirmation check after wait window
    const finalUrl = page.url().toLowerCase();
    const finalContent = await page.content().catch(() => "");
    const isSuccess = /thank you|application submitted|we have received your application/i.test(finalContent) || finalUrl.includes("thanks");

    if (isSuccess) {
      await updateHUDStatus(page, "Application Submitted", "Successfully submitted to Lever!", "success", 100);
      return {
        success: true,
        confirmation: "LEVER_SUBMISSION_SUCCESS"
      };
    }

    await updateHUDStatus(page, "Submission Timeout", "Did not detect confirmation page within 45s", "warning", 100);
    return {
      success: false,
      errorMessage: "LEVER_SUBMISSION_TIMEOUT_OR_UNCONFIRMED: Did not detect confirmation page or thank you text within timeout window."
    };
  }

  /**
   * Detects if an hCaptcha interactive challenge modal is active on screen.
   * Supports interactive headed mode resolution or waiting for token generation.
   */
  async handleCaptchaIfPresent(page: Page, timeoutMs = 90000): Promise<boolean> {
    // Initial short pause to give Lever's script and hCaptcha time to invoke
    await page.waitForTimeout(1500);

    const checkToken = async () => {
      return await page.evaluate(() => {
        const inp = document.getElementById("hcaptchaResponseInput") as HTMLInputElement;
        const textareas = Array.from(document.querySelectorAll("textarea[name='h-captcha-response']")) as HTMLTextAreaElement[];
        const hasInput = !!inp?.value && inp.value.length > 20;
        const hasTextarea = textareas.some(t => !!t.value && t.value.length > 20);
        return hasInput || hasTextarea;
      }).catch(() => false);
    };

    // If token is already present or page already redirected, nothing to wait for
    if (await checkToken() || page.url().toLowerCase().includes("thanks")) {
      return true;
    }

    // Wait up to 6 seconds to see if an interactive challenge iframe opens
    const isInteractiveVisible = async () => {
      return await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll("iframe"));
        return iframes.some(f => {
          const src = f.src || "";
          const isHcap = src.includes("hcaptcha.com") || src.includes("recaptcha");
          const rect = f.getBoundingClientRect();
          return isHcap && rect.width > 120 && rect.height > 120 && f.style.visibility !== "hidden";
        });
      }).catch(() => false);
    };

    let interactiveActive = false;
    for (let i = 0; i < 4; i++) {
      if (await checkToken() || page.url().toLowerCase().includes("thanks")) return true;
      if (await isInteractiveVisible()) {
        interactiveActive = true;
        break;
      }
      await page.waitForTimeout(1000);
    }

    if (!interactiveActive) {
      // Invisible challenge resolved automatically or no visual puzzle triggered
      return true;
    }

    console.log("\n⚠️ [hCaptcha Challenge Detected]: Visual puzzle ('Tap on things...') is currently active on screen!");
    await removeCursorVisualizer(page);
    await updateHUDStatus(page, "Security Verification", "Please complete the quick image puzzle in the window — Cluco will finalize submission automatically 🎯", "warning", 94);
    console.log("👉 Please complete the visual puzzle in the open browser window. Automation is waiting for your verification...");

    // Wait for user to complete the puzzle or token to populate
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (page.url().toLowerCase().includes("thanks") || page.url().toLowerCase().includes("confirmation")) {
        return true;
      }
      if (await checkToken()) {
        console.log("✅ [hCaptcha Solved]: Verification token received! Lever submission proceeding...");
        return true;
      }
      // If the challenge modal closed without producing a token, check if verification error appeared
      const hasError = await page.evaluate(() => document.body.innerText.includes("error verifying your application")).catch(() => false);
      if (hasError) {
        console.warn("⚠️ [LeverAdapter]: Verification error banner rendered after captcha.");
        return false;
      }
      await page.waitForTimeout(1500);
    }

    console.warn("⚠️ [LeverAdapter]: Captcha was not completed within the timeout window.");
    return false;
  }

  /**
   * Helper to solve hCaptcha via CapSolver HTTP API
   */
  private async solveWithCapSolver(apiKey: string, websiteUrl: string, websiteKey: string): Promise<string | null> {
    try {
      const createRes = await fetch("https://api.capsolver.com/createTask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: apiKey,
          task: {
            type: "HCaptchaTaskProxyLess",
            websiteURL: websiteUrl,
            websiteKey: websiteKey
          }
        })
      });
      const createData: any = await createRes.json();
      if (!createData || createData.errorId !== 0) {
        console.warn("⚠️ CapSolver task creation error:", createData?.errorDescription);
        return null;
      }

      const taskId = createData.taskId;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const res = await fetch("https://api.capsolver.com/getTaskResult", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientKey: apiKey, taskId })
        });
        const data: any = await res.json();
        if (data.status === "ready") {
          return data.solution?.token || data.solution?.gRecaptchaResponse || null;
        }
        if (data.status === "failed") break;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Helper to solve hCaptcha via 2Captcha HTTP API
   */
  private async solveWith2Captcha(apiKey: string, websiteUrl: string, websiteKey: string): Promise<string | null> {
    try {
      const inRes = await fetch(`https://2captcha.com/in.php?key=${apiKey}&method=hcaptcha&sitekey=${websiteKey}&pageurl=${encodeURIComponent(websiteUrl)}&json=1`);
      const inData: any = await inRes.json();
      if (!inData || inData.status !== 1) {
        console.warn("⚠️ 2Captcha task creation error:", inData?.request);
        return null;
      }

      const reqId = inData.request;
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await fetch(`https://2captcha.com/res.php?key=${apiKey}&action=get&id=${reqId}&json=1`);
        const data: any = await res.json();
        if (data.status === 1) {
          return data.request || null;
        }
        if (data.request !== "CAPCHA_NOT_READY") break;
      }
      return null;
    } catch {
      return null;
    }
  }
}
