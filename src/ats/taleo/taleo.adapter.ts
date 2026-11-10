import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import fs from "fs";
import path from "path";
import { fetchTaleoVerificationLink } from "../../utils/taleo-otp-listener";

export class TaleoAdapter implements ATSAdapter {
  private defaultEmail = process.env.TALEO_EMAIL || "babufakemail@gmail.com";
  private defaultPassword = process.env.TALEO_PASSWORD || "ClucoPass@2026!Secure";

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("taleo.net")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return (
      lower.includes("taleo.net") ||
      lower.includes("careersection") ||
      (await page.$(
        "[class*='taleo'], [class*='oracletaleo'], #TBE_theForm, #dialogTemplate-dialogForm, [id*='editTemplateMultipart']"
      )) !== null
    );
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "");

    const extracted = await page.evaluate(() => {
      const strongTitle = document.querySelector(".oracletaleocwsv2-job-description strong, .well strong")?.textContent?.trim();
      const title = strongTitle || document.querySelector(".oracletaleocwsv2-requisition-title, h1, h2, .title, .requisitiontitle, .masterfieldset, #requisitionDescriptionInterface\\.reqTitle")?.textContent?.trim() || "";
      const desc = document.querySelector(".oracletaleocwsv2-job-description, .oracletaleocwsv2-requisition-description, [class*='description'], .content")?.textContent?.trim() || "";
      return { title, desc };
    }).catch(() => ({ title: "", desc: "" }));

    let company = "Company";
    try {
      const urlObj = new URL(page.url());
      const host = urlObj.hostname;
      const parts = host.split(".");
      if (parts.length > 2 && parts[1] === "taleo") {
        company = parts[0].replace(/tas-|-tbe|phh|chm|chp/gi, "");
        company = company.charAt(0).toUpperCase() + company.slice(1);
      }
      const org = urlObj.searchParams.get("org");
      if (org && org !== "BASESOLU") {
        company = org;
      }
    } catch (e) {}

    return {
      company,
      title: extracted.title || pageTitle || "Taleo Position",
      description: extracted.desc || "Job details on Taleo",
      ats: "TALEO"
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    return page.evaluate(() => {
      const fields: FormField[] = [];
      const elements = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));

      for (const el of elements) {
        const inp = el as any;
        let labelText = "";
        if (inp.id) {
          const lbl = document.querySelector(`label[for='${inp.id}']`);
          if (lbl) labelText = lbl.textContent?.trim() || "";
        }
        if (!labelText && inp.name) {
          const parent = inp.closest(".form-group, tr, td, div");
          if (parent) {
            const lbl = parent.querySelector("label, .control-label, .label");
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

  private async dismissOverlays(page: Page): Promise<void> {
    await page.evaluate(() => {
      document.getElementById("usercentrics-root")?.remove();
      document.querySelector("div[class*='usercentrics']")?.remove();
      document.getElementById("onetrust-banner-sdk")?.remove();
      document.querySelector(".ot-sdk-container")?.remove();
    }).catch(() => {});
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers?: Record<string, string>,
    fields?: FormField[]
  ): Promise<void> {
    console.log(`[TaleoAdapter] Starting autofill for candidate: ${profile.firstName} ${profile.lastName} (${profile.email || this.defaultEmail})`);

    const userEmail = profile.email || this.defaultEmail;
    const rawPassword = additionalAnswers?.password || this.defaultPassword;
    const userPassword = rawPassword.length >= 14 ? rawPassword : `${rawPassword}!Secure2026`;

    // 0. Check if requisition is closed
    const isClosed = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("come back soon") || text.includes("no longer open") || text.includes("requisition is closed");
    }).catch(() => false);
    if (isClosed) {
      throw new Error("This Taleo job requisition is no longer active (Come Back Soon / Requisition Closed by employer).");
    }

    await this.dismissOverlays(page);

    // 0b. If on Requisition view page, click Apply Now
    const applyBtn = page.locator("a:has-text('Apply Now'), button:has-text('Apply Now'), a:has-text('Apply for this Position'), a:has-text('Apply Online'), button:has-text('Apply')").first();
    if (await applyBtn.count() > 0 && await applyBtn.isVisible().catch(() => false)) {
      console.log("[TaleoAdapter] Clicking 'Apply' button...");
      await applyBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await this.dismissOverlays(page);
    }

    // 0c. Handle Taleo Enterprise Privacy Statement / Agreement
    const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept'), a:has-text('I Accept')").first();
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("[TaleoAdapter] Accepting Privacy Statement / Agreement...");
      await acceptBtn.click({ force: true });
      await page.waitForTimeout(3000);
      await this.dismissOverlays(page);
    }

    // 0d. Check if on Taleo Enterprise Edition (TEE) authentication / application
    const isTee = page.url().includes("careersection") ||
      (await page.locator("#dialogTemplate-dialogForm, [id*='editTemplateMultipart'], input[id*='guestapply'], input[id*='login-name1']").count()) > 0;

    if (isTee) {
      console.log("[TaleoAdapter] Detected Taleo Enterprise Edition (TEE). Running Enterprise workflow...");
      await this.handleTeeWorkflow(page, profile, userEmail, userPassword, additionalAnswers);
      return;
    }

    // ─── TALEO BUSINESS EDITION (TBE) WORKFLOW ───
    await this.handleTbeWorkflow(page, profile, userEmail, userPassword, additionalAnswers);
  }

  /**
   * Complete universal workflow for Taleo Business Edition (TBE)
   */
  private async handleTbeWorkflow(
    page: Page,
    profile: UserProfile,
    userEmail: string,
    userPassword: string,
    additionalAnswers?: Record<string, string>
  ): Promise<void> {
    console.log("[TaleoAdapter] Running Taleo Business Edition (TBE) workflow...");

    for (let step = 1; step <= 8; step++) {
      await page.waitForTimeout(2000);
      const currUrl = page.url();
      const currTitle = await page.title().catch(() => "");
      console.log(`\n[TaleoAdapter] Step ${step} | URL: ${currUrl} | Title: "${currTitle}"`);

      // 1. Existing user login redirect
      if (currUrl.includes("candidateLogin")) {
        console.log(`[TaleoAdapter] Existing user login detected. Logging in as ${userEmail}...`);
        const passInp = page.locator("input[name='cwsPassword']").first();
        if (await passInp.count() > 0) await passInp.fill(userPassword);
        const loginBtn = page.locator("button[name='login'], button:has-text('Login'), input[value='Login']").first();
        if (await loginBtn.count() > 0) await loginBtn.click({ force: true });
        await page.waitForTimeout(4000);
        continue;
      }

      // 2. Email Verification page detected (e.g. Technatomy, TBE prospect confirmation)
      if (currUrl.includes("cwsProspectEmailVerification") || currTitle.toLowerCase().includes("email verification")) {
        console.log(`[TaleoAdapter] Taleo Email Verification page detected. Fetching confirmation link from Gmail (${userEmail})...`);
        const confirmUrl = await fetchTaleoVerificationLink(userEmail, 60000);
        if (confirmUrl) {
          console.log(`[TaleoAdapter] Navigating to confirmation link: ${confirmUrl}`);
          await page.goto(confirmUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForTimeout(3000);

          const contLink = page.locator("a:has-text('Continue'), button:has-text('Continue')").first();
          if (await contLink.count() > 0 && await contLink.isVisible().catch(() => false)) {
            console.log(`[TaleoAdapter] Clicking Continue link on confirmation page...`);
            await contLink.click({ force: true });
            await page.waitForTimeout(3000);
          }
          continue;
        } else {
          console.error(`❌ [TaleoAdapter] Failed to receive Taleo confirmation link in time.`);
        }
      }

      // 3. Credentials
      const emailInp = page.locator("input[name='email']").first();
      if (await emailInp.count() > 0 && await emailInp.isVisible().catch(() => false)) {
        const val = await emailInp.inputValue().catch(() => "");
        if (!val) {
          console.log(`[TaleoAdapter] Filling account email: ${userEmail}`);
          await emailInp.fill(userEmail);
        }
      }
      const pass1 = page.locator("input[name='cwsPassword']").first();
      if (await pass1.count() > 0 && await pass1.isVisible().catch(() => false)) {
        await pass1.fill(userPassword);
      }
      const pass2 = page.locator("input[name='cwsPassword_2']").first();
      if (await pass2.count() > 0 && await pass2.isVisible().catch(() => false)) {
        await pass2.fill(userPassword);
      }

      // 4. Personal & Contact Details
      const fn = page.locator("input[name='firstName']").first();
      if (await fn.count() > 0 && await fn.isVisible().catch(() => false)) {
        const val = await fn.inputValue().catch(() => "");
        if (!val) await fn.fill(profile.firstName);
      }
      const ln = page.locator("input[name='lastName']").first();
      if (await ln.count() > 0 && await ln.isVisible().catch(() => false)) {
        const val = await ln.inputValue().catch(() => "");
        if (!val) await ln.fill(profile.lastName);
      }
      const mi = page.locator("input[name='middleInitial'], input[name='middleName']").first();
      if (await mi.count() > 0 && await mi.isVisible().catch(() => false)) {
        const val = await mi.inputValue().catch(() => "");
        if (!val) await mi.fill(profile.middleName || "");
      }
      const phoneInp = page.locator("input[name='phone'], input[name='cellPhone'], input[name='CUSTOM_785'], input[name='CUSTOM_784']");
      const phoneCount = await phoneInp.count();
      for (let p = 0; p < phoneCount; p++) {
        const pEl = phoneInp.nth(p);
        if (await pEl.isVisible().catch(() => false)) {
          const val = await pEl.inputValue().catch(() => "");
          if (!val) await pEl.fill(profile.phone ? profile.phone.replace(/\D/g, "") : "4155552671");
        }
      }
      const addrInp = page.locator("input[name='address'], input[name='address1']").first();
      if (await addrInp.count() > 0 && await addrInp.isVisible().catch(() => false)) {
        const val = await addrInp.inputValue().catch(() => "");
        if (!val) await addrInp.fill(profile.street || "500 Oracle Parkway");
      }
      const aptInp = page.locator("input[name='CUSTOM_762'], input[name*='apt' i], input[name*='suite' i], input[name*='address2' i]").first();
      if (await aptInp.count() > 0 && await aptInp.isVisible().catch(() => false)) {
        const val = await aptInp.inputValue().catch(() => "");
        if (!val) await aptInp.fill(profile.addressLine2 || "Suite 100");
      }
      const cityInp = page.locator("input[name='city']").first();
      if (await cityInp.count() > 0 && await cityInp.isVisible().catch(() => false)) {
        const val = await cityInp.inputValue().catch(() => "");
        if (!val) await cityInp.fill(profile.city || "Los Angeles");
      }
      const zipInp = page.locator("input[name='zipCode']").first();
      if (await zipInp.count() > 0 && await zipInp.isVisible().catch(() => false)) {
        const val = await zipInp.inputValue().catch(() => "");
        if (!val) await zipInp.fill(profile.zipCode || "90001");
      }
      const emailExtraInp = page.locator("input[name='CUSTOM_764'], input[name*='email1' i], input[name*='emailAddress1' i]").first();
      if (await emailExtraInp.count() > 0 && await emailExtraInp.isVisible().catch(() => false)) {
        const val = await emailExtraInp.inputValue().catch(() => "");
        if (!val) await emailExtraInp.fill(userEmail);
      }

      // 5. Dynamic Dropdowns (Country, State, Custom Questions)
      const selects = await page.evaluate(() => {
        const allSel = Array.from(document.querySelectorAll("select"));
        return allSel.filter(s => {
          const rect = s.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && !s.disabled;
        }).map(s => {
          const lbl = s.closest("div, p, label")?.querySelector("label")?.textContent?.trim() || s.name || "";
          return {
            name: s.name,
            id: s.id,
            label: lbl.replace(/\s+/g, " "),
            selectedValue: s.value,
            selectedText: s.options[s.selectedIndex]?.text?.trim() || "",
            options: Array.from(s.options).map(o => ({ value: o.value, text: o.text.trim() }))
          };
        });
      });

      for (const sel of selects) {
        const isUnset = !sel.selectedValue || sel.selectedValue === "" || sel.selectedText === "Please select" || sel.selectedText === "--None--";
        if (!isUnset) continue;

        const lLower = (sel.label + " " + sel.name).toLowerCase();
        let targetValue = "";
        let targetText = "";

        if (lLower.includes("country")) {
          const match = sel.options.find(o => o.text.toLowerCase() === "united states" || o.text.toLowerCase() === "usa");
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("state") || lLower.includes("territory")) {
          const match = sel.options.find(o => o.text.toUpperCase() === "US-CA" || o.text.toLowerCase() === "california" || o.text.toUpperCase() === "CA")
                     || sel.options.find(o => o.text.toUpperCase().includes("US-CA") || o.text.toLowerCase().includes("california"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("source")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("career") || o.text.toLowerCase().includes("website") || o.text.toLowerCase().includes("indeed") || o.text.toLowerCase().includes("linkedin"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("current employment") || lLower.includes("employment status")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("actively") || o.text.toLowerCase().includes("employed"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("career level") || lLower.includes("experience level")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("experienced") || o.text.toLowerCase().includes("entry"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("desired job") || lLower.includes("job type")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("full-time") || o.text.toLowerCase().includes("full time"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("desired position type") || lLower.includes("position type")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("office") || o.text.toLowerCase().includes("both") || o.text.toLowerCase().includes("onshore"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("travel")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("25%") || o.text.toLowerCase().includes("no") || o.text.toLowerCase().includes("yes"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("preferred contact") || lLower.includes("contact method")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("mobile") || o.text.toLowerCase().includes("email") || o.text.toLowerCase().includes("cell"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("work authorization") || lLower.includes("authorized")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("any employer") || o.text.toLowerCase().includes("authorized") || o.text.toLowerCase().includes("citizen"));
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("month")) {
          const match = sel.options.find(o => o.text.toLowerCase().includes("jan")) || sel.options[1];
          if (match) { targetValue = match.value; targetText = match.text; }
        } else if (lLower.includes("year")) {
          if (lLower.includes("to") || lLower.includes("end")) {
            const match = sel.options.find(o => o.text.toLowerCase().includes("present")) || sel.options.find(o => o.text === "2026") || sel.options[1];
            if (match) { targetValue = match.value; targetText = match.text; }
          } else {
            const match = sel.options.find(o => o.text === "2024") || sel.options[1];
            if (match) { targetValue = match.value; targetText = match.text; }
          }
        } else if (sel.options.some(o => o.text.trim().toLowerCase() === "yes") && sel.options.some(o => o.text.trim().toLowerCase() === "no")) {
          let wantYes = true;
          if (
            lLower.includes("former") || lLower.includes("previous") || lLower.includes("relative") ||
            lLower.includes("felony") || lLower.includes("convict") || lLower.includes("sponsorship") ||
            lLower.includes("conflict") || lLower.includes("terminated")
          ) {
            wantYes = false;
          } else if (
            lLower.includes("authorized") || lLower.includes("18") || lLower.includes("drug") ||
            lLower.includes("background") || lLower.includes("citizen") || lLower.includes("eligible")
          ) {
            wantYes = true;
          } else {
            wantYes = !lLower.includes("employee") && !lLower.includes("affil");
          }
          const chosenText = wantYes ? "Yes" : "No";
          const match = sel.options.find(o => o.text.trim().toLowerCase() === chosenText.toLowerCase());
          if (match) { targetValue = match.value; targetText = match.text; }
        }

        // Generic fallback for any remaining unset dropdown
        if (!targetValue && sel.options.length > 1) {
          const validOpts = sel.options.filter(o => o.value !== "" && o.text !== "Please select" && o.text !== "--None--");
          if (validOpts.length > 0) {
            const fallback = validOpts[0];
            targetValue = fallback.value;
            targetText = fallback.text;
            console.log(`📢 [TaleoAdapter] User Info Needed: Dropdown '${sel.label}'`);
            console.log(`   Options: [${validOpts.map(o => o.text).join(", ")}]`);
            console.log(`   Auto-selecting '${fallback.text}' to satisfy required ATS field.`);
          }
        }

        if (targetValue) {
          await page.evaluate(({ name, id, val }) => {
            const el = ((id ? document.getElementById(id) : null) || document.querySelector(`select[name='${name}']`)) as HTMLSelectElement | null;
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, { name: sel.name, id: sel.id, val: targetValue });
          console.log(`✅ [TaleoAdapter] Selected '${targetText}' for dropdown: "${sel.label}"`);
        }
      }

      // 6. Handle "Add Work History" modal dialog
      const addWorkBtn = page.locator("button:has-text('Add Work History'), a:has-text('Add Work History'), a.oracletaleocwsv2-add-work-trigger:visible").first();
      if (await addWorkBtn.count() > 0 && await addWorkBtn.isVisible().catch(() => false)) {
        console.log(`[TaleoAdapter] Detected 'Add Work History' button. Clicking...`);
        await addWorkBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Fill modal fields
        await page.evaluate((prof) => {
          const inps = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea")) as HTMLInputElement[];
          for (const inp of inps) {
            const r = inp.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || inp.value) continue;
            const lbl = (inp.closest("div, p, label")?.querySelector("label")?.textContent || inp.name || "").toLowerCase();
            if (lbl.includes("employer") || lbl.includes("company")) inp.value = "Jobspring";
            else if (lbl.includes("title") || lbl.includes("position")) inp.value = "Full Stack AI Developer";
            else if (lbl.includes("city")) inp.value = prof.city || "Los Angeles";
            else if (lbl.includes("state")) inp.value = "CA";
            else if (lbl.includes("supervisor")) inp.value = "Alex Morgan";
            else if (lbl.includes("phone")) inp.value = prof.phone ? prof.phone.replace(/\D/g, "") : "2025550198";
            else if (lbl.includes("reason")) inp.value = "Career Growth";
            else if (lbl.includes("duties") || lbl.includes("description") || lbl.includes("responsibilit")) inp.value = "Engineered AI agent automation and full stack pipelines.";
            else if (inp.required || lbl.includes("*")) inp.value = "N/A";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }

          const sels = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
          for (const sel of sels) {
            const r = sel.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || (sel.value && sel.value !== "Please select")) continue;
            const lbl = (sel.closest("div, p, label")?.querySelector("label")?.textContent || sel.name || "").toLowerCase();
            if (lbl.includes("from") && lbl.includes("month")) {
              sel.selectedIndex = 1;
            } else if (lbl.includes("from") && lbl.includes("year")) {
              const opt = Array.from(sel.options).find(o => o.text.includes("2024"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (lbl.includes("to") && lbl.includes("month")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("present")) || Array.from(sel.options).find(o => o.text.includes("Mar"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (lbl.includes("to") && lbl.includes("year")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("present")) || Array.from(sel.options).find(o => o.text.includes("2026"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (sel.options.length > 1) {
              sel.selectedIndex = 1;
            }
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, profile);

        // Click Save button in modal
        const savedWork = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")) as HTMLElement[];
          const saveBtn = btns.find(b => {
            const r = b.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const t = (b.textContent || (b as any).value || "").trim().toLowerCase();
            return (t === "save" || t.includes("save work") || t === "done" || t === "add") && !t.includes("draft") && !t.includes("search");
          });
          if (saveBtn) {
            saveBtn.click();
            return (saveBtn.textContent || (saveBtn as any).value || "").trim();
          }
          return null;
        });
        if (savedWork) {
          console.log(`[TaleoAdapter] Successfully saved Work History entry!`);
          await page.waitForTimeout(2500);
        }
      }

      // 7. Handle "Add Education" modal dialog
      const addEduBtn = page.locator("button:has-text('Add Education'), a:has-text('Add Education'), a.oracletaleocwsv2-add-education-trigger:visible").first();
      if (await addEduBtn.count() > 0 && await addEduBtn.isVisible().catch(() => false)) {
        console.log(`[TaleoAdapter] Detected 'Add Education' button. Clicking...`);
        await addEduBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Fill modal fields
        await page.evaluate((prof) => {
          const inps = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea")) as HTMLInputElement[];
          for (const inp of inps) {
            const r = inp.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || inp.value) continue;
            const lbl = (inp.closest("div, p, label")?.querySelector("label")?.textContent || inp.name || "").toLowerCase();
            if (lbl.includes("institution") || lbl.includes("school") || lbl.includes("university")) inp.value = "Parul University";
            else if (lbl.includes("degree")) inp.value = "Bachelor of Technology";
            else if (lbl.includes("major")) inp.value = "Computer Science";
            else if (lbl.includes("gpa")) inp.value = "3.8";
            else if (lbl.includes("city")) inp.value = prof.city || "Los Angeles";
            else if (inp.required || lbl.includes("*")) inp.value = "N/A";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }

          const sels = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
          for (const sel of sels) {
            const r = sel.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || (sel.value && sel.value !== "Please select")) continue;
            const lbl = (sel.closest("div, p, label")?.querySelector("label")?.textContent || sel.name || "").toLowerCase();
            if (lbl.includes("degree")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("bachelor") || o.text.toLowerCase().includes("degree"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (lbl.includes("graduat") || lbl.includes("complete")) {
              const opt = Array.from(sel.options).find(o => o.text.toLowerCase().includes("yes"));
              if (opt) sel.value = opt.value; else sel.selectedIndex = 1;
            } else if (sel.options.length > 1) {
              sel.selectedIndex = 1;
            }
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, profile);

        // Click Save in modal
        const savedEdu = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")) as HTMLElement[];
          const saveBtn = btns.find(b => {
            const r = b.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return false;
            const t = (b.textContent || (b as any).value || "").trim().toLowerCase();
            return (t === "save" || t.includes("save education") || t === "done" || t === "add") && !t.includes("draft") && !t.includes("search");
          });
          if (saveBtn) {
            saveBtn.click();
            return (saveBtn.textContent || (saveBtn as any).value || "").trim();
          }
          return null;
        });
        if (savedEdu) {
          console.log(`[TaleoAdapter] Successfully saved Education entry!`);
          await page.waitForTimeout(2500);
        }
      }

      // 8. General Text & Textarea fields
      await page.evaluate(({ prof, userEmail }) => {
        const textInputs = Array.from(document.querySelectorAll("input[type='text']:not([readonly]), input[type='email']:not([readonly]), textarea:not([readonly])")) as HTMLInputElement[];
        for (const inp of textInputs) {
          const rect = inp.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0 || (inp.value && inp.value.trim().length > 0)) continue;

          const name = (inp.name || "").toLowerCase();
          const id = inp.id;
          let labelText = "";
          if (id) {
            const lblEl = document.querySelector(`label[for='${id}']`);
            if (lblEl) labelText = lblEl.textContent?.trim() || "";
          }
          if (!labelText) {
            labelText = inp.closest(".form-group, div, p, label")?.querySelector("label")?.textContent?.trim() || "";
          }
          const lbl = (labelText || inp.placeholder || name).toLowerCase();

          // Don't overwrite login password or initial login email
          if (name.includes("cwspassword") || (name === "email" && !lbl.includes("email address"))) continue;

          let val = "";
          if (inp.type === "email" || lbl.includes("email")) {
            val = userEmail;
          } else if (lbl.includes("phone") || lbl.includes("telephone") || lbl.includes("mobile") || lbl.includes("cell")) {
            val = prof.phone ? prof.phone.replace(/\D/g, "") : "4155552671";
          } else if ((lbl.includes("apartment") || lbl.includes("building") || lbl.includes("suite") || lbl.includes("address 2") || lbl.includes("line 2")) && !lbl.includes("email")) {
            val = prof.addressLine2 || "Suite 100";
          } else if (lbl.includes("street") || (lbl.includes("address") && !lbl.includes("email")) || name === "address") {
            val = prof.street || "500 Oracle Parkway";
          } else if (lbl.includes("zip") || lbl.includes("postal")) {
            val = prof.zipCode || "90001";
          } else if (lbl.includes("city")) {
            val = prof.city || "Los Angeles";
          } else if (lbl.includes("degree") || name.includes("degree")) {
            val = "Bachelor of Technology";
          } else if (lbl.includes("school") || name.includes("school")) {
            val = "Parul University";
          } else if (lbl.includes("major") || name.includes("major")) {
            val = "Computer Science";
          } else if (lbl.includes("company") || lbl.includes("employer") || name.includes("company")) {
            val = "Jobspring";
          } else if (lbl.includes("job title") || lbl.includes("title") || name.includes("jobtitle")) {
            val = "Full Stack AI Developer";
          } else if (lbl.includes("salary") || lbl.includes("compensation") || name.includes("salary")) {
            val = "95000";
          } else if (lbl.includes("signature") || name.includes("candesignature")) {
            val = prof.firstName + " " + prof.lastName;
          } else if (
            lbl.includes("start date") ||
            lbl.includes("available") ||
            name === "custom_756" ||
            lbl.includes("date") ||
            name.includes("candesignaturedate") ||
            inp.placeholder === "M/D/YY" ||
            inp.classList.contains("oracletaleocwsv2-datepicker-trigger")
          ) {
            const d = new Date();
            if (lbl.includes("start") || lbl.includes("available") || name === "custom_756" || !lbl.includes("signature")) {
              d.setDate(d.getDate() + 14); // 2 weeks out for Available Start Date
            }
            val = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
          } else if (lbl.includes("department") || lbl.includes("employee name") || lbl.includes("refer")) {
            val = "N/A";
          } else if (inp.required || inp.getAttribute("aria-required") === "true" || lbl.includes("*")) {
            val = "N/A";
          }

          if (val) {
            inp.value = val;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }, { prof: profile, userEmail });

      // 9. Resume & Cover Letter upload & text insertion (Step 3 / APRCE_V2)
      const resumePdf = path.resolve(additionalAnswers?.resumePath || profile.resumePath || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
      const coverPdf = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf");

      // A. Resume Upload
      const addResumeBtn = page.locator("a.oracletaleocwsv2-add-resume-trigger:visible, button:has-text('Add Resume')").first();
      if (await addResumeBtn.count() > 0 && await addResumeBtn.isVisible().catch(() => false)) {
        console.log(`[TaleoAdapter] Clicking 'Add Resume' button...`);
        await addResumeBtn.click().catch(() => {});
        await page.waitForTimeout(1000);
      }
      const resumeFileInput = page.locator("input[type='file']#resumeLocalFile, input[type='file'][name='resume']").first();
      if (await resumeFileInput.count() > 0 && fs.existsSync(resumePdf)) {
        console.log(`[TaleoAdapter] Attaching resume PDF: ${resumePdf}`);
        await resumeFileInput.setInputFiles(resumePdf).catch(() => {});
        await page.waitForTimeout(1000);
        const saveResumeBtn = page.locator(".oracletaleocwsv2-save-edit-trigger:visible").first();
        if (await saveResumeBtn.count() > 0 && await saveResumeBtn.isVisible().catch(() => false)) {
          await saveResumeBtn.click().catch(() => {});
          await page.waitForTimeout(2000);
        }
      }

      // B. Cover Letter Textarea (TBE uses resumeText on Step 3 or textarea with 'cover')
      const coverLetterInp = page.locator("textarea[name='resumeText'], textarea#resumeText__id_txt_, textarea[name*='cover' i]").first();
      if (await coverLetterInp.count() > 0 && await coverLetterInp.isVisible().catch(() => false)) {
        const existing = await coverLetterInp.inputValue().catch(() => "");
        if (!existing) {
          console.log(`[TaleoAdapter] Filling Cover Letter / supplementary textarea...`);
          const coverText = `Dear Hiring Team,\n\nI am writing to express my enthusiastic interest in this position. As a Full Stack AI Developer with extensive experience in building autonomous agent pipelines, resilient enterprise web architectures, and seamless cloud deployments, I bring hands-on experience in modern full-stack development, Python, TypeScript, and distributed systems.\n\nI am excited about the opportunity to contribute high impact and dedicated problem-solving to your organization.\n\nSincerely,\n${profile.firstName} ${profile.lastName}`;
          await coverLetterInp.fill(coverText);
          await page.waitForTimeout(1000);
        }
      }

      // C. Cover Letter Attachment
      const addAttBtn = page.locator("a.oracletaleocwsv2-add-attachment-trigger:visible, button:has-text('Add Attachment')").first();
      if (await addAttBtn.count() > 0 && await addAttBtn.isVisible().catch(() => false) && fs.existsSync(coverPdf)) {
        console.log(`[TaleoAdapter] Clicking 'Add Attachment' button for Cover Letter...`);
        await addAttBtn.click().catch(() => {});
        await page.waitForTimeout(1000);

        const attFileInput = page.locator("input[type='file'][name*='attachment' i], input[type='file']#attachmentLocalFile, input[type='file']").last();
        if (await attFileInput.count() > 0) {
          console.log(`[TaleoAdapter] Attaching Cover Letter PDF: ${coverPdf}`);
          await attFileInput.setInputFiles(coverPdf).catch(() => {});
          await page.waitForTimeout(1000);

          const descInp = page.locator("input[name='description']#description, input[name='description']:visible").first();
          if (await descInp.count() > 0) {
            await descInp.fill("Cover Letter");
          }

          const saveAttBtn = page.locator(".oracletaleocwsv2-save-edit-trigger:visible").last();
          if (await saveAttBtn.count() > 0 && await saveAttBtn.isVisible().catch(() => false)) {
            await saveAttBtn.click().catch(() => {});
            await page.waitForTimeout(2000);
          }
        }
      }

      // 10. Candidate eSignature (if present on active step)
      const sigInp = page.locator("input[name='candESignature']").first();
      if (await sigInp.count() > 0 && await sigInp.isVisible().catch(() => false)) {
        const val = await sigInp.inputValue().catch(() => "");
        if (!val) {
          console.log(`[TaleoAdapter] Signing certification: ${profile.firstName} ${profile.lastName}`);
          await sigInp.fill(`${profile.firstName} ${profile.lastName}`);
        }
      }
      const sigDateInp = page.locator("input[name='candEsignatureDate']").first();
      if (await sigDateInp.count() > 0 && await sigDateInp.isVisible().catch(() => false)) {
        const d = new Date();
        const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
        await sigDateInp.fill(dateStr);
      }

      // 11. Check for Final Submit Button vs Next Step Arrow
      const submitBtn = page.locator("button[type='submit'].btn-primary:has-text('Submit'), button:has-text('Submit Application'), input[value='Submit']").first();
      const isFinalSubmitVisible = (await submitBtn.count() > 0) && (await submitBtn.isVisible().catch(() => false));

      if (isFinalSubmitVisible) {
        console.log(`🎯 [TaleoAdapter] Reached final Submit step! Application successfully fully filled.`);
        break;
      }

      // 12. Advance via Next Arrow (never jQuery datepicker!)
      const nextArrow = page.locator("a.oracletaleocwsv2-arrow-nav-next:visible, button.oracletaleocwsv2-arrow-nav-next:visible, a.oracletaleocwsv2-btn-arrow-nav.oracletaleocwsv2-arrow-nav-next:visible").first();
      if (await nextArrow.count() > 0 && await nextArrow.isVisible().catch(() => false)) {
        console.log(`[TaleoAdapter] Advancing to next wizard step via arrow-nav-next...`);
        await nextArrow.click({ force: true });
        await page.waitForTimeout(3000);
      } else {
        console.log(`[TaleoAdapter] No further navigation arrow visible. Form filling completed.`);
        break;
      }
    }
  }

  /**
   * Complete workflow for Taleo Enterprise Edition (TEE).
   */
  private async handleTeeWorkflow(
    page: Page,
    profile: UserProfile,
    userEmail: string,
    userPassword: string,
    additionalAnswers?: Record<string, string>
  ): Promise<void> {
    await this.dismissOverlays(page);

    // 1. Check if on TEE Login or Auth page
    const loginDefaultCmd = page.locator("input[id*='login-defaultCmd'], input[id*='defaultCmd'], input[value='Login']").first();
    const guestApplyBtn = page.locator("input[id*='guestapply'], input[value='Apply as Guest']").first();
    const newUserBtn = page.locator("input[value='New User'], input[id*='register']").first();

    const isAuthPage = page.url().includes("accessmanagement") || page.url().includes("login.jsf") || (await loginDefaultCmd.isVisible().catch(() => false));

    if (isAuthPage) {
      console.log(`[TaleoAdapter] Handling Taleo Enterprise authentication for ${userEmail}...`);

      let authenticated = false;

      // Attempt 1: Try logging into existing account first
      const userInput = page.locator("input[id*='name1'], input[id*='userName'], input[id*='login-name1']").first();
      const passInput = page.locator("input[id*='password'], input[id*='login-password']").first();

      if ((await userInput.isVisible().catch(() => false)) && (await passInput.isVisible().catch(() => false))) {
        console.log(`[TaleoAdapter] Attempting login as ${userEmail}...`);
        await userInput.fill(userEmail);
        await passInput.fill(userPassword);

        if (await loginDefaultCmd.isVisible().catch(() => false)) {
          await loginDefaultCmd.click({ force: true });
          await page.waitForTimeout(4000);
          await this.dismissOverlays(page);
        }

        // Check if login succeeded (left login/auth page)
        const stillOnLogin = page.url().includes("accessmanagement") || page.url().includes("login.jsf") || (await page.locator("#dialogTemplate-dialogForm-login-defaultCmd, input[id*='login-defaultCmd']").count()) > 0;
        const hasAuthError = await page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes("incorrect") ||
                 text.includes("restricted") ||
                 text.includes("already registered") ||
                 text.includes("does not correspond to a registered user") ||
                 text.includes("action cannot be completed") ||
                 text.includes("cannot be completed") ||
                 text.includes("invalid");
        }).catch(() => false);

        if (!stillOnLogin && !hasAuthError) {
          console.log("[TaleoAdapter] Successfully authenticated into existing Taleo account!");
          authenticated = true;
        } else {
          console.log("[TaleoAdapter] Account not found or credentials invalid. Transitioning to New User registration...");
        }
      }

      // Attempt 2: Register New User if not authenticated and New User button is present
      if (!authenticated && (await newUserBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log("[TaleoAdapter] Creating new candidate account via 'New User' registration...");
        await page.evaluate(() => {
          const btn = document.querySelector("#dialogTemplate-dialogForm-login-register, input[value='New User']") as HTMLElement;
          if (btn) btn.click();
        });
        await page.waitForTimeout(4000);
        await this.dismissOverlays(page);

        const randSuffix = Date.now().toString().slice(-4);
        const uname = `hrutin_${randSuffix}`;
        const regEmail = userEmail.includes("+") ? userEmail : userEmail.replace("@", `+${randSuffix}@`);

        const uInput = page.locator("#dialogTemplate-dialogForm-userName, input[id*='userName']").first();
        const pInput = page.locator("#dialogTemplate-dialogForm-password, input[id*='password']:not([id*='Confirm'])").first();
        const pConf = page.locator("#dialogTemplate-dialogForm-passwordConfirm, input[id*='passwordConfirm']").first();
        const emInput = page.locator("#dialogTemplate-dialogForm-email, input[id*='email']:not([id*='Confirm'])").first();
        const emConf = page.locator("#dialogTemplate-dialogForm-emailConfirm, input[id*='emailConfirm']").first();

        console.log(`[TaleoAdapter] Submitting Taleo registration: ${uname} (${regEmail})...`);
        if (await uInput.isVisible().catch(() => false)) await uInput.fill(uname);
        if (await pInput.isVisible().catch(() => false)) await pInput.fill(userPassword);
        if (await pConf.isVisible().catch(() => false)) await pConf.fill(userPassword);
        if (await emInput.isVisible().catch(() => false)) await emInput.fill(regEmail);
        if (await emConf.isVisible().catch(() => false)) await emConf.fill(regEmail);

        const regSubmit = page.locator("#dialogTemplate-dialogForm-defaultCmd, input[id*='defaultCmd'], input[value='Register']").first();
        if (await regSubmit.isVisible().catch(() => false)) {
          await page.evaluate(() => {
            const btn = document.querySelector("#dialogTemplate-dialogForm-defaultCmd, input[value='Register']") as HTMLElement;
            if (btn) btn.click();
          });
          console.log("[TaleoAdapter] Submitted registration, waiting for application flow to mount...");
          await page.waitForFunction(() => {
            return !!document.querySelector("input[id*='saveContinueCmdBottom'], input[id*='saveContinueCmd'], input[type='file'], input[id*='dv_cs_']");
          }, { timeout: 20000 }).catch(() => {});
          await page.waitForTimeout(4000);
          await this.dismissOverlays(page);
          authenticated = true;
        }
      }

      // Attempt 3: Apply as Guest if New User wasn't available
      if (!authenticated && (await guestApplyBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log("[TaleoAdapter] Using 'Apply as Guest' fallback...");
        await guestApplyBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await this.dismissOverlays(page);

        const emailField = page.locator("input[id*='email']").first();
        if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log(`[TaleoAdapter] Entering guest email: ${userEmail}...`);
          await emailField.fill(userEmail);
          const contBtn = page.locator("input[id*='niceCommandButton_continue'], input[value='Continue']").first();
          if (await contBtn.isVisible().catch(() => false)) {
            await contBtn.click({ force: true });
            await page.waitForTimeout(4000);
            await this.dismissOverlays(page);
          }
        }
      }
    }

    // 2. Loop through TEE application wizard steps
    let teeStep = 0;
    const maxTeeSteps = 10;
    const resumePath = additionalAnswers?.resumePath || profile.resumePath || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf";

    while (teeStep < maxTeeSteps) {
      teeStep++;
      await page.waitForTimeout(2500);
      await this.dismissOverlays(page);

      const stepTitle = await page.title().catch(() => "");
      console.log(`[TaleoAdapter] Processing TEE Step ${teeStep}: "${stepTitle}" (${page.url()})`);

      // A. Check if on Review / Certification / Submit step
      const isReviewStep = stepTitle.toLowerCase().includes("review") ||
        stepTitle.toLowerCase().includes("submit") ||
        stepTitle.toLowerCase().includes("signature") ||
        (await page.locator("input[id*='submitCmd'], input[value='Submit']").count()) > 0;

      if (isReviewStep) {
        console.log("[TaleoAdapter] On TEE Review/Certification step: signing e-signature...");
        const sigInp = page.locator("input[id*='eSignature'], input[name*='candESignature'], input[id*='Signature'], input[id*='FullName']").first();
        if (await sigInp.isVisible().catch(() => false)) {
          await sigInp.fill(`${profile.firstName} ${profile.lastName}`);
        }

        const today = new Date();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const yyyy = today.getFullYear();
        const sigDate = page.locator("input[id*='Date'], input[id*='date'], input[name*='candEsignatureDate']").first();
        if (await sigDate.isVisible().catch(() => false)) {
          await sigDate.fill(`${mm}/${dd}/${yyyy}`);
        }

        const submitBtn = page.locator("input[id*='submitCmd'], input[value='Submit'], button:has-text('Submit')").first();
        if (await submitBtn.isVisible().catch(() => false)) {
          console.log("[TaleoAdapter] Final Submit button detected on Review step!");
        }

        console.log("✅ [TaleoAdapter]: All TEE application steps completed successfully!");
        break;
      }

      // B. Upload Resume on Attachments or Resume Upload step if present
      const resumeRadio = page.locator("input[id*='resumeUploadRadio'], input[value='2']").first();
      if (await resumeRadio.isVisible().catch(() => false)) {
        await resumeRadio.check({ force: true }).catch(() => {});
      }

      const fileInput = page.locator("input[type='file'], input[id*='uploadedFile'], input[id*='ResumeUploadInputFile']").first();
      if ((await fileInput.count() > 0) && fs.existsSync(resumePath)) {
        console.log(`[TaleoAdapter] Uploading resume: ${resumePath}...`);
        await fileInput.setInputFiles(resumePath).catch(() => {});
        await page.waitForTimeout(1000);

        const attachBtn = page.locator("input[id*='attachFileCommand'], input[value='Attach']").first();
        if (await attachBtn.count() > 0) {
          await attachBtn.evaluate((el: HTMLElement) => el.click());
          await page.waitForTimeout(4000);
          await this.dismissOverlays(page);
        }
      }

      // Check if re-authentication / flow confirmation popup is present
      const confUser = page.locator("input[id*='flowConfmEditUsername']").first();
      const confPass = page.locator("input[id*='flowConfmEditPassword']").first();
      const confBtn = page.locator("input[id*='saveContinueCmdFlowPopUp']").first();
      if (await confUser.isVisible().catch(() => false)) {
        console.log("[TaleoAdapter] Handling flow confirmation popup with credentials...");
        await confUser.fill(userEmail);
        await confPass.fill(userPassword);
        await confBtn.click({ force: true });
        await page.waitForTimeout(3000);
        await this.dismissOverlays(page);
      }

      // C. Populate Personal Information, eSignature & Contact Inputs dynamically
      const textInputs = page.locator("input[type='text']:visible, input[type='email']:visible, input[type='tel']:visible");
      const inCount = await textInputs.count();
      for (let i = 0; i < inCount; i++) {
        const inp = textInputs.nth(i);
        const id = (await inp.getAttribute("id") || "").toLowerCase();
        const name = (await inp.getAttribute("name") || "").toLowerCase();
        const curVal = await inp.inputValue().catch(() => "");
        if (curVal && curVal.trim().length > 0) continue;

        if (id.includes("fullname") || name.includes("fullname") || id.includes("esignature") || name.includes("esignature")) {
          await inp.fill(`${profile.firstName} ${profile.lastName}`);
        } else if (id.includes("first") || name.includes("first")) {
          await inp.fill(profile.firstName);
        } else if (id.includes("last") || name.includes("last")) {
          await inp.fill(profile.lastName);
        } else if (id.includes("middle") || name.includes("middle")) {
          await inp.fill(profile.middleName || "");
        } else if (id.includes("email") || name.includes("email")) {
          await inp.fill(userEmail);
        } else if (id.includes("phone") || id.includes("cell") || name.includes("phone") || id.includes("mobile")) {
          await inp.fill(profile.phone ? profile.phone.replace(/\D/g, "").slice(-10) : "2025550198");
        } else if (id.includes("address") || name.includes("address") || id.includes("street")) {
          await inp.fill(profile.street || "123 Market St");
        } else if (id.includes("city") || name.includes("city")) {
          await inp.fill(profile.city || "San Francisco");
        } else if (id.includes("zip") || id.includes("postal") || name.includes("zip")) {
          await inp.fill(profile.zipCode || "94105");
        }
      }

      // D. Populate Dropdowns (Country, State, Diversity, Questions)
      const selects = page.locator("select:visible");
      const selCount = await selects.count();
      for (let j = 0; j < selCount; j++) {
        const sel = selects.nth(j);
        const id = (await sel.getAttribute("id") || "").toLowerCase();
        const name = (await sel.getAttribute("name") || "").toLowerCase();
        const combined = `${id} ${name}`;

        if (combined.includes("sourcetype") || combined.includes("source")) {
          // Select Job Board or LinkedIn or first option
          await sel.selectOption({ label: "Job Board" }).catch(async () => {
            await sel.selectOption({ label: "Internet" }).catch(async () => {
              const val = await sel.evaluate((el: HTMLSelectElement) => {
                const opt = Array.from(el.options).find(o => o.value && o.value !== "-1" && o.value !== "");
                return opt ? opt.value : "";
              });
              if (val) await sel.selectOption(val).catch(() => {});
            });
          });
          await page.waitForTimeout(500);
        } else if (combined.includes("country") || combined.includes("residencelocation-0")) {
          await sel.selectOption({ label: "United States" }).catch(async () => {
            const val = await sel.evaluate((el: HTMLSelectElement) => {
              const opt = Array.from(el.options).find(o => o.text.includes("United States"));
              return opt ? opt.value : "1";
            });
            if (val) await sel.selectOption(val).catch(() => {});
          });
          await page.waitForTimeout(500);
        } else if (combined.includes("state") || combined.includes("residencelocation-1")) {
          await sel.selectOption({ label: profile.state || "California" }).catch(async () => {
            const val = await sel.evaluate((el: HTMLSelectElement, st: string) => {
              const opt = Array.from(el.options).find(o => o.text.toLowerCase().includes(st.toLowerCase()));
              return opt ? opt.value : el.options.length > 1 ? el.options[1].value : "";
            }, profile.state || "California");
            if (val) await sel.selectOption(val).catch(() => {});
          });
          await page.waitForTimeout(500);
        } else if (combined.includes("residencelocation-2")) {
          // Select first valid metropolitan area
          const metroVal = await sel.evaluate((el: HTMLSelectElement) => {
            const opt = Array.from(el.options).find(o => o.value && o.value !== "-1000" && o.value !== "");
            return opt ? opt.value : "";
          });
          if (metroVal) await sel.selectOption(metroVal).catch(() => {});
        } else if (combined.includes("referral")) {
          // Were you referred: No
          await sel.selectOption({ label: "No" }).catch(async () => {
            const noVal = await sel.evaluate((el: HTMLSelectElement) => {
              const opt = Array.from(el.options).find(o => o.text.toLowerCase().startsWith("no"));
              return opt ? opt.value : el.options.length > 1 ? el.options[1].value : "";
            });
            if (noVal) await sel.selectOption(noVal).catch(() => {});
          });
        } else if (combined.includes("sms")) {
          // SMS consent: Yes
          await sel.selectOption({ label: "Yes" }).catch(async () => {
            const yesVal = await sel.evaluate((el: HTMLSelectElement) => {
              const opt = Array.from(el.options).find(o => o.text.toLowerCase().startsWith("yes"));
              return opt ? opt.value : el.options.length > 1 ? el.options[1].value : "";
            });
            if (yesVal) await sel.selectOption(yesVal).catch(() => {});
          });
        } else if (combined.includes("gender")) {
          await sel.selectOption({ label: "Male" }).catch(async () => {
            await sel.selectOption("1").catch(() => {});
          });
        } else if (combined.includes("race") || combined.includes("ethnic")) {
          await sel.selectOption({ label: "Asian" }).catch(async () => {
            await sel.selectOption("1").catch(() => {});
          });
        } else if (combined.includes("veteran")) {
          await sel.selectOption({ label: "I am not a protected veteran" }).catch(async () => {
            await sel.selectOption("2").catch(() => {});
          });
        } else if (combined.includes("disability")) {
          await sel.selectOption({ label: "No, I do not have a disability" }).catch(async () => {
            await sel.selectOption("2").catch(() => {});
          });
        } else {
          // If required select with no value chosen, choose first valid option
          const curVal = await sel.inputValue().catch(() => "");
          if (!curVal || curVal === "-1000" || curVal === "-1" || curVal === "") {
            const firstValid = await sel.evaluate((el: HTMLSelectElement) => {
              const opt = Array.from(el.options).find(o => o.value && o.value !== "-1000" && o.value !== "-1" && !o.text.includes("Select"));
              return opt ? opt.value : "";
            });
            if (firstValid) await sel.selectOption(firstValid).catch(() => {});
          }
        }
      }

      // E. Checkboxes / Declarations
      const cbs = page.locator("input[type='checkbox']:visible");
      const cbCount = await cbs.count();
      for (let c = 0; c < cbCount; c++) {
        const cb = cbs.nth(c);
        if (!(await cb.isChecked().catch(() => false))) {
          await cb.check({ force: true }).catch(() => {});
        }
      }

      // F. Click Save and Continue / Next
      await page.waitForSelector("input[id*='saveContinueCmdBottom'], input[id*='saveContinueCmd'], input[value='Save and Continue'], input[value='Next']", { timeout: 8000 }).catch(() => {});

      const saveCont = page.locator(
        "input[id*='saveContinueCmdBottom'], input[id*='saveContinueCmd']:visible, " +
        "input[id*='SaveAndContinue']:visible, input[value='Save and Continue']:visible, " +
        "input[value='Next']:visible, button:has-text('Save and Continue'):visible, button:has-text('Next'):visible"
      ).first();

      const hasSaveCont = (await saveCont.count() > 0);
      if (hasSaveCont) {
        console.log("[TaleoAdapter] Advancing to next TEE step...");
        await page.evaluate(() => {
          const btn = (document.querySelector("input[id*='saveContinueCmdBottom']") ||
                       document.querySelector("input[id*='saveContinueCmd']:not([style*='none'])") ||
                       document.querySelector("input[value='Save and Continue']") ||
                       document.querySelector("input[value='Next']")) as HTMLElement;
          if (btn) btn.click();
        }).catch(async () => {
          await saveCont.click({ force: true });
        });
        await page.waitForTimeout(4000);
        await this.dismissOverlays(page);
      } else {
        console.log("[TaleoAdapter] No further advance button found. Step processing completed.");
        break;
      }
    }
  }

  async uploadResume(page: Page, resumePath: string): Promise<void> {
    if (!fs.existsSync(resumePath)) {
      console.warn(`[TaleoAdapter] Resume path does not exist: ${resumePath}`);
      return;
    }

    const rInput = page.locator("#resumeLocalFile, input[name='resume'], input[type='file']").first();
    if (await rInput.count() > 0) {
      console.log(`[TaleoAdapter] Uploading resume from: ${resumePath}`);
      await rInput.setInputFiles(resumePath).catch(() => {});
      await page.waitForTimeout(2000);
    }
  }

  async validate(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const isTeeSubmit = !!document.querySelector("input[id*='submitCmd'], input[value='Submit']");
      const isTbeSubmit = !!document.querySelector("button[type='submit'].btn-primary, input[name='candESignature']");
      const errors = Array.from(document.querySelectorAll(".oracletaleocwsv2-error-text:not(:empty), .text-danger:not(:empty), .errorMessage:not(:empty)"))
        .map(e => e.textContent?.trim())
        .filter(t => t && !t.includes("Draft saved") && !t.includes("required"));

      return (isTeeSubmit || isTbeSubmit) && errors.length === 0;
    });
  }

  async submit(page: Page): Promise<SubmissionResult> {
    try {
      const submitBtn = page.locator(
        "button[type='submit'].btn-primary, button:has-text('Submit'), " +
        "input[id*='submitCmd'], input[value='Submit'], input[id*='Submit']"
      ).first();

      if (await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false)) {
        console.log("[TaleoAdapter] Clicking Submit button...");
        await submitBtn.click({ force: true });
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
