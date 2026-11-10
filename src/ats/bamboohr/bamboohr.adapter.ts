import { Page, Locator } from "playwright";
import fs from "fs";
import path from "path";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { generateAnswerForQuestion, suggestAnswerForQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { resolveLocalResumePath } from "../../utils/path-resolver";

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
  await page.waitForTimeout(150);
}

export class BambooHRAdapter implements ATSAdapter {
  private cachedResumePath?: string;

  /**
   * Detects whether the current page is powered by BambooHR ATS.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("bamboohr.com") || url.includes("/careers/")) {
      return true;
    }
    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("bamboohr.com") ||
      content.includes("bamboohr") ||
      (await page.$("button:has-text('Apply for This Job'), [data-fabric-version], [data-one-instance-messageslidedown], [class*='fabric-']")) !== null
    );
  }

  /**
   * Extracts job info (company, title, description, location) from BambooHR page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const url = page.url();
    let company = "Company";
    let title = "Position";

    try {
      const hostname = new URL(url).hostname;
      const sub = hostname.split(".")[0];
      if (sub && sub !== "www" && sub !== "jobs") {
        company = sub
          .split("-")
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      if (company.toLowerCase() === "prentkeromich") company = "PRC-Saltillo";
      if (company.toLowerCase() === "greenparkcontent") company = "Greenpark";
      if (company.toLowerCase() === "headspin") company = "HeadSpin";
      if (company.toLowerCase() === "atlas") company = "Atlas Systems";
    } catch (e) {}

    // Title from DOM with fast timeout
    const titleCandidates = [
      "h2",
      "h1",
      "[class*='JobTitle']",
      "[class*='job-title']",
      "h3"
    ];
    for (const sel of titleCandidates) {
      const txt = await page.locator(sel).first().innerText({ timeout: 1200 }).catch(() => "");
      if (txt && txt.trim() && !txt.includes("Privacy") && !txt.includes("Job Openings") && !txt.includes("BambooHR")) {
        title = txt.trim();
        break;
      }
    }

    // Description with fast timeout
    const description = await page.locator(
      "[class*='jobDescription'], [class*='JobDescription'], div:has(> h3:has-text('Job Description')), div:has(> p), main, article"
    ).first().innerText({ timeout: 1500 }).catch(() => "");

    return {
      company,
      title,
      description: description ? description.slice(0, 1500) : "BambooHR job opportunity",
      ats: "BAMBOOHR"
    };
  }

  /**
   * Ensures the application form is visible by clicking the "Apply for This Job" button if present.
   */
  private async ensureFormOpen(page: Page): Promise<void> {
    const isFormAlreadyOpen = await page.locator("input[name='firstName'], #firstName, input[name='email'], #email").first().isVisible({ timeout: 1500 }).catch(() => false);
    if (isFormAlreadyOpen) {
      return;
    }

    console.log("👉 [BambooHRAdapter]: Opening application form (clicking 'Apply for This Job')...");
    const applyBtn = page.locator(
      "button:has-text('Apply for This Job'), a:has-text('Apply for This Job'), button:has-text('Apply'), a:has-text('Apply'), [role='button']:has-text('Apply')"
    ).first();

    if (await applyBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await humanClick(page, applyBtn);
      await page.waitForSelector("input[name='firstName'], #firstName, input[name='email'], #email", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Scrapes interactive form fields from BambooHR.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Analyzing BambooHR Application...", "Scanning application form", "info", 50);
    await dismissCommonPopups(page);
    await this.ensureFormOpen(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const inputs = Array.from(document.querySelectorAll("input, textarea, select"));

      inputs.forEach((inp, idx) => {
        const typeAttr = (inp.getAttribute("type") || inp.tagName).toLowerCase();
        const name = inp.getAttribute("name") || "";
        const id = inp.id || "";

        // Skip hidden, submit, recaptcha, and HONEYPOT fields
        if (typeAttr === "hidden" || typeAttr === "submit") return;
        if (name.includes("recaptcha") || id.includes("recaptcha")) return;
        if (name.includes("nickname") || id.includes("nickname") || name.includes("hpcsaf")) return;

        let label = "";
        const parentLabel = inp.closest("label");
        if (parentLabel && parentLabel.textContent) {
          label = parentLabel.textContent.trim();
        } else if (id) {
          const l = document.querySelector(`label[for="${id}"]`);
          if (l && l.textContent) label = l.textContent.trim();
        }

        if (!label) {
          const group = inp.closest("div[class*='field'], div[class*='Field'], div[class*='group'], div[class*='Group']");
          if (group) {
            const l = group.querySelector("label, span");
            if (l && l.textContent) label = l.textContent.trim();
          }
        }

        if (!label) {
          label = inp.getAttribute("aria-label") || inp.getAttribute("placeholder") || name || id || `field-${idx}`;
        }

        // Honeypot guard
        if (label.toLowerCase().includes("leave this field blank")) return;

        let type: FormField["type"] = "text";
        if (typeAttr === "textarea" || inp.tagName.toLowerCase() === "textarea") type = "textarea";
        if (typeAttr === "select" || inp.tagName.toLowerCase() === "select") type = "select";
        if (typeAttr === "file") type = "file";
        if (typeAttr === "checkbox") type = "checkbox";
        if (typeAttr === "radio") type = "radio";
        if (typeAttr === "tel") type = "tel";
        if (typeAttr === "email") type = "email";

        results.push({
          id: name || id || `field-${idx}`,
          label,
          type,
          required: inp.hasAttribute("required") || label.includes("*")
        });
      });

      return results;
    });
  }

  /**
   * Universal helper to select an option in BambooHR's custom Fabric searchable select dropdowns.
   */
  private async selectFabricDropdown(
    page: Page,
    labelRegex: RegExp,
    searchKeyword: string,
    targetOptionRegex: RegExp,
    logName: string
  ): Promise<boolean> {
    console.log(`🔽 [BambooHRAdapter]: Selecting ${logName} (typing "${searchKeyword}")...`);

    // 1. Find and click the toggle button inside the container matching the label
    const opened = await page.evaluate((labelPatternStr: string) => {
      const re = new RegExp(labelPatternStr, "i");
      const containers = Array.from(document.querySelectorAll(".fab-FormField, [class*='FormField'], div[class*='field'], .form-group, div"));
      for (const c of containers) {
        const lbl = c.querySelector("label, .fab-Label, [class*='Label'], span, p");
        const lblText = lbl?.textContent?.trim() || "";
        if (lblText && re.test(lblText) && lblText.length < 60) {
          const btn = c.querySelector("button, [role='combobox'], [role='button'], [class*='SelectToggle'], [class*='select-toggle']") as HTMLElement | null;
          if (btn) {
            btn.scrollIntoView({ block: "center" });
            btn.click();
            return true;
          }
        }
      }
      return false;
    }, labelRegex.source).catch(() => false);

    if (!opened) {
      const toggle = page.locator(".fab-FormField, [class*='FormField'], div[class*='field']").filter({
        hasText: labelRegex
      }).locator("button, [role='combobox'], [role='button'], [class*='SelectToggle'], [class*='select-toggle']").first();

      if (await toggle.isVisible({ timeout: 1500 }).catch(() => false)) {
        await humanClick(page, toggle);
      } else {
        console.warn(`⚠️ [BambooHRAdapter]: Could not open dropdown toggle for ${logName}`);
      }
    }

    await page.waitForTimeout(400);

    // 2. Type in search box if available (e.g. typing "ca" for State, or "Bachelor of Science" for Education)
    const searchBox = page.locator("input[placeholder*='Search' i], [class*='SearchInput'] input, input[type='search'], [role='listbox'] input").first();
    if (await searchBox.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchBox.fill("");
      await searchBox.pressSequentially(searchKeyword, { delay: 40 });
      await page.waitForTimeout(300);
    }

    // 3. Find and click the target option via DOM dispatch and Playwright
    const selected = await page.evaluate((optPatternStr: string) => {
      const re = new RegExp(optPatternStr, "i");
      const options = Array.from(document.querySelectorAll("[role='option'], .fab-SelectMenuOption, [class*='SelectMenuOption'], [class*='Option'], [class*='option'], li, button"));
      const match = options.find(o => re.test(o.textContent?.trim() || ""));
      if (match) {
        const clickable = match.closest("[role='option'], li, button") || match;
        clickable.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        clickable.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (clickable as HTMLElement).click();
        return true;
      }
      return false;
    }, targetOptionRegex.source).catch(() => false);

    if (selected) {
      console.log(`✅ [BambooHRAdapter]: Selected option matching ${targetOptionRegex} for ${logName} via DOM dispatch.`);
      await page.waitForTimeout(400);
      return true;
    }

    const optLoc = page.locator("[role='option'], [class*='SelectMenuOption'], [class*='Option'], li, button").filter({
      hasText: targetOptionRegex
    }).first();
    if (await optLoc.isVisible({ timeout: 1500 }).catch(() => false)) {
      await humanClick(page, optLoc);
      console.log(`✅ [BambooHRAdapter]: Selected option for ${logName} via Playwright click.`);
      await page.waitForTimeout(400);
      return true;
    }

    // 4. Fallback: native <select>
    const nativeSel = page.locator("select").filter({
      has: page.locator("option").filter({ hasText: targetOptionRegex })
    }).first();
    if (await nativeSel.isVisible({ timeout: 800 }).catch(() => false)) {
      const val = await nativeSel.evaluate((sel: HTMLSelectElement, reStr: string) => {
        const re = new RegExp(reStr, "i");
        const opt = Array.from(sel.options).find(o => re.test(o.text));
        return opt ? opt.value : "";
      }, targetOptionRegex.source).catch(() => "");
      if (val) {
        await nativeSel.selectOption(val).catch(() => {});
        console.log(`✅ [BambooHRAdapter]: Selected option on native select for ${logName}.`);
        return true;
      }
    }

    return false;
  }

  /**
   * Automates form filling on BambooHR using candidate profile & smart question answering.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    fields: FormField[] = []
  ): Promise<void> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Filling BambooHR Application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 60);
    await dismissCommonPopups(page);
    await this.ensureFormOpen(page);

    const job = await this.extractJob(page);

    // ─── 1. STANDARD PERSONAL INFO FIELDS ───
    console.log("✍️ [BambooHRAdapter]: Filling standard personal info...");

    // First Name
    const firstNameInp = page.locator("input[name='firstName'], #firstName").first();
    if (await firstNameInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, firstNameInp, profile.firstName);
    }

    // Last Name
    const lastNameInp = page.locator("input[name='lastName'], #lastName").first();
    if (await lastNameInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, lastNameInp, profile.lastName);
    }

    // Email
    const emailInp = page.locator("input[name='email'], #email, input[type='email']").first();
    if (await emailInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, emailInp, profile.email);
    }

    // Phone
    const phoneInp = page.locator("input[name='phone'], #phone, input[type='tel']").first();
    if (await phoneInp.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, phoneInp, profile.phone || "+1 202 555 0198");
    }

    // Street Address
    const addressInp = page.locator("input[name*='streetAddress'], input[name='address'], input[id*='FabricTextField'][aria-label*='Address' i]").first();
    if (await addressInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, addressInp, profile.street || "123 Market St");
    }

    // City
    const cityInp = page.locator("input[name*='city'], input[id*='FabricTextField'][aria-label*='City' i]").first();
    if (await cityInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, cityInp, profile.city || "San Francisco");
    }

    // ZIP / Postal Code
    const zipInp = page.locator("input[name*='zip'], input[id*='FabricTextField'][aria-label*='ZIP' i], input[id*='FabricTextField'][aria-label*='Postal' i]").first();
    if (await zipInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      await typeLikeHuman(page, zipInp, profile.zipCode || "94105");
    }

    // Country Select (select United States first so BambooHR enables the State dropdown)
    console.log("🌐 [BambooHRAdapter]: Setting Country to United States...");
    const countrySelected = await this.selectFabricDropdown(
      page,
      /^Country/i,
      "United States",
      /^United States$/i,
      "Country"
    );
    if (countrySelected) {
      await page.waitForTimeout(1000); // Allow BambooHR to load the State dropdown options
    }

    // State / Province (Handles BambooHR Fabric searchable dropdown)
    // Fulfills user instruction: "for state type ca and select California."
    console.log("🗺️ [BambooHRAdapter]: Setting State to California (typing 'ca')...");
    let stateFilled = await this.selectFabricDropdown(
      page,
      /^State(\s*\*|\b|\s*\/)/i,
      "ca",
      /^California$/i,
      "State"
    );

    if (!stateFilled) {
      // Direct retry typing full name "California"
      stateFilled = await this.selectFabricDropdown(
        page,
        /^State/i,
        "California",
        /California/i,
        "State"
      );
    }

    if (!stateFilled) {
      const stateSelect = page.locator("select[name*='state'], select[id*='state']").first();
      if (await stateSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        const optionVal = await stateSelect.evaluate((sel: HTMLSelectElement) => {
          const opts = Array.from(sel.options);
          const match = opts.find(o => o.text.toLowerCase().includes("california") || o.value.toLowerCase().includes("ca"));
          return match ? match.value : (opts[1] ? opts[1].value : "");
        });
        if (optionVal) {
          await stateSelect.selectOption(optionVal).catch(() => {});
          stateFilled = true;
        }
      } else {
        const stateInp = page.locator("input[name*='state'], input[id*='FabricTextField'][aria-label*='State' i], input[id*='FabricTextField'][aria-label*='Province' i]").first();
        if (await stateInp.isVisible({ timeout: 1000 }).catch(() => false)) {
          await typeLikeHuman(page, stateInp, "California");
          stateFilled = true;
        }
      }
    }

    // ─── 2. ADDITIONAL COMMON PROFILE FIELDS ───

    // Desired Pay
    const payInp = page.locator("input[name='desiredPay'], #desiredPay").first();
    if (await payInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      const currentVal = await payInp.inputValue().catch(() => "");
      if (!currentVal) {
        await typeLikeHuman(page, payInp, "$95,000 USD (Negotiable)");
      }
    }

    // Date Available (today's date in proper format e.g. "dd mon yyyy" -> "05 Nov 2026")
    // Fulfills user instruction: "avalibaily todays date"
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedDate = `${dd} ${months[now.getMonth()]} ${yyyy}`;

    console.log(`📅 [BambooHRAdapter]: Filling Date Available with today's date "${formattedDate}"...`);
    const dateContainer = page.locator(".fab-FormField, [class*='FormField'], div[class*='field']").filter({
      hasText: /Date Available|Available Date|Availability/i
    }).first();

    let dateAvailInp = dateContainer.locator("input:not([type='hidden'])").first();
    if (!(await dateAvailInp.isVisible({ timeout: 1000 }).catch(() => false))) {
      dateAvailInp = page.locator(
        "input[placeholder*='yyyy' i]:not([id*='nickname']):not([name*='nickname']), input[placeholder*='dd' i]:not([id*='nickname']), input[placeholder*='mon yyyy' i], input[name*='dateAvailable' i], label:has-text('Date Available') ~ div input"
      ).first();
    }

    if (await dateAvailInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dateAvailInp.scrollIntoViewIfNeeded().catch(() => {});
      await dateAvailInp.click({ force: true }).catch(() => {});
      await page.waitForTimeout(100);
      await dateAvailInp.fill("");
      await dateAvailInp.pressSequentially(formattedDate, { delay: 40 }).catch(() => {});

      // Use native value descriptor setter so React synthetic events retain the value on blur
      await dateAvailInp.evaluate((el: HTMLInputElement, val: string) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) nativeSetter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, formattedDate).catch(() => {});

      // Fallback: Click calendar picker icon if date input is still empty
      const curDateVal = await dateAvailInp.inputValue().catch(() => "");
      if (!curDateVal || curDateVal.trim() === "") {
        console.log("📅 [BambooHRAdapter]: Date input still empty, clicking calendar picker button...");
        const calBtn = dateContainer.locator("button, [role='button'], [class*='DatePicker-button'], svg").first();
        if (await calBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await calBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(400);
          const todayBtn = page.locator("button:has-text('Today'), [class*='today'], [aria-current='date']").first();
          if (await todayBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await todayBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(300);
          }
        }
      }
    }

    // Website / Portfolio URL
    const webInp = page.locator("input[name='websiteUrl'], #websiteUrl").first();
    if (await webInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      const currentVal = await webInp.inputValue().catch(() => "");
      if (!currentVal) {
        await typeLikeHuman(page, webInp, profile.portfolioUrl || profile.githubUrl || "");
      }
    }

    // LinkedIn URL
    const linkedinInp = page.locator("input[name='linkedinUrl'], #linkedinUrl").first();
    if (await linkedinInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      const currentVal = await linkedinInp.inputValue().catch(() => "");
      if (!currentVal) {
        await typeLikeHuman(page, linkedinInp, profile.linkedinUrl || "");
      }
    }

    // Highest Education Obtained (Selects "College - Bachelor of Science")
    // Fulfills user instruction: "higher education bachlor of science"
    console.log("🎓 [BambooHRAdapter]: Selecting Highest Education -> 'College - Bachelor of Science'...");
    let eduSelected = await this.selectFabricDropdown(
      page,
      /Highest Education|Education Level|Education/i,
      "Bachelor of Science",
      /Bachelor of Science/i,
      "Highest Education Obtained"
    );

    if (!eduSelected) {
      const eduSelect = page.locator("select[name='educationLevelId'], #educationLevelId").first();
      if (await eduSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
        const eduVal = await eduSelect.evaluate((sel: HTMLSelectElement) => {
          const opts = Array.from(sel.options);
          const match = opts.find(o => 
            o.text.toLowerCase().includes("bachelor of science") ||
            o.text.toLowerCase().includes("bachelor") || 
            o.text.toLowerCase().includes("college") || 
            o.text.toLowerCase().includes("bs")
          );
          return match ? match.value : (opts[1] ? opts[1].value : "");
        });
        if (eduVal) {
          await eduSelect.selectOption(eduVal).catch(() => {});
          eduSelected = true;
        }
      }
    }

    // Referred By
    const refInp = page.locator("input[name='referredBy'], #referredBy").first();
    if (await refInp.isVisible({ timeout: 1500 }).catch(() => false)) {
      const currentVal = await refInp.inputValue().catch(() => "");
      if (!currentVal) {
        await typeLikeHuman(page, refInp, profile.savedAnswers?.get("referral") || "Direct Application");
      }
    }

    // References
    const refTextarea = page.locator("textarea[name='references'], #references").first();
    if (await refTextarea.isVisible({ timeout: 1500 }).catch(() => false)) {
      const currentVal = await refTextarea.inputValue().catch(() => "");
      if (!currentVal) {
        await typeLikeHuman(page, refTextarea, "Available upon professional request.");
      }
    }

    // ─── 3. CUSTOM SCREENING QUESTIONS (TEXT, TEXTAREAS, RADIOS) ───
    console.log("🤖 [BambooHRAdapter]: Answering custom screening questions...");

    // Cover Letter Textarea (if present as a text field rather than a file input)
    const clTextarea = page.locator("textarea[name*='coverLetter' i], textarea[aria-label*='Cover Letter' i], textarea[placeholder*='Cover Letter' i], div:has(> label:has-text('Cover Letter')) textarea").first();
    if (await clTextarea.isVisible({ timeout: 1000 }).catch(() => false)) {
      const currentVal = await clTextarea.inputValue().catch(() => "");
      if (!currentVal || !currentVal.trim()) {
        const coverText = suggestAnswerForQuestion("cover letter");
        console.log("✍️ [BambooHRAdapter]: Filling Cover Letter textarea...");
        await typeLikeHuman(page, clTextarea, coverText);
      }
    }

    // Source dropdown (if present as a select or Fabric searchable toggle)
    const sourceToggle = page.locator("button[aria-label*='hear about' i], button[aria-label*='source' i], [class*='fab-SelectToggle'][aria-label*='hear about' i], [class*='fab-SelectToggle'][aria-label*='source' i]").first();
    if (await sourceToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sourceToggle.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      const searchBox = page.locator("input[placeholder*='Search' i]").first();
      if (await searchBox.isVisible({ timeout: 800 }).catch(() => false)) {
        await searchBox.fill("LinkedIn");
        await page.waitForTimeout(300);
      }
      const linkedinOpt = page.locator("div, li, button, [role='option'], span").filter({ hasText: /^LinkedIn$/i }).first();
      if (await linkedinOpt.isVisible({ timeout: 1500 }).catch(() => false)) {
        await linkedinOpt.click({ force: true });
        await page.waitForTimeout(300);
      }
    }

    const sourceSelect = page.locator("select[name*='source'], select[id*='source']").first();
    if (await sourceSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      const sVal = await sourceSelect.evaluate((sel: HTMLSelectElement) => {
        const opts = Array.from(sel.options);
        const match = opts.find(o => /linkedin/i.test(o.text));
        return match ? match.value : "";
      });
      if (sVal) await sourceSelect.selectOption(sVal).catch(() => {});
    }

    // Explicit LinkedIn priority check: ALWAYS click LinkedIn radio if present across the form
    console.log("🎯 [BambooHRAdapter]: Checking for LinkedIn source options...");
    await page.evaluate(() => {
      const allLabels = Array.from(document.querySelectorAll("label, .fab-Radio, [class*='Radio']"));
      for (const lbl of allLabels) {
        const txt = lbl.textContent?.trim().toLowerCase() || "";
        if (txt === "linkedin" || txt.includes("linkedin")) {
          const radioInput = lbl.querySelector("input[type='radio']") || lbl.closest("label")?.querySelector("input[type='radio']");
          if (radioInput) {
            lbl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
            lbl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
            (lbl as HTMLElement).click();
            return;
          }
        }
      }
    }).catch(() => {});

    // Custom Radio Groups (Scan ALL radio groups on the page)
    const radioGroupNames = await page.evaluate(() => {
      const names = new Set<string>();
      document.querySelectorAll("input[type='radio']").forEach(r => {
        const n = r.getAttribute("name");
        // Skip demographic fields handled in separate dedicated section
        if (n && !n.includes("gender") && !n.includes("ethnicity") && !n.includes("veteran") && !n.includes("disability")) {
          names.add(n);
        }
      });
      return Array.from(names);
    }).catch(() => [] as string[]);

    for (const rName of radioGroupNames) {
      const radios = page.locator(`input[type='radio'][name='${rName}']`);
      const count = await radios.count().catch(() => 0);
      if (count === 0) continue;

      const questionText = await radios.first().evaluate((el: HTMLElement) => {
        const group = el.closest("fieldset, [role='radiogroup'], div[class*='group'], div[class*='Field'], div[class*='field']");
        const legend = group?.querySelector("legend, label, span, p");
        return legend?.textContent?.trim() || "";
      }).catch(() => "");

      const optionTexts: string[] = [];
      for (let i = 0; i < count; i++) {
        const optText = await radios.nth(i).evaluate((el: HTMLInputElement) => {
          if (el.id) {
            const labelFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
            if (labelFor && labelFor.textContent?.trim()) return labelFor.textContent.trim();
          }
          const wrapper = el.closest(".fab-Radio, [class*='Radio'], [class*='radio'], label");
          if (wrapper && wrapper.textContent?.trim()) return wrapper.textContent.trim();
          const sibling = el.nextElementSibling;
          if (sibling && sibling.textContent?.trim()) return sibling.textContent.trim();
          const parent = el.parentElement;
          if (parent && parent.textContent?.trim()) return parent.textContent.trim();
          return (el.getAttribute("aria-label") || el.value || "").trim();
        });
        optionTexts.push(optText || (i === 0 ? "Yes" : "No"));
      }

      let targetIdx = -1;
      const isSourceQuestion = 
        questionText.toLowerCase().includes("hear about") ||
        questionText.toLowerCase().includes("first hear") ||
        questionText.toLowerCase().includes("source") ||
        questionText.toLowerCase().includes("where did you find");

      // 1. Direct DOM search for LinkedIn option in this group
      const domLiIdx = await radios.first().evaluate((el: HTMLElement) => {
        const group = el.closest("fieldset, [role='radiogroup'], div[class*='group'], div[class*='Field'], div[class*='field']");
        if (!group) return -1;
        const groupRadios = Array.from(group.querySelectorAll("input[type='radio']"));
        for (let i = 0; i < groupRadios.length; i++) {
          const r = groupRadios[i];
          const wrapper = r.closest(".fab-Radio, [class*='Radio'], [class*='radio'], label") || r.parentElement;
          const text = (wrapper?.textContent || "").toLowerCase();
          if (text.includes("linkedin")) return i;
        }
        return -1;
      }).catch(() => -1);

      if (domLiIdx !== -1) {
        targetIdx = domLiIdx;
        console.log(`🎯 [BambooHRAdapter]: Direct DOM matched LinkedIn in radio group at index ${targetIdx}`);
      } else {
        // ALWAYS select LinkedIn if ANY option contains LinkedIn
        const liIdx = optionTexts.findIndex(o => /linkedin/i.test(o));
        if (liIdx !== -1) {
          targetIdx = liIdx;
          console.log(`🎯 [BambooHRAdapter]: LinkedIn detected in radio options -> ALWAYS selecting LinkedIn: "${optionTexts[targetIdx]}"`);
        } else if (isSourceQuestion) {
          targetIdx = 0;
        }
      }

      if (targetIdx === -1) {
        const answer = await generateAnswerForQuestion(questionText, job, profile, optionTexts, "radio");
        console.log(`🔘 [BambooHRAdapter]: Radio "${questionText.slice(0, 40)}" with options [${optionTexts.join(", ")}] -> "${answer}"`);

        for (let i = 0; i < optionTexts.length; i++) {
          if (
            optionTexts[i].toLowerCase() === answer.toLowerCase() ||
            optionTexts[i].toLowerCase().includes(answer.toLowerCase()) ||
            answer.toLowerCase().includes(optionTexts[i].toLowerCase())
          ) {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx === -1) targetIdx = 0;

      const radioEl = radios.nth(targetIdx);
      await radioEl.evaluate((inp: HTMLInputElement) => {
        const lbl = inp.closest("label, .fab-Radio, [class*='Radio']") || inp;
        lbl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        lbl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (lbl as HTMLElement).click();
      }).catch(async () => {
        await radios.nth(targetIdx).check({ force: true }).catch(() => {});
      });
      await page.waitForTimeout(300);

      // Check if clicking this radio revealed a dynamic "Please Specify" text input and fill it immediately
      const dynamicSpecify = page.locator("input:not([type='radio']):not([type='checkbox']):not([type='hidden'])").filter({
        has: page.locator("xpath=ancestor::div[contains(., 'Specify') or contains(., 'specify')]")
      }).first();
      if (await dynamicSpecify.isVisible({ timeout: 500 }).catch(() => false)) {
        const cur = await dynamicSpecify.inputValue().catch(() => "");
        if (!cur) {
          console.log("✍️ [BambooHRAdapter]: Dynamic 'Please Specify' appeared after radio click -> Filling with 'LinkedIn'");
          await typeLikeHuman(page, dynamicSpecify, "LinkedIn");
        }
      }
    }

    // Fill any "Please Specify" / "Specify" text input (if Other was clicked or required)
    const specifyInputs = page.locator("input:not([type='radio']):not([type='checkbox']):not([type='hidden'])").filter({
      has: page.locator("xpath=ancestor::div[contains(., 'Specify') or contains(., 'specify') or contains(., 'other')]")
    });
    const specifyCount = await specifyInputs.count().catch(() => 0);
    for (let i = 0; i < specifyCount; i++) {
      const spInp = specifyInputs.nth(i);
      if (await spInp.isVisible().catch(() => false)) {
        const cur = await spInp.inputValue().catch(() => "");
        if (!cur) {
          console.log("✍️ [BambooHRAdapter]: Filling 'Please Specify' input -> 'LinkedIn'");
          await typeLikeHuman(page, spInp, "LinkedIn");
        }
      }
    }

    // Universal Safety Net: Fill ALL visible empty text inputs across the form
    const allTextInputs = await page.locator("input[type='text'], input:not([type]), input[type='number']").all().catch(() => []);
    for (const inp of allTextInputs) {
      if (!(await inp.isVisible().catch(() => false))) continue;
      const name = (await inp.getAttribute("name").catch(() => "")) || "";
      const id = (await inp.getAttribute("id").catch(() => "")) || "";
      // Skip honeypots and search boxes
      if (name.includes("nickname") || id.includes("nickname") || name.includes("hpcsaf")) continue;
      if (id.includes("search") || (await inp.getAttribute("placeholder").catch(() => "") || "").toLowerCase().includes("search")) continue;

      const currentVal = await inp.inputValue().catch(() => "");
      if (currentVal && currentVal.trim()) continue;

      const label = await inp.evaluate((el: HTMLInputElement) => {
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l && l.textContent) return l.textContent.trim();
        }
        return el.closest("label")?.textContent?.trim() || 
               el.closest("div[class*='field'], div[class*='group']")?.querySelector("label, span, p")?.textContent?.trim() ||
               el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
      }).catch(() => "");

      if (label.toLowerCase().includes("specify")) {
        await typeLikeHuman(page, inp, "LinkedIn");
        continue;
      }

      const answer = await generateAnswerForQuestion(label || "Information", job, profile, undefined, "input");
      console.log(`✍️ [BambooHRAdapter]: Safety net filling empty input "${label.slice(0, 40)}" -> "${answer.slice(0, 40)}"`);
      await typeLikeHuman(page, inp, answer);
    }

    // Universal Safety Net: Fill ALL visible empty textareas across the form
    const allTextareas = await page.locator("textarea").all().catch(() => []);
    for (const ta of allTextareas) {
      if (!(await ta.isVisible().catch(() => false))) continue;
      const currentVal = await ta.inputValue().catch(() => "");
      if (currentVal && currentVal.trim()) continue;

      const label = await ta.evaluate((el: HTMLTextAreaElement) => {
        if (el.id) {
          const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (l && l.textContent) return l.textContent.trim();
        }
        return el.closest("label")?.textContent?.trim() || 
               el.closest("div[class*='field'], div[class*='group']")?.querySelector("label, span, p")?.textContent?.trim() ||
               el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
      }).catch(() => "");

      const answer = await generateAnswerForQuestion(label || "Screening question", job, profile, undefined, "textarea");
      console.log(`✍️ [BambooHRAdapter]: Safety net filling empty textarea "${label.slice(0, 40)}" -> "${answer.slice(0, 40)}"`);
      await typeLikeHuman(page, ta, answer);
    }

    // ─── 4. EEO & DEMOGRAPHIC DROPDOWNS & RADIOS ───
    // Gender (Strict Male match)
    const genderSelect = page.locator("select[name='genderId'], #genderId").first();
    if (await genderSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      const gVal = await genderSelect.evaluate((sel: HTMLSelectElement) => {
        const opts = Array.from(sel.options);
        const match = opts.find(o => /^male$/i.test(o.text.trim())) ||
                      opts.find(o => /\bmale\b/i.test(o.text) && !/female/i.test(o.text));
        return match ? match.value : (opts[1] ? opts[1].value : "");
      });
      if (gVal) await genderSelect.selectOption(gVal).catch(() => {});
    }

    const genderToggle = page.locator("div, [class*='FormField']").filter({
      has: page.locator("label:has-text('Gender'), span:has-text('Gender')")
    }).locator("button, [role='combobox'], [role='button'], [class*='SelectToggle']").first();
    if (await genderToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await genderToggle.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      const maleOpt = page.locator("div, li, button, [role='option'], span").filter({ hasText: /^Male$/i }).first();
      if (await maleOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await maleOpt.click({ force: true }).catch(() => {});
      }
    }

    // Ethnicity
    const ethnicitySelect = page.locator("select[name='ethnicityId'], #ethnicityId").first();
    if (await ethnicitySelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      const eVal = await ethnicitySelect.evaluate((sel: HTMLSelectElement) => {
        const opts = Array.from(sel.options);
        const match = opts.find(o => /asian/i.test(o.text) || /south asian/i.test(o.text) || /two or more/i.test(o.text));
        return match ? match.value : (opts[1] ? opts[1].value : "");
      });
      if (eVal) await ethnicitySelect.selectOption(eVal).catch(() => {});
    }

    // Veteran status
    const veteranRadio = page.locator("input[type='radio']#notVeteran, label:has-text('Not a Veteran'), label:has-text('Decline to Answer')").first();
    if (await veteranRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
      await veteranRadio.click({ force: true }).catch(() => {});
    }

    // Disability status
    const disabilityRadio = page.locator("label:has-text('No, I Don\\'t Have A Disability'), label:has-text('Decline'), input[value*='no_disability' i]").first();
    if (await disabilityRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
      await disabilityRadio.click({ force: true }).catch(() => {});
    }

    // ─── 5. FILE UPLOADS (COVER LETTER & RESUME) ───
    const resumePath = additionalAnswers?.resumePath || profile.resumePath || resolveLocalResumePath(profile.resumePath || "");
    await this.uploadResume(page, resumePath, fields, profile);

    // ─── 6. SCROLL TO BOTTOM TO SHOW FULL WEBSITE & SUBMIT BUTTON ───
    const submitBtn = page.locator("button:has-text('Submit Application'), button:has-text('Apply'), button[type='submit']").first();
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }
  }

  /**
   * Resolves the candidate's Cover Letter PDF if available, or fallbacks appropriately.
   */
  private resolveCoverLetterPath(resumePath: string, profile?: UserProfile): string | null {
    const resolvedResume = resolveLocalResumePath(resumePath);
    if (!resolvedResume) return null;

    const dir = path.dirname(resolvedResume);
    const candidateCoverName = profile ? `${profile.firstName}_${profile.lastName}_Cover_Letter.pdf` : "Cover_Letter.pdf";
    const candidateFiles = [
      profile?.coverLetterPath || "",
      path.join(dir, candidateCoverName),
      path.join(dir, "cover_letter.pdf"),
      path.join(dir, "Cover_Letter.pdf"),
      path.join(dir, "CoverLetter.pdf"),
      resolvedResume.replace(/Resume/i, "Cover_Letter"),
      resolvedResume.replace(/resume/i, "cover_letter")
    ];

    for (const f of candidateFiles) {
      if (fs.existsSync(f)) {
        return f;
      }
    }

    if (profile?.userId) {
      const userDir = path.resolve(process.cwd(), "resumes", `user_${profile.userId}`);
      if (fs.existsSync(userDir)) {
        try {
          const files = fs.readdirSync(userDir);
          const match = files.find(f => /cover.*letter.*\.pdf$/i.test(f));
          if (match) return path.join(userDir, match);
        } catch (e) {}
      }
    }

    return resolvedResume;
  }

  /**
   * Uploads both candidate PDF Resume and Cover Letter to their respective BambooHR file inputs.
   * Guarantees Resume is uploaded directly to the Resume field, preventing Cover Letter clobbering.
   */
  async uploadResume(page: Page, resumePath: string, fields: FormField[] = [], profile?: UserProfile): Promise<void> {
    this.cachedResumePath = resumePath;
    const resolvedResume = resolveLocalResumePath(resumePath);
    const resolvedCoverLetter = this.resolveCoverLetterPath(resumePath, profile);

    console.log(`📂 [BambooHRAdapter]: Starting Resume & Cover Letter upload...`);

    // ─── 1. UPLOAD RESUME (ALWAYS TARGETS THE RESUME FIELD INDEPENDENTLY) ───
    if (resolvedResume) {
      let resumeUploaded = false;

      // Locate container explicitly labeled Resume / CV
      const resumeContainer = page.locator(".fab-FormField, [class*='FormField'], div[class*='field']").filter({
        has: page.locator("label, [class*='Label'], span").filter({ hasText: /Resume|CV/i })
      }).filter({
        hasNot: page.locator("label, [class*='Label'], span").filter({ hasText: /Cover/i })
      }).first();

      const resumeFileInput = resumeContainer.locator("input[type='file']").first();
      if ((await resumeFileInput.count()) > 0) {
        console.log(`📂 [BambooHRAdapter]: Uploading Resume to designated Resume field: ${resolvedResume}...`);
        await resumeFileInput.setInputFiles(resolvedResume).catch(err => {
          console.warn("⚠️ [BambooHRAdapter]: Resume setInputFiles notice:", err.message);
        });
        await resumeFileInput.evaluate((el: HTMLInputElement) => {
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }).catch(() => {});
        await page.waitForTimeout(2000);
        resumeUploaded = true;
      }

      // If designated container didn't match, inspect all file inputs and avoid any labeled Cover
      if (!resumeUploaded) {
        const fileInputs = page.locator("input[type='file']");
        const count = await fileInputs.count().catch(() => 0);
        for (let i = 0; i < count; i++) {
          const inp = fileInputs.nth(i);
          const isCover = await inp.evaluate((el: HTMLElement) => {
            const container = el.closest(".fab-FormField, [class*='FormField'], div[class*='field']") || el.parentElement;
            return /cover/i.test(container?.textContent || "");
          }).catch(() => false);

          if (!isCover) {
            console.log(`📂 [BambooHRAdapter]: Uploading Resume to input #${i + 1}: ${resolvedResume}...`);
            await inp.setInputFiles(resolvedResume).catch(() => {});
            await inp.evaluate((el: HTMLInputElement) => {
              el.dispatchEvent(new Event("change", { bubbles: true }));
              el.dispatchEvent(new Event("input", { bubbles: true }));
            }).catch(() => {});
            resumeUploaded = true;
            await page.waitForTimeout(2000);
            break;
          }
        }
      }
    }

    // ─── 2. UPLOAD COVER LETTER (ONLY TO COVER LETTER INPUT IF PRESENT) ───
    const coverInputs = page.locator(".fab-FormField:has-text('Cover'), div[class*='field']:has-text('Cover')").locator("input[type='file']");
    const coverCount = await coverInputs.count().catch(() => 0);

    if (coverCount > 0) {
      const coverInput = coverInputs.first();
      // Check if cover letter field is required
      const isCoverRequired = await coverInput.evaluate((el: HTMLElement) => {
        const ff = el.closest(".fab-FormField, [class*='FormField'], div[class*='field']") || el.parentElement;
        return ff?.textContent?.includes("*") || false;
      }).catch(() => false);

      const fileToUpload = resolvedCoverLetter || (isCoverRequired ? resolvedResume : null);

      if (fileToUpload) {
        console.log(`📂 [BambooHRAdapter]: Uploading Cover Letter to Cover field: ${fileToUpload}...`);
        await coverInput.setInputFiles(fileToUpload).catch(err => {
          console.warn("⚠️ [BambooHRAdapter]: Cover letter setInputFiles notice:", err.message);
        });
        await coverInput.evaluate((el: HTMLInputElement) => {
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }).catch(() => {});
        await page.waitForTimeout(1500);
      }
    }
  }

  /**
   * Validates if required fields are satisfied and attempts auto-remediation.
   */
  async validate(page: Page, fields: FormField[] = []): Promise<boolean> {
    const errors = await page.locator("[class*='error'], [role='alert'], [aria-invalid='true']").all();
    const visibleErrors: string[] = [];
    for (const err of errors) {
      if (await err.isVisible().catch(() => false)) {
        const text = (await err.innerText().catch(() => "")).trim();
        if (text && !text.includes("optional")) {
          visibleErrors.push(text);
        }
      }
    }

    if (visibleErrors.length > 0) {
      console.warn("⚠️ [BambooHRAdapter]: Form validation warning(s):", visibleErrors.join("; "));

      // Auto-remediation for file upload errors:
      const fileUploadError = visibleErrors.some(e => /upload a file|resume|cover letter/i.test(e));
      if (fileUploadError) {
        console.log("🛠️ [BambooHRAdapter]: Attempting auto-remediation for file upload error...");
        const fallbackResume = resolveLocalResumePath(this.cachedResumePath || "resumes/resume.pdf");
        const fileInputs = page.locator("input[type='file']");
        const count = await fileInputs.count().catch(() => 0);

        for (let i = 0; i < count; i++) {
          const input = fileInputs.nth(i);
          const meta = await input.evaluate((el: HTMLInputElement) => {
            const ff = el.closest(".fab-FormField, [class*='FormField'], div[class*='field'], section") || el.parentElement;
            return ff?.textContent?.toLowerCase() || "";
          });

          if (!meta.includes("cover") && fallbackResume) {
            await input.setInputFiles(fallbackResume).catch(() => {});
            await page.waitForTimeout(1500);
          }
        }
      }

      // Re-check visible errors after remediation
      const remainingErrors = await page.locator("[class*='error'], [role='alert'], [aria-invalid='true']").all();
      const stillVisible: string[] = [];
      for (const err of remainingErrors) {
        if (await err.isVisible().catch(() => false)) {
          const text = (await err.innerText().catch(() => "")).trim();
          if (text && !text.includes("optional")) stillVisible.push(text);
        }
      }

      if (stillVisible.length > 0) {
        console.warn("⚠️ [BambooHRAdapter]: Lingering validation errors:", stillVisible.join("; "));
        return false;
      }
    }
    return true;
  }

  /**
   * Submits or holds for review in simulation mode.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isDryRun = process.env.DRY_RUN !== "false";
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    console.log(`🎯 [BambooHRAdapter]: Submission evaluation (DRY_RUN=${isDryRun}, AUTO_SUBMIT=${isAutoSubmit})...`);

    const submitBtn = page.locator(
      "button:has-text('Submit Application'), button:has-text('Apply'), button[type='submit'], [class*='submit'] button"
    ).first();

    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    }

    if (isDryRun || !isAutoSubmit) {
      console.log("🔒 [BambooHRAdapter]: DRY_RUN active. Application filled, scrolled to submit, and verified without final submit click.");
      return {
        success: true,
        confirmation: "Form filled & verified (Simulation Mode - Ready for Review)"
      };
    }

    // ─── CHECK & HANDLE RECAPTCHA BEFORE SUBMISSION ───
    const recaptchaFrame = page.locator("iframe[src*='recaptcha' i], iframe[title*='reCAPTCHA' i]").first();
    if (await recaptchaFrame.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log("🛡️ [BambooHRAdapter]: reCAPTCHA detected on BambooHR form.");
      
      const isAlreadySolved = await page.evaluate(() => {
        const resp = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
        return !!(resp && resp.value && resp.value.trim().length > 0);
      }).catch(() => false);

      if (!isAlreadySolved) {
        try {
          const checkbox = recaptchaFrame.contentFrame().locator(".recaptcha-checkbox-border, #recaptcha-anchor").first();
          if (await checkbox.isVisible({ timeout: 1500 }).catch(() => false)) {
            console.log("👉 [BambooHRAdapter]: Clicking reCAPTCHA checkbox...");
            await checkbox.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000);
          }
        } catch (e) {}

        const nowSolved = await page.evaluate(() => {
          const resp = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
          return !!(resp && resp.value && resp.value.trim().length > 0);
        }).catch(() => false);

        if (!nowSolved) {
          console.log("🧩 [BambooHRAdapter]: reCAPTCHA puzzle challenge active on screen. Please solve the puzzle to auto-submit...");
          await updateHUDStatus(page, "reCAPTCHA Challenge", "Solve the image puzzle to auto-submit", "warning", 90);
          await recaptchaFrame.scrollIntoViewIfNeeded().catch(() => {});

          // Wait for reCAPTCHA response to be populated
          await page.waitForFunction(() => {
            const resp = document.getElementById("g-recaptcha-response") as HTMLTextAreaElement | null;
            return !!(resp && resp.value && resp.value.trim().length > 0);
          }, { timeout: 60000 }).catch(() => {});
          await page.waitForTimeout(1000);
        }
      }
    }

    console.log("🚀 [BambooHRAdapter]: Executing LIVE submission on BambooHR...");
    if (await submitBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      await humanClick(page, submitBtn);
      await page.waitForTimeout(4000);

      const isSuccess = await page.locator(
        ":has-text('Thank you'), :has-text('Application Received'), :has-text('Application submitted'), [class*='success']"
      ).first().isVisible({ timeout: 6000 }).catch(() => false);

      return {
        success: isSuccess,
        confirmation: isSuccess ? "Application successfully submitted on BambooHR" : "Submit clicked on BambooHR"
      };
    }

    return {
      success: false,
      errorMessage: "Submit button not found on BambooHR"
    };
  }
}
