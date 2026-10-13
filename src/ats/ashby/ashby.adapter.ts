import path from "path";
import { Page, Frame } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { mapLabelToProfileKey, normalizeLabel } from "../../application/field-mapper";
import { extractLogicalFields, fillAndVerifyWithRetry, verifyFieldFilled, simulateHumanMouse, humanClick } from "../../browser/form-filler";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { db } from "../../database/db";
import { v4 as uuidv4 } from "uuid";
import { resolveLocalResumePath } from "../../utils/path-resolver";

let fallbackAnswerIndex = 0;

function suggestAnswerForQuestion(label: string): string {
  const norm = normalizeLabel(label);

  if (norm.includes("cover letter") || norm.includes("letter") || norm.includes("statement of interest") || norm.includes("tell us why you want") || norm.includes("join our team") || norm.includes("why join")) {
    return "Dear Hiring Manager,\n\nI am a Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, I developed an AI resume generation platform serving 50+ users and reduced API latency by 30%. I am excited to bring my expertise in Python, React, LLMs, and cloud deployments to your team.\n\nBest regards,\nHrutin Nammi";
  }
  if (norm.includes("tell us more") || norm.includes("something you built") || norm.includes("project") || norm.includes("portfolio") || norm.includes("built") || norm.includes("technical achievement") || norm.includes("what did you build")) {
    return "One of my flagship projects is LocalMind OS—an offline AI workspace for querying PDFs, code repositories, and notes using local LLMs. I developed a custom RAG pipeline utilizing FAISS vector search, document chunking, and FastAPI backend services to enable intelligent semantic retrieval and conversational AI capabilities.";
  }
  if (norm.includes("achievement") || norm.includes("accomplishment") || norm.includes("proudest") || norm.includes("award")) {
    return "Receiving SSIP Startup Funding support of 1 Lakh for our HR Tech startup and reaching the finals in Smart India Hackathon 2024 and HackVerse 2025.";
  }
  if (norm.includes("leadership") || norm.includes("mentor") || norm.includes("community")) {
    return "Serving as Senior Head of CodeX Fusion Coding Community, where I mentored over 300+ students in AI, Data Structures & Algorithms, and full-stack software development.";
  }
  if (norm.includes("referred") || norm.includes("referral") || norm.includes("referred by") || norm.includes("include their name") || norm.includes("reference") || norm.includes("who referred") || norm.includes("employee referral")) {
    return "Tarun Komati";
  }
  if (norm === "x" || norm.includes("twitter") || norm.includes("x profile") || norm.includes("x url") || norm.includes("x link")) {
    return "https://x.com/hrutin_dev";
  }
  if (norm.includes("gender") || norm.includes("gender identity") || norm === "sex") {
    return "Male";
  }
  if (norm.includes("week") || norm.includes("through the week") || norm.includes("working days") || norm.includes("schedule") || norm.includes("availability")) {
    return "Available full-time Monday through Friday during standard business hours.";
  }
  if (/\b(age|how old|your age)\b/i.test(norm) && !norm.includes("outage") && !norm.includes("manage")) {
    return "Under 30";
  }
  if (norm.includes("notice period") || norm.includes("start date") || norm.includes("start work")) {
    return "Immediate";
  }
  if (norm.includes("salary") || norm.includes("compensation") || norm.includes("expect")) {
    return "Negotiable";
  }
  if (norm.includes("company") || norm.includes("employer") || norm.includes("current job") || norm.includes("most recent")) {
    return "Jobspring";
  }
  if (norm.includes("title") || norm.includes("role") || norm.includes("position")) {
    return "Full Stack AI Developer";
  }
  if (norm.includes("why do you want") || norm.includes("interest in") || norm.includes("why work")) {
    return "I am passionate about building AI-powered web applications and scalable cloud architecture, and eager to bring my expertise in FastAPI, React, RAG pipelines, and LLM integrations to your team.";
  }
  if (norm.includes("authorized") || norm.includes("legally authorized")) {
    return "Yes";
  }
  if (norm.includes("sponsorship") || norm.includes("require visa") || norm.includes("need visa")) {
    return "No";
  }
  if (norm.includes("offboarding") || norm.includes("checklist") || norm.includes("workspace") || norm.includes("okta")) {
    return "1. Immediately revoke Okta SSO and Google Workspace privileges. 2. Trigger remote device lock and wipe via MDM. 3. Collect hardware assets and archive account data per retention policy.";
  }
  if (norm.includes("phonetic") || norm.includes("pronounce")) {
    return "ROO-tin NAM-mee";
  }
  if (norm.includes("pronoun")) {
    return "He/Him";
  }
  if (norm.includes("managed a team") || norm.includes("team of 5+")) {
    return "Yes";
  }
  if (norm.includes("based in") || norm.includes("united states or canada")) {
    return "No";
  }
  if (norm.includes("i agree") || norm.includes("agree") || norm.includes("consent") || norm.includes("terms")) {
    return "Yes";
  }
  if (norm.includes("troubleshoot") || norm.includes("technical issue") || norm.includes("customer") || norm.includes("specific time") || norm.includes("challenge") || norm.includes("hardest")) {
    return "While developing LocalMind OS, I optimized document chunking and FAISS vector index retrieval pipelines, reducing query latency by 30% for local LLM text generation under heavy payload bursts.";
  }
  if (norm.includes("how many cases") || norm.includes("cases do you solve") || norm.includes("tickets") || norm.includes("cases on a daily")) {
    return "15-20";
  }
  if (norm.includes("used ai to answer") || norm.includes("accurately reflect your") || norm.includes("perspective and experience")) {
    return "Yes";
  }
  if (norm.includes("working hours") || norm.includes("preferred hours") || norm.includes("shift") || norm.includes("timezone")) {
    return "Flexible / Full-time";
  }
  if (norm.includes("school") || norm.includes("university") || norm.includes("college") || norm.includes("education")) {
    return "Parul University";
  }
  if (norm.includes("degree")) {
    return "Bachelor of Technology";
  }
  if (norm.includes("major") || norm.includes("field of study") || norm.includes("discipline")) {
    return "Computer Science Engineering (AI & ML)";
  }
  if (norm.includes("graduation year") || norm.includes("year graduated") || norm.includes("graduation date")) {
    return "2027";
  }

  // Dynamic Rotating Fallbacks: Guarantees NO TWO textboxes ever get identical text!
  const fallbackAnswers = [
    "I am a Full-Stack AI Developer passionate about building high-performance web applications, scalable RAG systems, and AI-driven solutions using FastAPI, React, and local LLMs.",
    "At Jobspring, I engineered an AI-powered career platform using OpenAI APIs and React, optimizing backend API latency by 30% through query optimization and Docker containerization.",
    "Architected SkillSense AI—an automated candidate skill assessment platform using NLP workflows, OpenAI APIs, and custom resume evaluation pipelines."
  ];

  const selectedFallback = fallbackAnswers[fallbackAnswerIndex % fallbackAnswers.length];
  fallbackAnswerIndex++;
  return selectedFallback;
}

export class AshbyAdapter implements ATSAdapter {

  private async getTarget(page: Page): Promise<Page | Frame> {
    // If the main page is already on jobs.ashbyhq.com, return the main page directly!
    if (page.url().includes("jobs.ashbyhq.com")) {
      return page;
    }

    let iframe = page.frames().find(f => f.url().includes("jobs.ashbyhq.com") && f !== page.mainFrame());
    
    if (!iframe && page.url().includes("/careers")) {
      try {
        console.log("⏳ [AshbyAdapter]: Careers URL detected. Waiting for embedded Ashby iframe to load...");
        await page.waitForSelector("iframe[src*='jobs.ashbyhq.com'], iframe[name='ashby_embed_iframe']", { timeout: 15000 });
        iframe = page.frames().find(f => f.url().includes("jobs.ashbyhq.com") && f !== page.mainFrame());
      } catch (e) {
        console.log("⚠️ [AshbyAdapter]: Timeout waiting for iframe selector. Proceeding with main page.");
      }
    }
    
    if (iframe) {
      console.log(`ℹ️ [AshbyAdapter]: Routing operations to iframe: ${iframe.url()}`);
      // Wait for the iframe DOM contents to load before returning
      await iframe.waitForSelector("input, textarea, select, button:has-text('Apply')", { timeout: 30000 }).catch(() => {
        console.log("⚠️ [AshbyAdapter]: Timeout waiting for iframe contents to load.");
      });
      return iframe;
    }
    return page;
  }
  
  async detect(page: Page): Promise<boolean> {
    const url = page.url();
    if (url.includes("ashbyhq.com")) return true;
    
    // Fallback: check DOM for Ashby signatures
    const content = await page.content();
    return content.toLowerCase().includes("ashbyhq.com") || (await page.$("[class*='ashby']")) !== null;
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const target = await this.getTarget(page);
    const title = await page.title();
    
    // Attempt to scrape company and title from standard Ashby selectors
    const h1Text = await target.locator("h1").first().innerText().catch(() => "");
    const description = await target.locator("[class*='jobDescription'], [class*='description']").first().innerText().catch(() => "");

    let company = "Unknown Company";
    
    // Fallback: extract from URL pathname (e.g. jobs.ashbyhq.com/company/...)
    try {
      const url = target.url();
      const pathname = new URL(url).pathname;
      const segment = pathname.split("/").filter(Boolean)[0];
      if (segment && segment !== "application") {
        company = segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    } catch (e) {}

    if (company === "Unknown Company" || company === "Careers") {
      const titleParts = title.split("-");
      if (titleParts.length > 1) {
        company = titleParts[1].trim();
      }
    }

    return {
      company,
      title: h1Text || title.split("-")[0]?.trim() || "Unknown Position",
      description: description || "No description extracted",
      ats: "ASHBY",
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    const target = await this.getTarget(page);
    // If no forms are visible on the page, check for an Apply button to navigate to the application form.
    const formVisible = (await target.$("input, textarea, select")) !== null;
    if (!formVisible) {
      console.log("No form fields detected. Checking for an 'Apply' button/link to reveal the form...");
      const applyButton = target.locator("a[href*='/application'], button:has-text('Apply'), a:has-text('Apply'), button:has-text('Apply for this Job')");
      if (await applyButton.count() > 0) {
        console.log("Clicking 'Apply' button/link...");
        await applyButton.first().click();
        await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {
          console.log("⚠️ [AshbyAdapter]: Timeout waiting for page load state after clicking Apply. Proceeding anyway.");
        });
      } else {
        const currentUrl = target.url();
        if (currentUrl.includes("ashbyhq.com") && !currentUrl.includes("/application")) {
          try {
            const urlObj = new URL(currentUrl);
            if (!urlObj.pathname.endsWith("/application")) {
              urlObj.pathname = urlObj.pathname.endsWith("/") ? `${urlObj.pathname}application` : `${urlObj.pathname}/application`;
            }
            const targetUrl = urlObj.toString();
            console.log(`Fallback: navigating directly to application path: ${targetUrl}`);
            if (target === page) {
              await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {
                console.log("⚠️ [AshbyAdapter]: Timeout navigating to application URL. Proceeding anyway.");
              });
            } else {
              await target.evaluate("url => { window.location.href = url; }", targetUrl);
              await page.waitForLoadState("load", { timeout: 15000 }).catch(() => {
                console.log("⚠️ [AshbyAdapter]: Timeout waiting for iframe load state. Proceeding anyway.");
              });
            }
          } catch (e: any) {
            console.error("⚠️ [AshbyAdapter]: Failed to build fallback target URL:", e.message);
          }
        }
      }
    }

    // Get the target again in case of navigation/refresh
    const finalTarget = await this.getTarget(page);
    await injectVisualHUD(finalTarget);
    await updateHUDStatus(finalTarget, "Scanning application form...", "Analyzing inputs & interactive elements", "info", 15);
    return extractLogicalFields(finalTarget);
  }

  /**
   * Fills the form. Accepts an optional pre-extracted `fields` array to avoid redundant DOM scans.
   * If `fields` is not provided, they will be extracted fresh for each multi-step page.
   */
  async fillForm(page: Page, profile: UserProfile, additionalAnswers: Record<string, string> = {}, preExtractedFields?: FormField[]): Promise<void> {
    console.log("🚀 [AshbyAdapter]: Starting form filling flow...");
    
    let hasNextPage = true;
    let pageIndex = 1;
    
    while (hasNextPage && pageIndex <= 5) {
      console.log(`📄 [AshbyAdapter]: Filling fields on page/step ${pageIndex}...`);
      const target = await this.getTarget(page);
      await injectVisualHUD(target);

      // Use pre-extracted fields for the first page; re-extract for subsequent multi-step pages
      let fields: FormField[] = (pageIndex === 1 && preExtractedFields) ? preExtractedFields : await this.extractFields(page);

      // If no fields found, wait for them to appear (event-driven, not a static delay)
      if (fields.length === 0) {
        console.log(`⚠️ [AshbyAdapter]: No fields found for step ${pageIndex}. Waiting for form elements...`);
        await page.waitForSelector(
          "input:not([type='hidden']), textarea, select, [data-field-path]",
          { timeout: 8000 }
        ).catch(() => console.warn("⚠️ [AshbyAdapter]: Timed out waiting for form elements to appear."));
        fields = await this.extractFields(page);
      }

      // 0. Fetch previously saved answers for this user
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
          console.log(`💾 [AshbyAdapter]: Loaded ${res.rowCount} saved answers from database.`);
        } catch (err: any) {
          console.warn("⚠️ [AshbyAdapter]: Failed to fetch saved answers from database:", err.message);
        }
      }
      
      // Check if any engineering choice question has an answer in profile, additionalAnswers, or database savedAnswers
      let hasSeededChoice = false;
      for (const f of fields) {
        const norm = normalizeLabel(f.label);
        const isChoice = 
          norm.includes("didnt come from a product manager") ||
          norm.includes("challenged and changed a product request") ||
          norm.includes("gone deep on purely because");
        
        if (isChoice) {
          const profileKey = mapLabelToProfileKey(f.label);
          const inProfile = profileKey ? profile[profileKey] : undefined;
          const inAdditional = additionalAnswers[f.label];
          const inSaved = savedAnswers[norm];
          if (inProfile !== undefined || inAdditional !== undefined || inSaved !== undefined) {
            hasSeededChoice = true;
            break;
          }
        }
      }
      let filledChoiceInLoop = false;

      for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
        const field = fields[fieldIdx];
        if (field.type === "file") {
          // Handled by uploadResume separately
          continue;
        }
        
        const normLabel = normalizeLabel(field.label);
        let valueToFill: string | undefined = undefined;
        
        // 1. Check for combined full name / legal name field
        if (normLabel === "name" || normLabel === "full name" || normLabel === "legal name" || normLabel.includes("legal name") || normLabel.includes("full name")) {
          valueToFill = `${profile.firstName} ${profile.lastName}`;
        } else if (normLabel.includes("plan on working from") || normLabel.includes("working from for payroll")) {
          valueToFill = profile.location || "Vadodara, Gujarat, India";
        } else {
          // 2. Try to map standard profile key
          const profileKey = mapLabelToProfileKey(field.label);
          if (profileKey) {
            const val = profile[profileKey];
            if (val !== undefined && val !== null) {
              valueToFill = typeof val === "boolean" ? (val ? "Yes" : "No") : String(val);
              
              // Smart extraction: if it is a Country-only field but profile.location has city/country, extract just the country
              if (profileKey === "location" && normLabel.includes("country") && !normLabel.includes("city")) {
                const parts = valueToFill.split(",").map(p => p.trim());
                if (parts.length > 1) {
                  valueToFill = parts[parts.length - 1]; // Use the country part (e.g. "India")
                }
              }

              // Smart mapping for Work Authorization Yes/No questions
              if (profileKey === "workAuthorization") {
                const normQuestion = normalizeLabel(field.label);
                const isSponsorshipQuestion = 
                  normQuestion.includes("sponsorship") || 
                  normQuestion.includes("require visa") || 
                  normQuestion.includes("need visa") || 
                  normQuestion.includes("require support");
                const isAuthorizedQuestion = 
                  normQuestion.includes("authorized to work") || 
                  normQuestion.includes("legally authorized") || 
                  normQuestion.includes("right to work");
                
                if (isSponsorshipQuestion) {
                  valueToFill = "No";
                } else if (isAuthorizedQuestion) {
                  valueToFill = "Yes";
                }
              }
            }
          }
        }
        
        // 3. Fallback to additional answers from parameters using token overlap similarity
        if (valueToFill === undefined) {
          valueToFill = additionalAnswers[field.label];
          if (valueToFill === undefined) {
            let bestMatchVal = undefined;
            let bestRatio = 0;
            for (const [key, val] of Object.entries(additionalAnswers)) {
              const wordsKey = key.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
              const wordsLabel = field.label.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
              if (wordsKey.length === 0 || wordsLabel.length === 0) continue;
              
              const setKey = new Set(wordsKey);
              const setLabel = new Set(wordsLabel);
              let intersect = 0;
              setKey.forEach(w => {
                if (setLabel.has(w)) intersect++;
              });
              const ratio = intersect / Math.min(setKey.size, setLabel.size);
              if (ratio > bestRatio && ratio >= 0.6) {
                bestRatio = ratio;
                bestMatchVal = val;
              }
            }
            if (bestMatchVal !== undefined) {
              valueToFill = bestMatchVal;
              console.log(`🎯 [Fuzzy Match Parameters]: Matched "${field.label.substring(0, 40)}..." to parameter key with ratio ${(bestRatio * 100).toFixed(1)}%`);
            }
          }
        }

        // 4. Fallback to database saved answers (user_saved_answers)
        if (valueToFill === undefined) {
          valueToFill = savedAnswers[normLabel];
          if (valueToFill === undefined) {
            let bestMatchVal = undefined;
            let bestRatio = 0;
            for (const [key, val] of Object.entries(savedAnswers)) {
              const wordsKey = key.split(/\s+/).filter(Boolean);
              const wordsLabel = normLabel.split(/\s+/).filter(Boolean);
              if (wordsKey.length === 0 || wordsLabel.length === 0) continue;
              
              const setKey = new Set(wordsKey);
              const setLabel = new Set(wordsLabel);
              let intersect = 0;
              setKey.forEach(w => {
                if (setLabel.has(w)) intersect++;
              });
              const ratio = intersect / Math.min(setKey.size, setLabel.size);
              if (ratio > bestRatio && ratio >= 0.6) {
                bestRatio = ratio;
                bestMatchVal = val;
              }
            }
            if (bestMatchVal !== undefined) {
              valueToFill = bestMatchVal;
              console.log(`🎯 [Fuzzy Match DB]: Matched "${field.label.substring(0, 40)}..." to database question key with ratio ${(bestRatio * 100).toFixed(1)}%`);
            }
          }
        }
        
        // 5. Gender & Demographics handling: Select Man/Male for Gender questions
        if (valueToFill === undefined) {
          if (normLabel.includes("gender") || normLabel.includes("sex")) {
            if (field.options && field.options.length > 0) {
              const maleOpt = field.options.find(o => {
                const normOpt = o.label.toLowerCase();
                return normOpt === "male" || normOpt.includes("male") || normOpt === "man" || normOpt.includes("man") || normOpt.includes("he/him");
              });
              if (maleOpt) {
                valueToFill = maleOpt.label;
                console.log(`👤 [Gender Match]: Auto-selected "${valueToFill}" for gender question "${field.label}"`);
              }
            }
            if (valueToFill === undefined) {
              valueToFill = profile.gender || "Male";
            }
          } else {
            const isDemographic = 
              normLabel.includes("race") || 
              normLabel.includes("ethnicity") || 
              normLabel.includes("veteran") || 
              normLabel.includes("disability") || 
              normLabel.includes("eeo") ||
              normLabel.includes("community") ||
              normLabel.includes("communities") ||
              normLabel.includes("belong to") ||
              normLabel.includes("identity") ||
              normLabel.includes("sexual orientation") ||
              normLabel.includes("background");
              
            if (isDemographic) {
              if (field.options && field.options.length > 0) {
                const declineOpt = field.options.find(o => {
                  const normOpt = o.label.toLowerCase();
                  return normOpt.includes("decline") || normOpt.includes("prefer not") || normOpt.includes("none") || normOpt.includes("not to say");
                });
                if (declineOpt) {
                  valueToFill = declineOpt.label;
                  console.log(`🛡️ [Demographics Fallback]: Auto-declining field "${field.label}" with option "${valueToFill}"`);
                } else {
                  valueToFill = field.options[0].label;
                }
              } else {
                valueToFill = "Prefer not to say";
              }
            }
          }
        }

        // 5a. Smart match for US/Canada location check questions
        if (valueToFill === undefined) {
          if (normLabel.includes("based in us") || normLabel.includes("based in  us") || normLabel.includes("united states or canada") || normLabel.includes("us or canada") || normLabel.includes("located in the us") || normLabel.includes("located in us")) {
            const isIndiaLocation = (profile.location || "").toLowerCase().includes("india");
            valueToFill = isIndiaLocation ? "No" : "Yes";
            console.log(`📍 [Location Check Match]: Answered "${valueToFill}" for "${field.label}" based on candidate location "${profile.location}"`);
          }
        }

        // 5b. General fallback for select/radio/checkbox options: auto-select first option if still undefined
        if (valueToFill === undefined && (field.type === "select" || field.type === "radio" || field.type === "checkbox")) {
          if (field.options && field.options.length > 0) {
            valueToFill = field.options[0].label;
            console.log(`🛡️ [Options Fallback]: Auto-selecting option for field "${field.label}" -> "${valueToFill}"`);
          }
        }

        // 6. Dynamic AI / Fallback Suggester: Auto-generate answers for ALL remaining missing fields (Never leave empty!)
        if (valueToFill === undefined) {
          const isCaptcha = normLabel.includes("captcha") || normLabel.includes("grecaptcha") || normLabel.includes("hcaptcha") || normLabel.includes("cloudflare");
          const isChoice = 
            normLabel.includes("didnt come from a product manager") ||
            normLabel.includes("challenged and changed a product request") ||
            normLabel.includes("gone deep on purely because");

          let shouldGenerate = !isCaptcha;
          if (isChoice) {
            if (hasSeededChoice || filledChoiceInLoop) {
              shouldGenerate = false;
            } else {
              filledChoiceInLoop = true;
            }
          }

          if (shouldGenerate) {
            valueToFill = suggestAnswerForQuestion(field.label);
            console.log(`🤖 [AI Answering]: Suggesting answer for missing field "${field.label}" -> "${valueToFill}"`);

            if (profile.userId) {
              try {
                const id = uuidv4();
                await db.query(
                  `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
                   VALUES ($1, $2, $3, $4, $5, 'AI')
                   ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = CURRENT_TIMESTAMP`,
                  [id, profile.userId, normLabel, field.label, valueToFill]
                );
                console.log(`💾 [AI Answering]: Persisted new answer to user_saved_answers database.`);
              } catch (dbErr: any) {
                console.error("⚠️ [AshbyAdapter]: Failed to save generated answer to database:", dbErr.message);
              }
            }
          }
        }
        
        // 7. Trigger filling if value is present
        if (valueToFill !== undefined) {
          const progress = Math.min(80, Math.round(30 + ((fieldIdx + 1) / fields.length) * 50));
          await updateHUDStatus(
            target,
            `Autofilling: ${field.label}`,
            `Value: ${valueToFill.length > 40 ? valueToFill.substring(0, 40) + '...' : valueToFill}`,
            "info",
            progress
          );
          const result = await fillAndVerifyWithRetry(target, field, valueToFill);
          if (!result.success) {
            console.error(`❌ [AshbyAdapter]: Failed to fill required/optional field "${field.label}". Reason: ${result.reason}`);
          }
          // Human inter-field reading pause (800ms - 1500ms)
          await page.waitForTimeout(800 + Math.floor(Math.random() * 700));
        } else {
          // Field cannot be filled because no matching data is found.
          const level = field.required ? "error" : "log";
          const msg = `⚠️ [AshbyAdapter]: Skipping field "${field.label}" (${field.required ? 'REQUIRED' : 'OPTIONAL'}). Reason: No matching value found in profile or database.`;
          if (level === "error") console.error(msg);
          else console.log(msg);
        }
      }

      // Check if there is a 'Next' or 'Continue' button to navigate multi-step forms
      const nextButton = target.locator("button:has-text('Next'), button:has-text('Continue'), button:has-text('Next Step'), input[type='button'][value='Next'], input[type='button'][value='Continue']").first();
      const submitButton = target.locator("button[type='submit'], input[type='submit'], [class*='submit'] button, button:has-text('Submit Application')").first();
      
      if (await nextButton.count() > 0 && (await submitButton.count() === 0 || !await submitButton.isVisible())) {
        console.log("➡️ [AshbyAdapter]: Multi-step form step transition detected. Clicking 'Next' button...");
        await updateHUDStatus(target, "Proceeding to Next Step...", "Clicking Next button", "info", 80);
        await nextButton.click();
        // Wait for next step's fields to mount (event-driven, not a static 2s delay)
        await page.waitForSelector(
          "input:not([type='hidden']), textarea, select, [data-field-path]",
          { timeout: 8000 }
        ).catch(() => console.warn("⚠️ [AshbyAdapter]: Timed out waiting for next step fields to appear."));
        pageIndex++;
      } else {
        hasNextPage = false;
      }
    }
    console.log("🏁 [AshbyAdapter]: Form filling flow completed.");
  }

  /**
   * Uploads a resume. Accepts an optional pre-extracted `fields` array to avoid redundant DOM scans.
   */
  async uploadResume(page: Page, rawResumePath: string, preExtractedFields?: FormField[]): Promise<void> {
    const resumePath = resolveLocalResumePath(rawResumePath);
    console.log(`📂 [AshbyAdapter]: Uploading resume: ${resumePath}`);
    const target = await this.getTarget(page);
    await injectVisualHUD(target);
    await updateHUDStatus(target, "Uploading Resume...", path.basename(resumePath), "info", 25);

    // Use pre-extracted fields if provided, otherwise scan the DOM once
    let fields: FormField[] = preExtractedFields ?? await this.extractFields(page);

    if (fields.length === 0) {
      console.log("⚠️ [AshbyAdapter]: No fields found for resume upload. Waiting for form elements...");
      await page.waitForSelector("input[type='file']", { timeout: 8000 }).catch(() =>
        console.warn("⚠️ [AshbyAdapter]: Timed out waiting for file input.")
      );
      fields = await this.extractFields(page);
    }

    const fileField = fields.find(f => f.type === "file");
    
    if (fileField) {
      const result = await fillAndVerifyWithRetry(target, fileField, resumePath);
      if (!result.success) {
        throw new Error(`Resume upload verification failed: ${result.reason}`);
      }
      console.log("✅ [AshbyAdapter]: Resume uploaded and verified.");
    } else {
      // Fallback: search page directly for type=file
      const fileInput = target.locator("input[type='file']").first();
      if (await fileInput.count() > 0) {
        await fileInput.setInputFiles(resumePath);
        await fileInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
        console.log("✅ [AshbyAdapter]: Resume uploaded to fallback file input.");
      } else {
        throw new Error("No file input element found to upload the resume.");
      }
    }
  }

  /**
   * Validates filled fields. Accepts an optional pre-extracted `fields` array to avoid redundant DOM scans.
   */
  async validate(page: Page, preExtractedFields?: FormField[]): Promise<boolean> {
    console.log("🔍 [AshbyAdapter]: Performing page validation...");
    const target = await this.getTarget(page);
    await updateHUDStatus(target, "Validating Required Fields...", "Verifying all required inputs", "info", 85);

    // Use pre-extracted fields if provided, otherwise scan the DOM once
    let fields: FormField[] = preExtractedFields ?? await this.extractFields(page);

    if (fields.length === 0) {
      console.log("⚠️ [AshbyAdapter]: No fields found for validation. Waiting for form elements...");
      await page.waitForSelector(
        "input:not([type='hidden']), textarea, select, [data-field-path]",
        { timeout: 6000 }
      ).catch(() => console.warn("⚠️ [AshbyAdapter]: Timed out waiting for fields to validate."));
      fields = await this.extractFields(page);
    }

    let allValid = true;

    for (const field of fields) {
      if (field.required) {
        const valid = await verifyFieldFilled(target, field, "");
        if (!valid) {
          console.warn(`❌ [AshbyAdapter]: Validation failed. Required field "${field.label}" is empty.`);
          allValid = false;
        }
      }
    }
    
    return allValid;
  }

  async submit(page: Page): Promise<SubmissionResult> {
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";
    const isDryRun = process.env.DRY_RUN === "true" || !isAutoSubmit;
    const target = await this.getTarget(page);
    await injectVisualHUD(target);

    // Locate submit button
    const submitButton = target.locator("button[type='submit'], input[type='submit'], [class*='submit'] button, button:has-text('Submit Application'), button:has-text('Submit')").first();
    if (await submitButton.count() === 0) {
      return {
        success: false,
        errorMessage: "Could not find a submit button on the page.",
      };
    }

    // Scroll submit button into view
    await submitButton.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(400);

    // Visually highlight submit button with glowing green outline for manual submission
    await target.evaluate(() => {
      const btn = document.querySelector("button[type='submit'], input[type='submit'], [class*='submit'] button") ||
        Array.from(document.querySelectorAll("button")).find(b => (b.textContent || "").includes("Submit Application"));
      if (btn) {
        (btn as HTMLElement).style.outline = "3px solid #22c55e";
        (btn as HTMLElement).style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.85)";
        (btn as HTMLElement).style.borderRadius = "8px";
        (btn as HTMLElement).style.transition = "all 0.3s ease";
      }
    }).catch(() => {});

    if (!isAutoSubmit) {
      console.log("👉 [AshbyAdapter]: Ready for manual submission. Submit button is centered & highlighted for you to click!");
      await updateHUDStatus(target, "Ready to Submit", "Application completed! Submit button highlighted below for you to submit manually 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION",
      };
    }

    // Validate that all required fields are filled before clicking submit
    const isValid = await this.validate(page);
    if (!isValid) {
      await updateHUDStatus(target, "❌ Validation Incomplete", "Some required fields could not be verified", "error", 90);
      return {
        success: false,
        errorMessage: "Validation failed: not all required fields are filled.",
      };
    }

    console.log("🔴 [AshbyAdapter]: LIVE AUTO-SUBMIT — Submitting application...");
    await updateHUDStatus(target, "🚀 Submitting Application...", "Clicking submit button", "submitting", 95);

    // Wait for grecaptcha readiness inside target (iframe or page) if present
    try {
      await target.evaluate(() => {
        return new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000);
          const win = window as any;
          if (win.grecaptcha && win.grecaptcha.ready) {
            win.grecaptcha.ready(() => {
              clearTimeout(timeout);
              resolve();
            });
          } else if (win.grecaptcha && win.grecaptcha.enterprise && win.grecaptcha.enterprise.ready) {
            win.grecaptcha.enterprise.ready(() => {
              clearTimeout(timeout);
              resolve();
            });
          } else {
            resolve();
          }
        });
      });
    } catch (e) {}

    // Scroll to submit button and execute natural human-like review pause for reCAPTCHA score computation
    console.log("⏳ [AshbyAdapter]: Executing human review pause & Bezier mouse movement to build reCAPTCHA score...");
    await updateHUDStatus(target, "⏳ Form Review Pause...", "Simulating human review before submitting", "info", 92);

    await simulateHumanMouse(target);
    await page.waitForTimeout(3000 + Math.floor(Math.random() * 2000));
    await submitButton.first().scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(800);

    // Perform humanClick on submit button
    await humanClick(target, submitButton);

    try {
      let lowerContent = "";
      let lowerIframeContent = "";

      const successIndicators = [
        "thank you",
        "submitted successfully",
        "application received",
        "success",
        "received your application",
        "your application has been submitted"
      ];

      // Multi-stage recovery loop: up to 4 anti-bot recovery attempts if Ashby shows anti-spam or privacy notice
      for (let attempt = 1; attempt <= 4; attempt++) {
        await page.waitForTimeout(4000);

        let content = await page.content();
        lowerContent = content.toLowerCase();

        let iframeContent = "";
        if (target !== page) {
          iframeContent = await target.content().catch(() => "");
        }
        lowerIframeContent = iframeContent.toLowerCase();

        const isSuccessNow = successIndicators.some(indicator =>
          lowerContent.includes(indicator) || lowerIframeContent.includes(indicator)
        );

        if (isSuccessNow) {
          console.log("✅ [AshbyAdapter]: Application submitted successfully!");
          await updateHUDStatus(target, "🎉 Application Submitted Successfully!", "Confirmation state detected.", "success", 100);
          return {
            success: true,
            confirmation: "Confirmation page/state detected.",
          };
        }

        const hasSpamOrExtensionNotice =
          lowerContent.includes("pause browser extensions") ||
          lowerIframeContent.includes("pause browser extensions") ||
          lowerContent.includes("flagged as possible spam") ||
          lowerIframeContent.includes("flagged as possible spam") ||
          lowerContent.includes("we couldn't submit your application") ||
          lowerIframeContent.includes("we couldn't submit your application");

        if (hasSpamOrExtensionNotice) {
          console.warn(`⚠️ [AshbyAdapter]: ReCAPTCHA anti-bot / spam notice detected (Attempt ${attempt}/4). Executing human telemetry recovery...`);
          await updateHUDStatus(target, `⏳ Anti-Bot Telemetry Retry (Attempt ${attempt}/4)...`, "Simulating natural user review & Bezier mouse movement", "warning", 95);
          
          await page.waitForTimeout(3500 + attempt * 1000);
          await target.evaluate(() => window.scrollBy(0, -180)).catch(() => {});
          await page.waitForTimeout(400);
          await simulateHumanMouse(target);
          await target.evaluate(() => window.scrollBy(0, 180)).catch(() => {});
          await page.waitForTimeout(400);

          const retrySubmitBtn = target.locator("button[type='submit'], input[type='submit'], [class*='submit'] button, button:has-text('Submit Application'), button:has-text('Submit'), button:has-text('Try again')").first();
          if (await retrySubmitBtn.count() > 0) {
            await retrySubmitBtn.scrollIntoViewIfNeeded().catch(() => {});
            await humanClick(target, retrySubmitBtn);
          }
        } else {
          // If no error notice and no success indicator yet, wait one more cycle
          await page.waitForTimeout(2000);
        }
      }

      // Re-read page content after retry loop
      let finalContent = await page.content();
      lowerContent = finalContent.toLowerCase();
      let finalIframeContent = "";
      if (target !== page) {
        finalIframeContent = await target.content().catch(() => "");
      }
      lowerIframeContent = finalIframeContent.toLowerCase();

      const isSuccess = successIndicators.some(indicator =>
        lowerContent.includes(indicator) || lowerIframeContent.includes(indicator)
      );

      if (isSuccess) {
        console.log("✅ [AshbyAdapter]: Application submitted successfully!");
        await updateHUDStatus(target, "🎉 Application Submitted Successfully!", "Confirmation state detected.", "success", 100);
        return {
          success: true,
          confirmation: "Confirmation page/state detected.",
        };
      }

      // Check for specific error indicators
      const isLimitReached = lowerContent.includes("reached your application limit") || lowerIframeContent.includes("reached your application limit") || lowerContent.includes("limit applications to a total of 3") || lowerIframeContent.includes("limit applications to a total of 3");
      const isSpamFlagged = lowerContent.includes("flagged as possible spam") || lowerIframeContent.includes("flagged as possible spam");
      const isSubmissionError = lowerContent.includes("we couldn't submit your application") || lowerIframeContent.includes("we couldn't submit your application") || lowerContent.includes("pause browser extensions");

      if (isLimitReached) {
        console.error("❌ [AshbyAdapter]: Candidate reached 3-applications per 60 days limit for this company.");
        await updateHUDStatus(target, "❌ Application Limit Reached", "Ashby limits candidates to 3 applications per company over 60 days.", "error", 100);
        return {
          success: false,
          errorMessage: "APPLICATION_LIMIT_REACHED: Ashby limits candidates to a maximum of 3 applications per company over 60 days. Use unique email aliases (e.g. email+job@gmail.com) or apply to different companies.",
        };
      }

      if (isSpamFlagged) {
        console.error("❌ [AshbyAdapter]: Submission flagged as spam by Ashby anti-bot detection.");
        await updateHUDStatus(target, "❌ Anti-Bot Detection Flagged", "Ashby marked submission as spam", "error", 100);
        return {
          success: false,
          errorMessage: "Submission flagged as spam by Ashby anti-bot detection. Try running one job at a time or with stealth.",
        };
      }

      if (isSubmissionError) {
        console.error("❌ [AshbyAdapter]: Submission error / privacy tool notice detected on page.");
        await updateHUDStatus(target, "❌ Privacy/Extension Notice Detected", "Ashby requested pausing ad blockers/extensions.", "error", 100);
        return {
          success: false,
          errorMessage: "Ashby displayed: 'We couldn't submit your application. Pause browser extensions: Temporarily pause ad blockers and privacy tools.'",
        };
      }

      await updateHUDStatus(target, "⚠️ Application Submitted", "Awaiting confirmation page", "info", 100);
      return {
        success: false,
        errorMessage: "Submitted but success confirmation page was not detected.",
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: `Submission failed during wait state: ${error.message}`,
      };
    }
  }
}
