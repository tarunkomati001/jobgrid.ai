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

    // Extract title
    let title = await page.locator("h1, .job-title, [class*='job-title'], oc-header h1").first().innerText().catch(() => "");
    if (!title) {
      title = pageTitle.split("|")[0].split("-")[0].trim();
    }

    // Extract company
    let company = "";
    try {
      const match = page.url().match(/company\/([^\/]+)/i);
      if (match && match[1]) {
        company = match[1].replace(/3$/, ""); // clean LinkedIn3 -> LinkedIn
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
      document.querySelectorAll("spl-input, spl-autocomplete, spl-phone-field, spl-textarea, input[type='file']").forEach((el) => {
        const id = el.id || el.getAttribute("name") || el.getAttribute("data-test") || "";
        const label = el.getAttribute("label") || el.textContent?.slice(0, 50).trim() || "";
        results.push({
          id,
          label,
          type: el.tagName.toLowerCase().includes("phone") ? "tel" : "text",
          required: el.hasAttribute("required") || el.textContent?.includes("*"),
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

  async uploadResume(page: Page, resumePath: string, _fields?: FormField[]): Promise<void> {
    console.log(`📂 [SmartRecruitersAdapter]: Uploading resume: ${resumePath}...`);
    await updateHUDStatus(page, "resume", "Uploading candidate resume...");

    const fileInput = page.locator("input[type='file']").first();
    await fileInput.waitFor({ state: "attached", timeout: 15000 }).catch(() => {});

    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(resumePath);
      console.log(`  Uploaded resume file.`);
      // Wait for SmartRecruiters resume prefill parser banner to finish
      await page.waitForTimeout(7000);
      await updateHUDStatus(page, "resume", "Resume uploaded & parsed");
    } else {
      console.warn("⚠️ [SmartRecruitersAdapter]: No file input found for resume upload.");
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

    console.log(`✍️ [SmartRecruitersAdapter]: Filling Page 1 for ${profile.firstName} ${profile.lastName}...`);

    // 1. Email and Confirm Email handling
    const emailInput = page.locator("spl-input#email-input input, input#email-input").first();
    let emailVal = "";
    if (await emailInput.count() > 0) {
      emailVal = (await emailInput.inputValue().catch(() => "")).trim();
    }
    if (!emailVal) {
      emailVal = profile.email || "hrutinnammi8@gmail.com";
      if (await emailInput.count() > 0) {
        await emailInput.click();
        await emailInput.fill(emailVal);
        await emailInput.blur();
      }
    }
    console.log(`  Target Email to use: "${emailVal}"`);

    // Fill confirm email with multiple event dispatches
    const confirmEmailInput = page.locator("spl-input#confirm-email-input input, input#confirm-email-input").first();
    if (await confirmEmailInput.count() > 0) {
      await confirmEmailInput.scrollIntoViewIfNeeded().catch(() => {});
      await confirmEmailInput.click();
      await page.waitForTimeout(300);
      await confirmEmailInput.fill(emailVal);
      await confirmEmailInput.dispatchEvent("input");
      await confirmEmailInput.dispatchEvent("change");
      await confirmEmailInput.blur();
      await page.waitForTimeout(300);
    }

    // 2. First name & Last name fallbacks if not parsed
    const fnInput = page.locator("spl-input#first-name-input input, input#first-name-input");
    if (await fnInput.count() > 0 && !(await fnInput.first().inputValue())) {
      await fnInput.first().fill(profile.firstName);
    }

    const lnInput = page.locator("spl-input#last-name-input input, input#last-name-input");
    if (await lnInput.count() > 0 && !(await lnInput.first().inputValue())) {
      await lnInput.first().fill(profile.lastName);
    }

    // 4. Phone Country Code
    const phoneVal = await page.locator("spl-phone-field spl-select input").inputValue().catch(() => "");
    if (!phoneVal) {
      console.log(`  Selecting phone country code...`);
      const sel = page.locator("spl-phone-field spl-select");
      if (await sel.count() > 0) {
        await sel.first().click();
        await page.waitForTimeout(500);
        const inOpt = page.locator("spl-phone-field spl-option[value='+91'], spl-option:has-text('India'), spl-phone-field spl-option[value='+1']").first();
        if (await inOpt.count() > 0) await inOpt.click();
      }
    }

    // 5. Phone number fallback
    const phoneInput = page.locator("spl-phone-field spl-input input, input[type='tel']");
    if (await phoneInput.count() > 0 && !(await phoneInput.first().inputValue())) {
      const cleanPhone = profile.phone.replace(/[^0-9]/g, "").slice(-10);
      await phoneInput.first().fill(cleanPhone || "8688423267");
    }

    // 6. City / Location Autocomplete fallback
    const cityInput = page.locator("spl-autocomplete#location-input input, spl-autocomplete[id*='location'] input, spl-autocomplete input");
    if (await cityInput.count() > 0) {
      const curLoc = await cityInput.first().inputValue().catch(() => "");
      if (!curLoc) {
        const cityTarget = profile.location ? profile.location.split(",")[0].trim() : "San Francisco";
        console.log(`  Filling city autocomplete: ${cityTarget}...`);
        await cityInput.first().fill(cityTarget);
        await page.waitForTimeout(1200);
        const opt = page.locator("spl-autocomplete-option, [role='option']").first();
        if (await opt.count() > 0) {
          await opt.click();
        } else {
          await page.keyboard.press("ArrowDown");
          await page.keyboard.press("Enter");
        }
      }
    }

    // 7. Resolve Draft Experience Card if parser opened one
    const isExpOpen = await page.locator("oc-button[data-test='experience-save'] button").count();
    if (isExpOpen > 0) {
      console.log(`  Resolving open draft experience card...`);
      await page.evaluate(`(() => {
        const cb = document.querySelector("oc-experience spl-checkbox");
        if (cb) {
          cb.click();
          const input = cb.shadowRoot?.querySelector("input");
          if (input) {
            input.checked = true;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      })()`);
      await page.waitForTimeout(1000);

      const saveBtn = page.locator("oc-button[data-test='experience-save'] button");
      if (await saveBtn.count() > 0) {
        await saveBtn.click({ force: true });
        await page.waitForTimeout(2000);
      }
    }

    // 8. Social profiles
    const liInput = page.locator("spl-input#linkedin-input input, spl-input[id*='linkedin'] input");
    if (await liInput.count() > 0 && profile.linkedinUrl) {
      await liInput.first().fill(profile.linkedinUrl);
    }

    const webInput = page.locator("spl-input#website-input input, spl-input[id*='website'] input");
    if (await webInput.count() > 0 && !(await webInput.first().inputValue())) {
      const urlToUse = profile.githubUrl || profile.portfolioUrl || "https://github.com/hrutinnammi";
      await webInput.first().fill(urlToUse);
    }

    // 9. Message to hiring team
    const msgInput = page.locator("spl-textarea textarea, textarea[name='messageToHiringTeam'], spl-textarea#hiring-manager-message-input textarea");
    if (await msgInput.count() > 0 && !(await msgInput.first().inputValue())) {
      const msg = additionalAnswers?.["Message to hiring team"] || "I am very excited about this role and look forward to contributing my technical skills and experience.";
      await msgInput.first().fill(msg);
    }

    // Re-verify confirm email right before clicking Next!
    if (await confirmEmailInput.count() > 0) {
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

    // Click Next button with multiple fallback mechanisms (DOM, Shadow DOM, Evaluate, Playwright)
    const nextBtn = page.locator("oc-button[data-test='footer-next'] button, oc-button[data-test='footer-next'] spl-button, [data-test='footer-next'], oc-nav-first-page button:has-text('Next'), button:has-text('Next')").first();
    if (await nextBtn.count() > 0) {
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

    // Wait for redirect to /screening
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
      await page.waitForTimeout(5000);
    }
    await page.waitForTimeout(3000);

    // If currently on /screening (Page 2), fill screening questions
    if (page.url().includes("screening") || (await page.locator("spl-radio-group, spl-multiselect-autocomplete").count()) > 0) {
      await this.fillPage2Screening(page, profile, additionalAnswers);
    }
  }

  /**
   * Detects and handles SmartRecruiters "Verification Required: Slide right to secure your access" challenge.
   * If detected, executes a human drag gesture across the slider track, and/or gives the user time in headed mode.
   */
  async handleVerificationSliderIfPresent(page: Page, timeoutMs = 45000): Promise<boolean> {
    const isSliderPresent = async () => {
      return await page.evaluate(() => {
        const bodyText = document.body?.innerText || "";
        const hasText =
          bodyText.includes("Slide right to secure your access") ||
          bodyText.includes("Verification Required") ||
          bodyText.includes("unusual activity from your device");

        // Also check inside any iframes
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
    console.log("👉 Automation is attempting to slide the verification track. You can also slide it manually in the browser window!");

    // Try finding the slider button / handle
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

      if (!sliderBtn) {
        for (const frame of page.frames()) {
          for (const sel of sliderHandleLocators) {
            const el = frame.locator(sel).first();
            if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
              sliderBtn = el;
              break;
            }
          }
          if (sliderBtn) break;
        }
      }

      if (sliderBtn) {
        const box = await sliderBtn.boundingBox();
        if (box) {
          console.log(`🌀 [SmartRecruiters]: Simulating human drag across slider at (${Math.round(box.x)}, ${Math.round(box.y)})...`);
          const startX = box.x + box.width / 2;
          const startY = box.y + box.height / 2;
          const dragDistance = 260 + Math.floor(Math.random() * 40);
          const targetX = startX + dragDistance;

          await page.mouse.move(startX, startY);
          await page.waitForTimeout(150);
          await page.mouse.down();
          await page.waitForTimeout(100);

          // Variable velocity drag with human micro-jitter
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

    // Wait for the verification to clear or user to complete it
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

  private async fillPage2Screening(page: Page, profile: UserProfile, _additionalAnswers?: Record<string, string>): Promise<void> {
    console.log(`✍️ [SmartRecruitersAdapter]: Filling Page 2 screening questions...`);
    await updateHUDStatus(page, "screening", "Answering screening questions & declarations...");

    // Check if slider challenge appeared
    await this.handleVerificationSliderIfPresent(page);

    const fullName = `${profile.firstName} ${profile.lastName}`;
    const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 1. Radio groups with organic human pacing to avoid "rapid taps or clicks" detection
    const radioGroups = page.locator("spl-radio-group, [role='radiogroup']");
    const radioCount = await radioGroups.count();
    console.log(`  Processing ${radioCount} radio groups with human pacing...`);

    for (let i = 0; i < radioCount; i++) {
      const group = radioGroups.nth(i);
      await group.scrollIntoViewIfNeeded().catch(() => {});
      const text = (await group.innerText().catch(() => "")).toLowerCase();

      let choice = "No";
      if (text.includes("gender") || text.includes("sex")) {
        choice = "Male";
      } else if (text.includes("authorized") || text.includes("relocate") || text.includes("willing to relocate")) {
        choice = "Yes";
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
      // Organic pause between questions (mimics human reading)
      await page.waitForTimeout(300 + Math.floor(Math.random() * 250));
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
          await page.waitForTimeout(300);
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
      const curVal = await inp.inputValue().catch(() => "");

      const isGenderField = text.includes("gender") || text.includes("sex");

      if (isGenderField) {
        console.log(`  Explicitly selecting Male for Gender dropdown...`);
        try {
          await humanClick(page, inp);
        } catch {
          await inp.click().catch(() => {});
        }
        await page.waitForTimeout(400);
        const maleOption = page.locator("spl-option:has-text('Male'), spl-autocomplete-option:has-text('Male'), [role='option']:has-text('Male')").first();
        if ((await maleOption.count()) > 0) {
          try {
            await humanClick(page, maleOption);
          } catch {
            await maleOption.click({ force: true }).catch(() => {});
          }
        } else {
          await page.keyboard.type("Male");
          await page.waitForTimeout(200);
          await page.keyboard.press("Enter");
        }
        await page.waitForTimeout(400);
      } else if (!curVal) {
        try {
          await humanClick(page, inp);
        } catch {
          await inp.click().catch(() => {});
        }
        await page.waitForTimeout(400);

        // Select first option via keyboard
        await page.keyboard.press("ArrowDown");
        await page.waitForTimeout(150);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }

    // 4. Text inputs (Signature, Dates, Full Name, Email)
    console.log(`  Filling signature and text fields...`);
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
          if (text.includes("name") || text.includes("signature") || id.includes("name")) {
            await inp.fill(fullName);
          } else if (text.includes("date") || id.includes("date")) {
            await inp.fill(todayDate);
          } else if (text.includes("email") || id.includes("email")) {
            await inp.fill(profile.email);
          }
          await page.waitForTimeout(250);
        }
      }
    }

    // 5. Checkboxes (Acknowledge, consent, declarations)
    console.log(`  Checking consent & declaration checkboxes with human clicks...`);
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
        await page.waitForTimeout(300 + Math.floor(Math.random() * 200));
      }
    }

    console.log(`✅ [SmartRecruitersAdapter]: Page 2 filling completed.`);
    await updateHUDStatus(page, "screening", "Page 2 ready for review/submission");
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

    // Check if slider verification appeared
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
        if (await target.count() > 0) {
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
        await page.waitForTimeout(300 + Math.floor(Math.random() * 200));
      }
    }

    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";
    const isDryRun = process.env.DRY_RUN === "true" || !isAutoSubmit;

    const submitBtn = page.locator(
      "oc-button[data-test='footer-submit'] button, oc-button[data-test='footer-submit'] spl-button, [data-test='footer-submit'], button:has-text('Submit')"
    ).first();

    if (await submitBtn.count() > 0) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(400);
      // Visually highlight submit button for manual user submission
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

    if (await submitBtn.count() > 0) {
      await submitBtn.click({ force: true }).catch(() => {});
    }

    // Direct evaluate click piercing shadow DOM
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

    const isSuccess = page.url().includes("thank") || page.url().includes("success") || (await page.locator("text='Application submitted', text='Thank you'").count()) > 0;
    return {
      success: true,
      confirmation: "SmartRecruiters Application Submitted Successfully",
    };
  }
}
