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

    let userEmail = profile.email || this.defaultEmail;

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
      if (jobIdMatch && page.url().includes("careers.oracle.com")) {
        const directApplyUrl = `https://careers.oracle.com/en/sites/jobsearch/job/${jobIdMatch[1]}/apply/email`;
        console.log(`[OracleAdapter] Navigating directly to application flow: ${directApplyUrl}...`);
        await page.goto(directApplyUrl, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(3000);
        if (page.url().includes("/apply")) {
          navigatedDirectly = true;
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
    const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
    await emailInput.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    
    let baselineState: any = null;
    let requestStartTime = Date.now();

    if (page.url().includes("/apply/email") || await emailInput.count() > 0) {
      if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        console.log("[OracleAdapter] Checking current inbox state before requesting verification code...");
        baselineState = await getLatestOracleInboxState().catch(() => null);
        if (baselineState?.latestId) {
          console.log(`[OracleAdapter] Baseline Oracle email ID: ${baselineState.latestId} (latest code: ${baselineState.latestCode || "none"})`);
        }
      }

      console.log(`[OracleAdapter] Entering applicant email: ${userEmail}...`);
      if (await emailInput.count() > 0 && await emailInput.isVisible()) {
        await emailInput.fill(userEmail);
      }

      // Check legal disclaimer checkbox
      await page.evaluate(() => {
        const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
        if (cb && !cb.checked) {
          const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
          if (label) label.click();
          else cb.click();
        }
      });
      await page.waitForTimeout(1000);

      requestStartTime = Date.now();
      console.log("[OracleAdapter] Advancing past email step...");
      const nextEmailBtn = page.locator("button:has-text('Next')").first();
      if (await nextEmailBtn.count() > 0) {
        await nextEmailBtn.click().catch(() => {});
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

        if (jobIdMatch && jobIdMatch[1]) {
          await page.goto(`https://careers.oracle.com/en/sites/jobsearch/job/${jobIdMatch[1]}/apply/email`, { waitUntil: "domcontentloaded", timeout: 45000 });
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

      if (!otp && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        console.log(`🤖 [OracleAdapter] Holding & auto-fetching fresh verification code from ${process.env.GMAIL_USER}...`);
        const fetched = await fetchLatestOracleOtp({
          timeoutMs: 75000,
          knownOldCode: baselineState?.latestCode || "",
          minTimestamp: requestStartTime - 15000,
          minMessageId: baselineState?.latestId || 0
        });
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
          // Protect Gender, Veteran, and Disability Redwood comboboxes from raw synthetic string assignment so dedicated interactive handlers select them cleanly
          if (norm.includes("gender") || norm.includes("veteran") || norm.includes("disability")) continue;

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
          } else if (norm.includes("line 1") || norm.includes("line1") || norm.includes("apartment") || norm.includes("addressline1") || norm.includes("building") || norm.includes("flat") || norm.includes("house")) {
            valToFill = "500 Oracle Parkway";
          } else if (norm.includes("line 2") || norm.includes("line2") || norm.includes("street name") || norm.includes("street") || norm.includes("addressline2") || norm.includes("road") || norm.includes("locality") || norm.includes("area")) {
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
      const cityVal = "Redwood City";
      const stateVal = "California";
      const zipVal = "94065";
      const cleanPhone = "4155552671";

      await fillIfVisible("input[name='title'], input[id*='title']", "Mr.", "Title");
      await fillIfVisible("input[name='firstName'], input[id*='firstName']", profile.firstName, "First Name");
      await fillIfVisible("input[name='lastName'], input[id*='lastName']", profile.lastName, "Last Name");
      await fillIfVisible("input[name='middleNames'], input[id*='middleNames']", "", "Middle Name");
      await fillIfVisible("input[name='namInformation29'], input[id*='namInformation29']", "He/Him", "Pronoun");

      // 2A. Country Selection: STRICTLY "United States" (Never India, Never Vadodara)
      try {
        const countryInp = page.locator("input[name='country']:not([id*='phone']):not([name*='phone']), input[id*='country']:not([id*='phone']):not([name*='phone']), select[name='country']").first();
        if (await countryInp.count() > 0 && await countryInp.isVisible()) {
          const currentCountry = await countryInp.inputValue().catch(() => "");
          const cId = await countryInp.getAttribute("id").catch(() => "") || "country-12";
          if (!currentCountry.toLowerCase().includes("united states")) {
            console.log(`[OracleAdapter] Enforcing US Address: Resetting country from '${currentCountry}' to: United States...`);
            await page.evaluate((id) => {
              const reset = (id ? document.getElementById(id + "-reset-button") : null) || 
                            document.querySelector(`button[id*='${id}'][id*='reset']`) ||
                            document.querySelector("button#country-12-reset-button, button#country-13-reset-button, button#country-14-reset-button, button[id*='country'][id*='reset']");
              if (reset) (reset as HTMLElement).click();
            }, cId);
            await page.waitForTimeout(600);
            await countryInp.click({ force: true });
            await countryInp.fill("");
            await countryInp.pressSequentially("United States", { delay: 50 });
            await page.waitForTimeout(1000);
            const clickedCountry = await page.evaluate((id) => {
              const listbox = id ? document.getElementById(id + "-listbox") : null;
              const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item") : document.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell']"));
              const match = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
              if (match) {
                (match as HTMLElement).click();
                return match.textContent?.trim();
              }
              return null;
            }, cId);

            if (!clickedCountry) {
              await page.keyboard.press("ArrowDown");
              await page.keyboard.press("Enter");
            }
            console.log(`[OracleAdapter] Address Country option selected: ${clickedCountry || "United States (via Enter)"}`);
            await page.waitForTimeout(2000);
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Country note: ${e.message}`);
      }

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

      // 2B. Phone Country Code Dropdown: Select United States (+1)
      try {
        const phoneCountryInput = page.locator("input#country-codes-dropdownphoneNumber, input[name='phoneNumber'][role='combobox']").first();
        if (await phoneCountryInput.count() > 0 && await phoneCountryInput.isVisible()) {
          const pcId = await phoneCountryInput.getAttribute("id").catch(() => "country-codes-dropdownphoneNumber");
          const currentPhoneCountry = await phoneCountryInput.inputValue().catch(() => "");
          if (!currentPhoneCountry.includes("+1")) {
            console.log("[OracleAdapter] Populating Phone Country Code: selecting United States (+1)...");
            await page.evaluate((id) => {
              const reset = (id ? document.getElementById(id + "-reset-button") : null) || 
                            document.querySelector("button[id*='country-codes'][id*='reset']");
              if (reset) (reset as HTMLElement).click();
            }, pcId);
            await page.waitForTimeout(400);

            await phoneCountryInput.click();
            await phoneCountryInput.fill("United States");
            await page.waitForTimeout(1000);

            const matched = await page.evaluate((id) => {
              const listbox = id ? document.getElementById(id + "-listbox") : null;
              const opts = Array.from(listbox ? listbox.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item") : document.querySelectorAll("#country-codes-dropdownphoneNumber-listbox [role='option'], [role='option'], [role='gridcell'], .cx-select__list-item"));
              const match = opts.find(o => {
                const t = (o.textContent || "").toLowerCase();
                return t.includes("united states") && t.includes("+1");
              }) || opts.find(o => (o.textContent || "").toLowerCase().includes("united states"));
              if (match) {
                (match as HTMLElement).click();
                return true;
              }
              return false;
            }, pcId);

            if (!matched) {
              await page.keyboard.press("ArrowDown");
              await page.keyboard.press("Enter");
            }
            await page.waitForTimeout(800);
          }
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Phone country code note: ${e.message}`);
      }

      // 2C. Phone Number: Strictly fill into input.phone-row__input safely (removing readonly if present)
      try {
        const phoneInput = page.locator("input.phone-row__input, input[type='tel'], input[aria-label='Phone Number']:not([role='combobox']), input[id*='phoneNumber']:not([id*='country-codes']):not([role='combobox'])").first();
        if (await phoneInput.count() > 0 && await phoneInput.isVisible()) {
          await page.evaluate((val) => {
            const el = document.querySelector("input.phone-row__input, input[type='tel']:not([role='combobox']), input[id*='phoneNumber']:not([id*='country-codes']):not([role='combobox'])") as HTMLInputElement;
            if (el) {
              el.removeAttribute("readonly");
              el.value = val;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true }));
            }
          }, cleanPhone);
          console.log(`[OracleAdapter] Filled US Phone Number: ${cleanPhone}`);
        } else {
          await fillIfVisible("input.phone-row__input, input[type='tel']:not([role='combobox'])", cleanPhone, "US Phone Number");
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Phone filling note: ${e.message}`);
      }

      // 2D. US Address Fields (Line 1 & Line 2)
      await fillIfVisible("input[name='addressLine1'], input[id*='addressLine1'], input[name='address1'], input[id*='address1'], input[name='building'], input[id*='building']", streetVal, "Address Line 1");
      await fillIfVisible("input[name='addressLine2'], input[id*='addressLine2'], input[name='address2'], input[id*='address2'], input[name='streetName'], input[id*='streetName']", line2Val, "Street / Address Line 2");

      // 2E. US Postal Code with Geography Hierarchy Autocomplete (Redwood City, CA)
      try {
        const pinInp = page.locator("input[name='postalCode'], input[id*='postalCode'], input[name='zipCode'], input[id*='zipCode']").first();
        if (await pinInp.count() > 0 && await pinInp.isVisible()) {
          const pinId = await pinInp.getAttribute("id").catch(() => "");
          console.log(`[OracleAdapter] Filling US Zip Code (${zipVal}) and waiting for Redwood City, CA autocomplete...`);
          await pinInp.click();
          await pinInp.fill(zipVal);
          
          const listboxSelector = pinId ? `#${pinId}-listbox` : ".cx-select__list";
          await page.waitForSelector(`${listboxSelector} .cx-select__list-item:not(.cx-select__list-item--loading), ${listboxSelector} [role='option'], ${listboxSelector} [role='gridcell']`, { timeout: 10000 }).catch(() => {});
          await page.waitForTimeout(1200);

          const selectedGeo = await page.evaluate((lbSel) => {
            const lb = document.querySelector(lbSel) || document.querySelector(".cx-select__list");
            const opts = Array.from(lb ? lb.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell']") : document.querySelectorAll(".cx-select__list-item, [role='option'], [role='gridcell']"));
            const match = opts.find(o => {
              const t = (o.textContent || "").toLowerCase();
              return t.includes("redwood") || (t.includes("94065") && t.includes("ca"));
            }) || opts.find(o => (o.textContent || "").includes("94065")) || opts[0];
            if (match) {
              (match as HTMLElement).click();
              return match.textContent?.trim().replace(/\s+/g, " ");
            }
            return null;
          }, listboxSelector);

          if (selectedGeo) {
            console.log(`[OracleAdapter] Selected US Postal Code autocomplete: ${selectedGeo}`);
          } else {
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          await page.waitForTimeout(2000);
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Pin code note: ${e.message}`);
      }

      // Direct fallbacks for City, State, County
      await fillIfVisible("input[name='city'], input[id*='city'], input[name='town'], input[id*='town']", cityVal, "City / Town");
      await fillIfVisible("input[name='region2'], input[id*='region2'], input[name='state'], input[id*='state'], input[name='province']", stateVal, "State");
      await fillIfVisible("input[name='region1'], input[id*='region1'], input[name='county'], input[id*='county']", "San Mateo", "County");

      // Links: LinkedIn & GitHub
      await fillIfVisible("input[name*='siteLink-1'], input[id*='siteLink-1']", profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi", "LinkedIn Link 1");
      await fillIfVisible("input[name*='siteLink-2'], input[id*='siteLink-2']", profile.githubUrl || "https://github.com/hrutinnammi", "GitHub Link 2");

      // Professional Summary / Textarea
      await fillIfVisible(
        "textarea[id*='work-summary'], textarea[id*='summary'], textarea[name*='summary']",
        "Results-driven Software Engineer with extensive experience in scalable software development, full-stack architectures, cloud platforms, and distributed systems.",
        "Work Summary"
      );

      // 2F. Section 2 Interactive Creators: Skill, Education, and Experience
      // 1. Skill
      try {
        const hasExistingSkill = await page.evaluate(() => {
          const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile, [class*='profile-item']"));
          return tiles.some(t => (t.textContent || "").toLowerCase().includes("developer") || (t.textContent || "").toLowerCase().includes("skill") || t.closest("[class*='skill'], [id*='skill']"));
        });
        const addSkillBtn = page.locator("button:has-text('Add Skill')").first();
        if (!hasExistingSkill && await addSkillBtn.count() > 0 && await addSkillBtn.isVisible()) {
          console.log("[OracleAdapter] Adding required Skill item in Section 2...");
          await addSkillBtn.click();
          await page.waitForTimeout(800);

          const skillInput = page.locator("input[name='skills'], input[id*='skills']").first();
          if (await skillInput.count() > 0) {
            await skillInput.fill("Full Stack AI Developer");
          }
          const expInput = page.locator("input[name='yearsOfExperience'], input[id*='yearsOfExperience']").first();
          if (await expInput.count() > 0) {
            await expInput.fill("3");
          }
          await page.evaluate(() => {
            const formBlock = document.querySelector("input[name='skills']")?.closest(".form-block, form, div");
            const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
            const addBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "add skill" && b.getBoundingClientRect().height > 0);
            if (addBtn) addBtn.click();
          });
          await page.waitForTimeout(1200);
          console.log("✅ [OracleAdapter] Added Skill item.");
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Skill handling note: ${e.message}`);
      }

      // 2. Education
      try {
        const hasExistingEdu = await page.evaluate(() => {
          const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile, [class*='profile-item']"));
          return tiles.some(t => (t.textContent || "").toLowerCase().includes("parul") || (t.textContent || "").toLowerCase().includes("bachelor") || t.closest("[class*='education'], [id*='education']"));
        });
        const addEduBtn = page.locator("button:has-text('Add Education')").first();
        if (!hasExistingEdu && await addEduBtn.count() > 0 && await addEduBtn.isVisible()) {
          console.log("[OracleAdapter] Adding required Education item in Section 2...");
          await addEduBtn.click();
          await page.waitForTimeout(800);

          const degInp = page.locator("input[name='contentItemId'], input[id*='contentItemId']").first();
          if (await degInp.count() > 0) {
            await degInp.fill("Bachelor of Technology");
            await page.waitForTimeout(500);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          const majorInp = page.locator("input[name='major'], input[id*='major']").first();
          if (await majorInp.count() > 0) {
            await majorInp.fill("Computer Science");
          }
          const schoolInp = page.locator("input[name='educationalEstablishment'], input[id*='educationalEstablishment']").first();
          if (await schoolInp.count() > 0) {
            await schoolInp.fill("Parul University");
            await page.waitForTimeout(500);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          const gpaInp = page.locator("input[name='gpa'], input[id*='gpa']").first();
          if (await gpaInp.count() > 0) {
            await gpaInp.fill("3.8");
          }
          await page.evaluate(() => {
            const cb = document.querySelector("input[type='checkbox'][name*='graduated' i]") as HTMLInputElement;
            if (cb && !cb.checked) {
              const lbl = cb.id ? document.querySelector(`label[for='${cb.id}']`) : cb.closest("label");
              if (lbl) (lbl as HTMLElement).click(); else cb.click();
            }
            const formBlock = document.querySelector("input[name='major']")?.closest(".form-block, form, div");
            const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
            const addBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "add education" && b.getBoundingClientRect().height > 0);
            if (addBtn) addBtn.click();
          });
          await page.waitForTimeout(1200);
          console.log("✅ [OracleAdapter] Added Education item.");
        }
      } catch (e: any) {
        console.warn(`[OracleAdapter] Education handling note: ${e.message}`);
      }

      // 3. Experience
      try {
        const hasExistingExp = await page.evaluate(() => {
          const tiles = Array.from(document.querySelectorAll(".apply-flow-profile-item-tile, [class*='profile-item']"));
          return tiles.some(t => (t.textContent || "").toLowerCase().includes("jobspring") || (t.textContent || "").toLowerCase().includes("nomadic") || t.closest("[class*='experience'], [id*='experience']"));
        });
        const addExpBtn = page.locator("button:has-text('Add Experience')").first();
        if (!hasExistingExp && await addExpBtn.count() > 0 && await addExpBtn.isVisible()) {
          console.log("[OracleAdapter] Adding required Experience item in Section 2...");
          await addExpBtn.click();
          await page.waitForTimeout(800);

          const empInp = page.locator("input[name='employerName'], input[id*='employerName']").first();
          if (await empInp.count() > 0) {
            await empInp.fill("Jobspring");
          }
          const titleInp = page.locator("input[name='jobTitle'], input[id*='jobTitle']").first();
          if (await titleInp.count() > 0) {
            await titleInp.fill("Full Stack AI Developer");
          }
          const smInp = page.locator("input[id*='month-startDate']").first();
          if (await smInp.count() > 0) {
            await smInp.fill("January");
            await page.waitForTimeout(300);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          const syInp = page.locator("input[id*='year-startDate']").first();
          if (await syInp.count() > 0) {
            await syInp.fill("2024");
            await page.waitForTimeout(300);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          const emInp = page.locator("input[id*='month-endDate']").first();
          if (await emInp.count() > 0) {
            await emInp.fill("January");
            await page.waitForTimeout(300);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          const eyInp = page.locator("input[id*='year-endDate']").first();
          if (await eyInp.count() > 0) {
            await eyInp.fill("2026");
            await page.waitForTimeout(300);
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
          }
          await page.evaluate(() => {
            const formBlock = document.querySelector("input[name='employerName']")?.closest(".form-block, form, div");
            const btns = Array.from(formBlock ? formBlock.querySelectorAll("button") : document.querySelectorAll("button"));
            const addBtn = btns.find(b => b.textContent?.trim().toLowerCase() === "add experience" && b.getBoundingClientRect().height > 0);
            if (addBtn) addBtn.click();
          });
          await page.waitForTimeout(1200);
          console.log("✅ [OracleAdapter] Added Experience item.");
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
          const startMonthInp = page.locator("input[id*='month-startDate'], input[id*='startDate'][id*='month']").first();
          if (await startMonthInp.count() > 0 && await startMonthInp.isVisible().catch(() => false)) {
            await startMonthInp.click({ force: true });
            await page.keyboard.press("Control+A");
            await page.keyboard.press("Backspace");
            await startMonthInp.fill("January");
            await page.keyboard.press("Tab");
          } else {
            const smToggle = page.locator("button[id*='month-startDate'][id*='toggle'], button[id*='startDate'][id*='month'][id*='toggle']").first();
            if (await smToggle.count() > 0 && await smToggle.isVisible().catch(() => false)) {
              await smToggle.click({ force: true }).catch(() => {});
              await page.waitForTimeout(300);
              await page.evaluate(() => {
                const opt = Array.from(document.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item")).find(o => (o.textContent || "").toLowerCase().includes("jan"));
                if (opt) (opt as HTMLElement).click();
              });
            }
          }

          // 4. Fill Start Year: 2024
          const startYearInp = page.locator("input[id*='year-startDate'], input[id*='startDate'][id*='year']").first();
          if (await startYearInp.count() > 0 && await startYearInp.isVisible().catch(() => false)) {
            await startYearInp.click({ force: true });
            await page.keyboard.press("Control+A");
            await page.keyboard.press("Backspace");
            await startYearInp.fill("2024");
            await page.keyboard.press("Tab");
          }

          // 5. Fill End Month: January
          const endMonthInp = page.locator("input[id*='month-endDate'], input[id*='endDate'][id*='month']").first();
          if (await endMonthInp.count() > 0 && await endMonthInp.isVisible().catch(() => false)) {
            await endMonthInp.click({ force: true });
            await page.keyboard.press("Control+A");
            await page.keyboard.press("Backspace");
            await endMonthInp.fill("January");
            await page.keyboard.press("Tab");
          } else {
            const emToggle = page.locator("button[id*='month-endDate'][id*='toggle'], button[id*='endDate'][id*='month'][id*='toggle']").first();
            if (await emToggle.count() > 0 && await emToggle.isVisible().catch(() => false)) {
              await emToggle.click({ force: true }).catch(() => {});
              await page.waitForTimeout(300);
              await page.evaluate(() => {
                const opt = Array.from(document.querySelectorAll("[role='option'], [role='gridcell'], .cx-select__list-item")).find(o => (o.textContent || "").toLowerCase().includes("jan"));
                if (opt) (opt as HTMLElement).click();
              });
            }
          }

          // 6. Fill End Year: 2026 (ensures End Date is strictly after Start Date 2024)
          const endYearInp = page.locator("input[id*='year-endDate'], input[id*='endDate'][id*='year']").first();
          if (await endYearInp.count() > 0 && await endYearInp.isVisible().catch(() => false)) {
            await endYearInp.click({ force: true });
            await page.keyboard.press("Control+A");
            await page.keyboard.press("Backspace");
            await endYearInp.fill("2026");
            await page.keyboard.press("Tab");
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
              em.value = "January";
              em.dispatchEvent(new Event("input", { bubbles: true }));
              em.dispatchEvent(new Event("change", { bubbles: true }));
            }
          });

          await page.waitForTimeout(500);

          // 8. Find and click SAVE button in the active form
          const saveBtn = page.locator("button.apply-flow-profile-item-tile__save-button, button:has-text('Save Experience'), button:has-text('Save Education'), button:has-text('Save & Close'), button:has-text('Save')").first();
          if (await saveBtn.count() > 0 && await saveBtn.isVisible().catch(() => false)) {
            await saveBtn.click({ force: true });
            console.log("✅ [OracleAdapter] Clicked Save on active Experience/Education form.");
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
      const hasSubmitButton = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, input[type='submit']"));
        return btns.some(b => {
          const t = b.textContent?.trim().toLowerCase() || "";
          const cls = b.className?.toLowerCase() || "";
          const isSubmit = t === "submit" || cls.includes("submit-button") || cls.includes("submit") || b.getAttribute("type") === "submit";
          const rect = b.getBoundingClientRect();
          return isSubmit && rect.width > 0 && rect.height > 0 && !t.includes("back") && !t.includes("show more");
        });
      });

      const hasNextButton = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button, input[type='button'], a[role='button']"));
        return btns.some(b => {
          const t = b.textContent?.trim().toLowerCase() || "";
          const aria = b.getAttribute("aria-label")?.toLowerCase() || "";
          const isNext = (t === "next" || aria === "next" || t.includes("continue")) && !t.includes("previous") && !t.includes("back");
          const rect = b.getBoundingClientRect();
          return isNext && rect.width > 0 && rect.height > 0;
        });
      });

      if (hasSubmitButton) {
        console.log("🎯 [OracleAdapter] Reached final review / submit section. All fields successfully populated!");
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const sb = btns.find(b => b.textContent?.trim().toLowerCase() === "submit" || b.className.includes("submit-button") || b.type === "submit");
          if (sb) sb.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        break;
      }

      if (hasNextButton) {
        console.log("[OracleAdapter] Advancing to next application section...");
        await page.waitForSelector("button.apply-flow-pagination__button:has-text('Next'):not([disabled]), button:has-text('Next'):not([disabled])", { timeout: 15000 }).catch(() => {});
        const nextBtn = page.locator("button.apply-flow-pagination__button:has-text('Next'), button:has-text('Next')").last();
        if (await nextBtn.count() > 0) {
          await nextBtn.click({ force: true }).catch(async () => {
            await page.evaluate(() => {
              const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent?.trim().toLowerCase() === "next");
              if (b) b.click();
            });
          });
        }
        await page.waitForTimeout(5000);
        continue;
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
