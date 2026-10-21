import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import fs from "fs";

export class TaleoAdapter implements ATSAdapter {
  private defaultEmail = process.env.TALEO_EMAIL || "babufakemail@gmail.com";
  private defaultPassword = process.env.TALEO_PASSWORD || "Tarun@2006";

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("taleo.net")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return lower.includes("taleo.net") || (await page.$("[class*='taleo'], [class*='oracletaleo'], #TBE_theForm")) !== null;
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");

    const extracted = await page.evaluate(() => {
      const strongTitle = document.querySelector(".oracletaleocwsv2-job-description strong, .well strong")?.textContent?.trim();
      const title = strongTitle || document.querySelector(".oracletaleocwsv2-requisition-title, h1, h2, .title")?.textContent?.trim() || "";
      const desc = document.querySelector(".oracletaleocwsv2-job-description, .oracletaleocwsv2-requisition-description, [class*='description'], .content")?.textContent?.trim() || "";
      return { title, desc };
    }).catch(() => ({ title: "", desc: "" }));

    let company = "Base-2 Solutions";
    try {
      const urlObj = new URL(page.url());
      const org = urlObj.searchParams.get("org");
      if (org && org !== "BASESOLU") {
        company = org;
      }
    } catch (e) {}

    return {
      company,
      title: extracted.title || pageTitle || "Taleo Requisition",
      description: extracted.desc || "Job details on Taleo",
      ats: "TALEO"
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    return page.evaluate(() => {
      const fields: FormField[] = [];
      const elements = Array.from(document.querySelectorAll("#TBE_theForm input, #TBE_theForm select, #TBE_theForm textarea"));

      for (const el of elements) {
        const inp = el as any;
        if (inp.type === "hidden") continue;

        let labelText = "";
        if (inp.id) {
          const lbl = document.querySelector(`label[for='${inp.id}']`);
          if (lbl) labelText = lbl.textContent?.trim() || "";
        }
        if (!labelText && inp.name) {
          const parent = inp.closest(".form-group, tr, td, div");
          if (parent) {
            const lbl = parent.querySelector("label, .control-label");
            if (lbl) labelText = lbl.textContent?.trim() || "";
          }
        }

        fields.push({
          id: inp.name || inp.id,
          label: labelText.replace(/\s+/g, " ") || inp.name || inp.id,
          type: (inp.type === "password" || inp.type === "email" || inp.type === "tel" || inp.type === "file" || inp.type === "checkbox") ? inp.type : "text",
          required: inp.required || inp.getAttribute("aria-required") === "true" || !!inp.closest(".required, [class*='required']")
        });
      }

      return fields;
    });
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers?: Record<string, string>,
    fields?: FormField[]
  ): Promise<void> {
    console.log(`[TaleoAdapter] Starting autofill for candidate: ${profile.firstName} ${profile.lastName}`);

    const userEmail = profile.email || this.defaultEmail;
    const userPassword = additionalAnswers?.password || this.defaultPassword;

    // 0. If on Requisition view page, click Apply Now
    const applyBtn = page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first();
    if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
      console.log("[TaleoAdapter] Clicking 'Apply Now' button...");
      await applyBtn.click();
      await page.waitForTimeout(3000);
    }

    // Handle Previous Applicants candidateLogin page if directly on it
    if (page.url().includes("candidateLogin")) {
      console.log(`[TaleoAdapter] On candidateLogin page, signing into account: ${userEmail}...`);
      if (await page.locator("input[name='cwsPassword']").count() > 0) {
        await page.fill("input[name='cwsPassword']", userPassword);
      }
      await page.locator("button[name='login'], button:has-text('Login')").first().click();
      await page.waitForTimeout(4000);
    }

    // 1. Initial Step 1 (Get Started / Account Creation or Check)
    const hasRegFields = await page.locator("input[name='cwsPassword_2']").count() > 0 && await page.locator("input[name='cwsPassword_2']").isVisible();
    if (hasRegFields) {
      console.log(`[TaleoAdapter] Entering credentials on Get Started step for ${userEmail}...`);
      if (await page.locator("input[name='email']").count() > 0) {
        await page.fill("input[name='email']", userEmail);
      }
      if (await page.locator("input[name='cwsPassword']").count() > 0) {
        await page.fill("input[name='cwsPassword']", userPassword);
      }
      if (await page.locator("input[name='cwsPassword_2']").count() > 0) {
        await page.fill("input[name='cwsPassword_2']", userPassword);
      }

      console.log("[TaleoAdapter] Advancing from Get Started...");
      await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
      await page.waitForTimeout(3000);

      // Check if redirected to candidateLogin (account already exists)
      if (page.url().includes("candidateLogin")) {
        console.log(`[TaleoAdapter] Existing account detected! Logging in as ${userEmail}...`);
        if (await page.locator("input[name='cwsPassword']").count() > 0) {
          await page.fill("input[name='cwsPassword']", userPassword);
        }
        await page.locator("button[name='login'], button:has-text('Login')").first().click();
        await page.waitForTimeout(4000);
      }
    }

    // Loop through wizard steps until Review & Submit is reached and filled
    let stepCount = 0;
    while (stepCount < 6) {
      stepCount++;
      await page.waitForTimeout(1000);

      // Inspect active step title and inputs
      const stepInfo = await page.evaluate(() => {
        const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
        if (!active) return { id: "", title: "", isReview: false, isInfo: false, isResume: false };
        const title = active.querySelector(".oracletaleocwsv2-step-title, .title, h1, h2")?.textContent?.trim() || "";
        const html = active.innerHTML;
        const isReview = title.includes("Review") || html.includes("candESignature") || html.includes("Candidate Certification");
        const isResume = !isReview && (title.includes("Resume") || html.includes("resumeLocalFile") || html.includes("resumeText"));
        const isInfo = !isReview && !isResume && (title.includes("Information") || html.includes("firstName") || html.includes("Phone Number"));
        return {
          id: active.id,
          title,
          isReview,
          isInfo,
          isResume
        };
      });

      console.log(`[TaleoAdapter] Current Step: ${stepInfo.id} ("${stepInfo.title}")`);

      // A. REVIEW & SUBMIT STEP (Check first)
      if (stepInfo.isReview) {
        console.log("[TaleoAdapter] On Review & Submit step: signing certification...");
        const sig = page.locator("input[name='candESignature']").first();
        if (await sig.count() > 0) {
          await sig.fill(`${profile.firstName || "Hrutin"} ${profile.lastName || "Nammi"}`);
        }

        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const yyyy = today.getFullYear();
        const sigDate = page.locator("input[name='candEsignatureDate']").first();
        if (await sigDate.count() > 0) {
          await sigDate.fill(`${mm}/${dd}/${yyyy}`);
        }
        console.log("[TaleoAdapter] Form filling successfully completed across all steps!");
        break;
      }

      // B. YOUR INFORMATION STEP
      if (stepInfo.isInfo) {
        console.log("[TaleoAdapter] Filling Contact & Candidate Information...");
        if (await page.locator("input[name='firstName']").count() > 0) {
          const val = await page.locator("input[name='firstName']").inputValue();
          if (!val) await page.fill("input[name='firstName']", profile.firstName || "Hrutin");
        }

        // Middle Name (Taleo uses name='middleInitial' or 'middleName')
        const middleVal = profile.middleName || "Goud";
        const middleLoc = page.locator("input[name='middleInitial'], input[name='middleName'], input[name*='middle' i], input[id*='middle' i]").first();
        if (await middleLoc.count() > 0) {
          const val = await middleLoc.inputValue().catch(() => "");
          if (!val) {
            console.log(`[TaleoAdapter] Filling Middle Name as: ${middleVal}`);
            await middleLoc.fill(middleVal);
          }
        }

        if (await page.locator("input[name='lastName']").count() > 0) {
          const val = await page.locator("input[name='lastName']").inputValue();
          if (!val) await page.fill("input[name='lastName']", profile.lastName || "Nammi");
        }
        if (await page.locator("input[name='phone']").count() > 0) {
          const val = await page.locator("input[name='phone']").inputValue();
          if (!val) await page.fill("input[name='phone']", profile.phone ? profile.phone.replace(/\D/g, "") : "8688423267");
        }
        const streetVal = profile.street || "ava street";
        const cityVal = profile.city || "vadodar";
        const stateVal = profile.state || "California";
        const zipVal = profile.zipCode || "390144";

        if (await page.locator("input[name='address']").count() > 0) {
          await page.fill("input[name='address']", streetVal);
        }
        if (await page.locator("input[name='city']").count() > 0) {
          await page.fill("input[name='city']", cityVal);
        }
        if (await page.locator("input[name='zipCode']").count() > 0) {
          await page.fill("input[name='zipCode']", zipVal);
        }
        if (await page.locator("select[name='country']").count() > 0) {
          await page.selectOption("select[name='country']", { label: "India" }).catch(async () => {
            await page.selectOption("select[name='country']", "267").catch(() => {});
          });
          await page.waitForTimeout(500);
        }
        if (await page.locator("select[name='state']").count() > 0) {
          await page.evaluate((val) => {
            const sel = document.querySelector("select[name='state']") as HTMLSelectElement;
            if (sel) {
              let opt = Array.from(sel.options).find(o => o.text.toLowerCase() === val.toLowerCase() || o.value.toLowerCase() === val.toLowerCase());
              if (!opt) {
                // If specific state not in list (e.g. US list), pick California or first valid option
                opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("california") || o.value.toLowerCase().includes("california"))
                  || Array.from(sel.options).find(o => o.value && o.value !== "");
              }
              if (opt) {
                sel.value = opt.value;
                sel.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }, stateVal).catch(() => {});
        } else if (await page.locator("input[name='state']").count() > 0) {
          await page.fill("input[name='state']", stateVal).catch(() => {});
        }
        if (await page.locator("select[name='source']").count() > 0) {
          await page.selectOption("select[name='source']", "1").catch(() => {});
        }
        if (await page.locator("input[name='referredBy']").count() > 0) {
          await page.fill("input[name='referredBy']", "Direct Application").catch(() => {});
        }
        if (await page.locator("select[name='legalStatus']").count() > 0) {
          await page.selectOption("select[name='legalStatus']", "441").catch(() => {});
        }
        if (await page.locator("select[name='CUSTOM_1237']").count() > 0) {
          // US Citizen: No (1388)
          await page.selectOption("select[name='CUSTOM_1237']", "1388").catch(() => {});
        }

        // Security Clearance Multiselect popup
        const clearanceBtn = page.locator("button[aria-label='Security Clearance']").first();
        if (await clearanceBtn.count() > 0 && await clearanceBtn.isVisible()) {
          console.log("[TaleoAdapter] Setting Security Clearance: None...");
          await clearanceBtn.click();
          await page.waitForTimeout(500);
          const noneOpt = page.locator(".oracletaleocwsv2-multiselect-popup label:has-text('None')").first();
          if (await noneOpt.count() > 0) {
            await noneOpt.click();
            await page.waitForTimeout(300);
          }
          const savePopup = page.locator(".oracletaleocwsv2-multiselect-popup a.oracletaleocwsv2-close-popup-trigger:has-text('Save')").first();
          if (await savePopup.count() > 0) {
            await savePopup.click();
            await page.waitForTimeout(500);
          }
        }

        if (await page.locator("select[name='CUSTOM_1138']").count() > 0) {
          // Clearance Status: Not Applicable (1386)
          await page.selectOption("select[name='CUSTOM_1138']", "1386").catch(() => {});
        }
        if (await page.locator("textarea[name='CUSTOM_1140']").count() > 0) {
          await page.fill("textarea[name='CUSTOM_1140']", "N/A").catch(() => {});
        }
        if (await page.locator("select[name='CUSTOM_288']").count() > 0) {
          // Education: Bachelor's Degree (478)
          await page.selectOption("select[name='CUSTOM_288']", "478").catch(() => {});
        }
        if (await page.locator("input[name='CUSTOM_1238']").count() > 0) {
          const val = await page.locator("input[name='CUSTOM_1238']").inputValue();
          if (!val) await page.fill("input[name='CUSTOM_1238']", "75000").catch(() => {});
        }
        if (await page.locator("input[name='CUSTOM_1239']").count() > 0) {
          const val = await page.locator("input[name='CUSTOM_1239']").inputValue();
          if (!val) await page.fill("input[name='CUSTOM_1239']", "95000").catch(() => {});
        }

        console.log("[TaleoAdapter] Advancing from Information step...");
        await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
        await page.waitForTimeout(3000);
        continue;
      }

      // B. RESUME & QUESTIONS STEP
      if (stepInfo.isResume && !stepInfo.isReview) {
        console.log("[TaleoAdapter] On Resume and Questions step...");
        if (additionalAnswers?.resumePath && fs.existsSync(additionalAnswers.resumePath)) {
          await this.uploadResume(page, additionalAnswers.resumePath);
        }

        const resumeTextArea = page.locator("textarea[name='resumeText']").first();
        if (await resumeTextArea.count() > 0) {
          const resumeSummary = `${profile.firstName} ${profile.lastName}
Full-Stack AI Developer | ${userEmail} | ${profile.phone || "+1 202 555 0198"} | ${profile.location || "San Francisco, CA, United States"}
LinkedIn: ${profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi"} | GitHub: ${profile.githubUrl || "https://github.com/hrutinnammi"}`;
          await resumeTextArea.fill(resumeSummary);
        }

        console.log("[TaleoAdapter] Advancing from Resume step...");
        await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
        await page.waitForTimeout(3000);
        continue;
      }

      // If unknown step, try clicking next arrow
      const nextBtn = page.locator(".oracletaleocwsv2-arrow-nav-next").first();
      if (await nextBtn.count() > 0 && await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(3000);
      } else {
        break;
      }
    }
  }

  async uploadResume(page: Page, resumePath: string): Promise<void> {
    if (!fs.existsSync(resumePath)) {
      console.warn(`[TaleoAdapter] Resume path does not exist: ${resumePath}`);
      return;
    }

    const rInput = page.locator("#resumeLocalFile, input[name='resume']").first();
    if (await rInput.count() > 0) {
      console.log(`[TaleoAdapter] Uploading resume from: ${resumePath}`);
      await rInput.setInputFiles(resumePath).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  async validate(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const active = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
      const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text:not(:empty), .text-danger:not(:empty)"))
        .map(e => e.textContent?.trim())
        .filter(t => t && !t.includes("Draft saved") && !t.includes("required"));
      
      const submitBtn = document.querySelector("button[type='submit'].btn-primary");
      const title = active?.querySelector(".title")?.textContent?.trim() || "";
      const isReview = title.includes("Review") || !!document.querySelector("input[name='candESignature']");
      return isReview && errors.length === 0 && !!submitBtn;
    });
  }

  async submit(page: Page): Promise<SubmissionResult> {
    try {
      const submitBtn = page.locator("button[type='submit'].btn-primary, button:has-text('Submit')").first();
      if (await submitBtn.count() > 0) {
        console.log("[TaleoAdapter] Clicking Submit button...");
        await submitBtn.click();
        await page.waitForTimeout(5000);

        return {
          success: true,
          confirmation: "Application successfully submitted via Taleo!"
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
      errorMessage: "Submit button not found on Taleo page"
    };
  }
}
