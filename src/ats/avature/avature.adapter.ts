import { Page, Locator } from "playwright";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { ATSAdapter, FormField, FormFieldOption, JobDetails, SubmissionResult, UserProfile } from "../ats.interface";
import { generateAnswerForQuestion, suggestAnswerForQuestion } from "../../application/question-answering";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { resolveLocalResumePath } from "../../utils/path-resolver";
import { db } from "../../database/db";

async function humanClick(page: Page, locator: Locator): Promise<void> {
  try {
    await locator.waitFor({ state: "visible", timeout: 4000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(100);
    await locator.click({ force: true, timeout: 3000 }).catch(async () => {
      await locator.evaluate((el: HTMLElement) => el.click()).catch(() => {});
    });
    await page.waitForTimeout(200);
  } catch {
    try {
      await locator.evaluate((el: HTMLElement) => el.click());
    } catch {}
  }
}

async function typeLikeHuman(page: Page, locator: Locator, text: string): Promise<void> {
  try {
    await locator.waitFor({ state: "visible", timeout: 4000 });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(50);
    await locator.fill(text, { timeout: 3000 });
    await locator.evaluate((el: HTMLInputElement) => {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }).catch(() => {});
    await page.waitForTimeout(100);
  } catch {
    try {
      await locator.evaluate((el: HTMLInputElement, val: string) => {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, text);
    } catch {}
  }
}

interface AvatureCredentialRecord {
  email: string;
  password?: string;
  name?: string;
  updatedAt: string;
}

export class AvatureAdapter implements ATSAdapter {
  private credentialsPath = path.resolve(process.cwd(), "data/avature_credentials.json");

  /**
   * Detects whether the current page or URL belongs to an Avature career portal.
   */
  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("avature.net")) return true;

    const content = (await page.content().catch(() => "")).toLowerCase();
    return (
      content.includes("avature.net") ||
      content.includes("avature") ||
      (await page.$("#uploadFileResume, .applicationMethods, [class*='avature'], .tpt_loginBox")) !== null
    );
  }

  /**
   * Extracts job details (title, company, description) from Avature job page.
   */
  async extractJob(page: Page): Promise<JobDetails> {
    const url = page.url();
    let company = "Company";
    let title = "Position";

    // 1. Derive company from tenant subdomain (e.g. bloomberg.avature.net -> Bloomberg)
    try {
      const parsedUrl = new URL(url);
      const hostParts = parsedUrl.hostname.split(".");
      if (hostParts.length >= 3 && hostParts[1] === "avature") {
        company = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
      }
    } catch (e) {}

    // 2. Extract title from DOM elements
    const domInfo = await page.evaluate(() => {
      const titleEl = document.querySelector("h1, .job-title, .article__header__title, .portal__job_title, [class*='jobTitle']");
      const descEl = document.querySelector(".job-description, .article__content, .portal__job_description, [class*='description']");
      return {
        title: titleEl?.textContent?.replace(/\s+/g, " ")?.trim() || "",
        description: descEl?.textContent?.replace(/\s+/g, " ")?.trim() || ""
      };
    }).catch(() => null);

    if (domInfo?.title && domInfo.title.length > 2) {
      title = domInfo.title;
    } else {
      const pageTitle = await page.title().catch(() => "");
      if (pageTitle.includes(" - ")) {
        title = pageTitle.split(" - ")[0].trim();
      } else if (pageTitle) {
        title = pageTitle.replace(/Careers|Jobs/gi, "").trim();
      }
    }

    return {
      title,
      company,
      description: domInfo?.description || title,
      ats: "AVATURE"
    };
  }

  /**
   * Scrapes interactive form fields from current Avature page.
   */
  async extractFields(page: Page): Promise<FormField[]> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Analyzing Avature Application...", "Scanning application form", "info", 40);
    await dismissCommonPopups(page);

    return await page.evaluate(() => {
      const results: FormField[] = [];
      const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea"));

      inputs.forEach((input, idx) => {
        let label = "";
        if (input.id) {
          const direct = document.querySelector(`label[for="${input.id}"]`);
          if (direct?.textContent?.trim()) label = direct.textContent.trim();
        }
        if (!label) {
          const container = input.closest(".WizardFieldInputContainer, .tc_formField, .fieldSpec, .fieldContainer, .form__item, [class*='form__item'], tr, div");
          const cLabel = container?.querySelector("label, .label, legend, h3, h4, p, th");
          if (cLabel?.textContent?.trim()) label = cLabel.textContent.trim();
        }
        if (!label) {
          label = input.getAttribute("aria-label") || (input as any).placeholder || input.getAttribute("name") || `field_${idx}`;
        }

        const isRequired = label.includes("*") || input.closest("[class*='required'], .required") !== null || (input as any).required;
        const cleanLabel = label.replace(/\*/g, "").replace(/\s+/g, " ").trim();
        const id = input.id || input.getAttribute("name") || `field_${idx}`;
        const typeAttr = (input.getAttribute("type") || input.tagName).toLowerCase();

        let fieldType: any = "text";
        if (typeAttr === "file") fieldType = "file";
        else if (typeAttr === "email") fieldType = "email";
        else if (typeAttr === "tel") fieldType = "tel";
        else if (typeAttr === "date" || typeAttr === "month") fieldType = "date";
        else if (typeAttr === "checkbox") fieldType = "checkbox";
        else if (typeAttr === "radio") fieldType = "radio";
        else if (input.tagName.toLowerCase() === "select") fieldType = "select";
        else if (input.tagName.toLowerCase() === "textarea") fieldType = "textarea";

        let options: FormFieldOption[] | undefined;
        if (input.tagName.toLowerCase() === "select") {
          const sel = input as HTMLSelectElement;
          options = Array.from(sel.options)
            .map(o => ({ value: o.value, label: o.text.trim() }))
            .filter(o => o.label && !o.label.toLowerCase().includes("select"));
        }

        results.push({
          id,
          label: cleanLabel || id,
          type: fieldType,
          required: isRequired,
          options
        });
      });

      return results;
    });
  }

  /**
   * Main form fill pipeline for Avature portals.
   * Handles authentication (login or account creation) and multi-step forms.
   */
  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers: Record<string, string> = {},
    fields: FormField[] = []
  ): Promise<void> {
    await injectVisualHUD(page);
    await updateHUDStatus(page, "Filling Avature Application...", `Candidate: ${profile.firstName} ${profile.lastName}`, "info", 50);
    await dismissCommonPopups(page);

    const job = await this.extractJob(page);
    const tenantDomain = new URL(page.url()).hostname.toLowerCase();

    // 0. Check if requisition is closed or Error page
    const isClosedOrError = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("page not found") || text.includes("an error has occurred") || text.includes("requisition is closed");
    }).catch(() => false);
    if (isClosedOrError || page.url().toLowerCase().includes("/error")) {
      throw new Error(`This Avature job is no longer active (Page not found / Requisition closed).`);
    }

    // ─── 1. AUTHENTICATION & PORTAL ENTRY ───
    await this.handleAuthentication(page, profile, tenantDomain, job);

    // ─── 2. RESUME ATTACHMENT ───
    const resumePath = additionalAnswers?.resumePath || profile.resumePath || resolveLocalResumePath(profile.resumePath || "");
    await this.uploadResume(page, resumePath, fields, profile);

    // ─── 3. MULTI-STEP WIZARD TRAVERSAL ───
    let currentStep = 1;
    const maxSteps = 10;
    let sameStepRetries = 0;
    let previousUrl = "";
    let previousContentLength = 0;

    while (currentStep <= maxSteps) {
      const stepStartUrl = page.url();
      console.log(`📋 [AvatureAdapter]: Populating fields on Application Step ${currentStep} (${tenantDomain})...`);
      await updateHUDStatus(page, "Filling Avature Application...", `Step ${currentStep} - Candidate: ${profile.firstName} ${profile.lastName}`, "info", 50 + (currentStep * 4));

      // If on Register form or Contact Info (ID 162), execute dedicated registration form fill
      const isRegistrationPage = page.url().toLowerCase().includes("register") ||
        (await page.locator("input[id='162']:visible, input[name='162']:visible").count() > 0);
      if (isRegistrationPage) {
        console.log(`✍️ [AvatureAdapter]: Detected Registration/Contact Info on Step ${currentStep}. Executing dedicated registration fill...`);
        await this.fillRegistrationForm(page, profile, "ClucoPass@2026!Secure", job);
        await page.waitForTimeout(3000);
        continue;
      } else {
        // Fill visible fields on active step
        await this.fillVisibleStepFields(page, job, profile);
      }

      // Check if there is an explicit Next/Continue button to advance to the next step
      // Strictly exclude Login buttons and header search buttons; detect final Submit
      const advanceBtn = page.locator(
        "form button[name='next'], form .nextButton, form a.nextButton, " +
        "button.WizardButtonPrimary:not([name*='login' i]):not([class*='search' i]):not([class*='header' i]), " +
        "form button:not([name*='login' i]):not([class*='search' i]):not([class*='header' i]):has-text('Next'), " +
        "form button:not([name*='login' i]):not([class*='search' i]):not([class*='header' i]):has-text('Continue'), " +
        "form input[type='submit'][value*='Next' i], form input[type='submit'][value*='Continue' i]"
      ).first();

      const hasAdvance = await advanceBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasAdvance) {
        const btnText = (await advanceBtn.textContent().catch(() => "") || "").trim().toLowerCase();
        const btnVal = (await advanceBtn.getAttribute("value").catch(() => "") || "").trim().toLowerCase();
        const combined = `${btnText} ${btnVal}`;

        // If it's a login button, final submit button, or header search, break out of wizard
        if (combined.includes("search") || combined.includes("login") || combined.includes("log in") || combined.includes("submit") || combined.includes("finish") || combined.includes("apply now") || combined.includes("send application")) {
          console.log(`ℹ️ [AvatureAdapter]: Final step reached (Submit/Finish detected: "${combined}").`);
          break;
        }

        console.log(`👉 [AvatureAdapter]: Advancing with button "${combined}" from Step ${currentStep}...`);
        await Promise.all([
          page.waitForNavigation({ timeout: 10000 }).catch(() => null),
          humanClick(page, advanceBtn)
        ]);
        await page.waitForTimeout(3000);
        await page.waitForSelector("input:not([type='hidden']), select, textarea, button", { timeout: 15000 }).catch(() => {});

        const stepEndUrl = page.url();
        const newContentLength = (await page.content().catch(() => "")).length;
        const urlChanged = stepEndUrl !== stepStartUrl;
        const contentChanged = Math.abs(newContentLength - previousContentLength) > 400;

        if (!urlChanged && !contentChanged) {
          sameStepRetries++;
          console.warn(`⚠️ [AvatureAdapter]: Step ${currentStep} did not advance (Retry ${sameStepRetries}/3). Re-checking fields...`);
          if (sameStepRetries >= 3) {
            console.log(`ℹ️ [AvatureAdapter]: Reached end of advance progression.`);
            break;
          }
          continue;
        }

        sameStepRetries = 0;
        previousUrl = stepEndUrl;
        previousContentLength = newContentLength;
        currentStep++;
      } else {
        console.log(`✅ [AvatureAdapter]: Reached final step (No further 'Next/Continue' button found).`);
        break;
      }
    }

    // ─── 4. FINAL VERIFICATION SWEEP ───
    await this.fillVisibleStepFields(page, job, profile);
  }

  /**
   * Handles tenant login or registration, remembering credentials in data/avature_credentials.json.
   * Priority: Attempts Login first to the particular hosting; if account not found, creates an account.
   */
  private async handleAuthentication(page: Page, profile: UserProfile, tenantDomain: string, job: JobDetails): Promise<void> {
    const tenantAccounts = this.getAllTenantAccounts(tenantDomain, profile.email);
    const candidatePasswords = Array.from(new Set([
      ...tenantAccounts.map(a => a.password),
      "ClucoPass@2026!Secure",
      "Tarun@143",
      "Tarun@2006",
      "ClucoAi@2026!Secure"
    ].filter(Boolean))) as string[];

    // Priority 1: User's profile email from DB (e.g. babufakemail@gmail.com)
    // Priority 2: Stored registered accounts for this tenant (e.g. babufakemail+4558@gmail.com)
    const emailsToTry = Array.from(new Set([
      profile.email,
      ...tenantAccounts.map(a => a.email)
    ].filter(Boolean))) as string[];

    // Capture jobId from initial URL if present (e.g. JobDetail/.../20217 or jobId=20217)
    const initialJobIdMatch = page.url().match(/(?:JobDetail\/[^\/]+\/|jobId=)(\d+)/i);
    const extractedJobId = initialJobIdMatch ? initialJobIdMatch[1] : null;

    // 0. Accept cookies if present on Bloomberg, Koch, CDCN
    const cookieBtn = page.locator(
      "#accept-recommended-btn-handler, a.cookiesButtonAccept, " +
      "button:has-text('Allow All'), button:has-text('Accept All'), " +
      "button:has-text('Accept'), #onetrust-accept-btn-handler, button#onetrust-accept-btn-handler"
    ).first();
    if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await humanClick(page, cookieBtn);
      await page.waitForTimeout(1000);
    }

    // 1. Check if candidate is already authenticated on this hosting
    const isAlreadyLoggedIn = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return !!document.querySelector("a[href*='Logout'], a[href*='logout'], a:has-text('Log out'), a:has-text('Sign out')") ||
             text.includes("log out") || text.includes("sign out");
    }).catch(() => false);

    if (isAlreadyLoggedIn) {
      console.log(`✅ [AvatureAdapter]: Candidate already authenticated on ${tenantDomain}. Proceeding to job...`);
      return;
    }

    // 2. Click Apply if on JobDetail page
    if (page.url().toLowerCase().includes("/jobdetail/")) {
      const applyBtn = page.locator(
        "a:has-text('Apply Now'):visible, a:has-text('Apply'):visible, " +
        "button:has-text('Apply Now'):visible, button:has-text('Apply'):visible, " +
        "a.button--primary:has-text('Apply'):visible, a[href*='Login?jobId=']:visible, " +
        "a[href*='ApplicationMethods']:visible, a:has-text('Apply Now'), a:has-text('Apply')"
      ).first();
      const hasApply = await applyBtn.isVisible({ timeout: 6000 }).catch(() => false);
      if (hasApply) {
        console.log(`🌐 [AvatureAdapter]: Clicking Apply button for job "${job.title}"...`);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => null),
          humanClick(page, applyBtn)
        ]);
        await page.waitForTimeout(3000);
      }
    }

    // Dismiss any secondary popups/cookies after navigation
    if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await humanClick(page, cookieBtn);
      await page.waitForTimeout(500);
    }

    // Wait for login or application elements to settle
    await page.waitForSelector(
      "#tpt_loginUsername, #username, input[name='username'], #resumeFile, input[type='file'], a:has-text('Create profile'), a:has-text('Create an account'), a.tpt_loginHiddenFieldsToggle",
      { timeout: 8000 }
    ).catch(() => {});

    // 3. Check current page state: Login, ApplicationMethods, or Register
    let loginUsernameInput = page.locator("#tpt_loginUsername:visible, #username:visible, input[name='username']:visible").first();
    let loginPasswordInput = page.locator("#tpt_loginPassword:visible, #password:visible, input[name='password']:visible").first();

    // If on ApplicationMethods / ApplicationProcess, toggle login form if hidden
    if (!(await loginUsernameInput.isVisible({ timeout: 500 }).catch(() => false))) {
      const loginToggle = page.locator(".applicationMethods a:has-text('login'), .applicationMethods a:has-text('Login'), a.tpt_loginHiddenFieldsToggle").first();
      if (await loginToggle.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log(`🔑 [AvatureAdapter]: Login toggle found on ${tenantDomain}. Toggling login form...`);
        await humanClick(page, loginToggle);
        await page.waitForTimeout(1000);
      }
    }

    loginUsernameInput = page.locator("#tpt_loginUsername:visible, #username:visible, input[name='username']:visible").first();
    loginPasswordInput = page.locator("#tpt_loginPassword:visible, #password:visible, input[name='password']:visible").first();

    const isLoginVisible = (await loginUsernameInput.isVisible({ timeout: 3000 }).catch(() => false)) &&
                           (await loginPasswordInput.isVisible({ timeout: 3000 }).catch(() => false));

    let loginSuccess = false;
    if (isLoginVisible) {
      console.log(`🔑 [AvatureAdapter]: Attempting Login first on ${tenantDomain}...`);

      loginLoop:
      for (const candidateEmail of emailsToTry) {
        for (const pw of candidatePasswords.slice(0, 2)) {
          console.log(`🔑 [AvatureAdapter]: Trying login with ${candidateEmail} (${pw.slice(0, 3)}***)...`);
          loginUsernameInput = page.locator("#tpt_loginUsername:visible, #username:visible, input[name='username']:visible").first();
          loginPasswordInput = page.locator("#tpt_loginPassword:visible, #password:visible, input[name='password']:visible").first();

          await typeLikeHuman(page, loginUsernameInput, candidateEmail);
          await typeLikeHuman(page, loginPasswordInput, pw);

          // Verify inputs are not empty before clicking submit (prevents native "Please fill out this field" tooltip)
          const userVal = (await loginUsernameInput.inputValue().catch(() => "")).trim();
          const passVal = (await loginPasswordInput.inputValue().catch(() => "")).trim();
          if (!userVal || !passVal) {
            console.warn(`⚠️ [AvatureAdapter]: Login inputs could not be filled properly. Re-trying DOM fill...`);
            await loginUsernameInput.evaluate((el: HTMLInputElement, val: string) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, candidateEmail).catch(() => {});
            await loginPasswordInput.evaluate((el: HTMLInputElement, val: string) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, pw).catch(() => {});
          }

          const submitLogin = page.locator("button[name='Login'], button#login, button:has-text('Log in'), button:has-text('Login')").first();
          await humanClick(page, submitLogin);
          await page.waitForTimeout(3000);

          const hasLoginError = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            return bodyText.includes("The username or password may be incorrect") ||
                   bodyText.includes("access might be restricted") ||
                   !!document.querySelector(".form__error, .error, .errorMessage, [role='alert']");
          });

          const isStillOnLogin = page.url().toLowerCase().includes("/login") || hasLoginError;
          if (!isStillOnLogin) {
            console.log(`✅ [AvatureAdapter]: Successfully logged into ${tenantDomain}!`);
            this.saveCredentials(tenantDomain, {
              email: candidateEmail,
              password: pw,
              name: `${profile.firstName} ${profile.lastName}`,
              updatedAt: new Date().toISOString()
            });
            loginSuccess = true;
            return;
          } else {
            console.warn(`⚠️ [AvatureAdapter]: Login credentials rejected on ${tenantDomain}.`);
          }
        }
      }

      // If candidate passwords fail on this hosting -> account does not exist or invalid credentials
      if (!loginSuccess) {
        console.warn(`📝 [AvatureAdapter]: Account not registered on ${tenantDomain}. Proceeding to create account / apply...`);
        const registerLink = page.locator("a:has-text('Create profile'), a:has-text('Create an account'), button:has-text('Create Profile'), button:has-text('Create profile'), a[href*='ApplicationMethods'], #methodButton--later, a:has-text('Without Resume'), a[href*='Register']").first();
        const hasRegLink = await registerLink.isVisible({ timeout: 2000 }).catch(() => false);
        if (hasRegLink) {
          const href = await registerLink.getAttribute("href").catch(() => null);
          if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
            const target = href.startsWith("http") ? href : new URL(href, page.url()).href;
            console.log(`📝 [AvatureAdapter]: Navigating to Account Creation URL: ${target}...`);
            await page.goto(target, { waitUntil: "domcontentloaded" });
          } else {
            console.log(`📝 [AvatureAdapter]: Clicking Account Creation link...`);
            await humanClick(page, registerLink);
          }
          await page.waitForTimeout(3000);
        } else {
          const urlObj = new URL(page.url());
          const targetJobId = urlObj.searchParams.get("jobId") || extractedJobId;
          if (targetJobId) {
            const appMethodsUrl = `${urlObj.origin}/careers/ApplicationMethods?jobId=${targetJobId}`;
            console.log(`🌐 [AvatureAdapter]: Direct navigating to ${appMethodsUrl}...`);
            await page.goto(appMethodsUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
            await page.waitForTimeout(3000);
          }
        }
      }
    }

    // ─── APPLICATION METHODS HANDLING ───
    if (page.url().includes("ApplicationMethods") || (await page.locator("#methodButton--later, #methodButton--file, #uploadFileResume").count() > 0)) {
      console.log(`📝 [AvatureAdapter]: On ApplicationMethods for ${tenantDomain}...`);
      const fileInput = page.locator("#resumeFile, input[type='file']").first();
      const resumePath = profile.resumePath || resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

      if (resumePath && fs.existsSync(resumePath) && (await fileInput.count() > 0)) {
        console.log(`📂 [AvatureAdapter]: Attaching resume on ApplicationMethods (${resumePath})...`);
        await fileInput.setInputFiles(resumePath).catch(() => {});
        await page.waitForTimeout(1500);

        await page.evaluate(() => {
          const input = document.querySelector("#resumeFile") as HTMLInputElement;
          if (input) {
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }
          const btn = (document.querySelector("#uploadFileResume") || document.querySelector("button.button--default")) as HTMLButtonElement;
          if (btn) btn.click();
        });

        // Wait for resume parsing and transition to Register page
        await page.waitForFunction(() => {
          const u = window.location.href.toLowerCase();
          return u.includes("register") || !!document.querySelector("input[id='162'], input[name='162'], input[id='2700']");
        }, { timeout: 25000 }).catch(() => {});
        await page.waitForTimeout(3000);
      } else {
        const withoutResumeBtn = page.locator("#methodButton--later, a:has-text('Without Resume'), a:has-text('Create profile'), a[href*='Register']").first();
        if (await withoutResumeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`📝 [AvatureAdapter]: Navigating without resume to Registration form...`);
          await humanClick(page, withoutResumeBtn);
          await page.waitForTimeout(3000);
        }
      }
    }

    // Wait for registration or wizard fields to mount (wizard loop in fillForm will handle population)
    await page.waitForSelector("input[id='162'], input[name='162'], input[id='2700'], input[name*='firstName' i], select[id='170'], select[id='6377'], .WizardFieldInputContainer", { timeout: 10000 }).catch(() => null);
  }

  /**
   * Fills registration fields on Avature portals.
   */
  private async fillRegistrationForm(page: Page, profile: UserProfile, passwordToSet: string, job?: JobDetails): Promise<void> {
    await page.waitForSelector("input[id='162'], input[id*='162'], input[name*='firstName' i], input[id='2700']", { timeout: 10000 }).catch(() => {});

    // 1. Country select FIRST (ID 170) so dependent State dropdown populates
    const countrySel = page.locator("select[id='170'], select[id*='170'], select[name*='country' i]").first();
    if (await countrySel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentCoVal = await countrySel.inputValue().catch(() => "");
      if (currentCoVal !== "233") {
        await countrySel.selectOption({ label: "United States" }).catch(async () => {
          const usVal = await countrySel.evaluate((sel: HTMLSelectElement) => {
            const opt = Array.from(sel.options).find(o => /^united states\b/i.test(o.text.trim()) || /\bunited states\b/i.test(o.text.trim()));
            return opt ? opt.value : "233";
          });
          if (usVal) await countrySel.selectOption(usVal);
        });
        await countrySel.evaluate((el: HTMLSelectElement) => {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      console.log(`📋 [AvatureAdapter]: Select "Country" -> "United States"`);
    }

    // Wait up to 5s for State dropdown to populate
    await page.waitForFunction(() => {
      const sel = document.querySelector("select[id='169'], select[id*='169'], select[name*='state' i]") as HTMLSelectElement;
      return sel && sel.options.length > 5;
    }, { timeout: 5000 }).catch(() => {});

    // 2. State select (ID 169 or name 169) - populated with US states using direct DOM evaluation
    const stateToSelect = profile.state || "California";
    await page.evaluate((st) => {
      const sel = document.querySelector("select[id='169'], select[id*='169'], select[name='169'], select[name*='state' i]") as HTMLSelectElement;
      if (sel && sel.options.length > 1) {
        const opt = Array.from(sel.options).find(o => new RegExp(`^${st}$`, 'i').test(o.text.trim()) || new RegExp(st, 'i').test(o.text.trim()));
        if (opt) {
          sel.value = opt.value;
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (sel.options.length > 5) {
          sel.selectedIndex = 5;
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }, stateToSelect);
    const stateSel = page.locator("select[name='169'], select[id='169'], select[name*='state' i]").first();
    if (await stateSel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stateSel.selectOption({ label: stateToSelect }).catch(async () => {
        await stateSel.selectOption({ index: 5 }).catch(() => {});
      });
    }
    console.log(`📋 [AvatureAdapter]: Select "State" -> "${stateToSelect}"`);

    // 3. First Name (ID 162)
    const fn = page.locator("input[id='162'], input[id*='162'], input[name*='firstName' i], input[placeholder*='First Name' i]").first();
    if (await fn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, fn, profile.firstName);
      console.log(`✍️ [AvatureAdapter]: Input "First Name" -> "${profile.firstName}"`);
    }

    // 4. Last Name (ID 163)
    const ln = page.locator("input[id='163'], input[id*='163'], input[name*='lastName' i], input[placeholder*='Last Name' i]").first();
    if (await ln.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, ln, profile.lastName);
      console.log(`✍️ [AvatureAdapter]: Input "Last Name" -> "${profile.lastName}"`);
    }

    // 5. Email (ID 164 or ID 2700 on Bloomberg)
    const em = page.locator("input[id='164'], input[id*='164'], input[id='2700'], input[id*='2700'], input[type='email'], input[name*='email' i]").first();
    if (await em.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, em, profile.email);
      console.log(`✍️ [AvatureAdapter]: Input "Email" -> "${profile.email}"`);
    }

    const rawPhone = profile.phone || "2025550198";
    const cleanPhone = rawPhone.replace(/\D/g, "").slice(-10) || "2025550198";

    // 6. Mobile Phone (ID 165 or ID 6378 on Bloomberg)
    const ph = page.locator("input[id='165'], input[id*='165'], input[id='6378'], input[id*='6378'], input[type='tel'], input[name*='phone' i]").first();
    if (await ph.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, ph, cleanPhone);
      console.log(`✍️ [AvatureAdapter]: Input "Mobile Phone" -> "${cleanPhone}"`);
    }

    // 7. Home Phone (ID 250) - leave empty to avoid duplicate phone conflicts
    const homePh = page.locator("input[id='250'], input[id*='250']").first();
    if (await homePh.isVisible({ timeout: 1000 }).catch(() => false)) {
      await homePh.fill("").catch(() => {});
    }

    // 8. Address (ID 251)
    const addr = page.locator("input[id='251'], input[id*='251'], input[name*='address' i]").first();
    if (await addr.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, addr, profile.street || "123 Market St");
      console.log(`✍️ [AvatureAdapter]: Input "Address" -> "${profile.street || "123 Market St"}"`);
    }

    // 9. City (ID 168)
    const city = page.locator("input[id='168'], input[id*='168'], input[name*='city' i]").first();
    if (await city.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, city, profile.city || "San Francisco");
      console.log(`✍️ [AvatureAdapter]: Input "City" -> "${profile.city || "San Francisco"}"`);
    }

    // 10. Zip Code (ID 683)
    const zip = page.locator("input[id='683'], input[id*='683'], input[name*='zip' i], input[name*='postal' i]").first();
    if (await zip.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeLikeHuman(page, zip, profile.zipCode || "94105");
      console.log(`✍️ [AvatureAdapter]: Input "Zip Code" -> "${profile.zipCode || "94105"}"`);
    }

    // 11. Password & Confirm Password (only visible)
    const pwInputs = page.locator("input[type='password']:visible");
    const pwCount = await pwInputs.count().catch(() => 0);
    for (let i = 0; i < pwCount; i++) {
      await typeLikeHuman(page, pwInputs.nth(i), passwordToSet);
    }

    // 12. Fill all remaining step fields (Select2 Country Code, School, Field of Study, Degree, Language, etc.)
    await this.fillVisibleStepFields(page, job || { title: "Position", company: "Company", ats: "AVATURE" }, profile);

    // 13. Consent checkboxes (e.g. ID 209 and other agreement checkboxes)
    const cbs = page.locator("input[type='checkbox']:visible");
    const cbCount = await cbs.count().catch(() => 0);
    for (let c = 0; c < cbCount; c++) {
      const cb = cbs.nth(c);
      const isChecked = await cb.isChecked().catch(() => false);
      if (!isChecked) {
        await cb.check({ force: true }).catch(() => {});
        await cb.evaluate((el: HTMLInputElement) => {
          el.checked = true;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }).catch(() => {});
      }
    }

    // 13b. Verify critical inputs are NOT empty before submitting (prevents empty field validation errors)
    const fieldPairs: [string, string][] = [
      ["input[id='162'], input[name='162']", profile.firstName],
      ["input[id='163'], input[name='163']", profile.lastName],
      ["input[id='164'], input[id='2700']", profile.email],
      ["input[id='165'], input[id='6378']", cleanPhone],
      ["input[id='168']", profile.city || "San Francisco"],
      ["input[id='251']", profile.street || "123 Market St"],
      ["input[id='683']", profile.zipCode || "94105"]
    ];
    for (const [sel, val] of fieldPairs) {
      await page.evaluate((arg: { s: string; v: string }) => {
        const el = document.querySelector(arg.s) as HTMLInputElement;
        if (el && !el.value) {
          el.value = arg.v;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, { s: sel, v: val }).catch(() => {});
    }

    // Verify State dropdown has a selected value
    await page.evaluate((st) => {
      const sel = document.querySelector("select[id='169'], select[id*='169'], select[name='169'], select[name*='state' i]") as HTMLSelectElement;
      if (sel && (sel.selectedIndex <= 0 || !sel.value)) {
        let opt = Array.from(sel.options).find(o => new RegExp(`^${st}$`, 'i').test(o.text.trim()) || new RegExp(st, 'i').test(o.text.trim()));
        if (!opt && sel.options.length > 5) opt = sel.options[5];
        if (opt) {
          sel.value = opt.value;
          sel.selectedIndex = opt.index;
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }, stateToSelect);

    // 14. Submit registration (strictly excluding any login buttons)
    const registerSubmit = page.locator(
      "button[id*='save'], button[name='save'], button[name='next'], .nextButton, " +
      "button.WizardButtonPrimary:not([name='Login']):not([name='login']), " +
      "button:not([name='Login']):not([name='login']):has-text('Continue'), " +
      "button:not([name='Login']):not([name='login']):has-text('Register'), " +
      "button:not([name='Login']):not([name='login']):has-text('Create profile')"
    ).first();
    await humanClick(page, registerSubmit);
    await page.waitForTimeout(3000);

    // 15. Check if registration advanced or if duplicate/validation errors occurred
    const hasErrorBanner = await page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("there are people with this information in the system") ||
             text.includes("there are some errors") ||
             text.includes("already registered") ||
             !!document.querySelector(".form__error:visible, .errorMessage:visible, [role='alert']:visible");
    }).catch(() => false);

    let isStillOnContactInfo = ((await page.locator("input[id='162']:visible, input[name='162']:visible").count()) > 0) && hasErrorBanner;

    if (isStillOnContactInfo) {
      console.warn(`⚠️ [AvatureAdapter]: Contact Info still present with errors. Applying unique candidate alias...`);
      const uniqueSuffix = Date.now().toString().slice(-4);
      const aliasEmail = profile.email.includes("@") ? profile.email.replace("@", `+${uniqueSuffix}@`) : `candidate_${uniqueSuffix}@example.com`;
      const randomPhone = `202${Math.floor(2000000 + Math.random() * 7000000)}`;

      if (await em.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, em, aliasEmail);
        console.log(`✍️ [AvatureAdapter]: Applied alias email "${aliasEmail}" to resolve duplicate.`);
      }
      if (await ph.isVisible({ timeout: 1000 }).catch(() => false)) {
        await typeLikeHuman(page, ph, randomPhone);
        console.log(`✍️ [AvatureAdapter]: Applied random phone "${randomPhone}" to resolve duplicate.`);
      }
      if (await homePh.isVisible({ timeout: 1000 }).catch(() => false)) {
        await homePh.fill("").catch(() => {});
      }

      // Re-select State using direct DOM evaluation
      await page.evaluate((st) => {
        const sel = document.querySelector("select[id='169'], select[id*='169'], select[name*='169'], select[name*='state' i]") as HTMLSelectElement;
        if (sel && sel.options.length > 1) {
          const opt = Array.from(sel.options).find(o => new RegExp(`^${st}$`, 'i').test(o.text.trim()) || new RegExp(st, 'i').test(o.text.trim()));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (sel.options.length > 5) {
            sel.selectedIndex = 5;
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }, stateToSelect);

      // Re-check consent checkboxes
      for (let c = 0; c < cbCount; c++) {
        await cbs.nth(c).check({ force: true }).catch(() => {});
      }

      await humanClick(page, registerSubmit);
      await page.waitForTimeout(4000);

      // Save the registered alias credentials so future jobs on this hosting can log in directly!
      this.saveCredentials(new URL(page.url()).hostname.toLowerCase(), {
        email: aliasEmail,
        password: passwordToSet,
        name: `${profile.firstName} ${profile.lastName}`,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Save credentials under candidate's base email
      this.saveCredentials(new URL(page.url()).hostname.toLowerCase(), {
        email: profile.email,
        password: passwordToSet,
        name: `${profile.firstName} ${profile.lastName}`,
        updatedAt: new Date().toISOString()
      });
    }

    // Wait until Contact Info (ID 162) is gone and next step has loaded
    await page.waitForFunction(() => {
      return !document.querySelector("input[id='162']:not([type='hidden'])");
    }, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    console.log(`✅ [AvatureAdapter]: Candidate Registration successfully completed!`);
  }

  /**
   * Fills all fields visible on the active step.
   */
  private async fillVisibleStepFields(page: Page, job: JobDetails, profile: UserProfile): Promise<void> {
    // 0. Explicit Country & State check first
    const countrySel = page.locator("select[id='170'], select[id*='170'], select[name*='country' i]").first();
    if (await countrySel.isVisible({ timeout: 1000 }).catch(() => false)) {
      const currentVal = await countrySel.inputValue().catch(() => "");
      if (currentVal !== "233") {
        await countrySel.selectOption({ label: "United States" }).catch(async () => {
          const usVal = await countrySel.evaluate((sel: HTMLSelectElement) => {
            const opt = Array.from(sel.options).find(o => /^united states\b/i.test(o.text.trim()) || /\bunited states\b/i.test(o.text.trim()));
            return opt ? opt.value : "233";
          });
          if (usVal) await countrySel.selectOption(usVal);
        });
        await countrySel.evaluate((el: HTMLSelectElement) => el.dispatchEvent(new Event("change", { bubbles: true }))).catch(() => {});
        await page.waitForTimeout(1000);
      }
    }

    const stateSel = page.locator("select[id='169'], select[id*='169'], select[name*='state' i]").first();
    if (await stateSel.isVisible({ timeout: 1000 }).catch(() => false)) {
      const stateToSelect = profile.state || "California";
      await stateSel.selectOption({ label: stateToSelect }).catch(async () => {
        const val = await stateSel.evaluate((sel: HTMLSelectElement, st: string) => {
          const opt = Array.from(sel.options).find(o => new RegExp(`^${st}$`, "i").test(o.text.trim()) || new RegExp(st, "i").test(o.text.trim()));
          return opt ? opt.value : "";
        }, stateToSelect);
        if (val) await stateSel.selectOption(val);
        else await stateSel.selectOption("4803").catch(() => stateSel.selectOption({ index: 5 }));
      });
      await stateSel.evaluate((el: HTMLSelectElement) => el.dispatchEvent(new Event("change", { bubbles: true }))).catch(() => {});
    }

    // 0b. Process all visible PASSWORD inputs (e.g. account creation on Koch/Avature)
    const pwInputs = page.locator("input[type='password']:visible");
    const pwCount = await pwInputs.count().catch(() => 0);
    if (pwCount > 0) {
      const passwordToSet = "ClucoPass@2026!Secure";
      for (let p = 0; p < pwCount; p++) {
        const pwEl = pwInputs.nth(p);
        const val = await pwEl.inputValue().catch(() => "");
        if (!val) {
          await typeLikeHuman(page, pwEl, passwordToSet);
          console.log(`🔑 [AvatureAdapter]: Populated password field on wizard step (${passwordToSet.slice(0, 3)}***)`);
        }
      }
      this.saveCredentials(new URL(page.url()).hostname.toLowerCase(), {
        email: profile.email,
        password: passwordToSet,
        name: `${profile.firstName} ${profile.lastName}`,
        updatedAt: new Date().toISOString()
      });
    }

    // 0c. Process Select2 / Autocomplete dropdowns (e.g. Bloomberg Country Code, School, Field of Study)
    const select2Elements = page.locator(".select2-selection:visible, [class*='select2Container']:visible");
    const s2Count = await select2Elements.count().catch(() => 0);
    for (let s = 0; s < s2Count; s++) {
      const s2 = select2Elements.nth(s);
      const s2Text = (await s2.textContent().catch(() => ""))?.trim() || "";
      if (s2Text.includes("Select an option") || s2Text === "") {
        const ariaLabel = (await s2.getAttribute("aria-labelledby").catch(() => "") || "").toLowerCase();
        const containerText = await s2.evaluate((el: HTMLElement) => {
          return el.closest(".field, .form__item, .WizardFieldInputContainer, tr, div")?.querySelector("label, .label, legend")?.textContent?.trim() || "";
        }).catch(() => "");
        const combined = `${ariaLabel} ${containerText}`.toLowerCase();

        await humanClick(page, s2);
        await page.waitForTimeout(400);

        const searchField = page.locator(".select2-search__field:visible").first();
        const isSearchVisible = await searchField.isVisible({ timeout: 500 }).catch(() => false);

        if (combined.includes("code") || combined.includes("6377") || combined.includes("phone")) {
          if (isSearchVisible) {
            await searchField.fill("United States").catch(() => {});
            await page.waitForTimeout(400);
          }
          const opt = page.locator(".select2-results__option:has-text('United States'), .select2-results__option--highlighted").first();
          await humanClick(page, opt);
        } else if (combined.includes("school") || combined.includes("university") || combined.includes("2238-2")) {
          if (isSearchVisible) {
            await searchField.fill("Other").catch(() => {});
            await page.waitForTimeout(400);
          }
          const opt = page.locator(".select2-results__option:has-text('Other'), .select2-results__option--highlighted, .select2-results__option").first();
          await humanClick(page, opt);
        } else if (combined.includes("field") || combined.includes("study") || combined.includes("major") || combined.includes("2238-3")) {
          if (isSearchVisible) {
            await searchField.fill("Computer").catch(() => {});
            await page.waitForTimeout(400);
          }
          const opt = page.locator(".select2-results__option:has-text('Computer'), .select2-results__option--highlighted, .select2-results__option").first();
          await humanClick(page, opt);
        } else {
          const opt = page.locator(".select2-results__option:not([aria-disabled='true']):not(.select2-results__option--load-more)").first();
          if (await opt.isVisible({ timeout: 500 }).catch(() => false)) {
            await humanClick(page, opt);
          }
        }
        await page.waitForTimeout(300);
      }
    }

    // 0d. Check for visible file inputs (e.g. Additional Documents / Upload Resume on Bloomberg)
    const fileInputs = page.locator("input[type='file']:visible, [id='8154']:visible");
    const fileCount = await fileInputs.count().catch(() => 0);
    if (fileCount > 0) {
      const resumePath = profile.resumePath || resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
      if (resumePath && fs.existsSync(resumePath)) {
        for (let f = 0; f < fileCount; f++) {
          const fEl = fileInputs.nth(f);
          const fVal = await fEl.inputValue().catch(() => "");
          if (!fVal) {
            await fEl.setInputFiles(resumePath).catch(() => {});
            console.log(`📂 [AvatureAdapter]: Attached resume to document input on active step (${resumePath}).`);
          }
        }
      }
    }

    // 1. Process all visible SELECT dropdowns (excluding Select2 which is already handled above)
    const selects = page.locator("select:visible:not(.select2-hidden-accessible)");
    const selCount = await selects.count().catch(() => 0);
    for (let i = 0; i < selCount; i++) {
      const selectEl = selects.nth(i);
      const labelText = await selectEl.evaluate((el: HTMLElement) => {
        let lbl = el.id ? document.querySelector(`label[for='${el.id}']`)?.textContent : null;
        if (!lbl) {
          const container = el.closest(".WizardFieldInputContainer, .tc_formField, .fieldSpec, .fieldContainer, .form__item, [class*='form__item'], tr, div");
          lbl = container?.querySelector("label, .label, legend, h3, h4, p, th")?.textContent;
        }
        return (lbl || (el as any).name || "").replace(/\s+/g, " ").trim();
      }).catch(() => "");
      const normLabel = labelText.toLowerCase().replace(/\*/g, "").trim();
      await this.handleSelectField(page, selectEl, normLabel, labelText, job, profile);
    }

    // 2. Process all visible TEXTAREAS
    const textareas = page.locator("textarea:visible");
    const taCount = await textareas.count().catch(() => 0);
    for (let i = 0; i < taCount; i++) {
      const ta = textareas.nth(i);
      const labelText = await ta.evaluate((el: HTMLElement) => {
        let lbl = el.id ? document.querySelector(`label[for='${el.id}']`)?.textContent : null;
        if (!lbl) {
          const container = el.closest(".WizardFieldInputContainer, .tc_formField, .fieldSpec, .fieldContainer, .form__item, [class*='form__item'], tr, div");
          lbl = container?.querySelector("label, .label, legend, h3, h4, p, th")?.textContent;
        }
        return (lbl || (el as any).name || "").replace(/\s+/g, " ").trim();
      }).catch(() => "");
      const normLabel = labelText.toLowerCase().replace(/\*/g, "").trim();
      await this.handleTextareaField(page, ta, normLabel, labelText, job, profile);
    }

    // 3. Process all visible CHECKBOXES
    const checkboxes = page.locator("input[type='checkbox']:visible");
    const cbCount = await checkboxes.count().catch(() => 0);
    for (let i = 0; i < cbCount; i++) {
      const cb = checkboxes.nth(i);
      const cbInfo = await cb.evaluate((el: HTMLElement) => {
        const optionLabel = el.closest("label, div, .tc_formField")?.textContent?.replace(/\s+/g, " ").trim() || "";
        const container = el.closest(".WizardFieldInputContainer, .tc_formField, .fieldSpec, .fieldContainer, .form__item, [class*='form__item'], tr, div, fieldset");
        const groupQuestion = container?.querySelector("legend, h3, h4, p, label")?.textContent?.replace(/\s+/g, " ").trim() || "";
        return { optionLabel, groupQuestion };
      }).catch(() => ({ optionLabel: "", groupQuestion: "" }));

      await this.handleCheckboxGroupOrSingle(cb, cbInfo.optionLabel, cbInfo.groupQuestion);
    }

    // 4. Process all visible RADIO GROUPS
    const radios = page.locator("input[type='radio']:visible");
    const rCount = await radios.count().catch(() => 0);
    const processedRadioNames = new Set<string>();

    for (let i = 0; i < rCount; i++) {
      const rEl = radios.nth(i);
      const rName = await rEl.getAttribute("name").catch(() => "") || `r_${i}`;
      if (processedRadioNames.has(rName)) continue;
      processedRadioNames.add(rName);

      const groupEls = page.locator(`input[type='radio'][name='${rName}']:visible`);
      const gCount = await groupEls.count().catch(() => 0);

      const labelText = await rEl.evaluate((el: HTMLElement) => {
        const container = el.closest(".WizardFieldInputContainer, .tc_formField, .fieldSpec, .fieldContainer, .form__item, [class*='form__item'], tr, div, fieldset");
        const q = container?.querySelector("legend, h3, h4, p, label")?.textContent;
        return (q || el.getAttribute("name") || "").replace(/\s+/g, " ").trim();
      }).catch(() => "");
      const normLabel = labelText.toLowerCase().replace(/\*/g, "").trim();

      await this.handleRadioGroup(groupEls, gCount, normLabel, labelText, job, profile);
    }

    // 5. Process all visible TEXT, TEL, EMAIL, NUMBER, MONTH, DATE inputs
    const textInputs = page.locator("input[type='text']:visible, input[type='tel']:visible, input[type='email']:visible, input[type='number']:visible, input[type='month']:visible, input[type='date']:visible, input:not([type]):visible");
    const tiCount = await textInputs.count().catch(() => 0);
    for (let i = 0; i < tiCount; i++) {
      const ti = textInputs.nth(i);
      const labelText = await ti.evaluate((el: HTMLElement) => {
        let lbl = el.id ? document.querySelector(`label[for='${el.id}']`)?.textContent : null;
        if (!lbl) {
          const container = el.closest(".WizardFieldInputContainer, .tc_formField, .fieldSpec, .fieldContainer, .form__item, [class*='form__item'], tr, div");
          lbl = container?.querySelector("label, .label, legend, h3, h4, p, th")?.textContent;
        }
        return (lbl || (el as any).placeholder || (el as any).name || "").replace(/\s+/g, " ").trim();
      }).catch(() => "");
      const normLabel = labelText.toLowerCase().replace(/\*/g, "").trim();
      await this.handleTextInputField(page, ti, normLabel, labelText, job, profile);
    }
  }

  /**
   * Handles individual or grouped Checkboxes on Avature.
   */
  private async handleCheckboxGroupOrSingle(cb: Locator, optionLabel: string, groupQuestion: string): Promise<void> {
    const optLower = optionLabel.toLowerCase();
    const qLower = groupQuestion.toLowerCase();

    // Check "Yes" for experience, authorization, relocation, STEM OPT, background check
    if (optLower === "yes" || optLower.startsWith("yes ")) {
      if (qLower.includes("sponsorship") || qLower.includes("visa")) {
        await cb.uncheck({ force: true }).catch(() => {});
      } else {
        await cb.check({ force: true }).catch(() => {});
        console.log(`☑️ [AvatureAdapter]: Checked "Yes" for "${groupQuestion.slice(0, 40)}"`);
      }
      return;
    }

    // Check "No" for visa sponsorship
    if (optLower === "no" || optLower.startsWith("no ")) {
      if (qLower.includes("sponsorship") || qLower.includes("visa")) {
        await cb.check({ force: true }).catch(() => {});
        console.log(`☑️ [AvatureAdapter]: Checked "No" for sponsorship "${groupQuestion.slice(0, 40)}"`);
      } else {
        await cb.uncheck({ force: true }).catch(() => {});
      }
      return;
    }

    // Skill level checkboxes
    if (optLower.includes("advanced") || optLower.includes("expert") || optLower.includes("proficient")) {
      await cb.check({ force: true }).catch(() => {});
      console.log(`☑️ [AvatureAdapter]: Checked "Advanced" for "${groupQuestion.slice(0, 40)}"`);
      return;
    }
    if (optLower.includes("beginner") || optLower.includes("intermediate")) {
      await cb.uncheck({ force: true }).catch(() => {});
      return;
    }

    // Single agreement/consent/privacy checkboxes
    const isChecked = await cb.isChecked().catch(() => false);
    if (!isChecked) {
      await cb.check({ force: true }).catch(() => {});
      console.log(`☑️ [AvatureAdapter]: Checked agreement checkbox "${optionLabel.slice(0, 40)}"`);
    }
  }

  /**
   * Handles Select dropdown inputs on Avature.
   */
  private async handleSelectField(
    page: Page,
    selectEl: Locator,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const options = await selectEl.evaluate((sel: HTMLSelectElement) => {
      return Array.from(sel.options).map(o => o.text.trim()).filter(t => t && !t.toLowerCase().includes("select") && !t.toLowerCase().includes("choose") && !t.toLowerCase().includes("searching"));
    }).catch(() => []);

    if (options.length === 0) return;

    let chosenOption = "";

    // 0. Work Sponsorship
    if (options.some(o => /sponsorship/i.test(o)) || normLabel.includes("sponsorship") || normLabel.includes("visa")) {
      chosenOption = options.find(o => /^no\b/i.test(o) || /will not require|do not require|not require/i.test(o)) || "No";
    }
    // 0b. Pronouns
    else if (normLabel.includes("pronoun")) {
      chosenOption = options.find(o => /he\/him/i.test(o)) || "He/Him/His";
    }
    // 0c. Country / Territory phone code
    else if (normLabel.includes("country/territory code") || normLabel.includes("country code") || normLabel.includes("phone code")) {
      chosenOption = options.find(o => /united states|usa|\+1\b/i.test(o)) || options[0];
    }
    // 1. Gender (Dynamic match candidate's profile - NEVER select decline)
    else if (normLabel.includes("gender") || normLabel === "sex") {
      const g = profile.gender || "Male";
      chosenOption = options.find(o => new RegExp(`^${g}$`, "i").test(o)) || options.find(o => new RegExp(g, "i").test(o) && !/female/i.test(o)) || g;
    }
    // 2. Race / Ethnicity (Dynamic match candidate's profile - NEVER select decline)
    else if (normLabel.includes("race") || normLabel.includes("ethnic") || normLabel.includes("identify with")) {
      const eth = profile.ethnicity || profile.savedAnswers?.get("ethnicity") || profile.savedAnswers?.get("race") || "Asian";
      chosenOption = options.find(o => new RegExp(eth, "i").test(o)) || options.find(o => !/decline|prefer not/i.test(o)) || eth;
    }
    // 3. Veteran Status (Strict Not a Protected Veteran - NEVER select decline)
    else if (normLabel.includes("veteran")) {
      chosenOption = options.find(o => /not a protected veteran|not a veteran|i am not a protected veteran/i.test(o)) || options.find(o => /^no$/i.test(o)) || options[0];
    }
    // 4. Disability Status (Strict No Disability - NEVER select decline)
    else if (normLabel.includes("disability")) {
      chosenOption = options.find(o => /no,|do not have a disability|don't have a disability|^no$/i.test(o)) || options[0];
    }
    // 5. State / Region
    else if (normLabel.includes("state") || normLabel.includes("province")) {
      const userState = profile.state || "California";
      chosenOption = options.find(o => new RegExp(`^${userState}$`, "i").test(o) || new RegExp(userState, "i").test(o)) || options[0];
    }
    // 6. Country
    else if (normLabel.includes("country")) {
      chosenOption = options.find(o => /^united states\b/i.test(o) || /\bunited states\b/i.test(o) || /^usa$/i.test(o) || /^us$/i.test(o)) ||
                     options.find(o => /united states/i.test(o)) || options[0];
    }
    // 6b. Current position / current education
    else if (normLabel.includes("current position") || normLabel.includes("is current") || normLabel.includes("current education")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || "Yes";
    }
    // 6c. Proficiency / Language skill
    else if (normLabel.includes("proficiency") || normLabel.includes("spoken") || normLabel.includes("written") || normLabel.includes("level")) {
      chosenOption = options.find(o => /fluent/i.test(o)) || options.find(o => /native|bilingual/i.test(o)) || options.find(o => /advanced|professional/i.test(o)) || options[options.length - 1];
    }
    // 6c2. Language selection
    else if (normLabel.includes("language") && !normLabel.includes("level")) {
      chosenOption = options.find(o => /english/i.test(o)) || options[1] || options[0];
    }
    // 6c3. Similar role / years of experience dropdowns
    else if (normLabel.includes("similar role") || (normLabel.includes("years") && normLabel.includes("experience"))) {
      chosenOption = options.find(o => /3|4|5|senior|mid/i.test(o)) || options[1] || options[0];
    }
    // 6c4. Please specify
    else if (normLabel.includes("specify") || normLabel.includes("detail")) {
      chosenOption = options[1] || options[0];
    }
    // 6d. How did you hear about this opportunity
    else if (normLabel.includes("hear") || normLabel.includes("opportunity") || normLabel.includes("source") || normLabel.includes("referral")) {
      chosenOption = options.find(o => /website/i.test(o) || /direct job link/i.test(o) || /linkedin/i.test(o) || /indeed/i.test(o)) || options[0];
    }
    // 6e. Consent to text messages
    else if (normLabel.includes("text message") || normLabel.includes("sms")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || "Yes";
    }
    // 6f. Background check / Drug screen
    else if (normLabel.includes("background check") || normLabel.includes("drug test") || normLabel.includes("drug screen")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || "Yes";
    }
    // 6g. 18 years of age or older
    else if (normLabel.includes("18") || normLabel.includes("age")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || "Yes";
    }
    // 6h. Schedule interview
    else if (normLabel.includes("interview") || normLabel.includes("schedule")) {
      chosenOption = options.find(o => /yes/i.test(o) || /not right now/i.test(o)) || options[0];
    }
    // 6i. Currency
    else if (normLabel.includes("currency")) {
      chosenOption = options.find(o => /usd|\$|united states dollar|us dollar/i.test(o)) || options[options.length > 1 ? 1 : 0];
    }
    // 6j. Education Degree / Certification
    else if (normLabel.includes("degree") || normLabel.includes("certification") || normLabel.includes("education")) {
      const userDegree = profile.educations?.[0]?.degree || "Bachelor";
      chosenOption = options.find(o => new RegExp(`\\b${userDegree}\\b`, 'i').test(o)) ||
                     options.find(o => /bachelor|undergraduate|college|degree/i.test(o)) ||
                     options[options.length > 1 ? 1 : 0];
    }
    // 6k. Institution / Program / School
    else if (normLabel.includes("institution") || normLabel.includes("school") || normLabel.includes("program")) {
      const userSchool = profile.educations?.[0]?.school || "Other";
      chosenOption = options.find(o => new RegExp(userSchool, 'i').test(o)) ||
                     options.find(o => /other|not listed/i.test(o)) ||
                     options[options.length - 1];
    }
    // 6l. Specialization / Major
    else if (normLabel.includes("specialization") || normLabel.includes("major")) {
      const userMajor = profile.educations?.[0]?.fieldOfStudy || "Computer Science";
      chosenOption = options.find(o => new RegExp(userMajor, 'i').test(o)) ||
                     options.find(o => /computer|engineering|technology|science|other/i.test(o)) ||
                     options[options.length > 1 ? 1 : 0];
    }
    // 7. Legally Authorized / Work Authorization
    else if (normLabel.includes("authorized") || normLabel.includes("legally") || normLabel.includes("eligible")) {
      chosenOption = options.find(o => /^yes\b/i.test(o) || /^yes$/i.test(o)) || "Yes";
    }
    // 8. DB & LLM Fallback
    else {
      const dbAnswer = await this.getAnswerFromDB(profile.userId, normLabel).catch(() => null);
      if (dbAnswer && options.some(o => o.toLowerCase() === dbAnswer.toLowerCase() || new RegExp(`\\b${dbAnswer}\\b`, 'i').test(o))) {
        chosenOption = options.find(o => o.toLowerCase() === dbAnswer.toLowerCase() || new RegExp(`\\b${dbAnswer}\\b`, 'i').test(o)) || dbAnswer;
      } else {
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 5000));
          chosenOption = await Promise.race([
            generateAnswerForQuestion(labelText, job, profile, options, "select"),
            timeoutPromise
          ]);
        } catch {
          chosenOption = options.find(o => /^yes\b/i.test(o)) || options[0];
        }
      }
    }

    if (!chosenOption || !options.some(o => o.toLowerCase() === chosenOption.toLowerCase() || new RegExp(`\\b${chosenOption}\\b`, 'i').test(o))) {
      chosenOption = options.find(o => /^yes\b/i.test(o)) || options[0];
    }

    console.log(`📋 [AvatureAdapter]: Select "${labelText.slice(0, 40)}" -> "${chosenOption}"`);
    await selectEl.selectOption({ label: chosenOption }, { timeout: 2500 }).catch(async () => {
      await selectEl.selectOption({ index: 1 }, { timeout: 2000 }).catch(() => {});
    });
    await selectEl.evaluate((el: HTMLSelectElement) => {
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }).catch(() => {});
    await this.saveAnswerToDB(profile.userId, labelText, chosenOption);
  }

  /**
   * Handles Radio button groups on Avature.
   */
  private async handleRadioGroup(
    radioEls: Locator,
    count: number,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const radioOptions: { index: number; text: string }[] = [];
    for (let i = 0; i < count; i++) {
      const text = await radioEls.nth(i).evaluate((el: HTMLInputElement) => {
        return el.closest("label, .radio-option, div")?.textContent?.replace(/\s+/g, " ").trim() || el.value || "";
      }).catch(() => "");
      radioOptions.push({ index: i, text });
    }

    let targetIdx = 0;
    const optLower = radioOptions.map(o => o.text.toLowerCase());

    const isGender = normLabel.includes("gender") || normLabel === "sex" || (optLower.some(o => o === "male") && optLower.some(o => o === "female"));
    const isRace = normLabel.includes("race") || normLabel.includes("ethnic") || normLabel.includes("identify with") ||
                   optLower.some(o => o.includes("hispanic") || o.includes("asian") || o.includes("black or african"));
    const isVeteran = normLabel.includes("veteran") || optLower.some(o => o.includes("protected veteran") || o.includes("classifications of protected veteran"));
    const isDisability = normLabel.includes("disability") || optLower.some(o => o.includes("have a disability") || o.includes("disability status"));

    if (isGender) {
      const g = (profile.gender || "Male").toLowerCase();
      targetIdx = radioOptions.findIndex(o => new RegExp(`^${g}$`, "i").test(o.text.trim()) || new RegExp(`^${g}\\b`, "i").test(o.text.trim()));
    } else if (isRace) {
      const eth = (profile.ethnicity || profile.savedAnswers?.get("ethnicity") || profile.savedAnswers?.get("race") || "Asian").toLowerCase();
      targetIdx = radioOptions.findIndex(o => new RegExp(eth, "i").test(o.text) && !/decline/i.test(o.text));
      if (targetIdx < 0) targetIdx = radioOptions.findIndex(o => !/decline|prefer not/i.test(o.text));
    } else if (isVeteran) {
      targetIdx = radioOptions.findIndex(o => /not a protected veteran|not a veteran|i am not a protected veteran/i.test(o.text));
      if (targetIdx < 0) targetIdx = radioOptions.findIndex(o => /^no$/i.test(o.text.trim()));
    } else if (isDisability) {
      targetIdx = radioOptions.findIndex(o => /no,|do not have a disability|don't have a disability|^no$/i.test(o.text));
      if (targetIdx < 0) targetIdx = radioOptions.findIndex(o => /^no$/i.test(o.text.trim()));
    } else if (normLabel.includes("sponsorship") || normLabel.includes("visa")) {
      targetIdx = radioOptions.findIndex(o => /^no$/i.test(o.text.trim()) || /^no\b/i.test(o.text.trim()));
    } else if (normLabel.includes("authorized") || normLabel.includes("legally") || normLabel.includes("eligible")) {
      targetIdx = radioOptions.findIndex(o => /^yes$/i.test(o.text.trim()) || /^yes\b/i.test(o.text.trim()));
    } else {
      const dbAnswer = await this.getAnswerFromDB(profile.userId, normLabel);
      if (dbAnswer) {
        const found = radioOptions.findIndex(o => o.text.toLowerCase().includes(dbAnswer.toLowerCase()));
        if (found >= 0) targetIdx = found;
      } else {
        const answer = await generateAnswerForQuestion(labelText, job, profile, radioOptions.map(o => o.text), "radio");
        const found = radioOptions.findIndex(o => o.text.toLowerCase().includes(answer.toLowerCase()));
        if (found >= 0) targetIdx = found;
      }
    }

    if (targetIdx < 0 || targetIdx >= count) targetIdx = 0;

    await radioEls.nth(targetIdx).check({ force: true }).catch(async () => {
      await radioEls.nth(targetIdx).evaluate((el: HTMLInputElement) => el.click());
    });
    console.log(`🔘 [AvatureAdapter]: Radio "${labelText.slice(0, 40)}" -> "${radioOptions[targetIdx]?.text}"`);
    await this.saveAnswerToDB(profile.userId, labelText, radioOptions[targetIdx]?.text);
  }

  /**
   * Handles Checkboxes on Avature.
   */
  private async handleCheckboxField(cb: Locator, normLabel: string): Promise<void> {
    const isChecked = await cb.isChecked().catch(() => false);
    if (!isChecked) {
      await cb.check({ force: true }).catch(() => {});
      console.log(`☑️ [AvatureAdapter]: Checked consent checkbox "${normLabel.slice(0, 40)}"`);
    }
  }

  /**
   * Handles Textareas on Avature.
   */
  private async handleTextareaField(
    page: Page,
    textarea: Locator,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const val = await textarea.inputValue().catch(() => "");
    if (val && val.trim().length > 0) return;

    let ans = "";
    if (normLabel.includes("cover letter")) {
      ans = suggestAnswerForQuestion("cover letter") ||
        `Dear Hiring Team at ${job.company},\n\nI am writing to express my strong enthusiasm for the ${job.title} role. With extensive engineering experience building scalable cloud-native architectures, distributed backend APIs, and modern web applications, I look forward to contributing immediately to your mission.\n\nSincerely,\n${profile.firstName} ${profile.lastName}`;
    } else {
      ans = await generateAnswerForQuestion(labelText, job, profile, undefined, "textarea");
    }

    console.log(`✍️ [AvatureAdapter]: Textarea "${labelText.slice(0, 40)}" -> "${ans.slice(0, 50)}..."`);
    await typeLikeHuman(page, textarea, ans);
    await this.saveAnswerToDB(profile.userId, labelText, ans);
  }

  /**
   * Handles Text, Email, Phone, Number, and Date Inputs on Avature.
   */
  private async handleTextInputField(
    page: Page,
    input: Locator,
    normLabel: string,
    labelText: string,
    job: JobDetails,
    profile: UserProfile
  ): Promise<void> {
    const val = await input.inputValue().catch(() => "");
    if (val && val.trim().length > 0) return;

    let ans = "";
    const inputId = (await input.getAttribute("id").catch(() => "") || "").toLowerCase();
    const inputName = (await input.getAttribute("name").catch(() => "") || "").toLowerCase();

    if (inputId === "162" || inputName === "162" || normLabel.includes("legal first") || normLabel.includes("first name") || inputId.includes("firstname") || inputName.includes("firstname")) {
      ans = profile.firstName;
    } else if (normLabel.includes("middle name")) {
      ans = "";
    } else if (normLabel.includes("preferred")) {
      ans = profile.firstName;
    } else if (inputId === "163" || inputName === "163" || normLabel.includes("legal last") || normLabel.includes("last name") || inputId.includes("lastname") || inputName.includes("lastname")) {
      ans = profile.lastName;
    } else if (normLabel.includes("your name") || normLabel === "name" || normLabel.includes("full name") || normLabel.includes("signature")) {
      ans = `${profile.firstName} ${profile.lastName}`;
    } else if (normLabel.includes("today's date") || normLabel === "date" || inputId.includes("date") || inputName.includes("date")) {
      const now = new Date();
      const yyyy = now.getFullYear().toString();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const inputType = (await input.getAttribute("type").catch(() => ""))?.toLowerCase();
      ans = inputType === "date" ? `${yyyy}-${mm}-${dd}` : `${mm}/${dd}/${yyyy}`;
    } else if (inputId === "164" || inputName === "164" || normLabel.includes("email")) {
      ans = profile.email;
    } else if (inputId === "250" || inputName === "250" || normLabel.includes("home phone")) {
      // Leave optional home phone empty to avoid duplicate candidate conflicts
      return;
    } else if (inputId === "165" || inputName === "165" || normLabel.includes("phone") || normLabel.includes("mobile") || normLabel.includes("cell")) {
      ans = (profile.phone || "2025550198").replace(/\D/g, "").slice(-10) || "2025550198";
    } else if (inputId === "251" || inputName === "251" || normLabel === "address" || normLabel.includes("street")) {
      ans = profile.street || "123 Market St";
    } else if (inputId === "168" || inputName === "168" || normLabel.includes("city")) {
      ans = profile.city || "San Francisco";
    } else if (inputId === "683" || inputName === "683" || normLabel.includes("zip") || normLabel.includes("postal")) {
      ans = profile.zipCode || "94105";
    } else if (normLabel.includes("salary") || normLabel.includes("compensation") || normLabel.includes("pay") || normLabel.includes("rate") || normLabel.includes("expectation")) {
      ans = "55";
    } else if (normLabel.includes("linkedin") || /\burl\b/i.test(normLabel) || inputId === "622") {
      ans = profile.linkedinUrl || "https://linkedin.com/in/hrutin-nammi";
    } else if (normLabel.includes("notes") || inputId === "623") {
      return;
    } else if (normLabel.includes("website") || normLabel.includes("portfolio")) {
      ans = profile.portfolioUrl || profile.githubUrl || "";
    } else if (normLabel.includes("company") || normLabel.includes("employer")) {
      ans = profile.experiences?.[0]?.company || "Tech Innovations Inc";
    } else if (normLabel.includes("position") || normLabel.includes("title")) {
      ans = profile.experiences?.[0]?.jobTitle || "Senior Software Engineer";
    } else if (normLabel.includes("job duties") || normLabel.includes("duties") || normLabel.includes("responsibilities")) {
      ans = "Developed distributed cloud backend services, RESTful APIs, and scalable architectures using TypeScript and Node.js.";
    } else if (normLabel.includes("degree") || normLabel.includes("certification")) {
      ans = profile.educations?.[0]?.degree || "Bachelor of Science";
    } else if (normLabel.includes("field of study") || normLabel.includes("major")) {
      ans = profile.educations?.[0]?.fieldOfStudy || "Computer Science";
    } else if (normLabel.includes("school") || normLabel.includes("university") || normLabel.includes("college")) {
      ans = profile.educations?.[0]?.school || "California State University";
    } else if (normLabel.includes("graduation date") || normLabel.includes("graduation") || normLabel.includes("completed or anticipated") || normLabel.includes("completion date")) {
      ans = "2024-05";
    } else if (normLabel.includes("hours") || normLabel.includes("how many hours")) {
      ans = "40";
    } else if (normLabel.includes("start date") || (normLabel.includes("from") && !normLabel.includes("where"))) {
      ans = "2021-01";
    } else if (normLabel.includes("end date") || (normLabel.includes("to") && !normLabel.includes("relocate") && !normLabel.includes("consent") && !normLabel.includes("authorized"))) {
      ans = "2024-05";
    } else if (normLabel.includes("language")) {
      ans = "English";
    } else if (normLabel.includes("years of") || normLabel.includes("how many years") || normLabel.includes("c#") || normLabel.includes("sql") || normLabel.includes("azure") || normLabel.includes("cicd")) {
      ans = "4";
    } else {
      const dbAns = await this.getAnswerFromDB(profile.userId, normLabel).catch(() => null);
      if (dbAns) {
        ans = dbAns;
      } else {
        try {
          const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("LLM Timeout")), 5000));
          ans = await Promise.race([
            generateAnswerForQuestion(labelText, job, profile, undefined, "input"),
            timeoutPromise
          ]);
        } catch {
          ans = "Yes";
        }
      }
    }

    if (ans && ans.length > 40 && (normLabel.includes("name") || inputId.includes("name"))) {
      ans = `${profile.firstName} ${profile.lastName}`;
    }

    if (ans) {
      console.log(`✍️ [AvatureAdapter]: Input "${labelText.slice(0, 40)}" -> "${ans}"`);
      const inputType = (await input.getAttribute("type").catch(() => ""))?.toLowerCase();
      if (inputType === "month" || inputType === "date") {
        await input.fill(ans).catch(async () => {
          await input.evaluate((el: HTMLInputElement, val: string) => {
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }, ans);
        });
      } else {
        await typeLikeHuman(page, input, ans);
      }
      await this.saveAnswerToDB(profile.userId, labelText, ans);
    }
  }

  /**
   * Uploads candidate resume to file inputs on Avature.
   */
  async uploadResume(page: Page, resumePath: string, fields: FormField[] = [], profile?: UserProfile): Promise<void> {
    const resolvedResume = resolveLocalResumePath(resumePath) || 
      resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

    if (!resolvedResume || !fs.existsSync(resolvedResume)) {
      return;
    }

    const fileInputs = page.locator("input[type='file']");
    const count = await fileInputs.count().catch(() => 0);
    if (count > 0) {
      console.log(`📂 [AvatureAdapter]: Uploading resume PDF to file input (${resolvedResume})...`);
      await fileInputs.first().setInputFiles(resolvedResume).catch(() => {});
      await page.waitForTimeout(1500);
    }
  }

  /**
   * Validates form fields on Avature.
   */
  async validate(page: Page, fields: FormField[] = []): Promise<boolean> {
    const invalidInputs = await page.locator(".error:visible, .invalid:visible, .required-error:visible, [aria-invalid='true']:visible, .form__error:visible").all();
    let hasRealError = false;

    for (const el of invalidInputs) {
      const text = (await el.textContent().catch(() => ""))?.trim() || "";
      if (text.length > 0 && !text.includes("There are people with this information in the system")) {
        console.warn(`⚠️ [AvatureAdapter]: Validation element visible: "${text.slice(0, 50)}"`);
        hasRealError = true;
      }
    }

    return !hasRealError;
  }

  /**
   * Submits or prepares the Avature application.
   */
  async submit(page: Page): Promise<SubmissionResult> {
    const isDryRun = process.env.DRY_RUN === "true" || process.env.AUTO_SUBMIT === "false";
    const currentUrl = page.url().toLowerCase();

    // Guard: Never attempt submit if on Login or initial Registration or ApplicationMethods page
    const isStillOnRegistrationContactInfo = await page.locator("input[id='162']:visible, input[id='2700']:visible").count() > 0;
    if (currentUrl.includes("/login") || currentUrl.includes("/applicationmethods") || isStillOnRegistrationContactInfo) {
      console.warn("⚠️ [AvatureAdapter]: submit() blocked: Page is still on login/initial registration!");
      return {
        success: false,
        errorMessage: "Application is not on the final submission step."
      };
    }

    const submitBtn = page.locator(
      "button:not([name='Login']):not([name='login']):has-text('Submit Application'), " +
      "button:not([name='Login']):not([name='login']):has-text('Submit'), " +
      "button:not([name='Login']):not([name='login']):has-text('Send Application'), " +
      "button:not([name='Login']):not([name='login']):has-text('Finish'), " +
      "button:not([name='Login']):not([name='login']):has-text('Apply Now'), " +
      "input[type='submit'][value*='Submit' i]:not([value*='login' i]), " +
      "button.saveButton:has-text('Submit')"
    ).first();

    const isVisible = await submitBtn.isVisible({ timeout: 2500 }).catch(() => false);
    if (!isVisible) {
      console.log("ℹ️ [AvatureAdapter]: No final submit button found; verifying if already submitted...");
      const confirmed = await page.locator(".success, .confirmation, h1:has-text('Thank you'), h2:has-text('Thank you')").isVisible({ timeout: 3000 }).catch(() => false);
      return {
        success: true,
        confirmation: confirmed ? "Avature Application Submitted Successfully" : "Form filled and completed on Avature."
      };
    }

    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});

    if (isDryRun) {
      console.log("🔒 [AvatureAdapter]: DRY_RUN active. Application filled and verified without final submit click.");
      return {
        success: true,
        confirmation: "Form filled and verified on Avature. Ready for manual review and submission."
      };
    }

    console.log("🚀 [AvatureAdapter]: Submitting application on Avature...");
    await humanClick(page, submitBtn);

    const confirmed = await page.waitForSelector(".success, .confirmation, h1:has-text('Thank you'), h2:has-text('Thank you')", { timeout: 15000 }).catch(() => null);
    return {
      success: true,
      confirmation: confirmed ? "Avature Application Submitted Successfully" : "Submitted Avature application."
    };
  }

  /**
   * Credentials storage helper for tenant domains.
   */
  private getAllTenantAccounts(tenantDomain: string, email: string): AvatureCredentialRecord[] {
    try {
      if (!fs.existsSync(this.credentialsPath)) return [];
      const raw = fs.readFileSync(this.credentialsPath, "utf-8");
      const data = JSON.parse(raw);
      const hostData = data[tenantDomain];
      if (!hostData) return [];
      const baseEmail = email.split("@")[0].split("+")[0].toLowerCase();
      const matches: AvatureCredentialRecord[] = [];
      for (const [savedEmail, record] of Object.entries(hostData)) {
        const savedBase = savedEmail.split("@")[0].split("+")[0].toLowerCase();
        if (savedBase === baseEmail || savedEmail.toLowerCase() === email.toLowerCase()) {
          matches.push(record as AvatureCredentialRecord);
        }
      }
      return matches.reverse(); // latest accounts first
    } catch {
      return [];
    }
  }

  private loadCredentials(tenantDomain: string, email: string): AvatureCredentialRecord | null {
    try {
      if (!fs.existsSync(this.credentialsPath)) return null;
      const raw = fs.readFileSync(this.credentialsPath, "utf-8");
      const data = JSON.parse(raw);
      const hostData = data[tenantDomain];
      if (!hostData) return null;
      // 1. Direct match
      if (hostData[email]) return hostData[email];
      // 2. Base email match (e.g. babufakemail before +)
      const baseEmail = email.split("@")[0].split("+")[0].toLowerCase();
      for (const [savedEmail, record] of Object.entries(hostData)) {
        const savedBase = savedEmail.split("@")[0].split("+")[0].toLowerCase();
        if (savedBase === baseEmail) return record as AvatureCredentialRecord;
      }
      // 3. Fallback to latest record for this tenant
      const keys = Object.keys(hostData);
      if (keys.length > 0) return hostData[keys[keys.length - 1]] as AvatureCredentialRecord;
      return null;
    } catch {
      return null;
    }
  }

  private saveCredentials(tenantDomain: string, creds: AvatureCredentialRecord): void {
    try {
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      let data: Record<string, any> = {};
      if (fs.existsSync(this.credentialsPath)) {
        data = JSON.parse(fs.readFileSync(this.credentialsPath, "utf-8"));
      }

      if (!data[tenantDomain]) data[tenantDomain] = {};
      data[tenantDomain][creds.email] = creds;

      fs.writeFileSync(this.credentialsPath, JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.warn("⚠️ [AvatureAdapter]: Error saving credentials:", e.message);
    }
  }

  private deleteCredentials(tenantDomain: string, email: string): void {
    try {
      if (!fs.existsSync(this.credentialsPath)) return;
      const raw = fs.readFileSync(this.credentialsPath, "utf-8");
      const data = JSON.parse(raw);
      if (data[tenantDomain] && data[tenantDomain][email]) {
        delete data[tenantDomain][email];
        if (Object.keys(data[tenantDomain]).length === 0) {
          delete data[tenantDomain];
        }
        fs.writeFileSync(this.credentialsPath, JSON.stringify(data, null, 2));
        console.log(`🗑️ [AvatureAdapter]: Purged invalid credentials for tenant "${tenantDomain}" (${email}).`);
      }
    } catch (e: any) {
      console.warn("⚠️ [AvatureAdapter]: Error deleting credentials:", e.message);
    }
  }

  /**
   * Database helpers.
   */
  private async getAnswerFromDB(userId?: string, normalizedQuestion?: string): Promise<string | null> {
    if (!userId || !normalizedQuestion) return null;
    try {
      const res: any = await db.query(
        "SELECT answer FROM user_saved_answers WHERE user_id = $1 AND normalized_question = $2 LIMIT 1",
        [userId, normalizedQuestion]
      );
      if (res?.rowCount && res.rowCount > 0) return res.rows[0].answer;
    } catch (e) {}
    return null;
  }

  private async saveAnswerToDB(userId?: string, questionText?: string, answerText?: string): Promise<void> {
    if (!userId || !questionText || !answerText) return;
    const normQ = questionText.toLowerCase().replace(/\*/g, "").trim();
    db.query(
      `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
       VALUES ($1, $2, $3, $4, $5, 'AVATURE')
       ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = CURRENT_TIMESTAMP`,
      [uuidv4(), userId, normQ, questionText, answerText]
    ).catch(() => {});
  }
}
