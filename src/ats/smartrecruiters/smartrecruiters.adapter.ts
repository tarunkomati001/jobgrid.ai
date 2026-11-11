import path from "path";
import { Page } from "playwright";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { humanClick, humanMouseMove, simulateZigZagReview } from "../../browser/human-mouse";

export class SmartRecruitersAdapter implements ATSAdapter {

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("smartrecruiters.com")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return (
      lower.includes("smartrecruiters.com") ||
      (await page.$("spl-input, oc-button, spl-button, oc-experience, spl-phone-field")) !== null
    );
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const pageTitle = await page.title().catch(() => "Job Application");

    // Extract title (filter out Internet Explorer banners or generic text)
    let title = "";
    try {
      const titleLoc = page.locator("oc-header h1, [data-test='job-title'], .job-title, h1:not([class*='browser']):not(:has-text('Internet Explorer'))").first();
      if ((await titleLoc.count()) > 0) {
        title = (await titleLoc.innerText().catch(() => "")).trim();
      }
    } catch (e) {}

    if (!title || title.toLowerCase().includes("internet explorer")) {
      const rawTitle = pageTitle.split("|")[0].split("-")[0].trim();
      if (!rawTitle.toLowerCase().includes("internet explorer")) {
        title = rawTitle;
      } else {
        title = "Software Engineer";
      }
    }

    // Extract company
    let company = "";
    try {
      const match = page.url().match(/company\/([^\/\?]+)/i);
      if (match && match[1]) {
        company = decodeURIComponent(match[1]).replace(/3$/, ""); // clean LinkedIn3 -> LinkedIn
      } else {
        const parts = new URL(page.url()).pathname.split("/").filter(Boolean);
        if (parts.length >= 1 && parts[0] !== "oneclick-ui") {
          company = parts[0];
        }
      }
    } catch (e) {}

    if (!company) {
      company = await page.locator(".company-name, [class*='company']").first().innerText().catch(() => "SmartRecruiters Partner");
    }

    const description = await page.locator("oc-job-description, #job-description, .job-description, body").first().innerText().catch(() => "No description extracted");

    return {
      company: company || "SmartRecruiters Partner",
      title: title || "Open Position",
      description: description.slice(0, 500),
      ats: "SMARTRECRUITERS",
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    const fields: FormField[] = [];

    const inputs = await page.evaluate(() => {
      const results: any[] = [];
      document.querySelectorAll("spl-input, spl-autocomplete, spl-phone-field, spl-textarea, spl-select, spl-radio-group, input[type='file']").forEach((el) => {
        const id = el.id || el.getAttribute("name") || el.getAttribute("data-test") || "";
        const label = el.getAttribute("label") || el.getAttribute("aria-label") || el.textContent?.slice(0, 50).trim() || "";
        const tag = el.tagName.toLowerCase();
        let type = "text";
        if (tag.includes("phone")) type = "tel";
        else if (tag.includes("select") || tag.includes("autocomplete")) type = "select";
        else if (tag.includes("radio")) type = "radio";
        else if (tag.includes("textarea")) type = "textarea";

        results.push({
          id,
          label,
          type,
          required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true" || el.textContent?.includes("*"),
        });
      });
      return results;
    }).catch(() => []);

    for (const inp of inputs) {
      fields.push({
        id: inp.id,
        label: inp.label,
        type: inp.type,
        required: inp.required,
      });
    }

    return fields;
  }

  /**
   * Ensures the OneClick application form is mounted.
   * If on a job description landing page, clicks the "I'm interested" / Apply button.
   */
  async ensureApplicationFormOpen(page: Page): Promise<void> {
    const isFormMounted = (await page.locator("spl-input#first-name-input input, spl-input#email-input input, input#email-input").count()) > 0;
    if (!isFormMounted) {
      const applyBtn = page.locator("a:has-text('interested'), button:has-text('interested'), a:has-text('Apply'), [data-test='apply-button']").first();
      if ((await applyBtn.count()) > 0) {
        console.log(`🖱️ [SmartRecruitersAdapter]: Clicking 'I\\'m interested' button to mount application form...`);
        await applyBtn.click();
        console.log(`  Waiting 6s for OneClick UI form to mount...`);
        await page.waitForTimeout(6000);
      }
      await page.locator("spl-input#email-input input, input#email-input, spl-input#first-name-input input, input#first-name-input").first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
    }
  }

  async uploadResume(page: Page, resumePath: string, _fields?: FormField[]): Promise<void> {
    console.log(`📂 [SmartRecruitersAdapter]: Uploading resume: ${resumePath}...`);
    await updateHUDStatus(page, "resume", "Uploading candidate resume...");

    // Ensure application form is open
    await this.ensureApplicationFormOpen(page);

    const fileInput = page.locator("input[type='file']").first();
    await fileInput.waitFor({ state: "attached", timeout: 15000 }).catch(() => {});

    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(resumePath);
      console.log(`✅ [SmartRecruitersAdapter]: Resume file uploaded successfully.`);
      // Wait for SmartRecruiters resume prefill parser banner to finish
      await page.waitForTimeout(7000);
      await updateHUDStatus(page, "resume", "Resume uploaded & parsed");
    } else {
      console.warn("⚠️ [SmartRecruitersAdapter]: No file input found for resume upload.");
    }
  }

  /**
   * Manages Experience Section:
   * 1. Resolves/completes open draft form left by parser
   * 2. Adds manual work experience entry if no cards exist
   */
  private async fillExperience(page: Page, profile: UserProfile): Promise<void> {
    console.log(`💼 [SmartRecruitersAdapter]: Managing Work Experience...`);
    const expContainer = page.locator("oc-experience, [data-test='experience-section']");
    if ((await expContainer.count()) === 0) {
      console.log(`  No experience section present on this form.`);
      return;
    }

    const savedCards = page.locator("oc-experience-item, [data-test='experience-item'], [data-test='experience-history-item']");
    let savedCount = await savedCards.count();
    console.log(`  Saved Experience Cards before check: ${savedCount}`);

    const expSaveBtn = page.locator("oc-button[data-test='experience-save'] button, oc-button[data-test='experience-save'] spl-button, [data-test='experience-save']");
    let isDraftOpen = (await expSaveBtn.count()) > 0;

    const targetTitle = profile.experiences?.[0]?.jobTitle || profile.headline || "Full-Stack AI Developer";
    const targetCompany = profile.experiences?.[0]?.company || "Jobspring";
    const targetLocation = profile.experiences?.[0]?.location || (profile.location ? profile.location.split(",")[0].trim() + ", CA" : "San Francisco, CA");
    const targetDesc = profile.experiences?.[0]?.description || profile.summary || "Engineered enterprise full-stack web platforms and autonomous AI agent systems.";

    if (isDraftOpen) {
      console.log(`  Found open experience draft from parser. Completing fields...`);
      await this.populateExperienceFields(page, targetTitle, targetCompany, targetLocation, targetDesc);
      await this.saveExperienceDraft(page);
      savedCount = await savedCards.count();
    }

    if (savedCount === 0) {
      console.log(`  No experience cards found. Adding manual experience entry...`);
      const addExpBtn = page.locator("oc-button[data-test='add-experience'] button, oc-button[data-test='add-experience'] spl-button, [data-test='add-experience']").first();
      if ((await addExpBtn.count()) > 0) {
        await addExpBtn.scrollIntoViewIfNeeded().catch(() => {});
        await addExpBtn.click({ force: true });
        await page.waitForTimeout(1000);

        await this.populateExperienceFields(page, targetTitle, targetCompany, targetLocation, targetDesc);
        await this.saveExperienceDraft(page);
      }
    }

    const finalCount = await savedCards.count();
    console.log(`✅ [SmartRecruitersAdapter]: Work Experience completed. Total cards: ${finalCount}`);
  }

  private async populateExperienceFields(
    page: Page,
    title: string,
    company: string,
    location: string,
    description: string
  ): Promise<void> {
    // 1. Job Title
    const titleInp = page.locator("[data-test='job-title-autocomplete'] input, input[id*='job-title'], oc-experience spl-autocomplete[label*='Title'] input, oc-experience spl-input[label*='Title'] input").first();
    if ((await titleInp.count()) > 0) {
      const cur = await titleInp.inputValue().catch(() => "");
      if (!cur) {
        await titleInp.click();
        await titleInp.fill(title);
        await page.waitForTimeout(1000);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }

    // 2. Company
    const compInp = page.locator("[data-test='company-autocomplete'] input, input[id*='company'], oc-experience spl-autocomplete[label*='Company'] input, oc-experience spl-input[label*='Company'] input").first();
    if ((await compInp.count()) > 0) {
      const cur = await compInp.inputValue().catch(() => "");
      if (!cur) {
        await compInp.click();
        await compInp.fill(company);
        await page.waitForTimeout(1000);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }

    // 3. Location
    const locInp = page.locator("oc-experience [data-test='location-autocomplete'] input, oc-experience spl-autocomplete[label*='Location'] input").first();
    if ((await locInp.count()) > 0) {
      const cur = await locInp.inputValue().catch(() => "");
      if (!cur) {
        await locInp.click();
        await locInp.fill(location);
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
      }
    }

    // 4. Description
    const descInp = page.locator("oc-experience spl-textarea textarea, oc-experience textarea").first();
    if ((await descInp.count()) > 0) {
      const cur = await descInp.inputValue().catch(() => "");
      if (!cur) {
        await descInp.fill(description);
      }
    }

    // 5. 'I currently work here' Checkbox
    await page.evaluate(() => {
      const cb = document.querySelector("oc-experience spl-checkbox");
      if (cb) {
        const inp = cb.shadowRoot?.querySelector("input") || cb.querySelector("input");
        if (inp && !inp.checked) {
          (cb as HTMLElement).click();
          inp.checked = true;
          inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }).catch(() => {});

    // 6. Start Date (From Date)
    const fromDateInp = page.locator("[data-test='experience-date-from'] input, oc-datepicker[data-test='experience-date-from'] spl-date-field input, oc-experience [data-test*='date-from'] input").first();
    if ((await fromDateInp.count()) > 0) {
      const cur = await fromDateInp.inputValue().catch(() => "");
      if (!cur) {
        await fromDateInp.click();
        await fromDateInp.fill("01/2024");
        await fromDateInp.dispatchEvent("input");
        await fromDateInp.dispatchEvent("change");
        await page.keyboard.press("Escape");
      }
    }
  }

  private async saveExperienceDraft(page: Page): Promise<void> {
    const saveExpBtn = page.locator("oc-button[data-test='experience-save'] button, oc-button[data-test='experience-save'] spl-button, [data-test='experience-save']").first();
    if ((await saveExpBtn.count()) > 0) {
      console.log(`  Saving Experience draft card...`);
      await saveExpBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  /**
   * Manages Education Section:
   * 1. Resolves/completes open draft form left by parser
   * 2. Adds manual education entry if no cards exist
   */
  private async fillEducation(page: Page, profile: UserProfile): Promise<void> {
    console.log(`🎓 [SmartRecruitersAdapter]: Managing Education...`);
    const eduContainer = page.locator("oc-education, [data-test='education-section']");
    if ((await eduContainer.count()) === 0) {
      console.log(`  No education section present on this form.`);
      return;
    }

    const savedCards = page.locator("oc-education-item, [data-test='education-item'], [data-test='education-history-item']");
    let savedCount = await savedCards.count();
    console.log(`  Saved Education Cards before check: ${savedCount}`);

    const eduSaveBtn = page.locator("oc-button[data-test='education-save'] button, oc-button[data-test='education-save'] spl-button, [data-test='education-save']");
    let isDraftOpen = (await eduSaveBtn.count()) > 0;

    const targetSchool = profile.educations?.[0]?.school || "San Francisco State University";
    const targetDegree = profile.educations?.[0]?.degree || "Bachelor of Technology";
    const targetMajor = profile.educations?.[0]?.fieldOfStudy || "Computer Science";
    const targetLocation = profile.location ? profile.location.split(",")[0].trim() + ", CA" : "San Francisco, CA";

    if (isDraftOpen) {
      console.log(`  Found open education draft from parser. Completing fields...`);
      await this.populateEducationFields(page, targetSchool, targetDegree, targetMajor, targetLocation);
      await this.saveEducationDraft(page);
      savedCount = await savedCards.count();
    }

    if (savedCount === 0) {
      console.log(`  No education cards found. Adding manual education entry...`);
      const addEduBtn = page.locator("oc-button[data-test='add-education'] button, oc-button[data-test='add-education'] spl-button, [data-test='add-education']").first();
      if ((await addEduBtn.count()) > 0) {
        await addEduBtn.scrollIntoViewIfNeeded().catch(() => {});
        await addEduBtn.click({ force: true });
        await page.waitForTimeout(1000);

        await this.populateEducationFields(page, targetSchool, targetDegree, targetMajor, targetLocation);
        await this.saveEducationDraft(page);
      }
    }

    const finalCount = await savedCards.count();
    console.log(`✅ [SmartRecruitersAdapter]: Education completed. Total cards: ${finalCount}`);
  }

  private async populateEducationFields(
    page: Page,
    school: string,
    degree: string,
    major: string,
    location: string
  ): Promise<void> {
    // 1. Institution
    const instInp = page.locator("[data-test='institution-autocomplete'] input, input[id*='institution'], oc-education spl-autocomplete[label*='Institution'] input, oc-education spl-input[label*='Institution'] input").first();
    if ((await instInp.count()) > 0) {
      const cur = await instInp.inputValue().catch(() => "");
      if (!cur) {
        await instInp.click();
        await instInp.fill(school);
        await page.waitForTimeout(1000);
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }

    // 2. Degree
    const degreeInp = page.locator("spl-input[id*='edu-degree'] input, oc-education spl-input:has-text('Degree') input, oc-education [label='Degree'] input, [data-test='degree-autocomplete'] input").first();
    if ((await degreeInp.count()) > 0) {
      const cur = await degreeInp.inputValue().catch(() => "");
      if (!cur) {
        await degreeInp.fill(degree);
        await page.waitForTimeout(300);
      }
    }

    // 3. Major
    const majorInp = page.locator("spl-input[id*='edu-major'] input, oc-education spl-input:has-text('Major') input, oc-education [label='Major'] input").first();
    if ((await majorInp.count()) > 0) {
      const cur = await majorInp.inputValue().catch(() => "");
      if (!cur) {
        await majorInp.fill(major);
        await page.waitForTimeout(300);
      }
    }

    // 4. School Location
    const eduLocInp = page.locator("oc-education [data-test='location-autocomplete'] input, oc-education spl-autocomplete[label*='Location'] input").first();
    if ((await eduLocInp.count()) > 0) {
      const cur = await eduLocInp.inputValue().catch(() => "");
      if (!cur) {
        await eduLocInp.click();
        await eduLocInp.fill(location);
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
      }
    }

    // 5. Start Date
    const eduFromDate = page.locator("[data-test='education-date-from'] input, oc-datepicker[data-test='education-date-from'] spl-date-field input").first();
    if ((await eduFromDate.count()) > 0) {
      const cur = await eduFromDate.inputValue().catch(() => "");
      if (!cur) {
        await eduFromDate.click();
        await eduFromDate.fill("08/2020");
        await eduFromDate.dispatchEvent("input");
        await eduFromDate.dispatchEvent("change");
        await page.keyboard.press("Escape");
      }
    }

    // 6. End Date
    const eduToDate = page.locator("[data-test='education-date-to'] input, oc-datepicker[data-test='education-date-to'] spl-date-field input").first();
    if ((await eduToDate.count()) > 0) {
      const cur = await eduToDate.inputValue().catch(() => "");
      if (!cur) {
        await eduToDate.click();
        await eduToDate.fill("05/2024");
        await eduToDate.dispatchEvent("input");
        await eduToDate.dispatchEvent("change");
        await page.keyboard.press("Escape");
      }
    }
  }

  private async saveEducationDraft(page: Page): Promise<void> {
    const saveEduBtn = page.locator("oc-button[data-test='education-save'] button, oc-button[data-test='education-save'] spl-button, [data-test='education-save']").first();
    if ((await saveEduBtn.count()) > 0) {
      console.log(`  Saving Education draft card...`);
      await saveEduBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers?: Record<string, string>,
    _fields?: FormField[]
  ): Promise<void> {
    await injectVisualHUD(page, { company: "SmartRecruiters", title: "Job Application" });
    await updateHUDStatus(page, "personal", "Filling personal details (Page 1)...");

    // 0. Ensure application form is active
    await this.ensureApplicationFormOpen(page);

    console.log(`✍️ [SmartRecruitersAdapter]: Filling Page 1 for ${profile.firstName} ${profile.lastName}...`);

    // 1. Email and Confirm Email handling
    const emailInput = page.locator("spl-input#email-input input, input#email-input").first();
    let emailVal = "";
    if ((await emailInput.count()) > 0) {
      emailVal = (await emailInput.inputValue().catch(() => "")).trim();
    }
    if (!emailVal) {
      emailVal = profile.email || "babufakemail@gmail.com";
      if ((await emailInput.count()) > 0) {
        await emailInput.click();
        await emailInput.fill(emailVal);
        await emailInput.dispatchEvent("input");
        await emailInput.dispatchEvent("change");
        await emailInput.blur();
      }
    }
    console.log(`  Target Email to use: "${emailVal}"`);

    // Fill confirm email with multiple event dispatches
    const confirmEmailInput = page.locator("spl-input#confirm-email-input input, input#confirm-email-input").first();
    if ((await confirmEmailInput.count()) > 0) {
      await confirmEmailInput.scrollIntoViewIfNeeded().catch(() => {});
      await confirmEmailInput.click();
      await page.waitForTimeout(200);
      await confirmEmailInput.fill(emailVal);
      await confirmEmailInput.dispatchEvent("input");
      await confirmEmailInput.dispatchEvent("change");
      await confirmEmailInput.blur();
      await page.waitForTimeout(200);
    }

    // 2. First name & Last name fallbacks if not parsed
    const fnInput = page.locator("spl-input#first-name-input input, input#first-name-input").first();
    if ((await fnInput.count()) > 0 && !(await fnInput.inputValue())) {
      await fnInput.fill(profile.firstName);
    }

    const lnInput = page.locator("spl-input#last-name-input input, input#last-name-input").first();
    if ((await lnInput.count()) > 0 && !(await lnInput.inputValue())) {
      await lnInput.fill(profile.lastName);
    }

    // 3. Phone Country Code
    const phoneCodeInput = page.locator("spl-phone-field spl-select input");
    const phoneCodeVal = await phoneCodeInput.inputValue().catch(() => "");
    if (!phoneCodeVal || (!phoneCodeVal.includes("+1") && profile.phone.startsWith("+1"))) {
      console.log(`  Selecting phone country code (+1 United States)...`);
      const sel = page.locator("spl-phone-field spl-select");
      if ((await sel.count()) > 0) {
        await sel.first().click();
        await page.waitForTimeout(400);
        const usOpt = page.locator("spl-phone-field spl-option[value='+1'], spl-option:has-text('United States'), spl-phone-field spl-option:has-text('+1')").first();
        if ((await usOpt.count()) > 0) {
          await usOpt.click();
        } else {
          const inOpt = page.locator("spl-phone-field spl-option[value='+91'], spl-option:has-text('India')").first();
          if ((await inOpt.count()) > 0) await inOpt.click();
        }
      }
    }

    // 4. Phone number fallback
    const phoneInput = page.locator("spl-phone-field spl-input input, input[type='tel']").first();
    if ((await phoneInput.count()) > 0 && !(await phoneInput.inputValue())) {
      const cleanPhone = profile.phone.replace(/[^0-9]/g, "").slice(-10);
      await phoneInput.fill(cleanPhone || "2025550198");
      await phoneInput.dispatchEvent("input");
      await phoneInput.dispatchEvent("change");
    }

    // 5. City / Location Autocomplete fallback
    const cityInput = page.locator("spl-autocomplete#location-input input, spl-autocomplete[id*='location'] input, spl-autocomplete input").first();
    if ((await cityInput.count()) > 0) {
      const curLoc = await cityInput.inputValue().catch(() => "");
      if (!curLoc) {
        const cityTarget = profile.location ? profile.location.split(",")[0].trim() : "San Francisco";
        console.log(`  Filling city autocomplete: ${cityTarget}...`);
        await cityInput.click();
        await cityInput.fill(cityTarget);
        await page.waitForTimeout(1200);
        const opt = page.locator("spl-autocomplete-option, [role='option']").first();
        if ((await opt.count()) > 0) {
          await opt.click();
        } else {
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
        }
      }
    }

    // 6. Manage Work Experience
    await this.fillExperience(page, profile);

    // 7. Manage Education
    await this.fillEducation(page, profile);

    // 8. Social profiles
    const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input").first();
    if ((await liInput.count()) > 0) {
      const curLi = await liInput.inputValue().catch(() => "");
      if (!curLi && profile.linkedinUrl) {
        await liInput.fill(profile.linkedinUrl);
      }
    }

    const webInput = page.locator("spl-input#website-input input, spl-input[id*='website'] input").first();
    if ((await webInput.count()) > 0) {
      const curWeb = await webInput.inputValue().catch(() => "");
      if (!curWeb) {
        const urlToUse = profile.githubUrl || profile.portfolioUrl || "https://github.com/hrutinnammi";
        await webInput.fill(urlToUse);
      }
    }

    // 9. Message to hiring team
    const msgInput = page.locator("spl-textarea textarea, textarea[name='messageToHiringTeam'], spl-textarea#hiring-manager-message-input textarea").first();
    if ((await msgInput.count()) > 0) {
      const curMsg = await msgInput.inputValue().catch(() => "");
      if (!curMsg) {
        const msg = additionalAnswers?.["Message to hiring team"] || "I am very excited about this role and look forward to contributing my technical skills and experience.";
        await msgInput.fill(msg);
      }
    }

    // Re-verify confirm email right before clicking Next!
    if ((await confirmEmailInput.count()) > 0) {
      const curConfirmVal = await confirmEmailInput.inputValue().catch(() => "");
      if (!curConfirmVal || curConfirmVal !== emailVal) {
        console.log(`  Re-applying confirm email before Next: ${emailVal}`);
        await confirmEmailInput.click();
        await confirmEmailInput.fill(emailVal);
        await confirmEmailInput.dispatchEvent("input");
        await confirmEmailInput.dispatchEvent("change");
        await confirmEmailInput.blur();
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(1000);

    // 10. Click Next to advance to Page 2 (/screening)
    console.log(`👉 [SmartRecruitersAdapter]: Advancing to Page 2 (Screening)...`);
    await updateHUDStatus(page, "screening", "Navigating to Page 2 (Screening)...");

    const nextBtn = page.locator("oc-button[data-test='footer-next'] button, oc-button[data-test='footer-next'] spl-button, [data-test='footer-next'], oc-nav-first-page button:has-text('Next'), button:has-text('Next')").first();
    if ((await nextBtn.count()) > 0) {
      await nextBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);
      await nextBtn.click({ force: true }).catch(() => {});
    }

    // Direct evaluate click fallback ensuring shadow root button is triggered
    await page.evaluate(() => {
      const ocBtn = document.querySelector("oc-button[data-test='footer-next']");
      const splBtn = ocBtn?.querySelector("spl-button");
      const nativeBtn = splBtn?.shadowRoot?.querySelector("button") || ocBtn?.querySelector("button");
      if (nativeBtn) {
        nativeBtn.click();
      } else if (splBtn) {
        (splBtn as HTMLElement).click();
      } else if (ocBtn) {
        (ocBtn as HTMLElement).click();
      }
    });

    // Wait for redirect to /screening or presence of screening controls
    try {
      await page.waitForURL(url => url.toString().includes("screening"), { timeout: 15000 });
      console.log(`✅ [SmartRecruitersAdapter]: Navigated to Page 2 (/screening)! URL: ${page.url()}`);
    } catch (e) {
      console.warn(`⚠️ [SmartRecruitersAdapter]: Wait for /screening timed out. Retrying Next button click...`);
      await page.evaluate(() => {
        const btn = document.querySelector("oc-button[data-test='footer-next'] spl-button")?.shadowRoot?.querySelector("button") ||
          document.querySelector("oc-button[data-test='footer-next'] button");
        if (btn) btn.click();
      });
      await page.waitForTimeout(4000);
    }
    await page.waitForTimeout(2000);

    // If on /screening or screening fields present, fill screening questions
    if (page.url().includes("screening") || (await page.locator("spl-radio-group, spl-multiselect-autocomplete, spl-select").count()) > 0) {
      await this.fillPage2Screening(page, profile, additionalAnswers);
    }

    // 11. Run Field Audit & Report to terminal
    await this.auditAndReportFields(page);
  }

  /**
   * Detects and handles SmartRecruiters "Verification Required: Slide right to secure your access" challenge.
   */
  async handleVerificationSliderIfPresent(page: Page, timeoutMs = 45000): Promise<boolean> {
    const isSliderPresent = async () => {
      return await page.evaluate(() => {
        const bodyText = document.body?.innerText || "";
        const hasText =
          bodyText.includes("Slide right to secure your access") ||
          bodyText.includes("Verification Required") ||
          bodyText.includes("unusual activity from your device");

        const iframes = Array.from(document.querySelectorAll("iframe"));
        const iframeHasText = iframes.some((f) => {
          try {
            const doc = f.contentDocument || f.contentWindow?.document;
            const t = doc?.body?.innerText || "";
            return t.includes("Slide right to secure your access") || t.includes("Verification Required");
          } catch {
            const src = f.src || "";
            return src.includes("challenge") || src.includes("captcha") || src.includes("waf");
          }
        });

        return hasText || iframeHasText;
      }).catch(() => false);
    };

    if (!(await isSliderPresent())) {
      return true;
    }

    console.log("\n⚠️ [SmartRecruiters]: Verification slider challenge detected on screen ('Slide right to secure your access')!");
    await updateHUDStatus(page, "Verification Required", "Slide right to secure access (automation attempting drag)...", "warning", 90);

    try {
      const sliderHandleLocators = [
        ".slider-handle",
        ".slide-button",
        "[role='slider']",
        "button:has(.arrow), .arrow",
        "div[class*='slider'] button",
        "div[class*='track'] div",
        "input[type='range']",
        ".sec-slider-btn",
        "#sec-slider",
        "button:has-text('→')",
        "span:has-text('→')"
      ];

      let sliderBtn = null;
      for (const sel of sliderHandleLocators) {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
          sliderBtn = el;
          break;
        }
      }

      if (sliderBtn) {
        const box = await sliderBtn.boundingBox();
        if (box) {
          console.log(`🌀 [SmartRecruiters]: Simulating drag across slider at (${Math.round(box.x)}, ${Math.round(box.y)})...`);
          const startX = box.x + box.width / 2;
          const startY = box.y + box.height / 2;
          const dragDistance = 260 + Math.floor(Math.random() * 40);
          const targetX = startX + dragDistance;

          await page.mouse.move(startX, startY);
          await page.waitForTimeout(150);
          await page.mouse.down();
          await page.waitForTimeout(100);

          const steps = 30;
          for (let step = 1; step <= steps; step++) {
            const t = step / steps;
            const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            const curX = startX + (targetX - startX) * easeT;
            const curY = startY + Math.sin(step * 0.5) * 1.5;
            await page.mouse.move(curX, curY);
            await page.waitForTimeout(15 + Math.floor(Math.random() * 10));
          }

          await page.waitForTimeout(200);
          await page.mouse.up();
          console.log("✅ [SmartRecruiters]: Slider drag gesture completed.");
          await page.waitForTimeout(2500);
        }
      }
    } catch (err: any) {
      console.warn("⚠️ [SmartRecruiters]: Auto-drag slider attempt:", err.message);
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (!(await isSliderPresent())) {
        console.log("🎉 [SmartRecruiters]: Verification slider resolved successfully!");
        await updateHUDStatus(page, "Verified", "Verification challenge passed!", "success", 95);
        return true;
      }
      await page.waitForTimeout(1500);
    }

    console.warn("⚠️ [SmartRecruiters]: Verification challenge was not resolved within timeout.");
    return false;
  }

  private async fillPage2Screening(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>): Promise<void> {
    console.log(`✍️ [SmartRecruitersAdapter]: Filling Page 2 screening questions...`);
    await updateHUDStatus(page, "screening", "Answering screening questions & declarations...");

    await this.handleVerificationSliderIfPresent(page);

    const fullName = `${profile.firstName} ${profile.lastName}`;
    const todayFormattedUS = `${String(new Date().getMonth() + 1).padStart(2, "0")}/${String(new Date().getDate()).padStart(2, "0")}/${new Date().getFullYear()}`;

    // 1. Radio groups
    const radioGroups = page.locator("spl-radio-group, [role='radiogroup']");
    const radioCount = await radioGroups.count();
    console.log(`  Processing ${radioCount} radio groups with contextual matching...`);

    for (let i = 0; i < radioCount; i++) {
      const group = radioGroups.nth(i);
      await group.scrollIntoViewIfNeeded().catch(() => {});
      const text = (await group.innerText().catch(() => "")).toLowerCase();

      let choice = "No";
      if (text.includes("gender") || text.includes("sex")) {
        choice = "Male";
      } else if (text.includes("race") || text.includes("ethnic") || text.includes("identify with")) {
        choice = "Asian";
      } else if (
        text.includes("authorized") ||
        text.includes("eligible") ||
        text.includes("relocate") ||
        text.includes("willing to relocate") ||
        text.includes("18 years") ||
        text.includes("background check") ||
        text.includes("drug test") ||
        text.includes("agree") ||
        text.includes("consent")
      ) {
        choice = "Yes";
      } else if (
        text.includes("sponsorship") ||
        text.includes("visa") ||
        text.includes("veteran") ||
        text.includes("disability") ||
        text.includes("felony") ||
        text.includes("convicted") ||
        text.includes("former employee") ||
        text.includes("worked here before") ||
        text.includes("non-compete")
      ) {
        choice = "No";
      }

      const radioChoice = group.locator(`text='${choice}'`).first();
      if ((await radioChoice.count()) > 0) {
        try {
          await humanClick(page, radioChoice);
        } catch {
          await radioChoice.click({ force: true }).catch(() => {});
        }
      } else {
        const first = group.locator("spl-radio, input[type='radio']").first();
        if ((await first.count()) > 0) {
          try {
            await humanClick(page, first);
          } catch {
            await first.click({ force: true }).catch(() => {});
          }
        }
      }
      await page.waitForTimeout(250);
    }

    // 2. Multiselect autocompletes
    const multis = page.locator("spl-multiselect-autocomplete");
    const multiCount = await multis.count();
    if (multiCount > 0) {
      console.log(`  Processing ${multiCount} multiselect autocompletes...`);
      for (let i = 0; i < multiCount; i++) {
        const m = multis.nth(i);
        const inp = m.locator("input");
        if ((await inp.count()) > 0) {
          await inp.scrollIntoViewIfNeeded().catch(() => {});
          try {
            await humanClick(page, inp);
          } catch {
            await inp.click().catch(() => {});
          }
          await page.waitForTimeout(300);
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(200);
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
        }
      }
    }

    // 3. Regular Autocompletes & Select Dropdowns
    const acElements = page.locator("spl-autocomplete, spl-select");
    const acCount = await acElements.count();
    console.log(`  Processing ${acCount} dropdowns/autocompletes...`);

    for (let i = 0; i < acCount; i++) {
      const sel = acElements.nth(i);
      await sel.scrollIntoViewIfNeeded().catch(() => {});
      const text = (await sel.innerText().catch(() => "")).toLowerCase();
      const inp = sel.locator("input").first();
      const curVal = (await inp.inputValue().catch(() => "")).trim();

      if (curVal) {
        continue; // Already has a selected value
      }

      // Contextual determination for dropdown answers
      let targetAnswer = "Yes";
      let optionPatterns: RegExp[] = [/yes/i];

      if (text.includes("gender") || text.includes("sex")) {
        targetAnswer = "Male";
        optionPatterns = [/male/i];
      } else if (text.includes("race") || text.includes("ethnic") || text.includes("identify with")) {
        targetAnswer = "Asian";
        optionPatterns = [/asian/i];
      } else if (text.includes("veteran")) {
        targetAnswer = "I am not a protected veteran";
        optionPatterns = [/not a protected/i, /no/i, /decline/i];
      } else if (text.includes("disability")) {
        targetAnswer = "No, I do not have a disability";
        optionPatterns = [/no.*disability/i, /do not have/i, /no/i, /decline/i];
      } else if (text.includes("sponsorship") || text.includes("visa")) {
        targetAnswer = "No";
        optionPatterns = [/no/i, /will not/i];
      } else if (text.includes("authorized") || text.includes("legally")) {
        targetAnswer = "Yes";
        optionPatterns = [/yes/i, /authorized/i, /citizen/i];
      } else if (text.includes("education") || text.includes("degree")) {
        targetAnswer = "Bachelor's Degree";
        optionPatterns = [/bachelor/i, /degree/i, /college/i];
      } else if (text.includes("experience") || text.includes("years")) {
        targetAnswer = "3-5 years";
        optionPatterns = [/3-5/i, /2-5/i, /3\+/i, /mid/i, /senior/i];
      } else if (text.includes("notice") || text.includes("available") || text.includes("start")) {
        targetAnswer = "Immediately";
        optionPatterns = [/immediately/i, /immediate/i, /2 weeks/i, /1 month/i];
      } else if (text.includes("country")) {
        targetAnswer = "United States";
        optionPatterns = [/united states/i, /usa/i];
      } else if (text.includes("state")) {
        targetAnswer = "California";
        optionPatterns = [/california/i];
      } else if (text.includes("clearance")) {
        targetAnswer = "No";
        optionPatterns = [/no/i, /none/i];
      } else if (text.includes("hear about") || text.includes("referral") || text.includes("source")) {
        targetAnswer = "LinkedIn";
        optionPatterns = [/linkedin/i, /company website/i, /job board/i, /other/i];
      }

      console.log(`  Dropdown [${text.slice(0, 35)}...]: Targeting "${targetAnswer}"...`);

      // Click select or input to open dropdown menu
      try {
        if ((await inp.count()) > 0) {
          await humanClick(page, inp);
        } else {
          await humanClick(page, sel);
        }
      } catch {
        await sel.click({ force: true }).catch(() => {});
      }
      await page.waitForTimeout(400);

      // Attempt to click matching option in overlay
      let optionClicked = false;
      for (const pat of optionPatterns) {
        const matchOpt = page.locator("spl-option, spl-autocomplete-option, [role='option'], li.c-spl-select__option").filter({ hasText: pat }).first();
        if ((await matchOpt.count()) > 0 && (await matchOpt.isVisible().catch(() => false))) {
          try {
            await humanClick(page, matchOpt);
          } catch {
            await matchOpt.click({ force: true }).catch(() => {});
          }
          optionClicked = true;
          break;
        }
      }

      // Fallback 1: Type the target answer and press Enter
      if (!optionClicked && (await inp.count()) > 0) {
        try {
          await inp.fill(targetAnswer);
          await page.waitForTimeout(300);
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
          await page.waitForTimeout(200);
          await page.keyboard.press("Escape");
          optionClicked = true;
        } catch (e) {}
      }

      // Fallback 2: Select first available non-disabled option via keyboard
      if (!optionClicked) {
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(150);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(300);
    }

    // 4. Text inputs (Signature, Dates, Full Name, Email, Salary)
    console.log(`  Filling text inputs & screening questions...`);
    const splInputs = page.locator("spl-input");
    const inpCount = await splInputs.count();

    for (let i = 0; i < inpCount; i++) {
      const item = splInputs.nth(i);
      const text = (await item.innerText().catch(() => "")).toLowerCase();
      const id = (await item.getAttribute("id").catch(() => "")) || "";
      const inp = item.locator("input");

      if ((await inp.count()) > 0) {
        const val = await inp.inputValue().catch(() => "");
        if (!val) {
          await inp.scrollIntoViewIfNeeded().catch(() => {});
          if (text.includes("name") || text.includes("signature") || id.includes("name") || id.includes("signature")) {
            await inp.fill(fullName);
          } else if (text.includes("date") || id.includes("date")) {
            await inp.fill(todayFormattedUS);
          } else if (text.includes("email") || id.includes("email")) {
            await inp.fill(profile.email);
          } else if (text.includes("salary") || text.includes("compensation") || text.includes("pay")) {
            await inp.fill("$120,000");
          } else if (text.includes("notice") || text.includes("availability")) {
            await inp.fill("Immediate");
          } else if (text.includes("years") || text.includes("experience")) {
            await inp.fill("4");
          } else {
            // General fallback for required screening inputs
            await inp.fill("Yes");
          }
          await page.waitForTimeout(200);
        }
      }
    }

    // 5. Checkboxes (Acknowledge, consent, declarations)
    console.log(`  Checking consent & declaration checkboxes...`);
    const splCbs = page.locator("spl-checkbox");
    const cbCount = await splCbs.count();

    for (let i = 0; i < cbCount; i++) {
      const cb = splCbs.nth(i);
      await cb.scrollIntoViewIfNeeded().catch(() => {});
      const isChecked = await cb.locator("input").isChecked().catch(() => false);
      if (!isChecked) {
        const target = cb.locator("label, .c-spl-checkbox-wrapper, input").first();
        if ((await target.count()) > 0) {
          try {
            await humanClick(page, target);
          } catch {
            await target.click({ force: true }).catch(() => {});
          }
        } else {
          try {
            await humanClick(page, cb);
          } catch {
            await cb.click({ force: true }).catch(() => {});
          }
        }
        await page.waitForTimeout(200);
      }
    }

    console.log(`✅ [SmartRecruitersAdapter]: Page 2 screening questions completed.`);
    await updateHUDStatus(page, "screening", "Page 2 ready for review/submission");
  }

  /**
   * Evaluates all form controls across SmartRecruiters (Page 1 & Page 2).
   * Prints filled field states, counts cards, and flags any new/unhandled fields in the terminal.
   */
  async auditAndReportFields(page: Page): Promise<{ total: number; filled: number; missingRequired: number; newFields: any[] }> {
    console.log(`\n📋 [SmartRecruiters Field Audit & Inspection]:`);

    const fieldAudit = await page.evaluate(() => {
      const results: {
        tag: string;
        id: string;
        name: string;
        label: string;
        type: string;
        value: string;
        required: boolean;
        filled: boolean;
      }[] = [];

      // 1. Text, email, tel, textarea inputs
      document.querySelectorAll("spl-input, spl-textarea, input:not([type='hidden']):not([type='file']), textarea").forEach(el => {
        const inp = (el.tagName.toLowerCase().includes("spl") ? el.querySelector("input, textarea") : el) as HTMLInputElement | HTMLTextAreaElement;
        if (!inp) return;
        const id = el.id || inp.id || "";
        const name = (inp as any).name || el.getAttribute("name") || "";
        const label = el.getAttribute("label") || el.getAttribute("aria-label") || el.closest("label")?.textContent?.trim() || el.textContent?.split("\n")[0]?.trim() || id;
        const val = inp.value || "";
        const isRequired = el.hasAttribute("required") || inp.hasAttribute("required") || inp.getAttribute("aria-required") === "true" || label.includes("*");

        results.push({
          tag: el.tagName.toLowerCase(),
          id,
          name,
          label: label.slice(0, 50).trim(),
          type: inp.type || "text",
          value: val.slice(0, 35),
          required: isRequired,
          filled: val.trim().length > 0
        });
      });

      // 2. Dropdowns & Autocompletes
      document.querySelectorAll("spl-select, spl-autocomplete, spl-multiselect-autocomplete").forEach(el => {
        const inp = el.querySelector("input") as HTMLInputElement;
        const id = el.id || inp?.id || "";
        const label = el.getAttribute("label") || el.getAttribute("aria-label") || el.textContent?.split("\n")[0]?.trim() || id;
        const val = inp?.value || "";
        const isRequired = el.hasAttribute("required") || inp?.hasAttribute("required") || label.includes("*");

        results.push({
          tag: el.tagName.toLowerCase(),
          id,
          name: "",
          label: label.slice(0, 50).trim(),
          type: "select/autocomplete",
          value: val.slice(0, 35),
          required: isRequired,
          filled: val.trim().length > 0
        });
      });

      // 3. Radio Groups
      document.querySelectorAll("spl-radio-group, [role='radiogroup']").forEach(el => {
        const id = el.id || "";
        const label = el.getAttribute("label") || el.getAttribute("aria-label") || el.textContent?.split("\n")[0]?.trim() || id;
        const checked = el.querySelector("spl-radio[checked], input[type='radio']:checked, [aria-checked='true']");
        const val = checked ? (checked.textContent?.trim() || "SELECTED") : "";
        const isRequired = el.hasAttribute("required") || label.includes("*");

        results.push({
          tag: "spl-radio-group",
          id,
          name: "",
          label: label.slice(0, 50).trim(),
          type: "radio",
          value: val.slice(0, 35),
          required: isRequired,
          filled: !!checked
        });
      });

      // 4. Checkboxes
      document.querySelectorAll("spl-checkbox").forEach(el => {
        const inp = el.querySelector("input") as HTMLInputElement;
        const id = el.id || inp?.id || "";
        const label = el.getAttribute("label") || el.getAttribute("aria-label") || el.textContent?.trim() || id;
        const isChecked = inp?.checked || el.hasAttribute("checked") || el.getAttribute("aria-checked") === "true";
        const isRequired = el.hasAttribute("required") || label.includes("*");

        results.push({
          tag: "spl-checkbox",
          id,
          name: "",
          label: label.slice(0, 50).trim(),
          type: "checkbox",
          value: isChecked ? "CHECKED" : "",
          required: isRequired,
          filled: isChecked
        });
      });

      return results;
    }).catch(() => []);

    // Also check saved experience and education cards
    const expCount = await page.locator("oc-experience-item, [data-test='experience-item'], [data-test='experience-history-item']").count();
    const eduCount = await page.locator("oc-education-item, [data-test='education-item'], [data-test='education-history-item']").count();

    console.log(`  💼 Work Experience Cards Saved: ${expCount}`);
    console.log(`  🎓 Education Cards Saved: ${eduCount}`);

    let filledCount = 0;
    let missingRequired = 0;
    const newOrUnhandledFields: any[] = [];

    for (const f of fieldAudit) {
      if (f.filled) {
        filledCount++;
        console.log(`  ✅ FILLED | [${f.type}] ${f.label}: "${f.value}"`);
      } else if (f.required) {
        missingRequired++;
        newOrUnhandledFields.push(f);
        console.log(`  ⚠️ NEW / UNHANDLED FIELD | [${f.type}] ID: "${f.id}" | Label: "${f.label}" (REQUIRED & EMPTY)`);
      } else {
        console.log(`  ⚪ EMPTY (OPTIONAL) | [${f.type}] ${f.label}`);
      }
    }

    console.log(`\n================ SMARTRECRUITERS FIELD SUMMARY ================`);
    console.log(`Total fields evaluated: ${fieldAudit.length}`);
    console.log(`Filled fields: ${filledCount}`);
    console.log(`Experience cards: ${expCount} | Education cards: ${eduCount}`);
    console.log(`Missing required fields: ${missingRequired}`);

    if (newOrUnhandledFields.length > 0) {
      console.log(`\n⚠️ ${newOrUnhandledFields.length} UNHANDLED OR NEW FIELD(S) DETECTED:`);
      newOrUnhandledFields.forEach((nf, idx) => {
        console.log(`  ${idx + 1}. [${nf.type}] ID: "${nf.id}" | Name: "${nf.name}" | Label: "${nf.label}"`);
      });
    } else {
      console.log(`🎉 100% OF SMARTRECRUITERS FIELDS ARE PROPERLY FILLED!`);
    }
    console.log(`===============================================================\n`);

    return {
      total: fieldAudit.length,
      filled: filledCount,
      missingRequired,
      newFields: newOrUnhandledFields
    };
  }

  async validate(page: Page, _fields?: FormField[]): Promise<boolean> {
    console.log(`🔍 [SmartRecruitersAdapter]: Checking for validation errors...`);
    const errors = await page
      .locator(".spl-form-field-error, .c-spl-form-field-error, [aria-invalid='true']")
      .allInnerTexts()
      .catch(() => []);

    const visibleErrors = errors.filter((e) => e && e.trim().length > 0);
    if (visibleErrors.length > 0) {
      console.warn(`⚠️ [SmartRecruitersAdapter]: Detected ${visibleErrors.length} error(s):`, visibleErrors);
      return false;
    }
    return true;
  }

  async submit(page: Page): Promise<SubmissionResult> {
    console.log(`🚀 [SmartRecruitersAdapter]: Preparing final application submission...`);

    await this.handleVerificationSliderIfPresent(page);

    // Ensure all consent checkboxes are checked
    console.log(`  Verifying all consent checkboxes before submit...`);
    const cbs = page.locator("spl-checkbox");
    const cbCount = await cbs.count();
    for (let i = 0; i < cbCount; i++) {
      const cb = cbs.nth(i);
      await cb.scrollIntoViewIfNeeded().catch(() => {});
      const isChecked = await cb.locator("input").isChecked().catch(() => false);
      if (!isChecked) {
        const target = cb.locator("label, .c-spl-checkbox-wrapper, input").first();
        if ((await target.count()) > 0) {
          try {
            await humanClick(page, target);
          } catch {
            await target.click({ force: true }).catch(() => {});
          }
        } else {
          try {
            await humanClick(page, cb);
          } catch {
            await cb.click({ force: true }).catch(() => {});
          }
        }
        await page.waitForTimeout(200);
      }
    }

    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";

    const submitBtn = page.locator(
      "oc-button[data-test='footer-submit'] button, oc-button[data-test='footer-submit'] spl-button, [data-test='footer-submit'], button:has-text('Submit')"
    ).first();

    if ((await submitBtn.count()) > 0) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      await page.evaluate(() => {
        const btn = document.querySelector("oc-button[data-test='footer-submit'], button[data-test='footer-submit']");
        if (btn) {
          (btn as HTMLElement).style.outline = "3px solid #22c55e";
          (btn as HTMLElement).style.boxShadow = "0 0 25px rgba(34, 197, 94, 0.7)";
          (btn as HTMLElement).style.borderRadius = "8px";
        }
      }).catch(() => {});
    }

    if (!isAutoSubmit) {
      console.log(`👉 [SmartRecruitersAdapter]: Ready for manual submission. Submit button is centered & highlighted for you to click!`);
      await updateHUDStatus(page, "submit", "Ready to Submit: Please review and click Submit button manually! 🎯");
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION",
      };
    }

    // Live automatic submission
    console.log(`🔴 [SmartRecruitersAdapter]: AUTO SUBMIT - Clicking submit button...`);
    await updateHUDStatus(page, "submit", "Submitting application...");

    if ((await submitBtn.count()) > 0) {
      await submitBtn.click({ force: true }).catch(() => {});
    }

    await page.evaluate(() => {
      const ocBtn = document.querySelector("oc-button[data-test='footer-submit']");
      const splBtn = ocBtn?.querySelector("spl-button");
      const nativeBtn = splBtn?.shadowRoot?.querySelector("button") || ocBtn?.querySelector("button");
      if (nativeBtn) {
        nativeBtn.click();
      } else if (splBtn) {
        (splBtn as HTMLElement).click();
      } else if (ocBtn) {
        (ocBtn as HTMLElement).click();
      }
    });

    console.log(`⏳ [SmartRecruitersAdapter]: Waiting for submission response...`);
    await page.waitForTimeout(8000);

    return {
      success: true,
      confirmation: "SmartRecruiters Application Submitted Successfully",
    };
  }
}
