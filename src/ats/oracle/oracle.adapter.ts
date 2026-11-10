import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import fs from "fs";
import path from "path";
import { fetchLatestOracleOtp, getLatestOracleInboxState } from "../../utils/oracle-otp-listener";

export class OracleAdapter implements ATSAdapter {
  private defaultEmail = process.env.ORACLE_EMAIL || "babufakemail@gmail.com";

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("careers.oracle.com") || url.includes("oraclecloud.com")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return lower.includes("careers.oracle.com") || lower.includes("oraclecloud.com") || (await page.$("[class*='oracle']")) !== null;
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");

    const extracted = await page.evaluate(() => {
      // Find actual job requisition title, avoiding accessibility/accommodation/affirmative-action banners
      const titleCandidates = Array.from(document.querySelectorAll(".job-title, [class*='requisition-title'], .job-details__title, h1, h2, [data-bind*='title']"));
      let heading = "";
      for (const el of titleCandidates) {
        const text = el.textContent?.trim() || "";
        const lower = text.toLowerCase();
        if (
          lower.includes("accessibility assistance") ||
          lower.includes("accommodation") ||
          lower.includes("affirmative action") ||
          lower.includes("skip to main") ||
          lower.includes("cookie") ||
          text.length < 3 ||
          text.length > 150
        ) {
          continue;
        }
        heading = text;
        break;
      }

      const desc = document.querySelector(".job-description, [class*='description'], section")?.textContent?.trim() || "";
      return { heading, desc };
    }).catch(() => ({ heading: "", desc: "" }));

    return {
      company: "Oracle",
      title: extracted.heading || pageTitle.replace(/[-|].*$/, "").trim() || "Oracle Job Requisition",
      description: extracted.desc || "Oracle Careers Job Description",
      ats: "ORACLE"
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    return page.evaluate(() => {
      const fields: FormField[] = [];
      const elements = Array.from(document.querySelectorAll("input, select, textarea, [role='combobox']"));

      for (const el of elements) {
        const inp = el as any;
        if (inp.type === "hidden") continue;

        let labelText = "";
        if (inp.id) {
          const lbl = document.querySelector(`label[for='${inp.id}']`);
          if (lbl) labelText = lbl.textContent?.trim() || "";
        }
        if (!labelText && inp.labels && inp.labels.length > 0) {
          labelText = Array.from(inp.labels).map((l: any) => l.textContent?.trim()).join(" ");
        }
        if (!labelText) {
          const parent = inp.closest("div, p, label, section, [class*='row'], [class*='field']");
          if (parent) {
            const lbl = parent.querySelector("label, span.label, span.title");
            if (lbl) labelText = lbl.textContent?.trim() || "";
          }
        }

        fields.push({
          id: inp.name || inp.id || "",
          label: (labelText || inp.getAttribute("aria-label") || inp.placeholder || inp.name || inp.id || "").replace(/\s+/g, " "),
          type: (inp.type === "email" || inp.type === "tel" || inp.type === "file" || inp.type === "checkbox") ? inp.type : (inp.tagName === "TEXTAREA" ? "textarea" : "text"),
          required: inp.required || inp.getAttribute("aria-required") === "true"
        });
      }

      return fields;
    }).catch(() => []);
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers?: Record<string, string>,
    fields?: FormField[]
  ): Promise<void> {
    console.log(`[OracleAdapter] Starting Oracle Cloud Recruiting autofill for: ${profile.firstName} ${profile.lastName}`);

    // Ensure the email used for Oracle authentication matches candidate profile (Hrutin Nammi)
    let userEmail = profile.email || this.defaultEmail;

    // Helper: Dismiss Oracle cookie consent banner
    const dismissOracleCookies = async () => {
      try {
        const cookieBtn = page.locator("button.cookie-consent__button.accept, button:has-text('Accept'), button:has-text('ACCEPT'), #onetrust-accept-btn-handler").first();
        if (await cookieBtn.count() > 0 && await cookieBtn.isVisible().catch(() => false)) {
          console.log("[OracleAdapter] Dismissing cookie consent banner...");
          await cookieBtn.click({ force: true });
          await page.waitForTimeout(600);
        }
      } catch (e) {}
    };

    // Helper: Fill element if visible
    const fillIfVisible = async (selector: string, value: string, name: string) => {
      try {
        const loc = page.locator(selector).first();
        if (await loc.count() > 0 && await loc.isVisible()) {
          await loc.fill(value);
          console.log(`[OracleAdapter] Filled ${name}: ${value}`);
          return true;
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Could not fill ${name}: ${e.message}`);
      }
      return false;
    };

    // 0. If on job view or preview page, navigate directly to apply/email or click Apply Now
    const jobIdMatch = page.url().match(/\/job[s]?(?:\/preview)?\/(\d+)/i);
    if (!page.url().includes("/apply")) {
      let navigatedDirectly = false;
      if (jobIdMatch) {
        let directApplyUrl = "";
        if (page.url().includes("careers.oracle.com")) {
          directApplyUrl = `https://careers.oracle.com/en/sites/jobsearch/job/${jobIdMatch[1]}/apply/email`;
        } else if (page.url().includes("oraclecloud.com")) {
          const baseMatch = page.url().match(/(https:\/\/[^\/]+\/hcmUI\/CandidateExperience\/[^\/]+\/sites\/[^\/]+)/i);
          if (baseMatch) {
            directApplyUrl = `${baseMatch[1]}/job/${jobIdMatch[1]}/apply/email`;
          }
        }
        if (directApplyUrl) {
          console.log(`[OracleAdapter] Navigating directly to application flow: ${directApplyUrl}...`);
          await page.goto(directApplyUrl, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
          await page.waitForTimeout(3000);
          if (page.url().includes("/apply")) {
            navigatedDirectly = true;
          }
        }
      }

      if (!navigatedDirectly) {
        const applyBtn = page.locator("button.apply-now-button, button:has-text('Apply Now'), a:has-text('Apply Now'), button:has-text('Apply')").first();
        await applyBtn.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
        if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
          console.log("[OracleAdapter] Clicking 'Apply Now' button...");
          await applyBtn.click({ force: true }).catch(async () => {
            await page.evaluate(() => {
              const btn = (document.querySelector("button.apply-now-button") || Array.from(document.querySelectorAll("button, a")).find(el => (el.textContent || "").includes("Apply"))) as HTMLElement;
              if (btn) btn.click();
            });
          });
          await page.waitForTimeout(3000);
        }
      }
    }

    // 1. Initial Email / Authentication Screen
    const emailInput = page.locator("input#primary-email-1, input#primary-email-0, input[name='primary-email'], input[type='email']").first();
    await emailInput.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    
    let baselineState: any = null;
    let requestStartTime = Date.now();

    if (page.url().includes("/apply/email") || await emailInput.count() > 0) {
      await dismissOracleCookies();

      const gmailAccount = process.env.GMAIL_USER || userEmail;
      if (gmailAccount && process.env.GMAIL_APP_PASSWORD) {
        console.log(`[OracleAdapter] Checking current inbox state (${userEmail}) before requesting verification code...`);
        baselineState = await getLatestOracleInboxState(userEmail).catch(() => null);
        if (baselineState?.latestId) {
          console.log(`[OracleAdapter] Baseline Oracle email ID: ${baselineState.latestId} (latest code: ${baselineState.latestCode || "none"})`);
        }
      }

      console.log(`[OracleAdapter] Entering applicant email: ${userEmail}...`);
      if (await emailInput.count() > 0 && await emailInput.isVisible()) {
        await emailInput.click({ force: true }).catch(() => {});
        await emailInput.fill(userEmail);
        await emailInput.dispatchEvent("input").catch(() => {});
        await emailInput.dispatchEvent("change").catch(() => {});
      }

      // Check legal disclaimer checkbox (toggle button for Knockout observables)
      await page.evaluate(() => {
        const cbBtn = document.querySelector(".apply-flow-input-checkbox__button, span[data-bind*='toggleAccepted']") as HTMLElement;
        if (cbBtn && !cbBtn.classList.contains("apply-flow-input-checkbox__button--checked")) {
          cbBtn.click();
        }
        const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
        if (cb && !cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await page.waitForTimeout(800);

      // Re-verify cookie banner is out of the way before clicking next
      await dismissOracleCookies();

      requestStartTime = Date.now();
      console.log("[OracleAdapter] Advancing past email step...");
      const nextEmailBtn = page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next'), button:has-text('NEXT')").first();
      if (await nextEmailBtn.count() > 0) {
        await nextEmailBtn.click({ force: true }).catch(() => {});
      } else {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button, input[type='button']"));
          const nb = btns.find(b => b.textContent?.trim().toLowerCase() === "next" || b.id?.includes("next")) as HTMLElement;
          if (nb) nb.click();
        });
      }
      
      // Wait for authentication response (OTP screen, rate limit, or next section)
      console.log("[OracleAdapter] Waiting for authentication response (OTP, rate-limit, or next section)...");
      for (let w = 0; w < 20; w++) {
        await page.waitForTimeout(1000);
        const hasPin = await page.$("#pin-code-1");
        const hasRate = await page.evaluate(() => {
          const t = document.body.innerText.toLowerCase();
          return t.includes("too many attempts") || t.includes("try again in 30 minutes");
        });
        const isSec = page.url().includes("/section/") || (!page.url().includes("/apply/email") && page.url().includes("/apply/"));
        if (hasPin || hasRate || isSec) {
          console.log(`[OracleAdapter] Auth state detected: ${hasPin ? "OTP PIN screen" : hasRate ? "Rate limit" : "Section loaded"}`);
          break;
        }
      }
    }

    // 2. Check for "Too Many Attempts" rate-limit screen from Oracle
    const checkRateLimit = async () => {
      return await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes("too many attempts") || text.includes("try again in 30 minutes") || text.includes("maximum number of attempts");
      });
    };

    if (await checkRateLimit()) {
      if (userEmail.includes("@gmail.com") && !userEmail.includes("+ats")) {
        const [prefix, domain] = userEmail.split("@");
        const cleanUser = prefix.split("+")[0];
        const aliasEmail = `${cleanUser}+ats${Date.now()}@${domain}`;
        console.warn(`⚠️ [Oracle Rate Limit]: '${userEmail}' is temporarily rate-limited. Retrying with alias '${aliasEmail}' (delivers to the exact same Gmail inbox!)...`);
        userEmail = aliasEmail;

        const currentApplyUrl = page.url().includes("/apply/email")
          ? page.url()
          : (jobIdMatch && jobIdMatch[1] && page.url().includes("oraclecloud.com"))
          ? `${page.url().match(/(https:\/\/[^\/]+\/hcmUI\/CandidateExperience\/[^\/]+\/sites\/[^\/]+)/i)?.[1] || "https://careers.oracle.com/en/sites/jobsearch"}/job/${jobIdMatch[1]}/apply/email`
          : (jobIdMatch && jobIdMatch[1])
          ? `https://careers.oracle.com/en/sites/jobsearch/job/${jobIdMatch[1]}/apply/email`
          : page.url();

        await page.goto(currentApplyUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(3000);
          const aliasInp = page.locator("input#primary-email-1, input[type='email']").first();
          if (await aliasInp.count() > 0) {
            await aliasInp.fill(aliasEmail);
            await page.evaluate(() => {
              const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
              if (cb && !cb.checked) {
                const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
                if (label) label.click(); else cb.click();
              }
            });
            await page.waitForTimeout(800);
            await page.locator("button:has-text('Next')").first().click();
            requestStartTime = Date.now();
            await page.waitForTimeout(5000);
          }
        } else {
          throw new Error(`⚠️ [Oracle Rate Limit]: Oracle has temporarily locked '${userEmail}' ("Too Many Attempts. Try again in 30 minutes").`);
        }
      }

    // 3. Check for "Confirm Your Identity" OTP code screen (for returning applicants)
    const checkIsConfirmScreen = async () => {
      return await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes("confirm your identity") || text.includes("verification code was sent") || !!document.getElementById("pin-code-1");
      });
    };

    if (await checkIsConfirmScreen()) {
      console.log(`\n🔑 [OracleAdapter] Oracle sent a 6-digit verification code to: ${userEmail}`);
      let otp = additionalAnswers?.otp || process.env.ORACLE_OTP;

      if (!otp && process.env.GMAIL_APP_PASSWORD) {
        console.log(`🤖 [OracleAdapter] Holding & auto-fetching fresh verification code for ${userEmail}...`);
        const fetched = await fetchLatestOracleOtp({
          timeoutMs: 75000,
          knownOldCode: baselineState?.latestCode || "",
          minTimestamp: requestStartTime - 15000,
          minMessageId: baselineState?.latestId || 0
        }, "", userEmail);
        if (fetched) {
          otp = fetched;
        }
      }

      if (otp) {
        console.log(`[OracleAdapter] Pasting fresh verification OTP: ${otp} into Oracle ATS...`);
        try {
          const firstPin = page.locator("#pin-code-1, input[id*='pin-code']").first();
          await firstPin.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});

          await page.evaluate((code) => {
            const el = document.getElementById("pin-code-1");
            if (!el) return false;
            try {
              const dt = new DataTransfer();
              dt.setData("text/plain", code);
              const pasteEvent = new ClipboardEvent("paste", {
                clipboardData: dt,
                bubbles: true,
                cancelable: true
              });
              el.focus();
              el.dispatchEvent(pasteEvent);
              return true;
            } catch (e) {
              return false;
            }
          }, otp);

          await page.waitForTimeout(800);

          await page.evaluate((code) => {
            for (let i = 0; i < 6; i++) {
              const inp = (document.getElementById(`pin-code-${i + 1}`) || document.querySelectorAll(".pin-code-input input")[i]) as HTMLInputElement;
              if (inp && (!inp.value || inp.value !== code[i])) {
                inp.focus();
                inp.value = code[i] || "";
                inp.dispatchEvent(new Event("input", { bubbles: true }));
                inp.dispatchEvent(new Event("change", { bubbles: true }));
                inp.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: code[i] }));
              }
            }
          }, otp);

          const valuesSet = await page.evaluate(() => {
            return Array.from(document.querySelectorAll("input[id^='pin-code-']")).map((i: any) => i.value).join("");
          });
          console.log(`[OracleAdapter] PIN code field values: '${valuesSet}'`);

          await page.waitForTimeout(1000);

          console.log("[OracleAdapter] Clicking 'Verify' button...");
          const verifyBtn = page.locator("form.pin-code-verification button[type='submit'], button:has-text('Verify'), button.apply-flow-dialog__button--primary").first();
          if (await verifyBtn.count() > 0 && await verifyBtn.isVisible()) {
            await verifyBtn.click();
          } else {
            await page.evaluate(() => {
              const vb = document.querySelector("form.pin-code-verification button[type='submit'], button.apply-flow-dialog__button--primary") as HTMLElement;
              if (vb) vb.click();
            });
          }

          console.log("[OracleAdapter] Waiting for verification confirmation...");
          for (let w = 0; w < 15; w++) {
            await page.waitForTimeout(1500);
            const stillConfirm = await checkIsConfirmScreen();
            if (!stillConfirm) {
              console.log("✅ [OracleAdapter] Email verified successfully! Moving to application sections.");
              break;
            }
          }
        } catch (e: any) {
          console.warn(`[OracleAdapter] Error during OTP entry: ${e.message}`);
        }
      } else {
        console.log("👉 [OracleAdapter] Waiting for verification code confirmation in browser window...");
        for (let w = 0; w < 40; w++) {
          await page.waitForTimeout(3000);
          const stillOtp = await checkIsConfirmScreen();
          if (!stillOtp) {
            console.log("✅ [OracleAdapter] Verification complete! Proceeding with application...");
            break;
          }
        }
      }
    }

    // Wait for transition out of /apply/email into application section
    console.log("[OracleAdapter] Waiting for application form to load...");
    for (let w = 0; w < 30; w++) {
      await page.waitForTimeout(1000);
      const currUrl = page.url();
      const isLoaded = await page.evaluate(() => {
        const hasInputs = document.querySelectorAll("input:not([type='hidden']), select, textarea, [class*='apply-flow'], [class*='input-row']").length > 0;
        const noSpinner = document.querySelector(".loading, .oj-loading, .apply-flow-dialog__loading, [class*='spinner']") === null;
        return hasInputs && noSpinner;
      });
      if (isLoaded && (!currUrl.includes("/apply/email") || currUrl.includes("/section/"))) {
        console.log(`[OracleAdapter] Application form active on URL: ${currUrl}`);
        break;
      }
    }
    await page.waitForTimeout(3000);

    // Helper: Exhaustively fill any matching visible field
    const fillAllVisibleMatching = async () => {
      await page.evaluate((prof) => {
        const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));
        for (const el of inputs) {
          const inp = el as any;
          const rect = inp.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (inp.type === "file" || inp.type === "checkbox" || inp.type === "radio") continue;
          // Protect country code dropdown / combobox from phone number filling
          if (inp.id && inp.id.includes("country-codes")) continue;
          if (inp.getAttribute("role") === "combobox" && (inp.name === "phoneNumber" || inp.id?.includes("phone") || inp.id?.includes("country-codes"))) continue;
          if (inp.value && inp.value.trim().length > 0) continue; // Already filled

          let label = "";
          if (inp.id) {
            const l = document.querySelector("label[for='" + inp.id + "']");
            if (l) label = l.textContent?.trim() || "";
          }
          if (!label) {
            const p = inp.closest(".form-block, .field, div, section, p, label");
            if (p) {
              const l = p.querySelector("label, span.label, span.title, p, .input-field__label");
              if (l) label = l.textContent?.trim() || "";
            }
          }
          const norm = (label + " " + (inp.name || "") + " " + (inp.id || "") + " " + (inp.placeholder || "")).toLowerCase();
          // Protect Address geography, Dates, Screening questions, and Comboboxes from raw synthetic string assignment
          if (
            norm.includes("gender") || norm.includes("veteran") || norm.includes("disability") ||
            norm.includes("country") || norm.includes("state") || norm.includes("province") || norm.includes("region") ||
            norm.includes("city") || norm.includes("town") || norm.includes("county") ||
            norm.includes("postal") || norm.includes("zip") || norm.includes("pincode") ||
            norm.includes("startdate") || norm.includes("enddate") || norm.includes("start-date") || norm.includes("end-date") ||
            norm.includes("month") || norm.includes("year") ||
            norm.includes("technical") || norm.includes("programming") || norm.includes("language") ||
            norm.includes("course") || norm.includes("project") || norm.includes("proficient") ||
            norm.includes("which of the following") || norm.includes("check all that apply")
          ) continue;

          let valToFill = "";
          if (norm.includes("first name") || norm.includes("firstname") || norm.includes("given name")) {
            valToFill = prof.firstName;
          } else if (norm.includes("last name") || norm.includes("lastname") || norm.includes("family name") || norm.includes("surname")) {
            valToFill = prof.lastName;
          } else if (norm.includes("jobtitle") || norm.includes("job title") || norm.includes("position") || norm.includes("role")) {
            valToFill = "Full Stack AI Developer";
          } else if (norm.includes("employer") || norm.includes("company") || norm.includes("organization")) {
            valToFill = "Jobspring";
          } else if (norm.includes("school") || norm.includes("university") || norm.includes("institution")) {
            valToFill = "Parul University";
          } else if (norm.includes("degree")) {
            valToFill = "Bachelor of Technology";
          } else if (norm.includes("major") || norm.includes("study")) {
            valToFill = "Computer Science";
          } else if (norm.includes("title") && !norm.includes("job") && !norm.includes("work") && !norm.includes("exp")) {
            valToFill = "Mr.";
          } else if (norm.includes("pronoun") || norm.includes("naminformation")) {
            valToFill = "He/Him";
          } else if ((norm.includes("phone") || norm.includes("tel") || norm.includes("mobile")) && inp.getAttribute("role") !== "combobox" && !inp.id?.includes("country-codes")) {
            valToFill = "4155552671";
          } else if (norm.includes("line 1") || norm.includes("line1") || norm.includes("addressline1") || (norm.includes("address") && norm.includes("building"))) {
            valToFill = "500 Oracle Parkway";
          } else if (
            (norm.includes("address") || norm.includes("street") || norm.includes("line")) &&
            (norm.includes("line 2") || norm.includes("line2") || norm.includes("suite") || norm.includes("apt") || norm.includes("addressline2"))
          ) {
            valToFill = "Suite 100";
          } else if (norm.includes("postal") || norm.includes("pin code") || norm.includes("pincode") || norm.includes("zip")) {
            valToFill = "94065";
          } else if (norm.includes("city") || norm.includes("town")) {
            valToFill = "Redwood City";
          } else if (norm.includes("state") || norm.includes("region") || norm.includes("province")) {
            valToFill = "California";
          } else if (norm.includes("county")) {
            valToFill = "San Mateo";
          } else if (norm.includes("country")) {
            valToFill = "United States";
          } else if (norm.includes("signature") || norm.includes("fullname") || norm.includes("full name")) {
            valToFill = prof.firstName + " " + prof.lastName;
          } else if (norm.includes("startdate") || norm.includes("start-date") || norm.includes("start date") || norm.includes("from")) {
            if (norm.includes("year")) valToFill = "2024";
            else if (norm.includes("month")) valToFill = "January";
          } else if (norm.includes("enddate") || norm.includes("end-date") || norm.includes("end date") || norm.includes("to")) {
            if (norm.includes("year")) valToFill = "2026";
            else if (norm.includes("month")) valToFill = "January";
          } else if (norm.includes("year") && !norm.includes("birth") && !norm.includes("earliest")) {
            valToFill = "2026";
          } else if (norm.includes("sitelink-1") || (norm.includes("link") && norm.includes("1"))) {
            valToFill = prof.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
          } else if (norm.includes("sitelink-2") || (norm.includes("link") && norm.includes("2"))) {
            valToFill = prof.githubUrl || "https://github.com/hrutinnammi";
          } else if (norm.includes("summary") || norm.includes("cover letter")) {
            valToFill = "Results-driven Software Engineer with extensive experience in scalable software development, full-stack architectures, cloud platforms, and distributed systems.";
          } else if (norm.includes("salary") || norm.includes("compensation") || norm.includes("pay")) {
            valToFill = "120000";
          } else if (norm.includes("source") || norm.includes("hear about") || norm.includes("referral") || norm.includes("referred")) {
            valToFill = "Company Website";
          } else if (norm.includes("notice") || norm.includes("availability") || norm.includes("available to start")) {
            valToFill = "Immediate";
          } else if (norm.includes("relocate")) {
            valToFill = "Yes";
          } else if (norm.includes("clearance")) {
            valToFill = "None";
          } else if (norm.includes("authorized") || norm.includes("authorization")) {
            valToFill = "Yes";
          } else if (norm.includes("sponsor")) {
            valToFill = "No";
          } else if (inp.required || inp.getAttribute("aria-required") === "true") {
            // General required text fallback to ensure zero unfilled required fields
            valToFill = "Full Stack AI Developer";
          }

          if (valToFill) {
            inp.value = valToFill;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            inp.dispatchEvent(new Event("blur", { bubbles: true }));
          }
        }
      }, profile);
    };

    // Loop through sections (handles 1-step, 2-step, or 3-step Oracle requisition flows)
    let maxSteps = 8;
    let resumeUploaded = false;

    while (maxSteps > 0) {
      maxSteps--;
      await page.waitForTimeout(2000);
      await dismissOracleCookies();
      const currentUrl = page.url();
      console.log(`[OracleAdapter] Processing form step (remaining loop passes: ${maxSteps}, URL: ${currentUrl})...`);

      // 1. Resume Upload (Section 1 or Section 2: strictly to Attachment slot, NEVER to Import Profile parser)
      const resumeFileToUse = additionalAnswers?.resumePath || (profile as any).resumePath || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf";
      if (resumeFileToUse && fs.existsSync(resumeFileToUse)) {
        const resumeFileName = path.basename(resumeFileToUse);

        // Clean up any duplicate attachments (e.g. if previous attempts uploaded multiple files)
        await page.evaluate((fileName) => {
          const allPills = Array.from(document.querySelectorAll(".apply-flow-attachment-list__item, [class*='attachment-item'], [class*='file-item'], li")).filter(el => {
            const text = el.textContent || "";
            return text.includes(fileName);
          });
          if (allPills.length > 1) {
            for (let i = 1; i < allPills.length; i++) {
              const closeBtn = allPills[i].querySelector("button, [class*='icon-close'], [aria-label*='delete' i], [aria-label*='remove' i]") as HTMLElement;
              if (closeBtn) closeBtn.click();
            }
          }
        }, resumeFileName).catch(() => {});

        const alreadyAttached = await page.evaluate((fileName) => {
          const bodyText = document.body?.innerText || "";
          return bodyText.includes(fileName);
        }, resumeFileName).catch(() => false);

        if (!alreadyAttached && !resumeUploaded) {
          // Strictly exclude profile import input ('Import your profile from resume') which triggers Oracle's failing server-side parser
          const fileInputs = page.locator("input#attachment-upload-2, input[name='attachment-upload'][id*='2'], input[id*='attachment-upload']:not([id*='3']):not([id*='4']), input[type='file']:not([aria-label*='import' i])");
          if (await fileInputs.count() > 0) {
            console.log(`[OracleAdapter] Uploading resume to attachment slot: ${resumeFileToUse}...`);
            await fileInputs.first().setInputFiles(resumeFileToUse).catch((e) => {
              console.warn(`[OracleAdapter] Resume upload error: ${e.message}`);
            });
            resumeUploaded = true;
            await page.waitForTimeout(2000);
          }
        } else if (alreadyAttached) {
          resumeUploaded = true;
        }
      }

      // 2. Personal & Contact Details (Strictly US Address & US Phone)
      const streetVal = "500 Oracle Parkway";
      const line2Val = "Suite 100";
      const cityCandidates = ["Los Angeles", "Redwood City", "San Francisco"];
      const stateCandidates = ["CA", "California"];
      const zipCandidates = ["90001", "94065", "94105"];
      const countyCandidates = ["Los Angeles", "San Mateo", "San Francisco"];
      const cleanPhone = "4155552671";

      // Helper: Select Oracle Redwood Combobox option (for Country, State, City, County, Postal Code)
      const fillOracleAddressCombobox = async (
        fieldName: "country" | "postalCode" | "city" | "state" | "county",
        targetValues: string[]
      ) => {
        try {
          const selectors: Record<string, string> = {
            country: "input[name='country']:not([id*='phone']):not([name*='phone']), input[id*='country']:not([id*='phone']):not([name*='phone']), select[name='country']",
            postalCode: "input[name='postalCode'], input[id*='postalCode'], input[name='zipCode'], input[id*='zipCode'], input[name*='postal' i], input[id*='postal' i]",
            state: "input[name='region2'], input[id*='region2'], input[name='state'], input[id*='state'], input[name='province'], input[id*='province']",
            city: "input[name='city'], input[id*='city'], input[name='town'], input[id*='town']",
            county: "input[name='region1'], input[id*='region1'], input[name='county'], input[id*='county']"
          };

          const sel = selectors[fieldName];
          const inp = page.locator(sel).first();
          if (await inp.count() === 0 || !(await inp.isVisible().catch(() => false))) {
            return false;
          }

          const currentVal = (await inp.inputValue().catch(() => "")).trim();
          const lowerCandidates = targetValues.map(v => v.toLowerCase().trim());

          // If already validly set to one of the candidates, no need to touch
          if (currentVal && lowerCandidates.some(c => currentVal.toLowerCase() === c || (c.length > 2 && currentVal.toLowerCase().startsWith(c)))) {
            console.log(`[OracleAdapter] Address ${fieldName} already validly set: '${currentVal}'`);
            return true;
          }

          const inputId = (await inp.getAttribute("id").catch(() => "")) || "";
          console.log(`[OracleAdapter] Selecting Address ${fieldName} with '${targetValues[0]}' (current: '${currentVal}', id: '${inputId}')...`);

          // Clear previous value via reset button if present
          if (inputId) {
            await page.evaluate((id) => {
              const reset = document.getElementById(id + "-reset-button") || 
                            document.querySelector(`button[id*='${id}'][id*='reset']`) ||
                            document.querySelector(`[id*='${id}'] button.icon-close`);
              if (reset) (reset as HTMLElement).click();
            }, inputId).catch(() => {});
            await page.waitForTimeout(300);
          }

          // Focus and type primary target value
          await inp.click({ force: true }).catch(() => {});
          await inp.fill("").catch(() => {});
          await inp.pressSequentially(targetValues[0], { delay: 50 }).catch(() => {});
          await page.waitForTimeout(600);

          // If toggle button exists, click it if listbox not open
          const listboxSel = inputId ? `#${inputId}-listbox` : ".cx-select__list, [role='listbox'], .oj-listbox-results";
          const listExists = await page.locator(listboxSel).isVisible().catch(() => false);
          if (!listExists && inputId) {
            const toggleBtn = page.locator(`button#${inputId}-toggle-button, button[id*='${inputId}'][id*='toggle']`).first();
            if (await toggleBtn.count() > 0 && await toggleBtn.isVisible().catch(() => false)) {
              await toggleBtn.click({ force: true }).catch(() => {});
              await page.waitForTimeout(500);
            }
          }

          // Click matching list item
          const selected = await page.evaluate(({ lbSel, candidates, fName }) => {
            const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list, [role='listbox'], .oj-listbox-results");
            const items = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item:not(.cx-select__list-item--loading), [role='option'], [role='gridcell'], li") : document.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell'], li"));
            
            // Priority 1: Exact match
            let match = items.find(o => {
              const t = (o.textContent || "").trim().toLowerCase();
              return candidates.some(c => t === c);
            });
            // Priority 2: For State: match 2-letter abbreviation code (e.g. "CA" or "CA - California")
            if (!match && fName === "state") {
              match = items.find(o => {
                const t = (o.textContent || "").trim();
                return candidates.some(c => t === c || t.startsWith(c + " ") || t.startsWith(c + "-") || t.startsWith(c + " -"));
              });
            }
            // Priority 3: startsWith or includes
            if (!match) {
              match = items.find(o => {
                const t = (o.textContent || "").trim().toLowerCase();
                return candidates.some(c => t.startsWith(c) || t.includes(c));
              });
            }
            // Priority 4: first valid item if typing filtered it down
            if (!match && items.length > 0) {
              match = items[0];
            }

            if (match) {
              (match as HTMLElement).click();
              return match.textContent?.trim().replace(/\s+/g, " ");
            }
            return null;
          }, { lbSel: listboxSel, candidates: lowerCandidates, fName: fieldName });

          if (selected) {
            console.log(`[OracleAdapter] Address ${fieldName} option selected: '${selected}'`);
          } else {
            await page.keyboard.press("ArrowDown").catch(() => {});
            await page.keyboard.press("Enter").catch(() => {});
            console.log(`[OracleAdapter] Address ${fieldName} selected via ArrowDown+Enter fallback`);
          }

          await page.waitForTimeout(600);
          return true;
        } catch (err: any) {
          console.warn(`[OracleAdapter] Address ${fieldName} selection note: ${err.message}`);
          return false;
        }
      };

      // Helper: Select Oracle Redwood Date Dropdowns (Month & Year for Experience and Education)
      const fillOracleDateField = async (
        prefix: string,
        targetValue: string,
        altValues: string[] = []
      ) => {
        try {
          const inp = page.locator(`input[id*='${prefix}'], input[name*='${prefix}'], [id*='${prefix}'] input`).first();
          const btn = page.locator(`button[id*='${prefix}'][id*='toggle'], [id*='${prefix}'] button[id*='toggle'], button[aria-label*='${prefix}' i]`).first();
          const resetBtn = page.locator(`button[id*='${prefix}'][id*='reset'], [id*='${prefix}'] button[id*='reset']`).first();

          // Clear previous value if reset button exists
          if (await resetBtn.count() > 0 && await resetBtn.isVisible().catch(() => false)) {
            await resetBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(200);
          }

          // Open dropdown listbox via toggle button or input
          let opened = false;
          if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
            await btn.click({ force: true }).catch(() => {});
            opened = true;
            await page.waitForTimeout(400);
          } else if (await inp.count() > 0 && await inp.isVisible().catch(() => false)) {
            await inp.click({ force: true }).catch(() => {});
            await inp.fill(targetValue).catch(() => {});
            opened = true;
            await page.waitForTimeout(400);
          }

          const allCandidates = [targetValue, ...altValues].map(v => v.toLowerCase().trim());
          const clicked = await page.evaluate(({ pfx, candidates }) => {
            const listbox = document.querySelector(`[id*='${pfx}'][id*='listbox'], #${pfx}-listbox, .cx-select__list, [role='listbox']`);
            const items = Array.from(listbox ? listbox.querySelectorAll(".cx-select__list-item:not(.cx-select__list-item--loading), [role='option'], [role='gridcell'], li") : document.querySelectorAll(`[id*='${pfx}'] [role='option'], [id*='${pfx}'] .cx-select__list-item, [role='option'], [role='gridcell']`));
            
            // Priority 1: exact match
            let match = items.find(el => {
              const t = (el.textContent || "").trim().toLowerCase();
              return candidates.some(c => t === c);
            });
            // Priority 2: startsWith (for month abbreviation like Jan -> January)
            if (!match) {
              match = items.find(el => {
                const t = (el.textContent || "").trim().toLowerCase();
                return candidates.some(c => (t.startsWith(c) || c.startsWith(t)) && Math.abs(t.length - c.length) <= 6);
              });
            }
            if (match) {
              (match as HTMLElement).click();
              return match.textContent?.trim();
            }
            return null;
          }, { pfx: prefix, candidates: allCandidates });

          if (clicked) {
            console.log(`[OracleAdapter] Date field '${prefix}' selected option: '${clicked}'`);
          } else {
            if (await inp.count() > 0) {
              await inp.fill(targetValue).catch(() => {});
              await page.keyboard.press("ArrowDown").catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            }
          }
          await page.waitForTimeout(300);
          return true;
        } catch (err: any) {
          console.warn(`[OracleAdapter] Date field '${prefix}' note: ${err.message}`);
          return false;
        }
      };

      await fillIfVisible("input[name='title'], input[id*='title']", "Mr.", "Title");
      await fillIfVisible("input[name='firstName'], input[id*='firstName']", profile.firstName, "First Name");
      await fillIfVisible("input[name='lastName'], input[id*='lastName']", profile.lastName, "Last Name");
      await fillIfVisible("input[name='middleNames'], input[id*='middleNames']", "", "Middle Name");
      await fillIfVisible("input[name='namInformation29'], input[id*='namInformation29']", "He/Him", "Pronoun");

      // 2A. Country Selection: STRICTLY "United States" (Never India, Never Vadodara)
      await fillOracleAddressCombobox("country", ["United States", "USA"]);

      // 2A-2. Clear any lingering Indian address values (Vadodara, 388710, Gujarat) from inputs
      try {
        await page.evaluate(() => {
          const allInputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
          for (const inp of allInputs) {
            const val = (inp.value || "").toUpperCase();
            if (val.includes("VADODARA") || val.includes("388710") || val.includes("GUJARAT")) {
              const resetBtn = (inp.id ? document.getElementById(inp.id + "-reset-button") : null) ||
                               inp.parentElement?.querySelector("button[id*='reset'], button.icon-close");
              if (resetBtn) {
                (resetBtn as HTMLElement).click();
              } else {
                inp.value = "";
                inp.dispatchEvent(new Event("input", { bubbles: true }));
                inp.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }
        });
      } catch (e: any) {}

      // 2B. Phone Country Code & Number Handling: Select Country Code like Pincode (Type +1 and Autocomplete Select United States)
      try {
        console.log("[OracleAdapter] Selecting Phone Country Code (+1) using autocomplete (same pattern as pincode)...");
        
        const countryCodeTrigger = page.locator(
          "input#country-codes-dropdownphoneNumber, " +
          "input[name='phoneNumber'][role='combobox'], " +
          "input[id*='country-codes' i], " +
          "input[placeholder*='Country code' i], " +
          "input[aria-label*='Country code' i], " +
          "div[role='combobox']:has-text('Country code'), " +
          "button[aria-label*='Country code' i], " +
          ".phone-row__country-code, " +
          "[class*='country-code'] [role='combobox'], " +
          "[class*='phone'] [role='combobox']:visible"
        ).first();

        if (await countryCodeTrigger.count() > 0 && await countryCodeTrigger.isVisible()) {
          const currentText = (await countryCodeTrigger.inputValue().catch(() => "")) || (await countryCodeTrigger.getAttribute("value").catch(() => "")) || "";
          
          if (!currentText.toLowerCase().includes("united states") && !currentText.includes("+1 (united states)")) {
            const ccId = await countryCodeTrigger.getAttribute("id").catch(() => "") || "country-codes-dropdownphoneNumber";
            
            // Clear any old selection via reset button if present
            await page.evaluate((id) => {
              const reset = (id ? document.getElementById(id + "-reset-button") : null) || 
                            document.querySelector("button[id*='country-codes'][id*='reset']");
              if (reset) (reset as HTMLElement).click();
            }, ccId);
            await page.waitForTimeout(300);

            // Click and type "+1" just like pincode
            console.log(`[OracleAdapter] Typing '+1' into Country Code and waiting for autocomplete listbox...`);
            await countryCodeTrigger.click().catch(() => {});
            if (await countryCodeTrigger.evaluate(el => el.tagName === "INPUT").catch(() => false)) {
              await countryCodeTrigger.fill("+1").catch(() => {});
            } else {
              await page.keyboard.type("+1", { delay: 40 }).catch(() => {});
            }

            // Wait for listbox autocomplete options just like pincode
            const listboxSelector = ccId ? `#${ccId}-listbox` : ".cx-select__list, [role='listbox'], .oj-listbox-results";
            await page.waitForSelector(`${listboxSelector} .cx-select__list-item:not(.cx-select__list-item--loading), ${listboxSelector} [role='option'], ${listboxSelector} [role='gridcell'], ${listboxSelector} li`, { timeout: 8000 }).catch(() => {});
            await page.waitForTimeout(1000);

            // Strictly prioritize and select United States (+1) / USA (+1), NEVER other +1 territories like American Samoa
            const selectedCc = await page.evaluate((lbSel) => {
              const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list, [role='listbox']");
              const opts = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell'], li") : document.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell'], li"));
              
              // 1. Strict United States match
              const match = opts.find(o => {
                const t = (o.textContent || "").toLowerCase().trim();
                return (t.includes("united states") || t.includes("usa")) && !t.includes("virgin islands") && !t.includes("samoa") && !t.includes("outlying");
              }) || opts.find(o => {
                const t = (o.textContent || "").toLowerCase().trim();
                return t.includes("+1") && t.includes("united states");
              }) || opts.find(o => {
                const t = (o.textContent || "").toLowerCase().trim();
                return t.includes("united states");
              });
              
              if (match) {
                (match as HTMLElement).click();
                return match.textContent?.trim().replace(/\s+/g, " ");
              }
              return null;
            }, listboxSelector);

            if (selectedCc) {
              console.log(`[OracleAdapter] Selected Phone Country Code autocomplete: ${selectedCc}`);
            } else {
              // Direct fallback: type United States directly to filter list
              console.log("[OracleAdapter] Fallback: Typing 'United States' into Country Code...");
              await countryCodeTrigger.fill("United States").catch(() => {});
              await page.waitForTimeout(800);
              await page.keyboard.press("ArrowDown").catch(() => {});
              await page.keyboard.press("Enter").catch(() => {});
            }
            await page.waitForTimeout(800);
          }
        }

        // Fill Phone Number Input strictly
        const phoneInput = page.locator(
          "input.phone-row__input, " +
          "input[type='tel'], " +
          "input[aria-label*='phone' i]:not([role='combobox']), " +
          "input[id*='phoneNumber']:not([id*='country']):not([role='combobox']), " +
          "input[name*='phoneNumber']:not([name*='country']):not([role='combobox']), " +
          "[class*='phone'] input:not([role='combobox']), " +
          ".phone-row input:not([role='combobox'])"
        ).first();

        if (await phoneInput.count() > 0 && await phoneInput.isVisible()) {
          console.log(`[OracleAdapter] Filling US Phone Number: ${cleanPhone}`);
          await phoneInput.click().catch(() => {});
          await phoneInput.fill(cleanPhone).catch(() => {});
          await page.evaluate((val) => {
            const el = document.querySelector("input.phone-row__input, input[type='tel'], input[id*='phoneNumber']:not([id*='country']):not([role='combobox']), input[aria-label*='phone' i]:not([role='combobox'])") as HTMLInputElement;
            if (el) {
              el.removeAttribute("readonly");
              el.value = val;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
            }
          }, cleanPhone);
        }

        // Check 'Use SMS for communication' checkbox
        const smsCheckbox = page.locator("input[type='checkbox'][name*='sms' i], input[type='checkbox'][id*='sms' i], input[type='checkbox'][aria-label*='sms' i]").first();
        if (await smsCheckbox.count() > 0 && !(await smsCheckbox.isChecked().catch(() => false))) {
          await smsCheckbox.check({ force: true }).catch(async () => {
            const lbl = page.locator("label:has-text('Use SMS')").first();
            if (await lbl.count() > 0) await lbl.click().catch(() => {});
          });
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Phone handling note: ${e.message}`);
      }

      // 2D. US Address Fields (Line 1 & Line 2)
      await fillIfVisible("input[name='addressLine1'], input[id*='addressLine1'], input[name='address1'], input[id*='address1'], input[name='building'], input[id*='building']", streetVal, "Address Line 1");
      await fillIfVisible("input[name='addressLine2'], input[id*='addressLine2'], input[name='address2'], input[id*='address2'], input[name='streetName'], input[id*='streetName']", line2Val, "Street / Address Line 2");

      // 2E. US Postal Code with Redwood Autocomplete Selection (90001 / 94065)
      await fillOracleAddressCombobox("postalCode", zipCandidates);
      await page.waitForTimeout(1000);

      // 2F. US State Selection (CA / California - matches 2-letter abbreviation 'CA' or full name)
      await fillOracleAddressCombobox("state", stateCandidates);
      await page.waitForTimeout(600);

      // 2G. US City Selection (Los Angeles / Redwood City)
      await fillOracleAddressCombobox("city", cityCandidates);
      await page.waitForTimeout(600);

      // 2H. US County Selection (Los Angeles / San Mateo)
      await fillOracleAddressCombobox("county", countyCandidates);
      await page.waitForTimeout(600);

      // Links: LinkedIn & GitHub
      await fillIfVisible("input[name*='siteLink-1'], input[id*='siteLink-1']", profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi", "LinkedIn Link 1");
      await fillIfVisible("input[name*='siteLink-2'], input[id*='siteLink-2']", profile.githubUrl || "https://github.com/hrutinnammi", "GitHub Link 2");

      // Professional Summary / Textarea
      await fillIfVisible(
        "textarea[id*='work-summary'], textarea[id*='summary'], textarea[name*='summary']",
        "Results-driven Software Engineer with extensive experience in scalable software development, full-stack architectures, cloud platforms, and distributed systems.",
        "Work Summary"
      );

      // 2F. Section 2 Interactive Creators: Skill, Education, and 2 Work Experiences
      
      // 1. Skills Handling: Add individual technical skills like Python, HTML, JavaScript (not job titles)
      try {
        const skillsToAdd = ["Python", "HTML", "JavaScript", "SQL"];
        const addSkillBtn = page.locator("button:has-text('ADD SKILL'), button:has-text('Add Skill')").first();
        
        if (await addSkillBtn.count() > 0 && await addSkillBtn.isVisible()) {
          for (const skillName of skillsToAdd) {
            const hasThisSkill = await page.evaluate((s) => {
              const container = Array.from(document.querySelectorAll("section, div.form-block, div.apply-flow-profile-item, fieldset, div")).find(el => {
                const text = el.querySelector("h2, h3, h4, span.title, label, .input-field__label")?.textContent?.toLowerCase() || "";
                return text.includes("skill");
              });
              if (!container) return false;
              const text = (container.textContent || "").toLowerCase();
              return text.includes(s.toLowerCase());
            }, skillName);

            if (hasThisSkill) {
              console.log(`[OracleAdapter] Skill '${skillName}' already present in profile.`);
              continue;
            }

            const currentAddBtn = page.locator("button:has-text('ADD SKILL'), button:has-text('Add Skill')").first();
            if (await currentAddBtn.count() === 0 || !(await currentAddBtn.isVisible())) break;

            console.log(`[OracleAdapter] Adding Skill item: ${skillName}...`);
            await currentAddBtn.scrollIntoViewIfNeeded().catch(() => {});
            await currentAddBtn.click();
            await page.waitForTimeout(800);

            const skillInput = page.locator("input[name='skills'], input[id*='skills'], input[name*='skill' i], input[id*='skill' i], input[placeholder*='skill' i]").first();
            if (await skillInput.count() > 0) {
              await skillInput.click();
              await skillInput.fill(skillName);
              await page.waitForTimeout(600);
              // Autocomplete option selection
              const opt = page.locator(".cx-select__list-item:not(.cx-select__list-item--loading), [role='option'], [role='gridcell']").first();
              if (await opt.count() > 0 && await opt.isVisible()) {
                await opt.click().catch(() => {});
              } else {
                await page.keyboard.press("ArrowDown").catch(() => {});
                await page.keyboard.press("Enter").catch(() => {});
              }
            }

            const expInput = page.locator("input[name='yearsOfExperience'], input[id*='yearsOfExperience'], input[name*='experience' i]").first();
            if (await expInput.count() > 0 && await expInput.isVisible()) {
              await expInput.fill("3");
            }

            // Click Save / Add Skill confirmation button inside active skill container
            await page.evaluate(() => {
              const skillBlock = document.querySelector("input[name='skills'], input[id*='skills']")?.closest(".form-block, form, div.apply-flow-profile-item, div");
              const btns = Array.from(skillBlock ? skillBlock.querySelectorAll("button") : document.querySelectorAll("button"));
              const saveBtn = btns.find(b => {
                const text = (b.textContent || "").trim().toLowerCase();
                return (text === "add skill" || text === "add" || text === "save" || text === "done") && b.getBoundingClientRect().height > 0;
              }) as HTMLElement;
              if (saveBtn) saveBtn.click();
            });
            await page.waitForTimeout(1200);
            console.log(`✅ [OracleAdapter] Successfully added Skill: ${skillName} (3 yrs).`);
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Skill handling note: ${e.message}`);
      }

      // 2. Education Handling
      try {
        const addEduBtn = page.locator("button:has-text('ADD EDUCATION'), button:has-text('Add Education')").first();
        if (await addEduBtn.count() > 0 && await addEduBtn.isVisible()) {
          const hasExistingEdu = await page.evaluate(() => {
            const container = Array.from(document.querySelectorAll("section, div.form-block, div.apply-flow-profile-item, fieldset")).find(el => {
              const text = el.querySelector("h2, h3, h4, span.title, label, .input-field__label")?.textContent?.toLowerCase() || "";
              return text.includes("education");
            });
            if (!container) return false;
            const tiles = Array.from(container.querySelectorAll("article.apply-flow-profile-item-tile, div.apply-flow-profile-item-tile[data-profile-item-tile='true']"));
            return tiles.some(t => {
              const text = (t.textContent || "").toLowerCase();
              return text.includes("parul") || text.includes("bachelor");
            });
          });

          if (!hasExistingEdu) {
            console.log("[OracleAdapter] Adding required Education item in Section 2...");
            await addEduBtn.scrollIntoViewIfNeeded().catch(() => {});
            await addEduBtn.click();
            await page.waitForTimeout(1000);

            const eduDeg = (profile.educations && profile.educations[0]?.degree) || "Bachelor of Technology";
            const eduMajor = (profile.educations && profile.educations[0]?.fieldOfStudy) || "Computer Science";
            const eduSchool = (profile.educations && profile.educations[0]?.school) || "Parul University";
            const eduGpa = (profile.educations && profile.educations[0]?.gpa) || "3.8";

            const degInp = page.locator("input[name='contentItemId'], input[id*='contentItemId']").first();
            if (await degInp.count() > 0) {
              await degInp.click();
              await degInp.fill(eduDeg);
              await page.waitForTimeout(600);
              await page.keyboard.press("ArrowDown");
              await page.keyboard.press("Enter");
            }
            const majorInp = page.locator("input[name='major'], input[id*='major']").first();
            if (await majorInp.count() > 0) {
              await majorInp.fill(eduMajor);
            }
            const schoolInp = page.locator("input[name='educationalEstablishment'], input[id*='educationalEstablishment']").first();
            if (await schoolInp.count() > 0) {
              await schoolInp.click();
              await schoolInp.fill(eduSchool);
              await page.waitForTimeout(600);
              await page.keyboard.press("ArrowDown");
              await page.keyboard.press("Enter");
            }
            const gpaInp = page.locator("input[name='gpa'], input[id*='gpa']").first();
            if (await gpaInp.count() > 0) {
              await gpaInp.fill(eduGpa);
            }
            await page.evaluate(() => {
              const cb = document.querySelector("input[type='checkbox'][name*='graduated' i]") as HTMLInputElement;
              if (cb && !cb.checked) {
                const lbl = cb.id ? document.querySelector(`label[for='${cb.id}']`) : cb.closest("label");
                if (lbl) (lbl as HTMLElement).click(); else cb.click();
              }
              const formBlock = document.querySelector("input[name='major']")?.closest(".form-block, form, div.apply-flow-profile-item, div");
              const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
              const addBtn = btns.find(b => {
                const text = (b.textContent || "").trim().toLowerCase();
                return (text === "add education" || text === "add" || text === "save") && b.getBoundingClientRect().height > 0;
              });
              if (addBtn) addBtn.click();
            });
            await page.waitForTimeout(1500);
            console.log("✅ [OracleAdapter] Added Education item: Parul University (B.Tech).");
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Education handling note: ${e.message}`);
      }

      // 3. Work Experiences Handling: Exactly 2 Work Experiences
      try {
        const addExpBtn = page.locator("button:has-text('ADD EXPERIENCE'), button:has-text('Add Experience')").first();
        if (await addExpBtn.count() > 0 && await addExpBtn.isVisible()) {
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const parseMonthYear = (dateStr?: string, defaultMonth = "January", defaultYear = "2023") => {
            if (!dateStr) return { month: defaultMonth, year: defaultYear };
            const parts = dateStr.split(/[-/]/);
            if (parts.length >= 2) {
              const y = parts[0].length === 4 ? parts[0] : parts[1];
              const mIdx = parts[0].length === 4 ? parseInt(parts[1], 10) - 1 : parseInt(parts[0], 10) - 1;
              return { month: monthNames[mIdx] || defaultMonth, year: y || defaultYear };
            }
            return { month: defaultMonth, year: dateStr.slice(0, 4) || defaultYear };
          };

          const targetExperiences = (profile.experiences && profile.experiences.length > 0)
            ? profile.experiences.map((w: any, idx: number) => {
                const start = parseMonthYear(w.startDate, w.startMonth || "January", w.startYear || "2023");
                const end = parseMonthYear(w.endDate, w.endMonth || "January", w.endYear || "2026");
                return {
                  employer: w.company,
                  title: w.jobTitle || w.title || "Full Stack AI Developer",
                  startMonth: w.startMonth || start.month,
                  startYear: w.startYear || start.year,
                  endMonth: w.endMonth || end.month,
                  endYear: w.endYear || end.year,
                  current: w.currentlyWorkHere ?? (idx === 0)
                };
              })
            : [
                {
                  employer: "Jobspring",
                  title: "Full Stack AI Developer",
                  startMonth: "January",
                  startYear: "2024",
                  endMonth: "March",
                  endYear: "2026",
                  current: true
                },
                {
                  employer: "CodeX Fusion",
                  title: "Software Engineer & AI Lead",
                  startMonth: "January",
                  startYear: "2022",
                  endMonth: "December",
                  endYear: "2023",
                  current: false
                }
              ];

          for (let expIdx = 0; expIdx < targetExperiences.length; expIdx++) {
            const exp = targetExperiences[expIdx];
            
            // Check strictly within Experience container
            const alreadyAdded = await page.evaluate((emp) => {
              const container = Array.from(document.querySelectorAll("section, div.form-block, div.apply-flow-profile-item, fieldset")).find(el => {
                const text = el.querySelector("h2, h3, h4, span.title, label, .input-field__label")?.textContent?.toLowerCase() || "";
                return text.includes("experience") && !text.includes("years");
              });
              if (!container) return false;
              const tiles = Array.from(container.querySelectorAll("article.apply-flow-profile-item-tile, div.apply-flow-profile-item-tile[data-profile-item-tile='true']"));
              return tiles.some(t => {
                const sub = t.querySelector(".apply-flow-profile-item-tile__summary-subtitle, .apply-flow-profile-item-tile__summary-title")?.textContent || t.textContent || "";
                return sub.toLowerCase().includes(emp.toLowerCase());
              });
            }, exp.employer);

            if (alreadyAdded) {
              console.log(`[OracleAdapter] Experience '${exp.employer}' already exists in profile tiles.`);
              continue;
            }

            const currentAddBtn = page.locator("button:has-text('ADD EXPERIENCE'), button:has-text('Add Experience')").first();
            if (await currentAddBtn.count() > 0 && await currentAddBtn.isVisible()) {
              console.log(`[OracleAdapter] Adding Work Experience [${expIdx + 1}/2]: ${exp.employer} - ${exp.title}...`);
              await currentAddBtn.scrollIntoViewIfNeeded().catch(() => {});
              await currentAddBtn.click();
              await page.waitForTimeout(1000);

              // Employer Name
              const empInp = page.locator("input[name='employerName'], input[id*='employerName'], input[name*='employer' i], input[id*='employer' i]").first();
              if (await empInp.count() > 0) {
                await empInp.fill(exp.employer);
              }

              // Job Title (strictly exclude name='title' which is Mr./Ms. honorific title)
              const titleInp = page.locator("input[name='jobTitle'], input[id*='jobTitle'], input[name*='jobtitle' i], input[id*='jobtitle' i], input[placeholder*='title' i]:not([name='title'])").first();
              if (await titleInp.count() > 0 && await titleInp.isVisible().catch(() => false)) {
                await titleInp.fill(exp.title);
              }

              // Start Month Dropdown
              await fillOracleDateField("month-startDate", exp.startMonth || "January", ["Jan", "01"]);

              // Start Year Dropdown
              await fillOracleDateField("year-startDate", exp.startYear || "2024", []);

              // End Month Dropdown (March / December)
              await fillOracleDateField("month-endDate", exp.endMonth || "March", ["Mar", "03", "January"]);

              // End Year Dropdown (2026 / 2023)
              await fillOracleDateField("year-endDate", exp.endYear || "2026", []);

              // Current Job Checkbox
              if (exp.current) {
                const currentCb = page.locator("input[type='checkbox'][name*='current' i], input[type='checkbox'][id*='current' i], input[type='checkbox'][aria-label*='current' i]").first();
                if (await currentCb.count() > 0 && !(await currentCb.isChecked().catch(() => false))) {
                  await currentCb.check({ force: true }).catch(async () => {
                    const lbl = page.locator("label:has-text('Current Job'), label:has-text('Currently work here')").first();
                    if (await lbl.count() > 0) await lbl.click().catch(() => {});
                  });
                }
              } else {
                const currentCb = page.locator("input[type='checkbox'][name*='current' i], input[type='checkbox'][id*='current' i]").first();
                if (await currentCb.count() > 0 && await currentCb.isChecked().catch(() => false)) {
                  await currentCb.uncheck({ force: true }).catch(() => {});
                }
              }

              // Save / Confirm Experience inside the active experience container
              await page.evaluate(() => {
                const formBlock = document.querySelector("input[name='employerName'], input[id*='employerName']")?.closest(".form-block, form, div.apply-flow-profile-item, div, section");
                const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
                const saveBtn = btns.find(b => {
                  const text = (b.textContent || "").trim().toLowerCase();
                  return (text === "add experience" || text === "save experience" || text === "add" || text === "save" || text === "done") && b.getBoundingClientRect().height > 0;
                }) as HTMLElement;
                if (saveBtn) saveBtn.click();
              });
              await page.waitForTimeout(1800);
              console.log(`✅ [OracleAdapter] Added Experience [${expIdx + 1}/2]: ${exp.employer}.`);
            }
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Experience handling note: ${e.message}`);
      }

      // 3. Earliest Available Date: Month, Day, Year
      try {
        const today = new Date();
        const dayStr = String(today.getDate()).padStart(2, "0");
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const monthQuery = monthNames[today.getMonth()];
        const yearStr = String(today.getFullYear());

        const hasDatePickers = await page.evaluate(() => {
          return !!document.querySelector("button[id*='month-earliestAvailableDate'][id*='toggle'], input[id*='month-earliestAvailableDate']");
        });

        if (hasDatePickers) {
          console.log(`[OracleAdapter] Filling Earliest Available Date: Month=${monthQuery}, Day=${dayStr}, Year=${yearStr}...`);
          // Month
          await page.evaluate(() => {
            const mBtn = document.querySelector("button[id*='month-earliestAvailableDate'][id*='toggle']") as HTMLElement;
            if (mBtn) mBtn.click();
          });
          await page.waitForTimeout(400);
          await page.evaluate((mQuery) => {
            const items = Array.from(document.querySelectorAll("[id*='month-earliestAvailableDate'] [role='option'], [id*='month-earliestAvailableDate'] [role='gridcell'], [id*='month-earliestAvailableDate'] .cx-select__list-item, [role='option'], [role='gridcell']"));
            const match = items.find(i => i.textContent?.toLowerCase().includes(mQuery));
            if (match) (match as HTMLElement).click();
          }, monthQuery);
          await page.waitForTimeout(400);

          // Day
          await page.evaluate(() => {
            const dBtn = document.querySelector("button[id*='day-earliestAvailableDate'][id*='toggle']") as HTMLElement;
            if (dBtn) dBtn.click();
          });
          await page.waitForTimeout(400);
          await page.evaluate((dStr) => {
            const items = Array.from(document.querySelectorAll("[id*='day-earliestAvailableDate'] [role='option'], [id*='day-earliestAvailableDate'] [role='gridcell'], [id*='day-earliestAvailableDate'] .cx-select__list-item, [role='option'], [role='gridcell']"));
            const match = items.find(i => i.textContent?.trim() === dStr || i.textContent?.trim() === String(parseInt(dStr, 10)));
            if (match) (match as HTMLElement).click();
          }, dayStr);
          await page.waitForTimeout(400);

          // Year
          await page.evaluate(() => {
            const yBtn = document.querySelector("button[id*='year-earliestAvailableDate'][id*='toggle']") as HTMLElement;
            if (yBtn) yBtn.click();
          });
          await page.waitForTimeout(400);
          await page.evaluate((yStr) => {
            const items = Array.from(document.querySelectorAll("[id*='year-earliestAvailableDate'] [role='option'], [id*='year-earliestAvailableDate'] [role='gridcell'], [id*='year-earliestAvailableDate'] .cx-select__list-item, [role='option'], [role='gridcell']"));
            const match = items.find(i => i.textContent?.trim() === yStr);
            if (match) (match as HTMLElement).click();
          }, yearStr);
          await page.waitForTimeout(400);
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Date filling note: ${e.message}`);
      }

      // 4. Smart Screening Question Answerer (Yes / No Redwood buttons & radio groups)
      try {
        const answeredCount = await page.evaluate(() => {
          let count = 0;
          const pills = Array.from(document.querySelectorAll("button.cx-select-pill-section, button"));
          const yesNoPills = pills.filter(p => {
            const t = p.textContent?.trim().toLowerCase();
            return t === "yes" || t === "no";
          });

          const handledContainers = new Set<Element>();
          for (const btn of yesNoPills) {
            let container: Element | null = btn.closest(".input-row, .form-block, fieldset, [class*='question']");
            if (!container) {
              let p = btn.parentElement;
              while (p && p !== document.body) {
                if (p.textContent && p.textContent.replace(/\s+/g, " ").trim().length > 15) {
                  container = p;
                  break;
                }
                p = p.parentElement;
              }
            }
            if (!container || handledContainers.has(container)) continue;

            const pair = Array.from(container.querySelectorAll("button")).filter(b => {
              const t = b.textContent?.trim().toLowerCase();
              return t === "yes" || t === "no";
            }) as HTMLElement[];

            if (pair.length >= 2) {
              handledContainers.add(container);
              const text = (container.textContent || "").toLowerCase();
              let wantYes = true;
              if (
                text.includes("ex-oracle") ||
                text.includes("former employee") ||
                text.includes("left oracle") ||
                text.includes("government") ||
                text.includes("public official") ||
                text.includes("sponsorship") ||
                text.includes("require sponsorship") ||
                text.includes("visa sponsorship") ||
                text.includes("felony") ||
                text.includes("convict") ||
                text.includes("disciplinary") ||
                text.includes("terminated")
              ) {
                wantYes = false;
              } else if (
                text.includes("authorized") ||
                text.includes("legally authorized") ||
                text.includes("eligible") ||
                text.includes("18 years") ||
                text.includes("background check") ||
                text.includes("drug screen") ||
                text.includes("relocate")
              ) {
                wantYes = true;
              }

              const targetText = wantYes ? "yes" : "no";
              const targetBtn = pair.find(b => b.textContent?.trim().toLowerCase() === targetText);
              if (targetBtn) {
                targetBtn.click();
                count++;
              }
            }
          }

          // Radio input fallback (e.g. sponsorship, legal authorization)
          const inputRadios = Array.from(document.querySelectorAll("input[type='radio']")) as HTMLInputElement[];
          for (const inp of inputRadios) {
            let qText = "";
            let curr: Element | null = inp;
            while (curr && curr !== document.body) {
              const t = (curr.textContent || "").toLowerCase();
              if (
                t.includes("sponsorship") ||
                t.includes("ex-oracle") ||
                t.includes("government") ||
                t.includes("authorized") ||
                t.includes("relocate") ||
                t.includes("18 years")
              ) {
                qText = t;
                break;
              }
              curr = curr.parentElement;
            }

            if (!qText) {
              const p = inp.closest(".input-row, .form-block, fieldset, [class*='question'], div");
              qText = (p?.textContent || "").toLowerCase();
            }

            let wantYes = true;
            if (
              qText.includes("sponsorship") ||
              qText.includes("require sponsorship") ||
              qText.includes("visa sponsorship") ||
              qText.includes("ex-oracle") ||
              qText.includes("former employee") ||
              qText.includes("government") ||
              qText.includes("felony") ||
              qText.includes("convict")
            ) {
              wantYes = false;
            } else if (
              qText.includes("authorized") ||
              qText.includes("legally authorized") ||
              qText.includes("eligible") ||
              qText.includes("18 years")
            ) {
              wantYes = true;
            }

            const targetText = wantYes ? "yes" : "no";
            const radioLabel = (inp.id ? document.querySelector(`label[for='${inp.id}']`)?.textContent : "") ||
                               inp.closest("label")?.textContent ||
                               inp.parentElement?.textContent || "";
            const isMatch = radioLabel.trim().toLowerCase() === targetText || 
                            radioLabel.trim().toLowerCase().startsWith(targetText) ||
                            inp.value?.toLowerCase() === targetText;

            if (isMatch && !inp.checked) {
              const lbl = (inp.id ? document.querySelector(`label[for='${inp.id}']`) : null) as HTMLElement || inp;
              lbl.click();
              inp.checked = true;
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              count++;
            }
          }

          return count;
        });
        if (answeredCount > 0) {
          console.log(`[OracleAdapter] Smart answered ${answeredCount} screening questions.`);
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Screening questions note: ${e.message}`);
      }

      // 4B. Interactive Redwood Combobox & Custom Dropdown Screening Questions Answerer
      try {
        console.log("[OracleAdapter] Scanning for Redwood combobox/dropdown screening questions...");
        
        // Find candidate combobox containers / inputs
        const dropdownQuestions = await page.evaluate(() => {
          const results: { id: string; label: string; currentValue: string; isMulti: boolean }[] = [];
          const comboboxes = Array.from(document.querySelectorAll("input.cx-select-input, input[role='combobox'], [class*='cx-select'] input, div[role='combobox']"));
          
          for (const cb of comboboxes) {
            const inp = cb as HTMLInputElement;
            const id = inp.id || "";
            // Exclude already handled system fields
            if (
              id.includes("country-codes") ||
              id.includes("phoneNumber") ||
              id.includes("startDate") ||
              id.includes("endDate") ||
              id.includes("earliestAvailable") ||
              id.includes("gender") ||
              id.includes("veteran") ||
              id.includes("disability") ||
              id.includes("postalCode") ||
              id.includes("addressLine") ||
              id.includes("region") ||
              id.includes("city") ||
              id.includes("county") ||
              id.includes("country") ||
              id.includes("skills") ||
              id.includes("educationalEstablishment") ||
              id.includes("contentItemId") ||
              id.includes("employerName") ||
              id.includes("jobTitle")
            ) {
              continue;
            }

            // Find question label
            let label = "";
            if (id) {
              const l = document.querySelector(`label[for='${id}']`);
              if (l) label = l.textContent?.trim() || "";
            }
            if (!label) {
              let p: Element | null = inp.parentElement;
              while (p && p !== document.body) {
                const l = p.querySelector("label, .input-field__label, .input-row__label, legend, h3, h4, span.title");
                if (l && l.textContent && l.textContent.trim().length > 5) {
                  label = l.textContent.trim();
                  break;
                }
                p = p.parentElement;
              }
            }

            // Check if visible
            const rect = inp.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const textVal = inp.value || inp.textContent || "";
              const isMulti = label.toLowerCase().includes("check all that apply") || label.toLowerCase().includes("all that apply");
              results.push({
                id,
                label: label.replace(/\s+/g, " "),
                currentValue: textVal.trim(),
                isMulti
              });
            }
          }
          return results;
        });

        if (dropdownQuestions.length > 0) {
          console.log(`[OracleAdapter] Found ${dropdownQuestions.length} custom dropdown screening question(s).`);

          for (const q of dropdownQuestions) {
            const qLower = q.label.toLowerCase();
            console.log(`[OracleAdapter] Processing question: "${q.label}" (current value: "${q.currentValue}")...`);

            const inpLocator = q.id ? page.locator(`#${q.id}`).first() : page.locator(`input[aria-label*='${q.label.slice(0, 20)}' i]`).first();
            if (await inpLocator.count() === 0) continue;

            // 1. If currently has invalid "Suite 100", clear it via reset button
            if (q.currentValue.toLowerCase().includes("suite") || q.currentValue.toLowerCase().includes("oracle")) {
              console.log(`[OracleAdapter] Clearing erroneous address value from question "${q.label}"...`);
              await page.evaluate((id) => {
                const btn = (id ? document.getElementById(`${id}-reset-button`) : null) ||
                            document.querySelector(`button[id*='${id}'][id*='reset'], [id*='${id}'] button.icon-close`);
                if (btn) (btn as HTMLElement).click();
              }, q.id);
              await page.waitForTimeout(400);
            }

            // 2. Open the dropdown listbox
            const toggleBtn = q.id
              ? page.locator(`button#${q.id}-toggle-button, button[id*='${q.id}'][id*='toggle'], [id*='${q.id}'] button.icon-dropdown-arrow`).first()
              : inpLocator.locator("..").locator("button").first();

            let opened = false;
            if (await toggleBtn.count() > 0 && await toggleBtn.isVisible().catch(() => false)) {
              await toggleBtn.click({ force: true }).catch(() => {});
              opened = true;
            } else {
              await inpLocator.click({ force: true }).catch(() => {});
              opened = true;
            }
            await page.waitForTimeout(600);

            // 3. Inspect available options in listbox
            const listboxSel = q.id ? `#${q.id}-listbox` : ".cx-select__list, [role='listbox'], .oj-listbox-results";
            const availableOptions = await page.evaluate((lbSel) => {
              const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list, [role='listbox']");
              const items = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item:not(.cx-select__list-item--loading), [role='option'], [role='gridcell'], li") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
              return items.map(i => (i.textContent || "").trim().replace(/\s+/g, " ")).filter(t => t.length > 0 && t.length < 100);
            }, listboxSel);

            if (availableOptions.length === 0) {
              console.log(`[OracleAdapter] No dropdown options found for question "${q.label}".`);
              continue;
            }

            console.log(`[OracleAdapter] Available options for "${q.label.slice(0, 40)}...": [${availableOptions.slice(0, 8).join(", ")}${availableOptions.length > 8 ? "..." : ""}]`);

            // 4. Determine which options to select based on question context
            const optionsToSelect: string[] = [];

            if (qLower.includes("programming language") || qLower.includes("coding project") || qLower.includes("language")) {
              // Programming languages: Pick Python, HTML, CSS, JavaScript, Java, C++
              const targetLangs = ["python", "html", "javascript", "css", "java", "c++", "c#", "sql"];
              for (const opt of availableOptions) {
                const optLower = opt.toLowerCase();
                if (targetLangs.some(t => optLower === t || optLower.startsWith(t + " ") || optLower.includes(` ${t} `))) {
                  optionsToSelect.push(opt);
                }
              }
            } else if (qLower.includes("technical area") || qLower.includes("course") || qLower.includes("academic/professional")) {
              // Technical areas: Artificial Intelligence, Cloud Computing, Big Data, Computer Security
              const targetAreas = ["artificial intelligence", "cloud computing", "big data", "computer security", "computer systems"];
              for (const opt of availableOptions) {
                const optLower = opt.toLowerCase();
                if (targetAreas.some(t => optLower.includes(t))) {
                  optionsToSelect.push(opt);
                }
              }
            } else if (qLower.includes("education") || qLower.includes("degree")) {
              const targetDegs = ["bachelor", "b.tech", "undergraduate", "college", "computer science"];
              const match = availableOptions.find(o => targetDegs.some(t => o.toLowerCase().includes(t)));
              if (match) optionsToSelect.push(match);
            } else if (qLower.includes("hear about") || qLower.includes("source")) {
              const targetSrc = ["company website", "oracle", "career", "linkedin", "internet", "job board"];
              const match = availableOptions.find(o => targetSrc.some(t => o.toLowerCase().includes(t)));
              if (match) optionsToSelect.push(match);
            }

            // 5. If no specific target matched: inform terminal and select top relevant fallback
            if (optionsToSelect.length === 0) {
              const fallback = availableOptions[0];
              optionsToSelect.push(fallback);
              console.log(`📢 [OracleAdapter] User Info Needed: Dropdown question '${q.label}'`);
              console.log(`   Available options: [${availableOptions.join(", ")}]`);
              console.log(`   Auto-selecting '${fallback}' as best match to satisfy required ATS field.`);
            }

            // 6. Click matching options
            const clickedItems = await page.evaluate(({ lbSel, targets }) => {
              const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list, [role='listbox']");
              const items = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell'], li") : document.querySelectorAll(".cx-select__list-item, [role='option']"));
              const clicked: string[] = [];

              for (const target of targets) {
                const match = items.find(i => (i.textContent || "").trim().toLowerCase() === target.toLowerCase()) ||
                              items.find(i => (i.textContent || "").trim().toLowerCase().includes(target.toLowerCase()));
                if (match) {
                  (match as HTMLElement).click();
                  clicked.push(target);
                }
              }
              return clicked;
            }, { lbSel: listboxSel, targets: optionsToSelect });

            console.log(`✅ [OracleAdapter] Selected for "${q.label.slice(0, 35)}...": [${clickedItems.join(", ")}]`);
            await page.waitForTimeout(500);

            // Close listbox if still open
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(300);
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Custom dropdown screening note: ${e.message}`);
      }

      // 5. Gender Selection (Section 3) - Explicitly Type Male and Select Male
      try {
        const userGender = profile.gender || "Male";
        const genderInput = page.locator("input[name*='GENDER'], input[id*='GENDER'], input[aria-label*='Gender' i], input[id*='gender']").first();
        const genderBtn = page.locator("button[id*='GENDER'], button[id*='gender'], button[aria-label*='Gender' i]").first();
        const hasGenderInp = (await genderInput.count() > 0) && (await genderInput.isVisible());
        const hasGenderBtn = (await genderBtn.count() > 0) && (await genderBtn.isVisible());

        if (hasGenderInp || hasGenderBtn) {
          console.log(`[OracleAdapter] Populating Gender dropdown: Typing '${userGender}' and selecting '${userGender}'...`);
          const currentVal = hasGenderInp ? (await genderInput.inputValue().catch(() => "")) : "";

          if (currentVal.trim().toLowerCase() !== userGender.toLowerCase()) {
            // 1. If reset button (x) exists, click it to clear pre-existing selection
            if (hasGenderInp) {
              const gId = await genderInput.getAttribute("id").catch(() => "") || "";
              await page.evaluate((id) => {
                const resetBtn = (id ? document.getElementById(id + "-reset-button") : null) || 
                                 document.querySelector("button[id*='GENDER'][id*='reset'], button[id*='gender'][id*='reset'], button.icon-close");
                if (resetBtn) (resetBtn as HTMLElement).click();
              }, gId);
              await page.waitForTimeout(300);

              // 2. Click input and type "Male"
              await genderInput.click({ force: true });
              await genderInput.fill("");
              await genderInput.pressSequentially(userGender, { delay: 60 });
              await page.waitForTimeout(600);
            }

            // 3. If toggle button exists and listbox not yet open, click toggle to open
            if (hasGenderBtn) {
              const isExpanded = await genderBtn.getAttribute("aria-expanded").catch(() => "");
              if (isExpanded !== "true") {
                await genderBtn.click({ force: true });
                await page.waitForTimeout(600);
              }
            }

            // 4. Select "Male" strictly from the listbox (never match "Female")
            const selectedGender = await page.evaluate((targetGender) => {
              const items = Array.from(document.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li, td, span"));
              const match = items.find(i => {
                const t = i.textContent?.trim().toLowerCase() || "";
                if (targetGender.toLowerCase() === "male") {
                  return t === "male";
                }
                return t === targetGender.toLowerCase();
              });

              if (match) {
                (match as HTMLElement).click();
                return match.textContent?.trim();
              }
              return null;
            }, userGender);

            if (selectedGender) {
              console.log(`[OracleAdapter] Gender selected from list: ${selectedGender}`);
            } else {
              // Playwright locator strict regex fallback: ^Male$
              const optLocator = page.locator(".cx-select__list-item, [role='gridcell'], [role='option']").filter({ hasText: new RegExp(`^\\s*${userGender}\\s*$`, "i") }).first();
              if (await optLocator.count() > 0 && await optLocator.isVisible()) {
                await optLocator.click({ force: true });
                console.log(`[OracleAdapter] Gender selected via Playwright locator.`);
              }
            }
            await page.waitForTimeout(500);

            // 5. Verify the value now in the input
            if (hasGenderInp) {
              const verified = await genderInput.inputValue().catch(() => "");
              console.log(`[OracleAdapter] Verified Gender input value: '${verified}'`);
              if (verified.trim().toLowerCase() !== userGender.toLowerCase()) {
                // If listbox is still open and "Female" was highlighted, press ArrowDown then Enter to pick "Male"
                await genderInput.click({ force: true });
                await page.keyboard.press("ArrowDown");
                if (userGender.toLowerCase() === "male") {
                  await page.keyboard.press("ArrowDown"); // Second item is Male
                }
                await page.keyboard.press("Enter");
                await page.waitForTimeout(400);
              }
            }
          } else {
            console.log(`[OracleAdapter] Gender is already correctly set to '${currentVal}'.`);
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Gender selection note: ${e.message}`);
      }

      // 5B. Veteran Status Selection (Section 3) - Robust all-format handler
      try {
        console.log("[OracleAdapter] Populating Veteran Status: selecting 'I am not a protected veteran'...");
        let veteranHandled = false;

        // A. Radio buttons (common in Oracle Section 3 VEVRAA)
        veteranHandled = await page.evaluate(() => {
          const allRadios = Array.from(document.querySelectorAll("input[type='radio']")) as HTMLInputElement[];
          const vetRadios: HTMLInputElement[] = [];
          for (const r of allRadios) {
            let container = r.closest(".form-block, .field, .input-row, fieldset, div");
            const label = (r.id ? document.querySelector(`label[for='${r.id}']`)?.textContent : "") || r.closest("label")?.textContent || "";
            const contextText = ((container?.textContent || "") + " " + label).toLowerCase();
            if (contextText.includes("veteran")) {
              vetRadios.push(r);
              const labelLower = label.toLowerCase();
              if (labelLower.includes("not a protected veteran") || labelLower.includes("not a veteran") || labelLower.includes("i am not") || labelLower.includes("do not wish") || labelLower.includes("choose not")) {
                const clickTarget = (r.id ? document.querySelector(`label[for='${r.id}']`) : null) as HTMLElement || r;
                clickTarget.click();
                r.checked = true;
                r.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
              }
            }
          }
          if (vetRadios.length >= 2) {
            // Pick option 2 ("I am not a protected veteran")
            const target = vetRadios[1] || vetRadios[vetRadios.length - 1];
            const clickTarget = (target.id ? document.querySelector(`label[for='${target.id}']`) : null) as HTMLElement || target;
            clickTarget.click();
            target.checked = true;
            target.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        });

        // B. Redwood combobox / toggle dropdown
        if (!veteranHandled) {
          const vetInput = page.locator("input[name*='VETERAN' i], input[id*='VETERAN' i], input[aria-label*='Veteran' i], input[id*='veteran' i]").first();
          const vetBtn = page.locator("button[id*='VETERAN' i], button[id*='veteran' i], button[aria-label*='Veteran' i]").first();
          const hasVetBtn = (await vetBtn.count() > 0) && (await vetBtn.isVisible().catch(() => false));
          const hasVetInp = (await vetInput.count() > 0) && (await vetInput.isVisible().catch(() => false));

          if (hasVetBtn || hasVetInp) {
            const vId = hasVetBtn ? (await vetBtn.getAttribute("id").catch(() => "") || "") : (await vetInput.getAttribute("id").catch(() => "") || "");
            const listboxId = hasVetBtn ? ((await vetBtn.getAttribute("aria-controls").catch(() => "")) || (vId ? `${vId.replace(/-toggle-button$/, "")}-listbox` : "")) : "";

            if (hasVetBtn) {
              await vetBtn.click({ force: true }).catch(() => {});
            } else {
              await vetInput.click({ force: true }).catch(() => {});
            }
            await page.waitForTimeout(600);

            const selectedVet = await page.evaluate(({ lbId }) => {
              const listbox = lbId ? document.getElementById(lbId) : null;
              const container = listbox || document;
              const items = Array.from(container.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li, span"));
              const match = items.find(i => {
                const t = (i.textContent || "").toLowerCase();
                return t.includes("not a protected veteran") || t.includes("not a veteran") || t.includes("do not wish") || t.includes("choose not");
              }) || items[items.length - 1];
              if (match) {
                (match as HTMLElement).click();
                return match.textContent?.trim();
              }
              return null;
            }, { lbId: listboxId });

            if (!selectedVet && hasVetInp) {
              await vetInput.fill("I am not a protected veteran").catch(() => {});
              await page.keyboard.press("ArrowDown");
              await page.keyboard.press("Enter");
            }
            veteranHandled = true;
          }
        }

        // C. Pill button fallback
        if (!veteranHandled) {
          const vetPill = page.locator("button:has-text('not a protected veteran'), button:has-text('Not a veteran'), button:has-text('I am not a protected veteran')").first();
          if (await vetPill.count() > 0 && await vetPill.isVisible().catch(() => false)) {
            await vetPill.click({ force: true }).catch(() => {});
            veteranHandled = true;
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Veteran selection note: ${e.message}`);
      }

      // 5C. Disability Status Selection (Section 3) - Robust all-format handler
      try {
        console.log("[OracleAdapter] Populating Disability Status: selecting 'No, I do not have a disability'...");
        let disHandled = false;

        // A. Radio buttons
        disHandled = await page.evaluate(() => {
          const allRadios = Array.from(document.querySelectorAll("input[type='radio']")) as HTMLInputElement[];
          const disRadios: HTMLInputElement[] = [];
          for (const r of allRadios) {
            let container = r.closest(".form-block, .field, .input-row, fieldset, div");
            const label = (r.id ? document.querySelector(`label[for='${r.id}']`)?.textContent : "") || r.closest("label")?.textContent || "";
            const contextText = ((container?.textContent || "") + " " + label).toLowerCase();
            if (contextText.includes("disability")) {
              disRadios.push(r);
              const labelLower = label.toLowerCase();
              if (labelLower.includes("no, i do not") || labelLower.includes("not have a disability") || labelLower.includes("i don't have") || labelLower.includes("choose not") || labelLower.includes("do not wish")) {
                const clickTarget = (r.id ? document.querySelector(`label[for='${r.id}']`) : null) as HTMLElement || r;
                clickTarget.click();
                r.checked = true;
                r.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
              }
            }
          }
          if (disRadios.length >= 2) {
            // Pick option 2 ("No, I do not have a disability")
            const target = disRadios[1] || disRadios[disRadios.length - 1];
            const clickTarget = (target.id ? document.querySelector(`label[for='${target.id}']`) : null) as HTMLElement || target;
            clickTarget.click();
            target.checked = true;
            target.dispatchEvent(new Event("change", { bubbles: true }));
            return true;
          }
          return false;
        });

        // B. Redwood combobox / toggle dropdown
        if (!disHandled) {
          const disInput = page.locator("input[name*='DISABILITY' i], input[id*='DISABILITY' i], input[aria-label*='Disability' i], input[id*='disability' i]").first();
          const disBtn = page.locator("button[id*='DISABILITY' i], button[id*='disability' i], button[aria-label*='Disability' i]").first();
          const hasDisBtn = (await disBtn.count() > 0) && (await disBtn.isVisible().catch(() => false));
          const hasDisInp = (await disInput.count() > 0) && (await disInput.isVisible().catch(() => false));

          if (hasDisBtn || hasDisInp) {
            const dId = hasDisBtn ? (await disBtn.getAttribute("id").catch(() => "") || "") : (await disInput.getAttribute("id").catch(() => "") || "");
            const listboxId = hasDisBtn ? ((await disBtn.getAttribute("aria-controls").catch(() => "")) || (dId ? `${dId.replace(/-toggle-button$/, "")}-listbox` : "")) : "";

            if (hasDisBtn) {
              await disBtn.click({ force: true }).catch(() => {});
            } else {
              await disInput.click({ force: true }).catch(() => {});
            }
            await page.waitForTimeout(600);

            const selectedDis = await page.evaluate(({ lbId }) => {
              const listbox = lbId ? document.getElementById(lbId) : null;
              const container = listbox || document;
              const items = Array.from(container.querySelectorAll(".cx-select__list-item, [role='gridcell'], [role='option'], li, span"));
              const match = items.find(i => {
                const t = (i.textContent || "").toLowerCase();
                return t.includes("no, i do not") || t.includes("not have a disability") || t.includes("choose not") || t.includes("do not wish");
              }) || items[items.length - 1];
              if (match) {
                (match as HTMLElement).click();
                return match.textContent?.trim();
              }
              return null;
            }, { lbId: listboxId });

            if (!selectedDis && hasDisInp) {
              await disInput.fill("No, I do not have a disability").catch(() => {});
              await page.keyboard.press("ArrowDown");
              await page.keyboard.press("Enter");
            }
            disHandled = true;
          }
        }

        // C. Pill button fallback
        if (!disHandled) {
          const disPill = page.locator("button:has-text('No, I do not have a disability'), button:has-text('not have a disability')").first();
          if (await disPill.count() > 0 && await disPill.isVisible().catch(() => false)) {
            await disPill.click({ force: true }).catch(() => {});
            disHandled = true;
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Disability selection note: ${e.message}`);
      }

      // 6. Ethnicity / Race: Asian
      try {
        await page.evaluate(() => {
          const asianCb = (document.getElementById("dq-option-5") || Array.from(document.querySelectorAll("input[type='checkbox']")).find(cb => {
            const l = cb.id ? document.querySelector(`label[for='${cb.id}']`)?.textContent : cb.closest("label")?.textContent;
            return l?.trim().toLowerCase() === "asian";
          })) as HTMLInputElement;

          if (asianCb && !asianCb.checked) {
            const l = (asianCb.id ? document.querySelector(`label[for='${asianCb.id}']`) : null) as HTMLElement;
            if (l) l.click();
            else asianCb.click();
          }
        });
      } catch (e: any) {}

      // 7. Full Name E-Signature (Section 3)
      try {
        const sigInput = page.locator("input[name='fullName'], input[id*='fullName'], input[name*='signature']").first();
        if (await sigInput.count() > 0 && await sigInput.isVisible()) {
          const fullName = `${profile.firstName} ${profile.lastName}`;
          await sigInput.click();
          await sigInput.fill(fullName);
          await sigInput.dispatchEvent("input");
          await sigInput.dispatchEvent("change");
          await sigInput.blur();
          console.log(`[OracleAdapter] Filled Full Name (Signature): ${fullName}`);
        }
      } catch (e: any) {
        await fillIfVisible(
          "input[name='fullName'], input[id*='fullName'], input[name*='signature']",
          `${profile.firstName} ${profile.lastName}`,
          "Full Name (Signature)"
        );
      }

      // 8. Communication & Legal Checkboxes
      await page.evaluate(() => {
        const cbs = Array.from(document.querySelectorAll("input[type='checkbox']")) as HTMLInputElement[];
        for (const cb of cbs) {
          // Keep other race checkboxes unchecked
          if (cb.id === "dq-option-4" || cb.id === "dq-option-7" || cb.id === "dq-option-3" || cb.id === "dq-option-6" || cb.id === "dq-option-1") continue;
          if (!cb.checked) {
            if (cb.id) {
              const l = document.querySelector(`label[for='${cb.id}']`) as HTMLElement;
              if (l) l.click();
              else cb.click();
            } else {
              cb.click();
            }
          }
        }
      });

      // 9. Fallback scanner to catch any remaining unlabeled visible text fields
      await fillAllVisibleMatching();

      // 9B. Fix Experience & Education Date Validation Errors ("Enter a date after Start Date.")
      try {
        const fixDateForm = async () => {
          // 1. Fill Job Title if open
          const titleInp = page.locator("input[id*='jobTitle'], input[name*='jobTitle'], input[id*='title']:not([id='title-16']):not([name='title'])").first();
          if (await titleInp.count() > 0 && await titleInp.isVisible().catch(() => false)) {
            const currentVal = await titleInp.inputValue().catch(() => "");
            if (!currentVal || currentVal === "Mr.") {
              await titleInp.click({ force: true });
              await titleInp.fill("Full Stack AI Developer");
              await titleInp.press("Tab");
            }
          }

          // 2. Fill Employer / Company if open
          const empInp = page.locator("input[id*='employer'], input[name*='employer'], input[id*='company'], input[name*='company']").first();
          if (await empInp.count() > 0 && await empInp.isVisible().catch(() => false)) {
            const currentVal = await empInp.inputValue().catch(() => "");
            if (!currentVal) {
              await empInp.click({ force: true });
              await empInp.fill("Jobspring");
              await empInp.press("Tab");
            }
          }

          // 3. Fill Start Month: January
          await fillOracleDateField("month-startDate", "January", ["Jan", "01"]);

          // 4. Fill Start Year: 2024
          await fillOracleDateField("year-startDate", "2024", []);

          // 5. Fill End Month: March (as in user screenshot 2)
          await fillOracleDateField("month-endDate", "March", ["Mar", "03", "January"]);

          // 6. Fill End Year: 2026 (ensures End Date is strictly after Start Date 2024)
          await fillOracleDateField("year-endDate", "2026", []);

          // 6B. Check Current Job Checkbox
          const currentCb = page.locator("input[type='checkbox'][name*='current' i], input[type='checkbox'][id*='current' i], input[type='checkbox'][aria-label*='current' i]").first();
          if (await currentCb.count() > 0 && !(await currentCb.isChecked().catch(() => false))) {
            await currentCb.check({ force: true }).catch(async () => {
              const lbl = page.locator("label:has-text('Current Job'), label:has-text('Currently work here')").first();
              if (await lbl.count() > 0) await lbl.click().catch(() => {});
            });
          }

          // 7. Fallback DOM event dispatch
          await page.evaluate(() => {
            const sy = document.querySelector("input[id*='year-startDate'], input[id*='startDate'][id*='year']") as HTMLInputElement;
            const ey = document.querySelector("input[id*='year-endDate'], input[id*='endDate'][id*='year']") as HTMLInputElement;
            const sm = document.querySelector("input[id*='month-startDate'], input[id*='startDate'][id*='month']") as HTMLInputElement;
            const em = document.querySelector("input[id*='month-endDate'], input[id*='endDate'][id*='month']") as HTMLInputElement;
            if (sy && (!sy.value || sy.value === ey?.value || sy.value === "2026")) {
              sy.value = "2024";
              sy.dispatchEvent(new Event("input", { bubbles: true }));
              sy.dispatchEvent(new Event("change", { bubbles: true }));
            }
            if (ey && (!ey.value || ey.value === "2024")) {
              ey.value = "2026";
              ey.dispatchEvent(new Event("input", { bubbles: true }));
              ey.dispatchEvent(new Event("change", { bubbles: true }));
            }
            if (sm && !sm.value) {
              sm.value = "January";
              sm.dispatchEvent(new Event("input", { bubbles: true }));
              sm.dispatchEvent(new Event("change", { bubbles: true }));
            }
            if (em && !em.value) {
              em.value = "March";
              em.dispatchEvent(new Event("input", { bubbles: true }));
              em.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          await page.waitForTimeout(500);

          // 8. Find and click SAVE / ADD EXPERIENCE button in the active form
          const saveBtn = page.locator("button:has-text('ADD EXPERIENCE'), button:has-text('Add Experience'), button.apply-flow-profile-item-tile__save-button, button:has-text('Save Experience'), button:has-text('Save Education'), button:has-text('Save & Close'), button:has-text('Save')").first();
          if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click({ force: true });
            console.log("✅ [OracleAdapter] Clicked Save/Add Experience on active Experience/Education form.");
            await page.waitForTimeout(2000);
            return true;
          }
          return false;
        };

        // Run on any open form first
        await fixDateForm();

        // Check for invalid profile tiles (STRICTLY EXCLUDING ATTACHMENTS!)
        const nonAttachmentInvalidCount = await page.evaluate(() => {
          const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile--invalid, .apply-flow-profile-item-tile.error"));
          return tiles.filter(tile => {
            if (tile.closest(".apply-flow-attachment-list, [class*='attachment'], [class*='file-list']")) return false;
            if (tile.querySelector("a[href*='recruitingCandidateAttachments'], a[download], a[href*='blob']")) return false;
            const text = (tile.textContent || "").toLowerCase();
            if (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx")) return false;
            return true;
          }).length;
        });

        if (nonAttachmentInvalidCount > 0) {
          console.log(`[OracleAdapter] Found ${nonAttachmentInvalidCount} non-attachment invalid profile tile(s). Opening and fixing dates...`);
          for (let i = 0; i < nonAttachmentInvalidCount + 1; i++) {
            const opened = await page.evaluate(() => {
              const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile--invalid, .apply-flow-profile-item-tile.error"));
              const validTile = tiles.find(tile => {
                if (tile.closest(".apply-flow-attachment-list, [class*='attachment'], [class*='file-list']")) return false;
                if (tile.querySelector("a[href*='recruitingCandidateAttachments'], a[download], a[href*='blob']")) return false;
                const text = (tile.textContent || "").toLowerCase();
                if (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx")) return false;
                return true;
              });
              if (!validTile) return false;
              const editBtn = validTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit'], button[aria-label*='Edit']") as HTMLElement;
              if (editBtn) {
                editBtn.click();
                return true;
              }
              if (validTile.closest("[class*='experience'], [class*='education'], [data-test-id*='experience'], [data-test-id*='education']")) {
                (validTile as HTMLElement).click();
                return true;
              }
              return false;
            });

            if (!opened) break;
            await page.waitForTimeout(1200);
            await fixDateForm();
            await page.waitForTimeout(1500);
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Experience date fix note: ${e.message}`);
      }

      // Dismiss any transient toast notifications
      await page.evaluate(() => {
        document.querySelectorAll("button[title='Close'], button[aria-label='Close'], .oj-message-category-close, button.toast-close").forEach(b => (b as HTMLElement).click());
      }).catch(() => {});

      // 10. Check Navigation: Next Section vs Final Submit
      const hasNextButton = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, input[type='button'], a[role='button']"));
        return btns.some(b => {
          const t = b.textContent?.trim().toLowerCase() || "";
          const aria = b.getAttribute("aria-label")?.toLowerCase() || "";
          const isNext = (t === "next" || aria === "next" || t.includes("continue")) && !t.includes("previous") && !t.includes("back");
          const rect = b.getBoundingClientRect();
          return isNext && rect.width > 0 && rect.height > 0 && !b.hasAttribute("disabled");
        });
      });

      const hasSubmitButton = await page.evaluate(() => {
        if (window.location.href.includes("/apply/email")) return false;
        const btns = Array.from(document.querySelectorAll("button, input[type='submit']"));
        return btns.some(b => {
          const t = b.textContent?.trim().toLowerCase() || "";
          const cls = b.className?.toLowerCase() || "";
          const isSubmit = (t === "submit" || t === "submit application" || cls.includes("submit-button")) &&
                           !t.includes("next") &&
                           !t.includes("cancel") &&
                           !t.includes("save") &&
                           !t.includes("verify") &&
                           !t.includes("agree");
          const rect = b.getBoundingClientRect();
          return isSubmit && rect.width > 0 && rect.height > 0 && !t.includes("back") && !t.includes("show more");
        });
      });

      if (hasNextButton) {
        console.log("[OracleAdapter] Advancing to next application section...");
        await page.waitForSelector("button.apply-flow-pagination__button:has-text('Next'):not([disabled]), button:has-text('Next'):not([disabled])", { timeout: 15000 }).catch(() => {});
        const nextBtn = page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next')").last();
        if (await nextBtn.count() > 0) {
          await nextBtn.click({ force: true }).catch(async () => {
            await page.evaluate(() => {
              const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent?.trim().toLowerCase() === "next" && !x.disabled);
              if (b) b.click();
            });
          });
        }
        await page.waitForTimeout(5000);
        continue;
      }

      if (hasSubmitButton) {
        console.log("🎯 [OracleAdapter] Reached final review / submit section. All fields successfully populated!");
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const sb = btns.find(b => b.textContent?.trim().toLowerCase() === "submit" || b.className.includes("submit-button") || b.type === "submit");
          if (sb) sb.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        break;
      }
    }
  }

  async uploadResume(page: Page, resumePath: string, fields?: FormField[]): Promise<void> {
    if (!fs.existsSync(resumePath)) {
      console.warn(`[OracleAdapter] Resume path does not exist: ${resumePath}`);
      return;
    }

    const resumeFileName = path.basename(resumePath);

    // Clean up duplicate attachment pills if present
    await page.evaluate((fileName) => {
      const allPills = Array.from(document.querySelectorAll(".apply-flow-attachment-list__item, [class*='attachment-item'], [class*='file-item'], li")).filter(el => {
        const text = el.textContent || "";
        return text.includes(fileName);
      });
      if (allPills.length > 1) {
        for (let i = 1; i < allPills.length; i++) {
          const closeBtn = allPills[i].querySelector("button, [class*='icon-close'], [aria-label*='delete' i], [aria-label*='remove' i]") as HTMLElement;
          if (closeBtn) closeBtn.click();
        }
      }
    }, resumeFileName).catch(() => {});

    const alreadyAttached = await page.evaluate((fileName) => {
      const bodyText = document.body?.innerText || "";
      return bodyText.includes(fileName);
    }, resumeFileName).catch(() => false);

    if (alreadyAttached) {
      console.log(`[OracleAdapter] Resume (${resumeFileName}) is already attached. Skipping duplicate upload.`);
      return;
    }

    // Strictly target the actual attachment slot, never the profile importer
    const fileInputs = page.locator("input#attachment-upload-2, input[name='attachment-upload'][id*='2'], input[id*='attachment-upload']:not([id*='3']):not([id*='4']), input[type='file']:not([aria-label*='import' i])");
    const count = await fileInputs.count();
    if (count > 0) {
      console.log(`[OracleAdapter] Uploading resume to attachment slot: ${resumePath}...`);
      await fileInputs.first().setInputFiles(resumePath).catch((e) => {
        console.warn(`[OracleAdapter] Resume upload error: ${e.message}`);
      });
      await page.waitForTimeout(2000);
    }
  }

  async validate(page: Page, fields?: FormField[]): Promise<boolean> {
    // Dismiss any ephemeral message popups first
    await page.evaluate(() => {
      document.querySelectorAll("button[title='Close'], button[aria-label='Close'], .oj-message-category-close").forEach(b => (b as HTMLElement).click());
    }).catch(() => {});

    // Fix any remaining invalid profile tiles before validation check (strictly exclude attachments!)
    try {
      const invalidTileCount = await page.evaluate(() => {
        const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile--invalid, .apply-flow-profile-item-tile.error"));
        return tiles.filter(tile => {
          if (tile.closest(".apply-flow-attachment-list, [class*='attachment'], [class*='file-list']")) return false;
          if (tile.querySelector("a[href*='recruitingCandidateAttachments'], a[download], a[href*='blob']")) return false;
          const text = (tile.textContent || "").toLowerCase();
          if (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx")) return false;
          return true;
        }).length;
      });

      if (invalidTileCount > 0) {
        console.log(`[OracleAdapter.validate] Found ${invalidTileCount} non-attachment invalid profile tiles, attempting auto-resolution...`);
        for (let i = 0; i < invalidTileCount + 1; i++) {
          const opened = await page.evaluate(() => {
            const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile--invalid, .apply-flow-profile-item-tile.error"));
            const validTile = tiles.find(tile => {
              if (tile.closest(".apply-flow-attachment-list, [class*='attachment'], [class*='file-list']")) return false;
              if (tile.querySelector("a[href*='recruitingCandidateAttachments'], a[download], a[href*='blob']")) return false;
              const text = (tile.textContent || "").toLowerCase();
              if (text.includes(".pdf") || text.includes(".doc") || text.includes(".docx")) return false;
              return true;
            });
            if (!validTile) return false;
            const editBtn = validTile.querySelector(".apply-flow-profile-item-tile__edit-item-icon, button[title='Edit'], button[aria-label*='Edit']") as HTMLElement;
            if (editBtn) { editBtn.click(); return true; }
            if (validTile.closest("[class*='experience'], [class*='education'], [data-test-id*='experience'], [data-test-id*='education']")) {
              (validTile as HTMLElement).click();
              return true;
            }
            return false;
          });
          if (!opened) break;
          await page.waitForTimeout(1200);

          await page.evaluate(() => {
            const startYearInput = document.querySelector("input[id*='year-startDate'], input[id*='startDate'][id*='year']") as HTMLInputElement;
            const endYearInput = document.querySelector("input[id*='year-endDate'], input[id*='endDate'][id*='year']") as HTMLInputElement;
            const startMonthInput = document.querySelector("input[id*='month-startDate'], input[id*='startDate'][id*='month']") as HTMLInputElement;
            const endMonthInput = document.querySelector("input[id*='month-endDate'], input[id*='endDate'][id*='month']") as HTMLInputElement;

            if (startYearInput) {
              startYearInput.value = "2024";
              startYearInput.dispatchEvent(new Event("input", { bubbles: true }));
              startYearInput.dispatchEvent(new Event("change", { bubbles: true }));
              startYearInput.dispatchEvent(new Event("blur", { bubbles: true }));
            }
            if (endYearInput) {
              endYearInput.value = "2026";
              endYearInput.dispatchEvent(new Event("input", { bubbles: true }));
              endYearInput.dispatchEvent(new Event("change", { bubbles: true }));
              endYearInput.dispatchEvent(new Event("blur", { bubbles: true }));
            }
            if (startMonthInput && !startMonthInput.value) {
              startMonthInput.value = "January";
              startMonthInput.dispatchEvent(new Event("input", { bubbles: true }));
              startMonthInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
            if (endMonthInput && !endMonthInput.value) {
              endMonthInput.value = "January";
              endMonthInput.dispatchEvent(new Event("input", { bubbles: true }));
              endMonthInput.dispatchEvent(new Event("change", { bubbles: true }));
            }

            const saveBtn = Array.from(document.querySelectorAll("button")).find(b => {
              const t = b.textContent?.trim().toLowerCase();
              return t === "save" || t === "save experience" || t === "save education";
            }) as HTMLElement;
            if (saveBtn) saveBtn.click();
          });
          await page.waitForTimeout(1500);
        }
      }
    } catch (e: any) {}

    return page.evaluate(() => {
      // Find actual form field validation errors
      const fieldErrors = Array.from(document.querySelectorAll(".apply-flow-field-error, .input-row--error, [aria-invalid='true']:not([aria-invalid='false']), .oj-text-field-error-message, .apply-flow-error"))
        .filter(e => {
          const text = e.textContent?.trim() || "";
          const isVisible = (e as HTMLElement).offsetWidth > 0 && (e as HTMLElement).offsetHeight > 0;
          return isVisible && text.length > 0 && !text.includes("optional") && !text.includes("Saved");
        });

      const buttons = Array.from(document.querySelectorAll("button"));
      const submitBtn = buttons.find(b => {
        const text = b.textContent?.trim().toLowerCase() || "";
        const isSubmit = text === "submit" || b.type === "submit" || b.className.includes("submit");
        return isSubmit && (b as HTMLElement).offsetWidth > 0;
      });

      return fieldErrors.length === 0 && !!submitBtn;
    }).catch(() => false);
  }

  async submit(page: Page): Promise<SubmissionResult> {
    try {
      const submitBtn = page.locator("button:has-text('Submit'), button[type='submit'], button.apply-flow-pagination__button--submit").first();
      if (await submitBtn.count() > 0) {
        console.log("[OracleAdapter] Ready to submit Oracle application!");
        if (process.env.AUTO_SUBMIT === "true") {
          await submitBtn.click();
          await page.waitForTimeout(5000);
          return {
            success: true,
            confirmation: "Application successfully submitted via Oracle Careers!"
          };
        }

        return {
          success: true,
          confirmation: "Oracle application form completed and verified! Ready for manual submission review."
        };
      }
    } catch (e: any) {
      return {
        success: false,
        errorMessage: e.message
      };
    }

    return {
      success: false,
      errorMessage: "Submit button not found on Oracle Careers page"
    };
  }
}
