import { Page, Frame, Locator } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { ATSAdapter, FormField, JobDetails, SubmissionResult, UserProfile, WorkExperienceItem, EducationItem } from "../ats.interface";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { humanClick, humanMouseMove } from "../../browser/human-mouse";
import {
  getWorkdayCredentials,
  getAllWorkdayCredentials,
  saveWorkdayCredentials,
  markCredentialInvalid,
  extractWorkdayDomain
} from "./workday-account-store";

export const DEFAULT_HRUTIN_EXPERIENCES: WorkExperienceItem[] = [
  {
    jobTitle: "Full Stack AI Developer",
    company: "Jobspring",
    location: "San Francisco, CA, United States",
    currentlyWorkHere: true,
    startDate: "01/2024",
    startMonth: "01",
    startYear: "2024",
    endDate: "01/2026",
    endMonth: "01",
    endYear: "2026",
    description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications. Reduced API response latency by 30% through database query optimization and backend performance improvements. Containerized and deployed applications using Docker and Azure App Service, reducing deployment time by 60%."
  },
  {
    jobTitle: "Full Stack Developer",
    company: "Nomadic Trails",
    location: "Remote",
    currentlyWorkHere: false,
    startDate: "09/2025",
    startMonth: "09",
    startYear: "2025",
    endDate: "10/2025",
    endMonth: "10",
    endYear: "2025",
    description: "Delivered full-stack features for a travel-tech platform serving customer-facing applications. Built scalable backend APIs and responsive frontend interfaces using modern development practices. Integrated third-party APIs for itinerary generation and workflow automation."
  }
];

export const DEFAULT_HRUTIN_EDUCATIONS: EducationItem[] = [
  {
    school: "Parul University",
    degree: "Bachelor of Technology",
    fieldOfStudy: "Computer Science and Engineering",
    gpa: "7.1",
    startDate: "08/2023",
    startYear: "2023",
    endDate: "06/2027",
    endYear: "2027"
  }
];

export const DEFAULT_HRUTIN_SKILLS = [
  "Python", "FastAPI", "React", "JavaScript", "Docker", "REST APIs", "MySQL", "MongoDB", "Git", "Azure", "NLP", "RAG"
];

export const DEFAULT_HRUTIN_WEBSITES = [
  "https://linkedin.com/in/hrutinnammi",
  "https://github.com/hrutinnammi"
];

export class WorkdayAdapter implements ATSAdapter {
  private authenticatedSessions = new Set<string>();
  private candidateProfile?: UserProfile;
  private cachedResumePath?: string;

  async detect(page: Page): Promise<boolean> {
    const url = page.url().toLowerCase();
    if (url.includes("myworkdayjobs.com") || url.includes("workday.com")) return true;

    const content = await page.content().catch(() => "");
    const lower = content.toLowerCase();
    return (
      lower.includes("myworkdayjobs.com") ||
      (await page.$("[data-automation-id='adventureButton'], [data-automation-id='autofillWithResume'], [class*='workday']")) !== null
    );
  }

  async extractJob(page: Page): Promise<JobDetails> {
    const title = await page.locator("h2[data-automation-id='jobPostingHeader'], h1, [data-automation-id='jobTitle']").first().innerText().catch(() => "Workday Role");
    const company = await page.evaluate(() => {
      const match = window.location.hostname.match(/([a-z0-9_-]+)\.[a-z0-9_-]+\.myworkdayjobs\.com/i);
      if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
      return "Workday Employer";
    }).catch(() => "Workday Employer");

    const description = await page.locator("[data-automation-id='jobPostingDescription'], #job-description, body").first().innerText().catch(() => "");

    return {
      title: title.trim(),
      company: company.trim(),
      description: description.slice(0, 500),
      ats: "WORKDAY"
    };
  }

  async extractFields(page: Page): Promise<FormField[]> {
    const fields: FormField[] = [];

    const inputs = await page.evaluate(() => {
      const results: any[] = [];
      document.querySelectorAll("input, select, textarea, button[aria-haspopup='listbox']").forEach((el) => {
        const id = el.getAttribute("data-automation-id") || el.getAttribute("name") || el.id || "";
        const label = el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";
        results.push({
          id,
          label,
          type: (el as HTMLInputElement).type || "text",
          required: el.hasAttribute("aria-required") || el.hasAttribute("required")
        });
      });
      return results;
    }).catch(() => []);

    for (const inp of inputs) {
      fields.push({
        id: inp.id,
        label: inp.label,
        type: (inp.type === "password" || inp.type === "email" || inp.type === "tel" || inp.type === "file" || inp.type === "checkbox" || inp.type === "radio") ? inp.type : "text",
        required: !!inp.required
      });
    }

    return fields;
  }

  /**
   * Accepts cookies if cookie banner is visible
   */
  private async acceptCookiesIfPresent(page: Page): Promise<void> {
    const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
    if (await cookieBtn.count() > 0 && await cookieBtn.isVisible().catch(() => false)) {
      console.log("  Accepting Workday cookies notice...");
      await cookieBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  /**
   * Initiates the application flow via "Autofill with Resume"
   */
  private async initiateApplyWithResume(page: Page): Promise<void> {
    await this.acceptCookiesIfPresent(page);

    const currentUrl = page.url();
    if (
      currentUrl.includes("/apply/autofillWithResume") ||
      currentUrl.includes("/apply/applyManually") ||
      (currentUrl.includes("/apply") && (await page.locator("input[type='file'], [data-automation-id='pageHeader'], [data-automation-id='bottom-navigation-next-button']").count()) > 0)
    ) {
      return;
    }

    // 1. Locate and click the Apply button
    const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
    const hasApplyBtn = await applyBtn.waitFor({ state: "visible", timeout: 15000 }).then(() => true).catch(() => false);
    if (hasApplyBtn) {
      console.log("  Clicking Workday Apply button ('adventureButton')...");
      await applyBtn.scrollIntoViewIfNeeded().catch(() => {});
      await applyBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(4000);
    }

    // 2. Select "Autofill with Resume" from the Start Application options
    const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
    const hasAutofill = await autofillOption.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
    if (hasAutofill) {
      console.log("  Selecting 'Autofill with Resume' application method...");
      await autofillOption.scrollIntoViewIfNeeded().catch(() => {});
      await autofillOption.click({ force: true }).catch(() => {});
      // Wait for loading screen to clear and inputs/auth or wizard to mount
      await page.waitForTimeout(3000);
      await page.waitForFunction(() => !document.querySelector("div[data-automation-id='applyFlowLoadingPage']"), { timeout: 12000 }).catch(() => {});
      await page.waitForSelector(
        "input[data-automation-id='email'], input[data-automation-id='userName'], button[data-automation-id='signInLink'], button[data-automation-id='createAccountLink'], input[type='file'], [data-automation-id='file-upload-drop-zone'], [data-automation-id='progressBarActiveStep']",
        { timeout: 15000 }
      ).catch(() => {});
    } else {
      // Fallback: Check if Apply Manually is visible if Autofill with Resume is not available
      const applyManually = page.locator("a[data-automation-id='applyManually'], button[data-automation-id='applyManually']").first();
      if (await applyManually.count() > 0 && await applyManually.isVisible().catch(() => false)) {
        console.log("  Selecting 'Apply Manually' option...");
        await applyManually.click({ force: true }).catch(() => {});
        await page.waitForTimeout(4000);
      }
    }
  }

  /**
   * Helper to robustly fill an input triggering React synthetic events and native prototype setter
   */
  private async setReactInputValue(page: Page, selector: string, value: string): Promise<void> {
    const loc = page.locator(selector).first();
    if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      await loc.focus().catch(() => {});
      await loc.fill(value).catch(() => {});
      await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel) as HTMLInputElement;
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(el, val);
          else el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }, { sel: selector, val: value }).catch(() => {});
      await loc.blur().catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  /**
   * Helper to click Workday overlay buttons (which wrap `<button>` inside `<div data-automation-id='click_filter'>`)
   */
  private async clickWorkdayButton(page: Page, locator: Locator): Promise<void> {
    try {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.evaluate((el: HTMLElement) => {
        const overlay = el.closest("[data-automation-id='click_filter']") ||
                        el.parentElement?.querySelector("[data-automation-id='click_filter']") ||
                        el.parentElement?.parentElement?.querySelector("[data-automation-id='click_filter']");
        if (overlay) {
          overlay.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          overlay.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          (overlay as HTMLElement).click();
        }
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        el.click();
      }).catch(() => {});
      await locator.click({ force: true, timeout: 2000 }).catch(() => {});
      return;
    } catch {}
    try {
      await locator.click({ timeout: 3000 });
      return;
    } catch {}
    try {
      const box = await locator.boundingBox();
      if (box && box.width > 0 && box.height > 0) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
    } catch {}
  }

  /**
   * Complete Workday Authentication (Account Creation or Sign-In with credential remembering)
   */
  private async ensureAuthenticated(page: Page, profile: UserProfile): Promise<void> {
    const domain = extractWorkdayDomain(page.url());
    if (this.authenticatedSessions.has(domain)) {
      return;
    }

    await this.initiateApplyWithResume(page);

    // Check if we are already authenticated and in the application wizard
    const isAlreadyInWizard = await page.evaluate(() => {
      const url = window.location.href;
      if (url.includes("/login")) return false;
      const userHeader = document.querySelector("[data-automation-id='utilityButtonSignIn'], [data-automation-id='userAccountButton']");
      const bodyText = document.body?.innerText || "";
      const isLoggedInHeader = bodyText.includes("Candidate Home") || bodyText.includes("Job Alerts") || bodyText.includes("Settings");
      const fileInput = document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
      const pageHeader = document.querySelector("[data-automation-id='pageHeader'], [data-automation-id='legalNameSection_firstName'], input[id*='firstName']");
      return !!(isLoggedInHeader && (fileInput || pageHeader));
    }).catch(() => false);

    if (isAlreadyInWizard) {
      console.log("✅ [WorkdayAdapter]: Candidate is already authenticated and in application workflow.");
      this.authenticatedSessions.add(domain);
      return;
    }

    console.log("🔐 [WorkdayAdapter]: Handling Candidate Authentication (Create Account / Sign In)...");
    await updateHUDStatus(page, "Authentication", "Authenticating with Workday candidate portal...", "info", 20);

    // 0. Accept cookies if banner is blocking the auth view
    await this.acceptCookiesIfPresent(page);

    // 0b. Check if an alternative authentication method screen is shown (e.g. Accenture "Sign in with email")
    const emailProviderBtn = page.locator(
      "button:has-text('Sign in with email'), [data-automation-id*='signInWithEmail'], div[role='button']:has-text('Sign in with email'), button:has-text('email')"
    ).first();
    if (await emailProviderBtn.count() > 0 && await emailProviderBtn.isVisible().catch(() => false)) {
      console.log("  Selecting 'Sign in with email' authentication method...");
      await emailProviderBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
    }

    // Wait up to 20s for the auth container/fields to mount
    await page.waitForSelector(
      "input[data-automation-id='email'], input[data-automation-id='userName'], button[data-automation-id='signInLink'], button[data-automation-id='createAccountLink'], button[data-automation-id='signInSubmitButton'], div[data-automation-id='click_filter'][aria-label='Create Account'], div[data-automation-id='click_filter'][aria-label='Sign In']",
      { timeout: 20000 }
    ).catch(() => {
      console.log("  Notice: Auth selector wait reached timeout, inspecting current DOM...");
    });

    const defaultPassword = process.env.WORKDAY_PASSWORD || "Tarun@143";
    const defaultEmail = process.env.WORKDAY_EMAIL || "tarunkomati2@gmail.com";

    // Candidate email pool in order of priority:
    // 1. Any saved/remembered credentials for this domain first
    // 2. Primary user configured email: tarunkomati2@gmail.com
    // 3. Profile email and fallback
    const allKnownCreds = await getAllWorkdayCredentials(domain);
    const candidateEmails = Array.from(new Set([
      ...allKnownCreds.map(c => c.email),
      defaultEmail,
      "tarunkomati2@gmail.com",
      profile.email,
      "babu020106@gmail.com",
      "chetanmidde@gmail.com",
      "komatitarun@yahoo.com",
      "babufakemail@gmail.com"
    ].filter(Boolean))) as string[];

    const candidatePasswords = Array.from(new Set([
      defaultPassword,
      "Tarun@143",
      ...allKnownCreds.map(c => c.password),
      "Tarun@2006",
      "Nithin@6677",
      "ClucoAi@2026!Secure",
      "BabuFake123!"
    ].filter(Boolean))) as string[];

    if (allKnownCreds.length > 0) {
      console.log(`🔑 [WorkdayAdapter]: Found ${allKnownCreds.length} remembered credential(s) for ${domain} (${allKnownCreds.map(c => c.email).join(", ")}).`);
    }

    // PHASE 1: Always go directly to Sign In tab / link first (User instruction: "go directly to signin click login or sign in and then enter the signin credentials")
    const signInTab = page.locator(
      "button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], div[data-automation-id='click_filter'][aria-label='Sign In'], button:has-text('Sign In'), a:has-text('Sign In')"
    ).first();
    if (await signInTab.count() > 0 && await signInTab.isVisible().catch(() => false)) {
      console.log("  Switching directly to 'Sign In' to enter candidate credentials...");
      await this.clickWorkdayButton(page, signInTab);
      await page.waitForTimeout(2000);
      await page.waitForSelector("input[data-automation-id='password']", { timeout: 10000 }).catch(() => {});
    }

    let authenticatedEmail: string | null = null;

    // Try signing in with all candidate emails in priority order
    for (const email of candidateEmails) {
      console.log(`👉 [WorkdayAdapter]: Trying Candidate Sign In (${email})...`);
      await updateHUDStatus(page, "Sign In", `Attempting sign in with ${email}...`, "info", 25);
      const ok = await this.attemptSignInWithFallback(page, domain, email, candidatePasswords);
      if (ok) {
        console.log(`🎉 [WorkdayAdapter]: Successfully authenticated with candidate account: ${email}!`);
        authenticatedEmail = email;
        break;
      }
    }

    // PHASE 2 & 3: If no existing account could log in, Create Account and then Sign In with those details
    if (!authenticatedEmail) {
      console.log("  No existing candidate account could be signed in. Switching to 'Create Account' tab...");
      await updateHUDStatus(page, "Create Account", "Creating candidate account on Workday...", "info", 25);

      const createAccTab = page.locator(
        "button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], div[data-automation-id='click_filter'][aria-label*='Create Account'], button:has-text('Create Account'), a:has-text('Create Account')"
      ).first();
      if (await createAccTab.count() > 0 && await createAccTab.isVisible().catch(() => false)) {
        await this.clickWorkdayButton(page, createAccTab);
        await page.waitForTimeout(2500);
      }
      await page.waitForSelector("input[data-automation-id='verifyPassword']", { timeout: 15000 }).catch(() => {});

      const emailsToRegister = [
        "babu020106@gmail.com",
        "chetanmidde@gmail.com",
        "komatitarun@yahoo.com",
        profile.email || "babufakemail@gmail.com"
      ];

      let registeredEmail: string | null = null;
      const registeredPassword = defaultPassword;

      for (const regEmail of emailsToRegister) {
        console.log(`  Submitting candidate account registration (${regEmail})...`);
        const emailInp = page.locator("input[data-automation-id='email']:not([name='website']), input[data-automation-id='userName']:not([name='website'])").first();
        if (await emailInp.count() > 0) {
          await emailInp.focus().catch(() => {});
          await emailInp.fill(regEmail).catch(() => {});
          await emailInp.press("Tab").catch(() => {});
        }

        const pwInp = page.locator("input[data-automation-id='password']:not([name='website'])").first();
        if (await pwInp.count() > 0) {
          await pwInp.focus().catch(() => {});
          await pwInp.fill(registeredPassword).catch(() => {});
          await pwInp.press("Tab").catch(() => {});
        }

        const vpwInp = page.locator("input[data-automation-id='verifyPassword']:not([name='website'])").first();
        if (await vpwInp.count() > 0) {
          await vpwInp.focus().catch(() => {});
          await vpwInp.fill(registeredPassword).catch(() => {});
          await vpwInp.press("Tab").catch(() => {});
        }

        const agreementCb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
        if (await agreementCb.count() > 0) {
          const isChecked = await agreementCb.isChecked().catch(() => false);
          if (!isChecked) {
            const cbContainer = page.locator("div[data-automation-id='createAccountCheckbox']").first();
            if (await cbContainer.count() > 0) {
              await cbContainer.click().catch(() => {});
            } else {
              await agreementCb.check({ force: true }).catch(() => {});
            }
          }
        }

        const createSubmitBtn = page.locator(
          "button[data-automation-id='createAccountSubmitButton'], div[data-automation-id='click_filter'][aria-label*='Create Account'], button:has-text('Create Account')"
        ).first();
        if (await createSubmitBtn.count() > 0) {
          console.log("  Clicking 'Create Account' submit button...");
          await this.clickWorkdayButton(page, createSubmitBtn);
        }

        await page.waitForTimeout(6000);

        const alreadyExists = await page.evaluate(() => {
          const text = (document.body?.innerText || "").toLowerCase();
          return text.includes("already exists") || text.includes("please sign in");
        }).catch(() => false);

        if (alreadyExists) {
          console.log(`  Notice: Account with ${regEmail} already exists. Trying next candidate email...`);
          continue;
        }

        registeredEmail = regEmail;
        break;
      }

      if (!registeredEmail) {
        const tenantSlug = domain.split(".")[0];
        const aliasEmail = `babu020106+${tenantSlug}${Date.now().toString().slice(-4)}@gmail.com`;
        console.log(`  All candidate emails registered. Creating tenant alias account: ${aliasEmail}...`);
        const emailInp = page.locator("input[data-automation-id='email']:not([name='website'])").first();
        await emailInp.fill(aliasEmail).catch(() => {});
        const pwInp = page.locator("input[data-automation-id='password']:not([name='website'])").first();
        await pwInp.fill(registeredPassword).catch(() => {});
        const vpwInp = page.locator("input[data-automation-id='verifyPassword']:not([name='website'])").first();
        await vpwInp.fill(registeredPassword).catch(() => {});
        const agreementCb = page.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox'], input[type='checkbox']").first();
        if (await agreementCb.count() > 0 && !(await agreementCb.isChecked().catch(() => false))) {
          await agreementCb.check({ force: true }).catch(() => {});
        }
        const createSubmitBtn = page.locator("button[data-automation-id='createAccountSubmitButton'], div[data-automation-id='click_filter'][aria-label*='Create Account']").first();
        await this.clickWorkdayButton(page, createSubmitBtn);
        await page.waitForTimeout(6000);
        registeredEmail = aliasEmail;
      }

      // User instruction: "once account created click on login or signin , but here its clicking create account , it should create account and login with the details only"
      console.log(`\n🔑 Account created with ${registeredEmail}! Waiting for Sign In / Login form to mount on redirect...`);
      await updateHUDStatus(page, "Signing In", `Logging in with created account (${registeredEmail})...`, "info", 30);

      // Wait up to 20s for the redirect or for the login elements to mount
      await page.waitForSelector(
        "input[data-automation-id='email'], input[data-automation-id='userName'], button[data-automation-id='signInSubmitButton'], [data-automation-id='signInLink']",
        { timeout: 20000 }
      ).catch(() => {});
      await page.waitForTimeout(2000);

      // If a Sign In link is visible, click it
      const signInLoc = page.locator("[data-automation-id='signInLink'], a:has-text('Sign In'), button:has-text('Sign In')").first();
      if (await signInLoc.count() > 0 && await signInLoc.isVisible().catch(() => false)) {
        console.log("  Clicking Sign In link on redirected page...");
        await signInLoc.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2500);
      }

      // Fill login inputs
      const loginEmailInp = page.locator("input[data-automation-id='email']:not([name='website']), input[data-automation-id='userName']:not([name='website']), input[name='userName']").first();
      await loginEmailInp.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});

      if (await loginEmailInp.count() > 0 && await loginEmailInp.isVisible().catch(() => false)) {
        console.log(`  Filling login form with created credentials (${registeredEmail} / ${registeredPassword})...`);
        await loginEmailInp.focus().catch(() => {});
        await loginEmailInp.fill(registeredEmail).catch(() => {});
        await loginEmailInp.press("Tab").catch(() => {});

        const loginPwInp = page.locator("input[data-automation-id='password']:not([name='website']), input[name='password']").first();
        await loginPwInp.focus().catch(() => {});
        await loginPwInp.fill(registeredPassword).catch(() => {});

        const loginSubmitBtn = page.locator("button[data-automation-id='signInSubmitButton'], [data-automation-id='click_filter'][aria-label*='Sign In']").first();
        console.log("  Clicking Sign In submit button...");
        await this.clickWorkdayButton(page, loginSubmitBtn);
        await page.waitForTimeout(6000);
      }

      await saveWorkdayCredentials(domain, registeredEmail, registeredPassword);
      authenticatedEmail = registeredEmail;
    }

    // Check if redirected to job details page after authentication (Workday redirect behavior)
    const hasJobDetailsApply = await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first().isVisible().catch(() => false);
    if (hasJobDetailsApply && !page.url().includes("/apply")) {
      console.log("  Redirected to job details page after authentication. Launching application wizard with active session...");
      await this.initiateApplyWithResume(page);
      await page.waitForTimeout(5000);
    }

    // Wait for Workday to mount either resume upload or application wizard
    await page.waitForSelector(
      "input[type='file'], [data-automation-id='file-upload-drop-zone'], [data-automation-id='bottom-navigation-next-button'], [data-automation-id='pageHeader'], input[id*='firstName']",
      { timeout: 12000 }
    ).catch(() => {});

    // Check if transient Workday error appeared right after sign in / upload ("Something went wrong")
    const hasTransientError = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      return text.includes("Something went wrong") && text.includes("refresh the page");
    }).catch(() => false);

    if (hasTransientError) {
      console.log("  Workday transient error detected after auth. Reloading page to resume...");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(6000);
    }

    const inWorkflow = await page.evaluate(() => {
      const url = window.location.href;
      if (url.includes("/login")) return false;
      if (document.querySelector("input[data-automation-id='verifyPassword']")) return false;
      if (document.querySelector("input[data-automation-id='password']")) return false;
      if (document.querySelector("button[data-automation-id='signInSubmitButton'], button[data-automation-id='createAccountSubmitButton']")) return false;
      const stepText = (document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent || "").toLowerCase();
      if (stepText.includes("sign in") || stepText.includes("create account")) return false;

      const bodyText = (document.body?.innerText || "").toLowerCase();
      const isLoggedIn = bodyText.includes("candidate home") || bodyText.includes("settings") || bodyText.includes("job alerts");
      return !!(
        isLoggedIn ||
        document.querySelector(
          "input[type='file'], [data-automation-id='file-upload-drop-zone'], [data-automation-id='bottom-navigation-next-button'], input[id*='firstName'], button[data-automation-id='pageFooterNextButton']"
        )
      );
    }).catch(() => false);

    if (inWorkflow) {
      this.authenticatedSessions.add(domain);
      console.log("✅ [WorkdayAdapter]: Candidate authentication successfully finalized.");
    } else {
      console.warn("⚠️ [WorkdayAdapter]: Authentication not confirmed in workflow yet. Checking page state...");
    }
  }

  /**
   * Helper to attempt Sign In trying candidate passwords in sequence if wrong credentials error is returned
   */
  private async attemptSignInWithFallback(
    page: Page,
    domain: string,
    loginEmail: string,
    passwords: string[]
  ): Promise<boolean> {
    await page.waitForSelector(
      "input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName'], input[type='email'], input[type='text']",
      { timeout: 15000 }
    ).catch(() => {});

    // Accept cookies if present on sign in screen
    await this.acceptCookiesIfPresent(page);

    // If an intermediate "Sign in with email" button is present, click it
    const emailProviderBtn = page.locator("button:has-text('Sign in with email'), [data-automation-id*='signInWithEmail'], div[role='button']:has-text('Sign in with email')").first();
    if (await emailProviderBtn.count() > 0 && await emailProviderBtn.isVisible().catch(() => false)) {
      await emailProviderBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    for (const pw of passwords) {
      console.log(`  Attempting sign in with password candidate (${pw.slice(0, 3)}***)...`);
      const emailInp = page.locator("div[role='dialog'] input[data-automation-id='email'], div[role='dialog'] input[data-automation-id='userName'], input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").last();
      const pwInp = page.locator("div[role='dialog'] input[data-automation-id='password'], input[data-automation-id='password'], input[name='password']").last();

      if (await emailInp.count() > 0) {
        await emailInp.scrollIntoViewIfNeeded().catch(() => {});
        await emailInp.focus().catch(() => {});
        await emailInp.fill(loginEmail).catch(() => {});
      }
      if (await pwInp.count() > 0) {
        await pwInp.scrollIntoViewIfNeeded().catch(() => {});
        await pwInp.focus().catch(() => {});
        await pwInp.fill(pw).catch(() => {});
      }

      // Clear any prior error banner from DOM so we don't match stale errors from previous attempts
      await page.evaluate(() => {
        const banners = document.querySelectorAll("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']");
        banners.forEach(b => (b as HTMLElement).remove());
      }).catch(() => {});

      // Submit via button click and enter key on the active dialog / last button
      const submitBtn = page.locator("div[role='dialog'] button[data-automation-id='signInSubmitButton'], div[role='dialog'] div[data-automation-id='click_filter'][aria-label*='Sign In'], button[data-automation-id='signInSubmitButton'], div[data-automation-id='click_filter'][aria-label*='Sign In'], button:has-text('Sign In')").last();
      if (await submitBtn.count() > 0) {
        await submitBtn.click({ force: true }).catch(() => {});
        await this.clickWorkdayButton(page, submitBtn);
      }

      if (await pwInp.count() > 0) {
        await pwInp.press("Enter").catch(() => {});
      }

      // Wait and poll for authentication response (up to 15s)
      let hasWrongCreds = false;
      let isLoggedIn = false;
      let isVerificationRequired = false;

      for (let i = 0; i < 15; i++) {
        await page.waitForTimeout(1000);
        const status = await page.evaluate(() => {
          const text = (document.body?.innerText || "").toLowerCase();
          const errBanner = document.querySelector(
            "[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']"
          );
          const isErrVisible = !!(errBanner && (errBanner as HTMLElement).offsetParent !== null);
          const errText = isErrVisible ? (errBanner?.textContent || "").toLowerCase() : "";
          const wrong =
            isErrVisible && (
              errText.includes("wrong email") ||
              errText.includes("invalid user name") ||
              errText.includes("incorrect password") ||
              errText.includes("locked") ||
              errText.includes("invalid credentials")
            );

          const isVerification =
            text.includes("verify your account before you sign in") ||
            text.includes("verification email") ||
            text.includes("account may need verification");

          const isDialogVisible = Array.from(document.querySelectorAll("[role='dialog'], [data-behavior-click-outside-close='topmost']")).some(
            d => (d as HTMLElement).offsetParent !== null && d.querySelector("input[data-automation-id='password']")
          );

          const stepText = (document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent || "").toLowerCase();
          const isAuthStep = stepText.includes("sign in") || stepText.includes("create account");

          const hasContinueBtn = Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").trim() === "Continue");
          const hasUserIndicator = text.includes("candidate home") || text.includes("settings") || text.includes("job alerts") || text.includes("tarunkomati2@gmail.com");
          const hasFormStep = !!document.querySelector(
            "input[type='file'], [data-automation-id='file-upload-drop-zone'], [data-automation-id='bottom-navigation-next-button'], button[data-automation-id='pageFooterNextButton'], input[id*='firstName']"
          );

          const loggedIn =
            !isVerification &&
            (hasUserIndicator || (!isDialogVisible && !isAuthStep && (hasContinueBtn || hasFormStep)));

          return { wrong, loggedIn, errText, isVerification };
        }).catch(() => ({ wrong: false, loggedIn: false, errText: "", isVerification: false }));

        if (status.isVerification) {
          isVerificationRequired = true;
          console.warn("  ⚠️ [WorkdayAdapter]: This Workday tenant requires email verification before login!");
          break;
        }

        if (status.wrong) {
          hasWrongCreds = true;
          console.log(`  [Notice] Authentication error banner displayed: "${status.errText.slice(0, 120)}"`);
          break;
        }

        if (status.loggedIn) {
          isLoggedIn = true;
          break;
        }
      }

      if (isVerificationRequired) {
        return false;
      }

      if (isLoggedIn && !hasWrongCreds) {
        console.log(`  🎉 Successful authentication for ${domain} (${loginEmail})!`);
        await saveWorkdayCredentials(domain, loginEmail, pw).catch(() => {});
        return true;
      }

      if (hasWrongCreds) {
        console.log(`  Password attempt (${pw.slice(0, 3)}***) returned invalid credentials. Trying next...`);
        continue;
      }

      // Check if redirect / wizard mounted
      const wizardMounted = await page.evaluate(() => {
        const text = (document.body?.innerText || "").toLowerCase();
        const hasUserIndicator = text.includes("candidate home") || text.includes("settings") || text.includes("job alerts") || text.includes("tarunkomati2@gmail.com");
        const hasContinueBtn = Array.from(document.querySelectorAll("button")).some(b => (b.textContent || "").trim() === "Continue");
        const hasWizard = hasUserIndicator || hasContinueBtn || !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone'], [data-automation-id='bottom-navigation-next-button']");
        return hasWizard;
      }).catch(() => false);

      if (wizardMounted) {
        console.log(`  🎉 Successful authentication for ${domain} (${loginEmail})!`);
        await saveWorkdayCredentials(domain, loginEmail, pw).catch(() => {});
        return true;
      }
    }

    const wasSaved = (await getAllWorkdayCredentials(domain)).some(c => c.email.toLowerCase() === loginEmail.toLowerCase());
    if (wasSaved) {
      await markCredentialInvalid(domain, loginEmail).catch(() => {});
    }
    return false;
  }

  /**
   * Resolves the local absolute path of candidate resume
   */
  private resolveResumePath(specifiedPath?: string): string | null {
    const candidates = [
      specifiedPath,
      this.cachedResumePath,
      this.candidateProfile?.resumePath,
      path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf"),
      path.resolve("resumes/user_hrutin/resume.pdf"),
      path.resolve("resumes/resume.pdf"),
      path.resolve("scratch/test-resume.pdf")
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      try {
        const resolved = path.isAbsolute(p) ? p : path.resolve(p);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      } catch {}
    }
    return null;
  }

  /**
   * Helper to advance past standalone resume screens (/autofillWithResume or drop-zone only views)
   */
  private async advancePastStandaloneUpload(page: Page): Promise<void> {
    const isStandalone = await page.evaluate(() => {
      const url = window.location.href.toLowerCase();
      if (url.includes("/apply/autofillwithresume")) return true;
      const textInputs = Array.from(document.querySelectorAll("input:not([type='file']):not([type='hidden']), select, textarea"));
      const visibleInputs = textInputs.filter(el => (el as HTMLElement).offsetParent !== null);
      return visibleInputs.length <= 1;
    }).catch(() => false);

    if (!isStandalone) return;

    console.log("  Advancing past standalone resume upload step...");
    const continueBtn = page.locator(
      "div[data-automation-id='click_filter'][aria-label*='Continue'], button:has-text('Continue'), button[data-automation-id='bottom-navigation-next-button'], button:has-text('Next')"
    ).first();

    if (await continueBtn.count() > 0 && await continueBtn.isVisible().catch(() => false)) {
      await this.clickWorkdayButton(page, continueBtn);
      await page.waitForTimeout(6000);
    }
  }

  /**
   * Robust helper to upload resume wherever it appears in the Workday flow
   * (e.g. Step 0 Autofill screen, Step 2 My Experience, or any step with a drop zone)
   */
  private async uploadResumeIfPresent(
    page: Page,
    specifiedResumePath?: string,
    isStandaloneScreen: boolean = false
  ): Promise<boolean> {
    const resumePath = this.resolveResumePath(specifiedResumePath);
    if (!resumePath) {
      console.warn("⚠️ [WorkdayAdapter]: No valid resume file path found to upload.");
      return false;
    }

    // 1. Check if resume is already uploaded on this step
    const isAlreadyUploaded = await page.evaluate(() => {
      const uploadItem = document.querySelector(
        "[data-automation-id='file-upload-item'], [data-automation-id='uploaded-file-name'], [data-automation-id='file-upload-item-name'], button[data-automation-id='delete-file'], button[aria-label*='Delete file'], button[aria-label*='Remove file']"
      );
      if (uploadItem && (uploadItem as HTMLElement).offsetParent !== null) {
        return true;
      }
      const dropZones = Array.from(document.querySelectorAll("[data-automation-id='file-upload-drop-zone'], div[class*='dropZone']"));
      for (const dz of dropZones) {
        if (dz.textContent && (dz.textContent.includes(".pdf") || dz.textContent.includes(".docx") || dz.textContent.includes(".doc"))) {
          return true;
        }
      }
      return false;
    }).catch(() => false);

    if (isAlreadyUploaded) {
      console.log("  ✅ Resume is already attached on current step.");
      if (isStandaloneScreen) {
        await this.advancePastStandaloneUpload(page);
      }
      return true;
    }

    // 2. Locate file input on the step
    const fileInputs = page.locator("input[type='file']");
    const count = await fileInputs.count();
    if (count === 0) {
      return false;
    }

    // Find the file input that corresponds to Resume/CV (or fallback to the first one)
    let targetInput = fileInputs.first();
    for (let i = 0; i < count; i++) {
      const inp = fileInputs.nth(i);
      const isResume = await inp.evaluate((el) => {
        const parent = el.closest("section, fieldset, div[data-automation-id*='Section'], div[class*='dropZone'], div");
        const heading = parent?.querySelector("h1, h2, h3, h4, h5, [role='heading']")?.textContent?.toLowerCase() || "";
        const label = el.getAttribute("aria-label")?.toLowerCase() || "";
        const id = (el.id || "").toLowerCase();
        return heading.includes("resume") || heading.includes("cv") || label.includes("resume") || label.includes("cv") || id.includes("resume");
      }).catch(() => false);

      if (isResume) {
        targetInput = inp;
        break;
      }
    }

    console.log(`📂 [WorkdayAdapter]: Attaching resume (${path.basename(resumePath)}) to file input...`);
    try {
      await targetInput.setInputFiles(resumePath);
    } catch (err: any) {
      console.warn("  Failed to attach file via setInputFiles:", err.message);
      return false;
    }

    console.log("  Waiting for Workday file upload to register...");
    await page.waitForSelector(
      "[data-automation-id='file-upload-item'], [data-automation-id='uploaded-file-name'], button[data-automation-id='delete-file'], button[aria-label*='Delete file'], button[aria-label*='Remove file']",
      { timeout: 12000 }
    ).catch(() => {});

    await page.waitForTimeout(3000);

    const uploadSuccess = await page.evaluate(() => {
      return document.querySelector(
        "[data-automation-id='file-upload-item'], [data-automation-id='uploaded-file-name'], button[data-automation-id='delete-file'], button[aria-label*='Delete file'], button[aria-label*='Remove file']"
      ) !== null;
    }).catch(() => false);

    if (uploadSuccess) {
      console.log("  ✅ Resume successfully attached to Workday application!");
      await updateHUDStatus(page, "Resume Uploaded", "Resume successfully attached", "success", 45);
    } else {
      console.log("  Resume input submitted (AJAX response pending or completed). Continuing...");
    }

    if (isStandaloneScreen) {
      await this.advancePastStandaloneUpload(page);
    }

    return true;
  }

  async uploadResume(page: Page, resumePath: string, _fields?: FormField[], profile?: UserProfile): Promise<void> {
    console.log(`📂 [WorkdayAdapter]: uploadResume called with: ${resumePath}...`);
    this.cachedResumePath = resumePath;
    if (profile) {
      this.candidateProfile = profile;
    }
    const userProf = profile || this.candidateProfile || {
      firstName: "Hrutin",
      lastName: "Nammi",
      email: "babufakemail@gmail.com",
      phone: "2025550198",
      location: "San Francisco, CA, United States",
      willingToRelocate: true,
      workAuthorization: "Yes",
      yearsOfExperience: 3
    };
    const domain = extractWorkdayDomain(page.url());
    const isInWizardOrReview = await page.evaluate(() => {
      const url = window.location.href.toLowerCase();
      if (url.includes("/review") || url.includes("/apply")) return true;
      return !!document.querySelector(
        "[data-automation-id='progressBarActiveStep'], [data-automation-id='bottom-navigation-next-button'], [data-automation-id='pageHeader']"
      );
    }).catch(() => false);

    if (!this.authenticatedSessions.has(domain) && !isInWizardOrReview) {
      await this.ensureAuthenticated(page, userProf);
    }

    const hasFileInput = (await page.locator("input[type='file'], [data-automation-id='file-upload-drop-zone']").count()) > 0;
    if (hasFileInput) {
      await this.uploadResumeIfPresent(page, resumePath, false);
    } else {
      console.log("  Resume file input not on current screen (already uploaded during wizard steps).");
    }
  }

  async fillForm(
    page: Page,
    profile: UserProfile,
    additionalAnswers?: Record<string, string>,
    _fields?: FormField[]
  ): Promise<void> {
    this.candidateProfile = profile;
    if (additionalAnswers?.resumePath) {
      this.cachedResumePath = additionalAnswers.resumePath;
    } else if (profile.resumePath) {
      this.cachedResumePath = profile.resumePath;
    }

    await injectVisualHUD(page, { company: "Workday", title: "Job Application" });

    // Step 1: Ensure authentication is completed
    await this.ensureAuthenticated(page, profile);

    // Guard: Check if page is still on authentication or email verification screen
    const isStillOnAuth = await page.evaluate(() => {
      const url = window.location.href;
      if (url.includes("/login")) return true;
      if (document.querySelector("input[data-automation-id='verifyPassword']")) return true;
      if (document.querySelector("input[data-automation-id='password']")) return true;
      if (document.querySelector("button[data-automation-id='signInSubmitButton'], button[data-automation-id='createAccountSubmitButton']")) return true;
      const text = (document.body?.innerText || "").toLowerCase();
      return text.includes("verify your account before you sign in") || text.includes("check your email to verify");
    }).catch(() => false);

    if (isStillOnAuth) {
      console.warn("⚠️ [WorkdayAdapter]: Page is still on authentication / verification screen. Retrying authentication...");
      await this.ensureAuthenticated(page, profile);
      const stillAuth = await page.evaluate(() => !!document.querySelector("input[data-automation-id='password']")).catch(() => false);
      if (stillAuth) {
        console.warn("⚠️ [WorkdayAdapter]: Still on auth screen after retry. Stopping form completion.");
        return;
      }
    }

    this.authenticatedSessions.add(extractWorkdayDomain(page.url()));

    // Initial standalone resume upload check before entering wizard loop
    await this.uploadResumeIfPresent(page, this.cachedResumePath, true);

    console.log(`✍️ [WorkdayAdapter]: Executing multi-step form completion for ${profile.firstName} ${profile.lastName}...`);
    await updateHUDStatus(page, "Application Form", "Completing Workday application wizard...", "info", 50);

    // Maximum 8 wizard steps (Information, Experience, Questions, Disclosures, Review)
    for (let step = 1; step <= 8; step++) {
      await this.acceptCookiesIfPresent(page);

      // Check if transient Workday error appeared ("Something went wrong")
      const hasTransientError = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        return text.includes("Something went wrong") && text.includes("refresh the page");
      }).catch(() => false);

      if (hasTransientError) {
        console.log("  Workday transient error detected. Reloading page to resume...");
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForTimeout(6000);
      }

      // Close any open dialog or drawer (like cookie settings or help drawer)
      const closeDrawer = page.locator("button[aria-label='Close'], button:has-text('✕')").first();
      if (await closeDrawer.count() > 0 && await closeDrawer.isVisible().catch(() => false)) {
        await closeDrawer.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      // Check if we reached the final Review page or submit button
      const isReviewPage = await page.evaluate(() => {
        const url = window.location.href.toLowerCase();
        if (url.includes("/review")) return true;
        const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
        if (activeStep.toLowerCase().includes("review")) return true;
        const header = document.querySelector("h2[data-automation-id='pageHeader'], h2, h3")?.textContent || "";
        if (header.toLowerCase().includes("review")) return true;
        return false;
      }).catch(() => false);

      const hasSubmitBtn = await page.locator("button[data-automation-id='bottom-navigation-next-button']:has-text('Submit'), button[data-automation-id='submitButton']").count() > 0;

      if (isReviewPage || hasSubmitBtn) {
        console.log("🎯 [WorkdayAdapter]: Reached final Review step! Application completely filled.");
        await updateHUDStatus(page, "Review Step", "Reached final review step. Ready for submission!", "success", 95);
        break;
      }

      console.log(`  Processing Workday Wizard Step ${step}...`);

      // 1. Fill Source ("How Did You Hear About Us?") dropdown if present
      await this.fillSourceDropdown(page);

      // 2. Fill "Have you previously worked for..." question if present
      await this.fillPreviouslyWorkedQuestion(page);

      // 3. Fill standard Personal Info fields if present (with Title Case formatting)
      await this.fillPersonalInfoFields(page, profile);
      await this.formatNamesToTitleCase(page, profile);

      // 4. Fill Address & Contact fields if present
      await this.fillAddressAndContact(page, profile);
      // Strictly enforce 10-digit clean phone number (strip +91 and country code)
      await this.cleanAndFillPhoneNumber(page, profile);

      // 5. Fill Work Experience, Education, Websites, and Skills (Step 2: My Experience)
      await this.fillWorkExperience(page, profile);
      await this.fillEducation(page, profile);
      await this.fillWebsites(page, profile);
      await this.fillSkills(page, profile);

      // 5b. Guarantee Resume Upload whenever file input or drop zone is present on step
      await this.uploadResumeIfPresent(page, this.cachedResumePath, false);

      // 6. Fill Radio Questions & Dropdowns
      await this.fillRadioQuestions(page, profile);
      await this.fillDropdowns(page, profile, additionalAnswers);

      // 6. Fill required checkboxes (declarations, acknowledgments)
      await this.fillCheckboxes(page);

      // 7. Fill Workday Date inputs (From *, To, MM/YYYY)
      await this.fillWorkdayDateInputs(page);

      // 8. Sanitize Gender fields (Strictly enforce Male)
      await this.sanitizeGenderFields(page, profile);

      // 9. Fill any empty required inputs with smart fallback
      await this.fillRequiredInputs(page, profile, additionalAnswers);

      // 10. Auto-remedy any error/alert banner present on step
      await this.remedyWorkdayErrorsAndAlerts(page, profile);

      await page.waitForTimeout(1000);

      // Check if specifically on Experience step and ensure experience & education are filled
      const isExpStep = await page.evaluate(() => {
        const active = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.toLowerCase() || "";
        if (active.includes("experience")) return true;
        const pageHeader = document.querySelector("h2[data-automation-id='pageHeader'], h2, h3")?.textContent?.toLowerCase() || "";
        if (pageHeader.includes("experience")) return true;
        const h4s = Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading']"));
        return h4s.some(h => (h.textContent || "").toLowerCase().includes("work experience") && (h as HTMLElement).offsetParent !== null);
      }).catch(() => false);

      if (isExpStep) {
        const jobTitleFilled = await page.locator("input[data-automation-id='jobTitle'], input[id*='jobTitle'], input[name='jobTitle']").first().inputValue().catch(() => "");
        if (!jobTitleFilled) {
          console.log("  ⚠️ Work Experience was not filled yet. Re-running fillWorkExperience...");
          await this.fillWorkExperience(page, profile);
        }
        const schoolFilled = await page.locator("input[data-automation-id='school'], button[data-automation-id='school'], input[id*='school'], input[name*='schoolName']").first().inputValue().catch(() => "");
        if (!schoolFilled) {
          console.log("  ⚠️ Education was not filled yet. Re-running fillEducation...");
          await this.fillEducation(page, profile);
        }

        // Re-verify resume is attached on Experience step
        const resumeUploaded = await page.evaluate(() => {
          return !!document.querySelector("[data-automation-id='file-upload-item'], [data-automation-id='uploaded-file-name'], button[data-automation-id='delete-file']");
        }).catch(() => false);
        const hasDropZone = (await page.locator("[data-automation-id='file-upload-drop-zone'], input[type='file']").count()) > 0;
        if (hasDropZone && !resumeUploaded) {
          console.log("  ⚠️ Resume not yet attached on Experience step. Retrying upload...");
          await this.uploadResumeIfPresent(page, this.cachedResumePath, false);
        }
      }

      // 9. Click 'Save and Continue' / Next / Continue button
      const nextBtn = page.locator(
        "button[data-automation-id='pageFooterNextButton'], button[data-automation-id='bottom-navigation-next-button'], [data-automation-id='click_filter'][aria-label*='Continue'], [data-automation-id='click_filter'][aria-label*='Next'], button:has-text('Save and Continue'), button:has-text('Continue'), button:has-text('Next'), button[data-automation-id*='continue'], button[data-automation-id*='next']"
      ).last();

      const hasNext = await nextBtn.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);
      if (hasNext) {
        const btnText = (await nextBtn.innerText().catch(() => "")).trim();
        if (btnText.toLowerCase().includes("submit")) {
          console.log("🎯 [WorkdayAdapter]: Submit button encountered on step!");
          break;
        }

        const currentStepText = await page.evaluate(() => document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "");

        console.log(`  Advancing to next step ('${btnText || "Save and Continue"}')...`);
        await this.clickWorkdayButton(page, nextBtn);
        await page.waitForTimeout(3000);

        // Wait for Workday step transition or error banner to appear
        await page.waitForFunction((prevStep) => {
          const cur = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
          const hasError = document.querySelector("[data-automation-id='error-message'], [class*='errorMessage'], [aria-invalid='true']") !== null;
          return (cur && cur !== prevStep) || hasError;
        }, currentStepText, { timeout: 8000 }).catch(() => {});

        // Check if Workday displayed an error/alert banner after clicking Next
        const hadErrors = await this.remedyWorkdayErrorsAndAlerts(page, profile);
        if (hadErrors) {
          console.log("  Re-clicking Next after auto-remedy...");
          const retryNext = page.locator(
            "button[data-automation-id='pageFooterNextButton'], button[data-automation-id='bottom-navigation-next-button'], [data-automation-id='click_filter'][aria-label*='Continue'], [data-automation-id='click_filter'][aria-label*='Next'], button:has-text('Save and Continue'), button:has-text('Continue'), button:has-text('Next'), button[data-automation-id*='continue'], button[data-automation-id*='next']"
          ).last();
          if (await retryNext.count() > 0 && await retryNext.isVisible().catch(() => false)) {
            await this.clickWorkdayButton(page, retryNext);
            await page.waitForTimeout(5000);
          }
        } else {
          await page.waitForTimeout(2000);
        }
      } else {
        const onReview = await page.evaluate(() => {
          return document.body?.innerText?.includes("review your information before submitting") || false;
        }).catch(() => false);
        if (onReview) break;
        console.log("  Waiting for step to mount...");
        await page.waitForTimeout(3000);
      }
    }

    console.log(`✅ [WorkdayAdapter]: Form filling completed.`);
  }

  /**
   * Helper to format names to proper Title Case with at most 1-2 capitals to satisfy Workday capitalization validation rule:
   * "Verify that the field is correctly capitalized because it contains more than 2 capital letters."
   */
  private sanitizeNameCapitals(s: string, fallback: string): string {
    if (!s || !s.trim()) return fallback;
    let trimmed = s.trim();
    const capCount = (trimmed.match(/[A-Z]/g) || []).length;
    if (capCount > 2 || trimmed === trimmed.toUpperCase()) {
      trimmed = trimmed.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
    }
    // If still more than 2 capitals (e.g. multi-word like "First Middle Last"), force strictly 1 capital
    if ((trimmed.match(/[A-Z]/g) || []).length > 2) {
      trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    }
    return trimmed || fallback;
  }

  /**
   * Helper to format names to proper Title Case to avoid Workday capitalization alerts
   */
  private async formatNamesToTitleCase(page: Page, profile: UserProfile): Promise<void> {
    const cleanFirst = this.sanitizeNameCapitals(profile.firstName || "Hrutin", "Hrutin");
    const cleanLast = this.sanitizeNameCapitals(profile.lastName || "Nammi", "Nammi");

    console.log(`👤 [WorkdayAdapter]: Ensuring Given Name is "${cleanFirst}" and Family Name is "${cleanLast}" (<= 2 capitals)...`);

    // 1. Playwright locators for Given Name / First Name
    const firstLocators = page.locator(
      "input[data-automation-id='legalNameSection_firstName'], input[data-automation-id*='firstName'], input[data-automation-id*='givenName'], input[id*='firstName' i], input[id*='givenName' i], input[name*='firstName' i], input[name*='givenName' i]"
    );
    const fCount = await firstLocators.count();
    for (let i = 0; i < fCount; i++) {
      const loc = firstLocators.nth(i);
      if (await loc.isVisible().catch(() => false)) {
        const val = (await loc.inputValue().catch(() => "")).trim();
        const capCount = (val.match(/[A-Z]/g) || []).length;
        if (!val || capCount > 2 || val === val.toUpperCase() || val !== cleanFirst || /\d/.test(val)) {
          await loc.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
          await loc.press("Backspace", { timeout: 1000 }).catch(() => {});
          await loc.fill(cleanFirst, { timeout: 2000 }).catch(() => {});
          await loc.dispatchEvent("input").catch(() => {});
          await loc.dispatchEvent("change").catch(() => {});
          await loc.dispatchEvent("blur").catch(() => {});
        }
      }
    }

    // 2. Playwright locators for Family Name / Last Name
    const lastLocators = page.locator(
      "input[data-automation-id='legalNameSection_lastName'], input[data-automation-id*='lastName'], input[data-automation-id*='familyName'], input[id*='lastName' i], input[id*='familyName' i], input[name*='lastName' i], input[name*='familyName' i]"
    );
    const lCount = await lastLocators.count();
    for (let i = 0; i < lCount; i++) {
      const loc = lastLocators.nth(i);
      if (await loc.isVisible().catch(() => false)) {
        const val = (await loc.inputValue().catch(() => "")).trim();
        const capCount = (val.match(/[A-Z]/g) || []).length;
        if (!val || capCount > 2 || val === val.toUpperCase() || val !== cleanLast || /\d/.test(val)) {
          await loc.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
          await loc.press("Backspace", { timeout: 1000 }).catch(() => {});
          await loc.fill(cleanLast, { timeout: 2000 }).catch(() => {});
          await loc.dispatchEvent("input").catch(() => {});
          await loc.dispatchEvent("change").catch(() => {});
          await loc.dispatchEvent("blur").catch(() => {});
        }
      }
    }

    // 3. Playwright locators for Middle Name & Local Names -> clear any accidental phone digits
    const otherNameLocators = page.locator(
      "input[id*='middleName' i], input[data-automation-id*='middleName'], input[name*='middleName' i], input[id*='local' i], input[data-automation-id*='local' i], input[name*='local' i]"
    );
    const oCount = await otherNameLocators.count();
    for (let i = 0; i < oCount; i++) {
      const loc = otherNameLocators.nth(i);
      if (await loc.isVisible().catch(() => false)) {
        const val = (await loc.inputValue().catch(() => "")).trim();
        if (/\d/.test(val) || val === "8688423267") {
          await loc.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
          await loc.press("Backspace", { timeout: 1000 }).catch(() => {});
          await loc.dispatchEvent("input").catch(() => {});
          await loc.dispatchEvent("change").catch(() => {});
          await loc.dispatchEvent("blur").catch(() => {});
        }
      }
    }

    // 4. DOM evaluation fallback across all inputs
    await page.evaluate(({ fName, lName }) => {
      const sanitize = (s: string) => {
        if (!s) return "";
        let t = s.trim();
        if ((t.match(/[A-Z]/g) || []).length > 2 || t === t.toUpperCase()) {
          t = t.toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
        }
        if ((t.match(/[A-Z]/g) || []).length > 2) {
          t = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
        }
        return t;
      };

      const inputs = Array.from(document.querySelectorAll("input:not([type='hidden'])")) as HTMLInputElement[];
      for (const inp of inputs) {
        const id = (inp.id || "").toLowerCase();
        const autoId = (inp.getAttribute("data-automation-id") || "").toLowerCase();
        const aria = (inp.getAttribute("aria-label") || "").toLowerCase();
        const name = (inp.name || "").toLowerCase();
        const val = (inp.value || "").trim();

        let labelText = "";
        if (inp.id) {
          const lbl = document.querySelector(`label[for='${inp.id}']`);
          if (lbl) labelText = (lbl.textContent || "").toLowerCase();
        }
        if (!labelText) {
          const parent = inp.closest("label, div[data-automation-id*='formField']");
          if (parent) labelText = (parent.textContent || "").toLowerCase();
        }

        const isFirst =
          id.includes("firstname") ||
          autoId.includes("firstname") ||
          aria.includes("first name") ||
          aria.includes("given name") ||
          name.includes("firstname") ||
          name.includes("givenname") ||
          labelText.includes("first name") ||
          labelText.includes("given name") ||
          id.includes("givenname") ||
          autoId.includes("givenname");

        const isLast =
          id.includes("lastname") ||
          autoId.includes("lastname") ||
          aria.includes("last name") ||
          aria.includes("family name") ||
          name.includes("lastname") ||
          name.includes("familyname") ||
          labelText.includes("last name") ||
          labelText.includes("family name") ||
          id.includes("familyname") ||
          autoId.includes("familyname");

        const isMiddleOrLocal =
          id.includes("middle") || autoId.includes("middle") || name.includes("middle") || labelText.includes("middle") ||
          id.includes("local") || autoId.includes("local") || name.includes("local") || labelText.includes("local");

        if (isFirst) {
          const capCount = (val.match(/[A-Z]/g) || []).length;
          const target = (!val || capCount > 2 || val === val.toUpperCase() || /\d/.test(val)) ? fName : sanitize(val);
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(inp, target);
          else inp.value = target;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          inp.dispatchEvent(new Event("blur", { bubbles: true }));
        } else if (isLast) {
          const capCount = (val.match(/[A-Z]/g) || []).length;
          const target = (!val || capCount > 2 || val === val.toUpperCase() || val.toLowerCase().includes("kumar") || /\d/.test(val)) ? lName : sanitize(val);
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(inp, target);
          else inp.value = target;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          inp.dispatchEvent(new Event("blur", { bubbles: true }));
        } else if (isMiddleOrLocal) {
          if (/\d/.test(val) || val === "8688423267") {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (setter) setter.call(inp, "");
            else inp.value = "";
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            inp.dispatchEvent(new Event("blur", { bubbles: true }));
          }
        }
      }
    }, { fName: cleanFirst, lName: cleanLast }).catch(() => {});
  }

  /**
   * Cleans phone inputs across the page: strips +91, country code, and non-digits to ensure strictly valid 10 digits
   */
  private async cleanAndFillPhoneNumber(page: Page, profile: UserProfile): Promise<void> {
    let raw = profile.phone || "8688423267";
    let digits = raw.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("1")) {
      digits = digits.slice(1);
    } else if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    if (!digits || digits.length < 10) digits = "8688423267";

    console.log(`📞 [WorkdayAdapter]: Ensuring phone number input is strictly 10 digits without country code -> "${digits}"...`);

    // 1. Phone Device Type dropdown -> Mobile
    const phoneTypeBtn = page.locator(
      "button[data-automation-id='phone-device-type'], button[id*='phoneType'], button[id*='phone-device-type'], div[data-automation-id*='phone-device-type'] button, div[data-automation-id*='phoneDeviceType'] button"
    ).first();
    if (await phoneTypeBtn.count() > 0 && await phoneTypeBtn.isVisible().catch(() => false)) {
      const cur = (await phoneTypeBtn.innerText().catch(() => "")).trim();
      if (!cur || cur.includes("Select One") || cur.includes("Select")) {
        await this.clickWorkdayButton(page, phoneTypeBtn);
        await page.waitForTimeout(600);
        const mobOpt = page.locator("[role='option']:has-text('Mobile'), li:has-text('Mobile'), div[data-automation-id='promptOption']:has-text('Mobile')").first();
        if (await mobOpt.count() > 0) {
          await mobOpt.click({ force: true, timeout: 2000 }).catch(() => {});
        } else {
          const firstOpt = page.locator("[role='option']:not(:has-text('Select One')), div[data-automation-id='promptOption']").first();
          if (await firstOpt.count() > 0) await firstOpt.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(300);
      }
    }

    // 2. Country Phone Code dropdown -> +91
    const isIndia = profile.location ? profile.location.toLowerCase().includes("india") : true;
    const phoneCodeBtn = page.locator("button[data-automation-id='countryPhoneCode'], button[id*='countryPhoneCode'], div[data-automation-id*='countryPhoneCode'] button").first();
    if (await phoneCodeBtn.count() > 0 && await phoneCodeBtn.isVisible().catch(() => false)) {
      const curCode = (await phoneCodeBtn.innerText().catch(() => "")).trim();
      if (!curCode || curCode.includes("Select One") || curCode.includes("Select")) {
        const targetCode = isIndia ? "+91" : "+1";
        await this.clickWorkdayButton(page, phoneCodeBtn);
        await page.waitForTimeout(500);
        const codeOpt = page.locator(`[role='option']:has-text('${targetCode}'), [role='option']:has-text('${isIndia ? "India" : "United States"}')`).first();
        if (await codeOpt.count() > 0) await codeOpt.click({ force: true, timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }

    // 3. Strictly locate ONLY the genuine phone number input (NEVER matching name, address, city, etc.)
    const phoneLocators = page.locator(
      "input[data-automation-id='phone-number'], input[data-automation-id='phoneNumber'], input[type='tel'], input[id*='phone-number' i]:not([id*='code']):not([id*='device']):not([id*='name']), input[id*='phoneNumber' i]:not([id*='code']):not([id*='device']):not([id*='name'])"
    );
    const pCount = await phoneLocators.count();
    for (let i = 0; i < pCount; i++) {
      const pInp = phoneLocators.nth(i);
      if (await pInp.isVisible().catch(() => false)) {
        const curVal = await pInp.inputValue().catch(() => "");
        if (curVal.includes("+") || curVal.includes(" ") || curVal !== digits) {
          await pInp.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
          await pInp.press("Backspace", { timeout: 1000 }).catch(() => {});
          await pInp.fill(digits, { timeout: 2000 }).catch(() => {});
          await pInp.dispatchEvent("input").catch(() => {});
          await pInp.dispatchEvent("change").catch(() => {});
          await pInp.dispatchEvent("blur").catch(() => {});
        }
      }
    }

    // 4. In DOM, strictly protect non-phone inputs and fill only the real phone input
    await page.evaluate(({ cleanDigits }) => {
      const allInputs = Array.from(document.querySelectorAll("input:not([type='hidden'])")) as HTMLInputElement[];
      for (const inp of allInputs) {
        const id = (inp.id || "").toLowerCase();
        const autoId = (inp.getAttribute("data-automation-id") || "").toLowerCase();
        const aria = (inp.getAttribute("aria-label") || "").toLowerCase();
        const name = (inp.name || "").toLowerCase();
        const type = (inp.type || "").toLowerCase();

        // STRICT GUARD: If it is a name, address, city, zip, email, or device/code field, NEVER fill with phone!
        const isNameOrOther =
          id.includes("name") || autoId.includes("name") || aria.includes("name") || name.includes("name") ||
          id.includes("first") || autoId.includes("first") || name.includes("first") ||
          id.includes("last") || autoId.includes("last") || name.includes("last") ||
          id.includes("middle") || autoId.includes("middle") || name.includes("middle") ||
          id.includes("given") || autoId.includes("given") ||
          id.includes("family") || autoId.includes("family") ||
          id.includes("address") || autoId.includes("address") ||
          id.includes("city") || autoId.includes("city") ||
          id.includes("postal") || id.includes("zip") ||
          id.includes("code") || autoId.includes("code") ||
          id.includes("device") || autoId.includes("device") ||
          id.includes("search") || autoId.includes("search") ||
          type === "checkbox" || type === "radio" || type === "file";

        if (isNameOrOther) continue;

        const isStrictPhone =
          autoId === "phone-number" ||
          autoId === "phonenumber" ||
          id === "phone-number" ||
          id.endsWith("phonenumber") ||
          id.endsWith("phone-number") ||
          type === "tel" ||
          aria === "phone number";

        if (isStrictPhone) {
          inp.focus();
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
          if (setter) setter.call(inp, cleanDigits);
          else inp.value = cleanDigits;
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          inp.dispatchEvent(new Event("blur", { bubbles: true }));
          inp.blur();
        }
      }
    }, { cleanDigits: digits }).catch(() => {});
  }

  /**
   * Handles "How Did You Hear About Us?" and any secondary prompt sub-dropdown
   */
  private async fillSourceDropdown(page: Page): Promise<void> {
    const sourceBtns = page.locator(
      "button[data-automation-id*='source'], button[id*='source'], div[data-automation-id*='formField']:has-text('How Did You Hear About Us') button, div:has(label:has-text('How Did You Hear About Us')) button, div:has-text('How Did You Hear About Us') button:has-text('Select One')"
    );
    const count = await sourceBtns.count();
    for (let i = 0; i < count; i++) {
      const sourceBtn = sourceBtns.nth(i);
      if (!(await sourceBtn.isVisible().catch(() => false))) continue;
      const curText = (await sourceBtn.innerText().catch(() => "")).trim();
      if (!curText || curText.includes("Select One") || curText.includes("Select")) {
        console.log("  Selecting source dropdown ('How Did You Hear About Us?')...");
        await this.clickWorkdayButton(page, sourceBtn);
        await page.waitForTimeout(800);

        let optionChosen = false;

        // Strategy 1: Use Search input inside prompt popup if available
        const searchInput = page.locator(
          "input[data-automation-id='searchBox'], div[data-automation-id='promptPopup'] input, input[placeholder*='Search' i]"
        ).first();

        if (await searchInput.count() > 0 && await searchInput.isVisible().catch(() => false)) {
          console.log("  Searching 'LinkedIn' in source prompt popup...");
          await searchInput.click({ timeout: 2000 }).catch(() => {});
          await searchInput.fill("LinkedIn", { timeout: 2000 }).catch(() => {});
          await searchInput.press("Enter").catch(() => {});
          await page.waitForTimeout(1000);

          const searchResultOpt = page.locator(
            "[role='option']:has-text('LinkedIn'), div[data-automation-id='promptOption']:has-text('LinkedIn'), [role='treeitem']:has-text('LinkedIn'), li:has-text('LinkedIn')"
          ).first();

          if (await searchResultOpt.count() > 0 && await searchResultOpt.isVisible().catch(() => false)) {
            await searchResultOpt.click({ force: true, timeout: 2000 }).catch(() => {});
            optionChosen = true;
            await page.waitForTimeout(600);
          }
        }

        // Strategy 2: Click category (Job Board / Other / Social Media) and then child leaf option
        if (!optionChosen) {
          const categoryOpt = page.locator(
            "[role='option']:has-text('Job Board'), div[data-automation-id='promptOption']:has-text('Job Board'), [role='treeitem']:has-text('Job Board'), div:has-text('Job Board'), [role='option']:has-text('Other'), div[data-automation-id='promptOption']:has-text('Other')"
          ).first();

          if (await categoryOpt.count() > 0 && await categoryOpt.isVisible().catch(() => false)) {
            console.log("  Clicking prompt category ('Job Board' / 'Other')...");
            await categoryOpt.click({ force: true, timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(1000);

            // In child view, click first available leaf option (e.g. LinkedIn, Indeed, Other)
            const childOpt = page.locator(
              "[role='option']:has-text('LinkedIn'), [role='option']:has-text('Indeed'), [role='option']:has-text('Job Board - Other'), [role='option']:has-text('Other'), [role='option']:not(:has-text('Back')), div[data-automation-id='promptOption']:not(:has-text('Back')), li:not(:has-text('Back'))"
            ).first();

            if (await childOpt.count() > 0 && await childOpt.isVisible().catch(() => false)) {
              console.log("  Clicking child source option...");
              await childOpt.click({ force: true, timeout: 2000 }).catch(() => {});
              optionChosen = true;
              await page.waitForTimeout(600);
            }
          }
        }

        // Strategy 3: Click any option visible in prompt list
        if (!optionChosen) {
          const anyOpt = page.locator(
            "[role='option']:not(:has-text('Select One')), div[data-automation-id='promptOption']:not(:has-text('Select One'))"
          ).first();
          if (await anyOpt.count() > 0) {
            await anyOpt.click({ force: true, timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(500);
          }
        }

        // Check if secondary/sub-source prompt dropdown appeared
        const subSourceBtn = page.locator(
          "button[data-automation-id*='sourcePrompt'], button[id*='sourcePrompt'], div[data-automation-id*='formField']:has-text('How Did You Hear About Us') button:has-text('Select One'), div:has(label:has-text('How Did You Hear About Us')) button:has-text('Select One')"
        ).first();
        if (await subSourceBtn.count() > 0 && await subSourceBtn.isVisible().catch(() => false)) {
          console.log("  Selecting sub-source prompt dropdown...");
          await this.clickWorkdayButton(page, subSourceBtn);
          await page.waitForTimeout(600);
          const subOpt = page.locator(
            "[role='option']:has-text('Indeed'), [role='option']:has-text('LinkedIn'), [role='option']:not(:has-text('Select One')), div[data-automation-id='promptOption']"
          ).first();
          if (await subOpt.count() > 0) {
            await subOpt.click({ force: true, timeout: 2000 }).catch(() => {});
          }
          await page.waitForTimeout(400);
        }
      }
    }
  }

  /**
   * Handles "Have you previously worked for [Company]?" or "Have you ever been employed by [Company]?" questions -> strictly "No"
   */
  private async fillPreviouslyWorkedQuestion(page: Page): Promise<void> {
    const prevWorkContainers = page.locator(
      "div:has-text('previously worked'), div:has-text('worked for'), div:has-text('worked at'), div:has-text('former employee'), div:has-text('employed by'), div:has-text('ever been employed'), div:has-text('been employed'), div:has-text('prior employee'), div:has-text('currently employed'), fieldset:has-text('worked'), fieldset:has-text('employed'), div[role='radiogroup']:has-text('worked'), div[role='radiogroup']:has-text('employed'), div[data-automation-id*='formField']:has-text('worked'), div[data-automation-id*='formField']:has-text('employed')"
    );

    const cCount = await prevWorkContainers.count();
    for (let i = 0; i < cCount; i++) {
      const container = prevWorkContainers.nth(i);
      if (!(await container.isVisible().catch(() => false))) continue;

      const text = (await container.innerText().catch(() => "")).toLowerCase();
      // Only target employment/company questions
      const isEmploymentQ =
        text.includes("previously worked") ||
        text.includes("worked for") ||
        text.includes("worked at") ||
        text.includes("former employee") ||
        text.includes("employed by") ||
        text.includes("ever been employed") ||
        text.includes("been employed") ||
        text.includes("prior employee");
      if (!isEmploymentQ) continue;

      // Check if "No" is already selected
      const isNoSelected = await container.evaluate((el) => {
        const checked = el.querySelector("input[type='radio']:checked, [role='radio'][aria-checked='true']");
        if (!checked) return false;
        const lbl = checked.closest("label") || checked.parentElement;
        const t = (lbl?.textContent || checked.getAttribute("value") || "").trim().toLowerCase();
        return t.startsWith("no");
      }).catch(() => false);

      if (isNoSelected) continue;

      const noRadio = container.locator(
        "label:has-text('No'), input[value*='No' i], [role='radio']:has-text('No'), div[data-automation-id*='click_filter']:has-text('No')"
      ).first();

      if (await noRadio.count() > 0) {
        console.log("  Selecting 'No' for previously worked / employed by question (Radio)...");
        await noRadio.click({ force: true }).catch(() => {});
        const nativeRadio = container.locator("input[type='radio']").nth(1);
        if (await nativeRadio.count() > 0) {
          await nativeRadio.check({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(300);
        continue;
      }

      const selectBtn = container.locator("button:has-text('Select One'), button[aria-haspopup='listbox']").first();
      if (await selectBtn.count() > 0 && await selectBtn.isVisible().catch(() => false)) {
        console.log("  Selecting 'No' for previously worked / employed by question (Dropdown)...");
        await this.clickWorkdayButton(page, selectBtn);
        await page.waitForTimeout(500);
        const noOpt = page.locator("[role='option']:has-text('No'), li:has-text('No'), div[data-automation-id='promptOption']:has-text('No')").first();
        if (await noOpt.count() > 0) {
          await noOpt.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(300);
      }
    }
  }

  /**
   * Detects Workday error/alert summary and applies targeted remedies
   */
  private async remedyWorkdayErrorsAndAlerts(page: Page, profile: UserProfile): Promise<boolean> {
    const errorBanner = page.locator(
      "[data-automation-id='error-message'], [data-automation-id='errorMessage'], [class*='errorMessage'], [class*='alert-banner'], div:has-text('Errors and Alerts Found'), div:has-text('Error: The field'), [aria-invalid='true']"
    );

    const hasErrors = (await errorBanner.count() > 0) && (await errorBanner.first().isVisible().catch(() => false));
    if (!hasErrors) return false;

    console.warn("⚠️ [WorkdayAdapter]: Detected Workday errors/alerts! Applying targeted corrections...");

    // 1. Phone number format error -> clean phone and remove +91 prefix
    await this.cleanAndFillPhoneNumber(page, profile);

    // 2. Capitalization alerts -> convert names to Title Case
    await this.formatNamesToTitleCase(page, profile);

    // 3. Source missing error -> re-fill source dropdown
    await this.fillSourceDropdown(page);

    // 4. Previously worked / employed by error -> select 'No'
    await this.fillPreviouslyWorkedQuestion(page);

    // 5. Date inputs (From * / To MM/YYYY)
    await this.fillWorkdayDateInputs(page);

    // 6. Sanitize Gender (Strictly Male)
    await this.sanitizeGenderFields(page, profile);

    // 7. Work Experience, Education, Websites, and Skills
    await this.fillWorkExperience(page, profile);
    await this.fillEducation(page, profile);
    await this.fillWebsites(page, profile);
    await this.fillSkills(page, profile);

    // 8. Radio & Dropdown questions
    await this.fillRadioQuestions(page, profile);
    await this.fillDropdowns(page, profile);

    // 9. Required inputs
    await this.fillRequiredInputs(page, profile);

    // 9. Sanitize location inputs that might have been filled with '2' or left empty
    await this.sanitizeLocationFields(page, profile);

    await page.waitForTimeout(1000);
    return true;
  }

  private async fillPersonalInfoFields(page: Page, profile: UserProfile): Promise<void> {
    const cleanFirst = this.sanitizeNameCapitals(profile.firstName || "Hrutin", "Hrutin");
    const cleanLast = this.sanitizeNameCapitals(profile.lastName || "Nammi", "Nammi");

    // First Name / Given Name
    const firstNameLocators = [
      "input[data-automation-id='legalNameSection_firstName']",
      "input[data-automation-id*='firstName']",
      "input[data-automation-id*='givenName']",
      "input[id*='firstName' i]",
      "input[id*='givenName' i]",
      "input[name*='firstName' i]",
      "input[name*='givenName' i]"
    ];
    for (const sel of firstNameLocators) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        const val = (await loc.inputValue().catch(() => "")).trim();
        const capCount = (val.match(/[A-Z]/g) || []).length;
        if (!val || capCount > 2 || val === val.toUpperCase() || val !== cleanFirst) {
          await loc.click({ clickCount: 3 }).catch(() => {});
          await loc.press("Backspace").catch(() => {});
          await loc.fill(cleanFirst).catch(() => {});
          await this.setReactInputValue(page, sel, cleanFirst);
        }
        break;
      }
    }

    // Last Name / Family Name
    const lastNameLocators = [
      "input[data-automation-id='legalNameSection_lastName']",
      "input[data-automation-id*='lastName']",
      "input[data-automation-id*='familyName']",
      "input[id*='lastName' i]",
      "input[id*='familyName' i]",
      "input[name*='lastName' i]",
      "input[name*='familyName' i]"
    ];
    for (const sel of lastNameLocators) {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
        const val = (await loc.inputValue().catch(() => "")).trim();
        const capCount = (val.match(/[A-Z]/g) || []).length;
        if (!val || capCount > 2 || val === val.toUpperCase() || val !== cleanLast) {
          await loc.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
          await loc.press("Backspace", { timeout: 1000 }).catch(() => {});
          await loc.fill(cleanLast, { timeout: 2000 }).catch(() => {});
          await this.setReactInputValue(page, sel, cleanLast);
        }
        break;
      }
    }

    // Middle Name / Local Names: clear any accidental phone digits
    const otherNameLocators = page.locator(
      "input[id*='middleName' i], input[data-automation-id*='middleName'], input[name*='middleName' i], input[id*='local' i], input[data-automation-id*='local' i], input[name*='local' i]"
    );
    const oCount = await otherNameLocators.count();
    for (let i = 0; i < oCount; i++) {
      const loc = otherNameLocators.nth(i);
      if (await loc.isVisible().catch(() => false)) {
        const val = (await loc.inputValue().catch(() => "")).trim();
        if (/\d/.test(val) || val === "8688423267") {
          await loc.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
          await loc.press("Backspace", { timeout: 1000 }).catch(() => {});
          await loc.dispatchEvent("input").catch(() => {});
          await loc.dispatchEvent("change").catch(() => {});
          await loc.dispatchEvent("blur").catch(() => {});
        }
      }
    }

    // Preferred Name (if present and empty)
    const prefNameLoc = page.locator("input[data-automation-id*='preferredName'], input[id*='preferredName']").first();
    if (await prefNameLoc.count() > 0 && await prefNameLoc.isVisible().catch(() => false)) {
      const val = await prefNameLoc.inputValue().catch(() => "");
      if (!val.trim()) {
        await prefNameLoc.fill(profile.firstName).catch(() => {});
      }
    }

    // Check "Use legal name as preferred name" if present
    const useLegalCheck = page.locator("input[type='checkbox'][data-automation-id*='useLegalName'], input[type='checkbox'][id*='useLegalName']").first();
    if (await useLegalCheck.count() > 0 && await useLegalCheck.isVisible().catch(() => false)) {
      if (!(await useLegalCheck.isChecked().catch(() => false))) {
        await useLegalCheck.check({ force: true }).catch(() => {});
      }
    }
  }

  private async fillAddressAndContact(page: Page, profile: UserProfile): Promise<void> {
    const isIndia = profile.location ? profile.location.toLowerCase().includes("india") : false;
    const targetCountry = isIndia ? "India" : "United States of America";
    const targetState = isIndia ? "Gujarat" : "California";
    const targetCity = profile.location ? (isIndia ? profile.location.split(",")[0].trim() : "San Francisco") : "San Francisco";
    const targetPostal = isIndia ? "390001" : "94105";

    // 1. Country Dropdown
    const countryBtn = page.locator("button[data-automation-id='countryDropdown'], button[id*='country--country'], button[id*='country']").first();
    if (await countryBtn.count() > 0 && await countryBtn.isVisible().catch(() => false)) {
      const curText = (await countryBtn.innerText().catch(() => "")).trim();
      if (!curText || curText.includes("Select One") || curText.includes("Select")) {
        console.log(`  Selecting country dropdown -> ${targetCountry}...`);
        await this.clickWorkdayButton(page, countryBtn);
        await page.waitForTimeout(600);
        const opt = page.locator(`[role='option']:has-text('${targetCountry}'), li:has-text('${targetCountry}'), div[data-automation-id='promptOption']:has-text('${targetCountry}')`).first();
        if (await opt.count() > 0) {
          await opt.click({ force: true }).catch(() => {});
        } else {
          const firstOpt = page.locator("[role='option']:not(:has-text('Select One')), li[role='option']:not(:has-text('Select One'))").first();
          if (await firstOpt.count() > 0) await firstOpt.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(400);
      }
    }

    // 2. Address Line 1
    const addr1Loc = page.locator("input[id*='addressLine1'], input[data-automation-id*='addressLine1']").first();
    if (await addr1Loc.count() > 0 && await addr1Loc.isVisible().catch(() => false)) {
      const val = await addr1Loc.inputValue().catch(() => "");
      if (!val.trim()) {
        await this.setReactInputValue(page, "input[id*='addressLine1'], input[data-automation-id*='addressLine1']", "101 High Street");
      }
    }

    // 2b. Address Line 2 (ensure it is never filled with '2')
    const addr2Loc = page.locator("input[id*='addressLine2'], input[data-automation-id*='addressLine2']").first();
    if (await addr2Loc.count() > 0 && await addr2Loc.isVisible().catch(() => false)) {
      const val = (await addr2Loc.inputValue().catch(() => "")).trim();
      if (val === "2") {
        await addr2Loc.fill("").catch(() => {});
      }
    }

    // 2c. Generic Location input if present on step (ensure it's filled with real candidate location, never '2')
    const locInp = page.locator("input[id*='location' i]:not([id*='search']):not([id*='code']):not([type='file']), input[data-automation-id*='location' i]:not([data-automation-id*='search']):not([type='file'])").first();
    if (await locInp.count() > 0 && await locInp.isVisible().catch(() => false)) {
      const val = (await locInp.inputValue().catch(() => "")).trim();
      if (!val || val === "2" || val === "N/A" || /^\d+$/.test(val)) {
        await this.setReactInputValue(page, "input[id*='location' i]:not([id*='search']):not([id*='code']):not([type='file']), input[data-automation-id*='location' i]:not([data-automation-id*='search']):not([type='file'])", profile.location || "San Francisco, CA, United States");
      }
    }

    // 3. City
    const cityLoc = page.locator("input[id*='city'], input[data-automation-id*='city']").first();
    if (await cityLoc.count() > 0 && await cityLoc.isVisible().catch(() => false)) {
      const val = await cityLoc.inputValue().catch(() => "");
      if (!val.trim()) {
        await this.setReactInputValue(page, "input[id*='city'], input[data-automation-id*='city']", targetCity);
      }
    }

    // 4. State / Province Dropdown or Text Input
    const stateBtn = page.locator("button[data-automation-id='stateProvinceDropdown'], button[id*='stateProvince'], button[id*='state--state'], button[id*='state'], button[id*='province']").first();
    if (await stateBtn.count() > 0 && await stateBtn.isVisible().catch(() => false)) {
      const curText = (await stateBtn.innerText().catch(() => "")).trim();
      if (!curText || curText.includes("Select One") || curText.includes("Select")) {
        console.log(`  Selecting state dropdown -> ${targetState}...`);
        await this.clickWorkdayButton(page, stateBtn);
        await page.waitForTimeout(600);
        const opt = page.locator(`[role='option']:has-text('${targetState}'), li:has-text('${targetState}'), div[data-automation-id='promptOption']:has-text('${targetState}')`).first();
        if (await opt.count() > 0) {
          await opt.click({ force: true }).catch(() => {});
        } else {
          const firstOpt = page.locator("[role='option']:not(:has-text('Select One')), li[role='option']:not(:has-text('Select One'))").first();
          if (await firstOpt.count() > 0) await firstOpt.click({ force: true }).catch(() => {});
        }
        await page.waitForTimeout(400);
      }
    } else {
      const stateInput = page.locator("input[id*='stateProvince'], input[id*='state'], input[data-automation-id*='state']").first();
      if (await stateInput.count() > 0 && await stateInput.isVisible().catch(() => false)) {
        const val = await stateInput.inputValue().catch(() => "");
        if (!val.trim()) {
          await this.setReactInputValue(page, "input[id*='stateProvince'], input[id*='state'], input[data-automation-id*='state']", targetState);
        }
      }
    }

    // 5. Postal Code
    const zipLoc = page.locator("input[id*='postalCode'], input[data-automation-id*='postalCode']").first();
    if (await zipLoc.count() > 0 && await zipLoc.isVisible().catch(() => false)) {
      const val = await zipLoc.inputValue().catch(() => "");
      if (!val.trim()) {
        await this.setReactInputValue(page, "input[id*='postalCode'], input[data-automation-id*='postalCode']", targetPostal);
      }
    }

    // 6. Phone & Country Code handling (without +91 in phone number field)
    await this.cleanAndFillPhoneNumber(page, profile);

    // 7. Sanitize any location inputs on the screen
    await this.sanitizeLocationFields(page, profile);
  }

  /**
   * Helper to ensure location/city fields across the DOM are never filled with '2' or experience digits
   */
  private async sanitizeLocationFields(page: Page, profile: UserProfile): Promise<void> {
    const locValue = profile.location || "San Francisco, CA, United States";
    const cityValue = profile.location ? (profile.location.toLowerCase().includes("india") ? profile.location.split(",")[0].trim() : "San Francisco") : "San Francisco";

    await page.evaluate(({ fullLoc, city }) => {
      const inputs = Array.from(document.querySelectorAll("input:not([type='hidden']), textarea")) as (HTMLInputElement | HTMLTextAreaElement)[];
      for (const inp of inputs) {
        const id = (inp.id || "").toLowerCase();
        const autoId = (inp.getAttribute("data-automation-id") || "").toLowerCase();
        const aria = (inp.getAttribute("aria-label") || "").toLowerCase();
        const name = (inp.name || "").toLowerCase();
        const placeholder = (inp.placeholder || "").toLowerCase();

        const isLocationField =
          (id.includes("location") || autoId.includes("location") || aria.includes("location") || name.includes("location") || placeholder.includes("location")) &&
          !id.includes("search") && !autoId.includes("search") && !aria.includes("search");

        const isCityField =
          (id.includes("city") || autoId.includes("city") || aria.includes("city") || name.includes("city")) &&
          !id.includes("ethnicity") && !aria.includes("ethnicity");

        if (isLocationField) {
          const val = (inp.value || "").trim();
          if (val === "2" || val === "" || val === "N/A" || /^\d+$/.test(val)) {
            const target = autoId.includes("city") || aria.includes("city") ? city : fullLoc;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
                           Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            if (setter) setter.call(inp, target);
            else inp.value = target;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            inp.dispatchEvent(new Event("blur", { bubbles: true }));
          }
        } else if (isCityField) {
          const val = (inp.value || "").trim();
          if (val === "2" || val === "" || val === "N/A" || /^\d+$/.test(val)) {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            if (setter) setter.call(inp, city);
            else inp.value = city;
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            inp.dispatchEvent(new Event("blur", { bubbles: true }));
          }
        }
      }
    }, { fullLoc: locValue, city: cityValue }).catch(() => {});
  }

  /**
   * Helper to fill a single locator input triggering React synthetic events and native prototype setter
   */
  private async fillSingleInput(page: Page, locator: Locator, value: string): Promise<void> {
    try {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({ clickCount: 3, timeout: 2000 }).catch(() => {});
      await locator.press("Backspace", { timeout: 1000 }).catch(() => {});
      await locator.fill(value, { timeout: 2000 }).catch(() => {});
      await locator.evaluate((el: any, v: string) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
                       Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        if (setter) setter.call(el, v);
        else el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, value).catch(() => {});
      await locator.blur().catch(() => {});
      await page.waitForTimeout(200);
    } catch {}
  }

  /**
   * Helper to click the 'Add' button belonging to a specific section heading (e.g. Work Experience, Education, Websites)
   */
  private async clickWorkdaySectionAdd(page: Page, sectionHeading: string): Promise<boolean> {
    const clickedInDom = await page.evaluate((headingText) => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, [role='heading']"));
      const h = headings.find(el => el.textContent?.trim().toLowerCase().includes(headingText.toLowerCase()));
      if (!h) return false;

      // Look in next siblings
      let next = h.nextElementSibling;
      while (next) {
        const btn = next.querySelector("button") || (next.tagName === "BUTTON" ? next : null);
        if (btn && (btn.textContent?.trim().includes("Add") || btn.getAttribute("data-automation-id") === "add-button" || btn.getAttribute("data-automation-id") === "Add")) {
          (btn as HTMLButtonElement).click();
          return true;
        }
        next = next.nextElementSibling;
      }

      // Look in parent container
      const parent = h.closest("section, fieldset, div");
      if (parent) {
        const btn = parent.querySelector("button[data-automation-id='add-button'], button[data-automation-id='Add'], button[data-automation-id*='add'], button");
        if (btn && (btn.textContent?.trim().includes("Add") || btn.getAttribute("data-automation-id") === "add-button")) {
          (btn as HTMLButtonElement).click();
          return true;
        }
      }
      return false;
    }, sectionHeading).catch(() => false);

    if (clickedInDom) return true;

    // Playwright fallback
    const slug = sectionHeading.toLowerCase().replace(/\s+/g, "-");
    const loc = page.locator(
      `button[data-automation-id='add-${slug}'], button[data-automation-id='${slug}-add'], button[data-automation-id='add-button']`
    ).first();
    if (await loc.count() > 0 && await loc.isVisible().catch(() => false)) {
      await this.clickWorkdayButton(page, loc);
      return true;
    }
    return false;
  }

  /**
   * Fills Work Experience cards on the 'My Experience' step
   */
  private async fillWorkExperience(page: Page, profile: UserProfile): Promise<void> {
    const hasWorkExpHeading = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, [role='heading']"));
      return headings.some(h => (h.textContent || "").toLowerCase().includes("work experience"));
    }).catch(() => false);

    const hasJobTitleInput = (await page.locator("input[data-automation-id='jobTitle'], input[id*='jobTitle'], input[name='jobTitle']").count()) > 0;

    if (!hasWorkExpHeading && !hasJobTitleInput) return;

    console.log("💼 [WorkdayAdapter]: Filling Work Experience section...");
    const experiences: WorkExperienceItem[] =
      profile.experiences && profile.experiences.length > 0
        ? profile.experiences
        : DEFAULT_HRUTIN_EXPERIENCES;

    let jobTitleInputs = page.locator("input[data-automation-id='jobTitle'], input[id*='jobTitle'], input[name='jobTitle']");
    let count = await jobTitleInputs.count();

    // If 0 cards exist, click "Add" or "Add Work Experience"
    if (count === 0) {
      console.log("  Clicking 'Add' button for Work Experience...");
      await this.clickWorkdaySectionAdd(page, "Work Experience");
      await page.waitForTimeout(1500);
      jobTitleInputs = page.locator("input[data-automation-id='jobTitle'], input[id*='jobTitle'], input[name='jobTitle']");
      count = await jobTitleInputs.count();
    }

    // Fill each experience card
    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];

      // If we need another card and it doesn't exist yet, click Add Another
      if (i >= count) {
        const addAnotherBtn = page.locator(
          "button:has-text('Add Another'), button[data-automation-id='Add Another'], button[data-automation-id='add-work-experience']"
        ).first();
        if (await addAnotherBtn.count() > 0 && await addAnotherBtn.isVisible().catch(() => false)) {
          console.log(`  Adding card for Work Experience ${i + 1}...`);
          await this.clickWorkdayButton(page, addAnotherBtn);
          await page.waitForTimeout(1500);
        }
      }

      console.log(`  Filling Work Experience ${i + 1}: ${exp.jobTitle} at ${exp.company}...`);

      // 1. Job Title
      const titleInp = page.locator("input[data-automation-id='jobTitle'], input[id*='jobTitle'], input[name='jobTitle']").nth(i);
      if (await titleInp.count() > 0 && await titleInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, titleInp, exp.jobTitle);
      }

      // 2. Company
      const companyInp = page.locator("input[data-automation-id='company'], input[id*='companyName'], input[name='companyName'], input[id*='company'], input[name='company']").nth(i);
      if (await companyInp.count() > 0 && await companyInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, companyInp, exp.company);
      }

      // 3. Location
      const locInp = page.locator("input[id*='workExperience'][id*='location'], input[data-automation-id='location'], input[id*='location']:not([id*='search']), input[name='location']").nth(i);
      if (await locInp.count() > 0 && await locInp.isVisible().catch(() => false)) {
        const curVal = await locInp.inputValue().catch(() => "");
        if (!curVal.trim() || curVal === "2") {
          await this.fillSingleInput(page, locInp, exp.location || profile.location || "San Francisco, CA, United States");
        }
      }

      // 4. Currently Work Here Checkbox
      if (exp.currentlyWorkHere) {
        const currCb = page.locator("input[type='checkbox'][data-automation-id*='currentlyWorkHere'], input[type='checkbox'][id*='currentlyWorkHere'], input[type='checkbox'][name='currentlyWorkHere']").nth(i);
        if (await currCb.count() > 0 && await currCb.isVisible().catch(() => false)) {
          if (!(await currCb.isChecked().catch(() => false))) {
            await currCb.check({ force: true }).catch(() => {});
            await page.waitForTimeout(200);
          }
        }
      }

      // 5. Start Date (From) Month & Year or single input
      const startMonthInp = page.locator("input[id*='startDate-dateSectionMonth-input'], input[id*='dateSectionMonth-input'], input[data-automation-id='dateSectionMonth-input']").nth(i);
      if (await startMonthInp.count() > 0 && await startMonthInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, startMonthInp, exp.startMonth || "01");
      }
      const startYearInp = page.locator("input[id*='startDate-dateSectionYear-input'], input[id*='dateSectionYear-input'], input[data-automation-id='dateSectionYear-input']").nth(i);
      if (await startYearInp.count() > 0 && await startYearInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, startYearInp, exp.startYear || "2024");
      }
      const startSingleInp = page.locator("input[data-automation-id='startDate'], input[id*='startDate']:not([id*='dateSection']), input[data-automation-id*='from'], input[id*='from']").nth(i);
      if (await startSingleInp.count() > 0 && await startSingleInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, startSingleInp, exp.startDate || "01/2024");
      }

      // 6. End Date (To) Month & Year or single input
      const endMonthInp = page.locator("input[id*='endDate-dateSectionMonth-input']").nth(i);
      if (await endMonthInp.count() > 0 && await endMonthInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, endMonthInp, exp.endMonth || "01");
      }
      const endYearInp = page.locator("input[id*='endDate-dateSectionYear-input']").nth(i);
      if (await endYearInp.count() > 0 && await endYearInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, endYearInp, exp.endYear || "2026");
      }
      const endSingleInp = page.locator("input[data-automation-id='endDate'], input[id*='endDate']:not([id*='dateSection']), input[data-automation-id*='to'], input[id*='to']").nth(i);
      if (await endSingleInp.count() > 0 && await endSingleInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, endSingleInp, exp.endDate || "01/2026");
      }

      // 7. Role Description
      if (exp.description) {
        const descInp = page.locator("textarea[data-automation-id='description'], textarea[id*='roleDescription'], textarea[name='roleDescription'], textarea[id*='description']").nth(i);
        if (await descInp.count() > 0 && await descInp.isVisible().catch(() => false)) {
          await this.fillSingleInput(page, descInp, exp.description);
        }
      }
    }
  }

  /**
   * Fills Education cards on the 'My Experience' step
   */
  private async fillEducation(page: Page, profile: UserProfile): Promise<void> {
    const hasEduHeading = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, [role='heading']"));
      return headings.some(h => (h.textContent || "").toLowerCase().includes("education"));
    }).catch(() => false);

    const hasSchoolInput = (await page.locator("input[data-automation-id='school'], button[data-automation-id='school'], input[id*='school'], input[name*='schoolName']").count()) > 0;

    if (!hasEduHeading && !hasSchoolInput) return;

    console.log("🎓 [WorkdayAdapter]: Filling Education section...");
    const educations: EducationItem[] =
      profile.educations && profile.educations.length > 0
        ? profile.educations
        : DEFAULT_HRUTIN_EDUCATIONS;

    let schoolInputs = page.locator("input[data-automation-id='school'], button[data-automation-id='school'], input[id*='school'], input[name*='schoolName']");
    let count = await schoolInputs.count();

    // If 0 cards exist, click "Add" or "Add Education"
    if (count === 0) {
      console.log("  Clicking 'Add' button for Education...");
      await this.clickWorkdaySectionAdd(page, "Education");
      await page.waitForTimeout(1500);
      schoolInputs = page.locator("input[data-automation-id='school'], button[data-automation-id='school'], input[id*='school'], input[name*='schoolName']");
      count = await schoolInputs.count();
    }

    for (let i = 0; i < educations.length; i++) {
      const edu = educations[i];

      if (i >= count) {
        const addAnotherBtn = page.locator(
          "button:has-text('Add Another'), button[data-automation-id='Add Another'], button[data-automation-id='add-education']"
        ).last();
        if (await addAnotherBtn.count() > 0 && await addAnotherBtn.isVisible().catch(() => false)) {
          console.log(`  Adding card for Education ${i + 1}...`);
          await this.clickWorkdayButton(page, addAnotherBtn);
          await page.waitForTimeout(1500);
        }
      }

      console.log(`  Filling Education ${i + 1}: ${edu.school} (${edu.degree})...`);

      // 1. School / Institution
      const schoolTarget = page.locator("input[data-automation-id='school'], button[data-automation-id='school'], input[id*='schoolName'], input[name='schoolName'], input[id*='school'], button[id*='school']").nth(i);
      if (await schoolTarget.count() > 0 && await schoolTarget.isVisible().catch(() => false)) {
        const tagName = await schoolTarget.evaluate(el => el.tagName.toLowerCase()).catch(() => "input");
        if (tagName === "button") {
          await this.clickWorkdayButton(page, schoolTarget);
          await page.waitForTimeout(600);
          const searchInp = page.locator("input[data-automation-id='searchBox'], div[data-automation-id='promptPopup'] input, input[placeholder*='Search']").first();
          if (await searchInp.count() > 0) {
            await searchInp.fill(edu.school);
            await searchInp.press("Enter");
            await page.waitForTimeout(800);
          }
          const opt = page.locator(`[role='option']:has-text('${edu.school}'), div[data-automation-id='promptOption'], [role='option']`).first();
          if (await opt.count() > 0) await opt.click({ force: true }).catch(() => {});
        } else {
          await this.fillSingleInput(page, schoolTarget, edu.school);
        }
      }

      // 2. Degree
      const degreeTarget = page.locator("button[data-automation-id='degree'], input[data-automation-id='degree'], button[id*='degree'], input[id*='degree']").nth(i);
      if (await degreeTarget.count() > 0 && await degreeTarget.isVisible().catch(() => false)) {
        const tagName = await degreeTarget.evaluate(el => el.tagName.toLowerCase()).catch(() => "input");
        if (tagName === "button") {
          await this.clickWorkdayButton(page, degreeTarget);
          await page.waitForTimeout(600);
          const searchInp = page.locator("input[data-automation-id='searchBox'], div[data-automation-id='promptPopup'] input, input[placeholder*='Search']").first();
          if (await searchInp.count() > 0) {
            await searchInp.fill("Bachelor");
            await searchInp.press("Enter");
            await page.waitForTimeout(800);
          }
          const opt = page.locator("[role='option']:has-text('Bachelor'), div[data-automation-id='promptOption']:has-text('Bachelor'), [role='option']:not(:has-text('Select One'))").first();
          if (await opt.count() > 0) await opt.click({ force: true }).catch(() => {});
        } else {
          await this.fillSingleInput(page, degreeTarget, edu.degree || "Bachelor of Technology");
        }
      }

      // 3. Field of Study
      const fieldTarget = page.locator("button[data-automation-id='field-of-study'], input[data-automation-id='field-of-study'], button[data-automation-id*='fieldOfStudy'], input[data-automation-id*='fieldOfStudy'], button[id*='fieldOfStudy'], input[id*='fieldOfStudy']").nth(i);
      if (await fieldTarget.count() > 0 && await fieldTarget.isVisible().catch(() => false)) {
        const tagName = await fieldTarget.evaluate(el => el.tagName.toLowerCase()).catch(() => "input");
        if (tagName === "button") {
          await this.clickWorkdayButton(page, fieldTarget);
          await page.waitForTimeout(600);
          const searchInp = page.locator("input[data-automation-id='searchBox'], div[data-automation-id='promptPopup'] input, input[placeholder*='Search']").first();
          if (await searchInp.count() > 0) {
            await searchInp.fill("Computer Science");
            await searchInp.press("Enter");
            await page.waitForTimeout(800);
          }
          const opt = page.locator("[role='option']:has-text('Computer Science'), div[data-automation-id='promptOption']:has-text('Computer Science'), [role='option']:not(:has-text('Select One'))").first();
          if (await opt.count() > 0) await opt.click({ force: true }).catch(() => {});
        } else {
          await this.fillSingleInput(page, fieldTarget, edu.fieldOfStudy || "Computer Science and Engineering");
          await fieldTarget.press("Enter").catch(() => {});
          await page.waitForTimeout(500);
          const opt = page.locator("[role='option']:has-text('Computer Science'), div[data-automation-id='promptOption']:has-text('Computer Science')").first();
          if (await opt.count() > 0 && await opt.isVisible().catch(() => false)) {
            await opt.click({ force: true }).catch(() => {});
          }
        }
      }

      // 4. GPA
      const gpaInp = page.locator("input[data-automation-id='gpa'], input[id*='gradeAverage'], input[name='gradeAverage'], input[id*='gpa']").nth(i);
      if (await gpaInp.count() > 0 && await gpaInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, gpaInp, edu.gpa || "7.1");
      }

      // 5. First Year / Last Year Attended
      const firstYearInp = page.locator("input[data-automation-id='firstYearAttended'], input[id*='firstYearAttended'], input[data-automation-id*='firstYear']").nth(i);
      if (await firstYearInp.count() > 0 && await firstYearInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, firstYearInp, edu.startYear || "2023");
      }
      const lastYearInp = page.locator("input[data-automation-id='lastYearAttended'], input[id*='lastYearAttended'], input[data-automation-id*='lastYear']").nth(i);
      if (await lastYearInp.count() > 0 && await lastYearInp.isVisible().catch(() => false)) {
        await this.fillSingleInput(page, lastYearInp, edu.endYear || "2027");
      }
    }
  }

  /**
   * Fills Website / Portfolio URLs and LinkedIn on the 'My Experience' step
   */
  private async fillWebsites(page: Page, profile: UserProfile): Promise<void> {
    const hasWebHeading = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, [role='heading']"));
      return headings.some(h => (h.textContent || "").toLowerCase().includes("website"));
    }).catch(() => false);

    const hasWebInput = (await page.locator("input[data-automation-id='website'], input[data-automation-id='url'], input[id*='webAddress'], input[name='url']").count()) > 0;

    if (hasWebHeading || hasWebInput) {
      console.log("🌐 [WorkdayAdapter]: Filling Websites / Portfolio section...");
      const sites: string[] =
        profile.websites && profile.websites.length > 0
          ? profile.websites
          : DEFAULT_HRUTIN_WEBSITES;

      let webInputs = page.locator("input[data-automation-id='website'], input[data-automation-id='url'], input[id*='webAddress'], input[name='url']");
      let count = await webInputs.count();

      if (count === 0) {
        await this.clickWorkdaySectionAdd(page, "Websites");
        await page.waitForTimeout(1000);
        webInputs = page.locator("input[data-automation-id='website'], input[data-automation-id='url'], input[id*='webAddress'], input[name='url']");
        count = await webInputs.count();
      }

      for (let i = 0; i < sites.length; i++) {
        if (i >= count) {
          const addAnotherBtn = page.locator(
            "button:has-text('Add Another'), button[data-automation-id='Add Another'], button[data-automation-id='add-website']"
          ).last();
          if (await addAnotherBtn.count() > 0 && await addAnotherBtn.isVisible().catch(() => false)) {
            await this.clickWorkdayButton(page, addAnotherBtn);
            await page.waitForTimeout(1000);
          }
        }

        const inp = page.locator("input[data-automation-id='website'], input[data-automation-id='url'], input[id*='webAddress'], input[name='url']").nth(i);
        if (await inp.count() > 0 && await inp.isVisible().catch(() => false)) {
          await this.fillSingleInput(page, inp, sites[i]);
        }
      }
    }

    // Social Network URLs (Strictly ensure LinkedIn URL format with https://www.linkedin.com/...)
    let formattedLinkedIn = profile.linkedinUrl || "https://www.linkedin.com/in/hrutinnammi";
    if (formattedLinkedIn.startsWith("https://linkedin.com")) {
      formattedLinkedIn = formattedLinkedIn.replace("https://linkedin.com", "https://www.linkedin.com");
    } else if (!formattedLinkedIn.startsWith("http")) {
      formattedLinkedIn = `https://www.linkedin.com/in/${formattedLinkedIn.replace(/^\/+/, "")}`;
    }

    const linkedinInp = page.locator(
      "input[id*='socialNetworkAccounts--linkedInAccount'], input[name='linkedInAccount'], input[data-automation-id*='linkedInAccount'], input[id*='linkedIn' i]"
    ).first();
    if (await linkedinInp.count() > 0 && await linkedinInp.isVisible().catch(() => false)) {
      await this.fillSingleInput(page, linkedinInp, formattedLinkedIn);
    }
  }

  /**
   * Fills Skills tags on the 'My Experience' step
   */
  private async fillSkills(page: Page, profile: UserProfile): Promise<void> {
    const skillsInput = page.locator(
      "input[id*='skills--skills'], input[data-automation-id='skills-search-input'], input[data-automation-id*='skill'], input[id*='skills-search-input'], input[placeholder*='Search Skills' i]"
    ).first();

    if ((await skillsInput.count() === 0) || !(await skillsInput.isVisible().catch(() => false))) {
      return;
    }

    console.log("🛠️ [WorkdayAdapter]: Filling Skills section...");
    const skillsList: string[] =
      profile.skills && profile.skills.length > 0
        ? profile.skills
        : DEFAULT_HRUTIN_SKILLS;

    for (const skill of skillsList.slice(0, 6)) {
      try {
        await skillsInput.click({ timeout: 1500 }).catch(() => {});
        await skillsInput.fill(skill).catch(() => {});
        await page.waitForTimeout(500);
        await skillsInput.press("Enter").catch(() => {});
        await page.waitForTimeout(400);

        const opt = page.locator(`[role='option']:has-text('${skill}'), div[data-automation-id='promptOption']:has-text('${skill}')`).first();
        if (await opt.count() > 0 && await opt.isVisible().catch(() => false)) {
          await opt.click({ force: true }).catch(() => {});
          await page.waitForTimeout(300);
        }
      } catch {}
    }
  }

  /**
   * Dedicated handler for Workday MM/YYYY date fields (From *, To, Start Date, End Date)
   */
  private async fillWorkdayDateInputs(page: Page): Promise<void> {
    const dateLocators = [
      "input[placeholder*='YYYY' i]",
      "input[placeholder*='MM' i]",
      "input[data-automation-id*='date' i]",
      "input[id*='startDate' i]",
      "input[id*='endDate' i]",
      "input[id*='fromDate' i]",
      "input[id*='toDate' i]",
      "input[id*='date' i]",
      "input[aria-label*='From' i]",
      "input[aria-label*='To' i]",
      "input[aria-label*='Start Date' i]",
      "input[aria-label*='End Date' i]"
    ];

    const dateInputs = page.locator(dateLocators.join(", "));
    const count = await dateInputs.count();

    for (let i = 0; i < count; i++) {
      const inp = dateInputs.nth(i);
      if (!(await inp.isVisible().catch(() => false))) continue;

      const currentVal = (await inp.inputValue().catch(() => "")).trim();
      // If already has a valid MM/YYYY date, skip
      if (currentVal && /^\d{2}\/\d{4}$/.test(currentVal)) continue;

      // Determine if this is a "From/Start" or "To/End" field
      const meta = await inp.evaluate((el) => {
        const p = (el.getAttribute("placeholder") || "").toLowerCase();
        const a = (el.getAttribute("aria-label") || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const name = (el.getAttribute("name") || "").toLowerCase();
        const parent = el.closest("div[data-automation-id*='formField'], [data-automation-id*='dateInputWrapper'], fieldset, div")?.textContent || "";
        return `${p} ${a} ${id} ${name} ${parent}`.toLowerCase();
      }).catch(() => "");

      let targetDate = "01/2024"; // Default start/from date
      if (meta.includes("to") || meta.includes("end date") || meta.includes("last year") || meta.includes("graduation")) {
        targetDate = "01/2026";
      }

      console.log(`  Filling Workday Date input -> "${targetDate}"`);
      await inp.focus().catch(() => {});
      await inp.click({ force: true }).catch(() => {});
      await inp.press("Control+A").catch(() => {});
      await inp.press("Backspace").catch(() => {});
      await inp.pressSequentially(targetDate, { delay: 40 }).catch(() => {});

      // Dispatch native input & change events
      await inp.evaluate((el: HTMLInputElement, d: string) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(el, d);
        else el.value = d;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }, targetDate).catch(() => {});

      await inp.blur().catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  /**
   * Helper to ensure Gender is strictly filled as 'Male' and never 'Female'
   */
  private async sanitizeGenderFields(page: Page, profile: UserProfile): Promise<void> {
    const desired = (profile.gender || "Male").toLowerCase();
    if (desired !== "male" && desired !== "man") return;

    // 1. Radio groups for gender
    const genderFieldsets = page.locator(
      "fieldset:has-text('Gender'), fieldset:has-text('Sex'), [role='radiogroup']:has-text('Gender'), [role='radiogroup']:has-text('Sex'), div[data-automation-id*='formField']:has-text('Gender'), div[data-automation-id*='formField']:has-text('Sex')"
    );

    const fCount = await genderFieldsets.count();
    for (let i = 0; i < fCount; i++) {
      const fs = genderFieldsets.nth(i);
      if (!(await fs.isVisible().catch(() => false))) continue;

      // Check if Male is already properly checked
      const maleChecked = await fs.evaluate((el) => {
        const checked = el.querySelector("input[type='radio']:checked, [role='radio'][aria-checked='true']");
        if (!checked) return false;
        const lbl = checked.closest("label") || checked.parentElement;
        const t = (lbl?.textContent || checked.getAttribute("value") || "").trim().toLowerCase();
        return t.includes("male") && !t.includes("female");
      }).catch(() => false);

      if (maleChecked) continue;

      console.log("  Enforcing Gender radio to 'Male'...");
      // Strictly locate Male option (never Female)
      const maleRadio = fs.locator("label, [role='radio'], div[data-automation-id*='radio']").filter({
        hasText: /^\s*(Male|Man)\b/i
      }).first();

      if (await maleRadio.count() > 0 && await maleRadio.isVisible().catch(() => false)) {
        await maleRadio.click({ force: true }).catch(() => {});
      } else {
        const fallback = fs.locator("label:has-text('Male'):not(:has-text('Female')), [role='radio']:has-text('Male'):not(:has-text('Female')), input[value='Male' i]").first();
        if (await fallback.count() > 0) {
          await fallback.click({ force: true }).catch(() => {});
        }
      }
      await page.waitForTimeout(300);
    }

    // 2. Dropdown selectors for gender
    const genderDropdownContainers = page.locator(
      "div[data-automation-id*='formField']:has-text('Gender'), div[data-automation-id*='formField']:has-text('Sex'), fieldset:has-text('Gender'), fieldset:has-text('Sex')"
    );
    const dCount = await genderDropdownContainers.count();
    for (let i = 0; i < dCount; i++) {
      const container = genderDropdownContainers.nth(i);
      if (!(await container.isVisible().catch(() => false))) continue;

      const btn = container.locator("button[aria-haspopup='listbox'], button:has-text('Select One'), div[data-automation-id*='select']").first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        const btnText = (await btn.innerText().catch(() => "")).trim().toLowerCase();
        // If it's already "Male" (and not Female), good
        if (btnText.includes("male") && !btnText.includes("female")) continue;

        console.log("  Correcting Gender dropdown to 'Male'...");
        await this.clickWorkdayButton(page, btn);
        await page.waitForTimeout(500);

        const maleOpt = page.locator("[role='option'], li, div[data-automation-id='promptOption']").filter({
          hasText: /^\s*(Male|Man)\b/i
        }).first();

        if (await maleOpt.count() > 0) {
          await maleOpt.click({ force: true }).catch(() => {});
        } else {
          const fallback = page.locator("[role='option']:has-text('Male'):not(:has-text('Female')), li:has-text('Male'):not(:has-text('Female')), div[data-automation-id='promptOption']:has-text('Male'):not(:has-text('Female'))").first();
          if (await fallback.count() > 0) {
            await fallback.click({ force: true }).catch(() => {});
          }
        }
        await page.waitForTimeout(300);
      }
    }
  }

  private async fillRadioQuestions(page: Page, profile: UserProfile): Promise<void> {
    const fieldsets = page.locator(
      "fieldset:has(input[type='radio']), fieldset:has([role='radio']), [role='radiogroup'], div[data-automation-id*='formField']:has(input[type='radio']), div[data-automation-id*='formField']:has([role='radio'])"
    );
    const count = await fieldsets.count();

    for (let i = 0; i < count; i++) {
      const fs = fieldsets.nth(i);
      const isVisible = await fs.isVisible().catch(() => false);
      if (!isVisible) continue;

      const hasRadio = (await fs.locator("input[type='radio'], [role='radio']").count()) > 0;
      if (!hasRadio) continue;

      const text = (await fs.innerText().catch(() => "")).toLowerCase();
      let targetChoice = "Yes";
      if (
        text.includes("sponsorship") ||
        text.includes("require visa") ||
        text.includes("visa") ||
        text.includes("felony") ||
        text.includes("convict") ||
        text.includes("relative") ||
        text.includes("family member") ||
        text.includes("conflict of interest") ||
        text.includes("previously worked") ||
        text.includes("worked for") ||
        text.includes("worked at") ||
        text.includes("worked with") ||
        text.includes("previously employed") ||
        text.includes("employed by") ||
        text.includes("ever been employed") ||
        text.includes("been employed") ||
        text.includes("employed with") ||
        text.includes("prior employee") ||
        text.includes("past employee") ||
        text.includes("former employee") ||
        text.includes("currently employed") ||
        text.includes("current employee") ||
        text.includes("affiliated with") ||
        text.includes("agency") ||
        text.includes("contractor") ||
        text.includes("relationship to employee") ||
        text.includes("related to") ||
        text.includes("relationship") ||
        text.includes("friend or relative") ||
        text.includes("non-compete") ||
        text.includes("disciplinary") ||
        text.includes("termination") ||
        text.includes("investigation")
      ) {
        targetChoice = "No";
      } else if (text.includes("gender") || text.includes("sex")) {
        targetChoice = profile.gender || "Male";
      } else if (
        text.includes("authorized") ||
        text.includes("18 years") ||
        text.includes("relocate") ||
        text.includes("willing to relocate") ||
        text.includes("background check") ||
        text.includes("drug test") ||
        text.includes("consent") ||
        text.includes("agree") ||
        text.includes("commutable") ||
        text.includes("hybrid") ||
        text.includes("eligible")
      ) {
        targetChoice = "Yes";
      }

      // Inspect currently checked radio
      const checkedInfo = await fs.evaluate((el) => {
        const checked = el.querySelector("input[type='radio']:checked, [role='radio'][aria-checked='true']");
        if (!checked) return null;
        const lbl = checked.closest("label") || checked.parentElement;
        return (lbl?.textContent || checked.getAttribute("value") || "").trim().toLowerCase();
      }).catch(() => null);

      if (checkedInfo) {
        if ((targetChoice === "Male" || targetChoice === "Man") && checkedInfo.includes("male") && !checkedInfo.includes("female")) {
          continue;
        }
        if (targetChoice === "No" && checkedInfo.startsWith("no")) {
          continue;
        }
        if (targetChoice === "Yes" && checkedInfo.startsWith("yes")) {
          continue;
        }
      }

      console.log(`  Selecting Workday radio: "${text.slice(0, 40).trim()}..." -> "${targetChoice}"`);
      let radioBtn: any = null;

      if (targetChoice === "Male" || targetChoice === "Man") {
        // Strictly exclude Female / Woman
        const maleRadio = fs.locator("label, [role='radio'], div[data-automation-id*='radio']").filter({
          hasText: /^\s*(Male|Man)\b/i
        }).first();
        if (await maleRadio.count() > 0 && await maleRadio.isVisible().catch(() => false)) {
          radioBtn = maleRadio;
        } else {
          const fallback = fs.locator("label:has-text('Male'):not(:has-text('Female')), [role='radio']:has-text('Male'):not(:has-text('Female')), input[value='Male' i]").first();
          if (await fallback.count() > 0) radioBtn = fallback;
        }
      } else if (targetChoice === "No") {
        const strictNo = fs.locator("label, [role='radio'], div[data-automation-id*='radio'], div[data-automation-id*='click_filter']").filter({
          hasText: /^\s*No\b/i
        }).first();
        if (await strictNo.count() > 0 && await strictNo.isVisible().catch(() => false)) {
          radioBtn = strictNo;
        } else {
          radioBtn = fs.locator("label:has-text('No'):not(:has-text('Yes')), input[value='No' i], [role='radio']:has-text('No')").first();
        }
      } else if (targetChoice === "Yes") {
        const strictYes = fs.locator("label, [role='radio'], div[data-automation-id*='radio'], div[data-automation-id*='click_filter']").filter({
          hasText: /^\s*Yes\b/i
        }).first();
        if (await strictYes.count() > 0 && await strictYes.isVisible().catch(() => false)) {
          radioBtn = strictYes;
        } else {
          radioBtn = fs.locator("label:has-text('Yes'):not(:has-text('No')), input[value='Yes' i], [role='radio']:has-text('Yes')").first();
        }
      } else {
        radioBtn = fs.locator(`label:has-text('${targetChoice}'), input[value*='${targetChoice}' i], [role='radio']:has-text('${targetChoice}')`).first();
      }

      if (radioBtn && (await radioBtn.count()) > 0) {
        await radioBtn.click({ force: true, timeout: 2000 }).catch(() => {});
      } else {
        const firstRadio = fs.locator("input[type='radio'], [role='radio']").first();
        if (await firstRadio.count() > 0) {
          await firstRadio.click({ force: true, timeout: 2000 }).catch(() => {});
        }
      }
      await page.waitForTimeout(200);
    }
  }

  private async fillDropdowns(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>): Promise<void> {
    const dropdownButtons = page.locator(
      "button:has-text('Select One'), [role='button']:has-text('Select One'), button[aria-haspopup='listbox'], div[data-automation-id*='select']:has-text('Select One')"
    );

    const count = await dropdownButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = dropdownButtons.nth(i);
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      const btnText = (await btn.innerText().catch(() => "")).trim();
      const questionText = await btn.evaluate((el) => {
        const container = el.closest("div[data-automation-id*='formField'], [data-automation-id*='question'], fieldset, [role='group'], tr, div");
        return container?.textContent || "";
      }).catch(() => "");

      const q = questionText.toLowerCase();

      let targetOption = "Yes";
      if (
        q.includes("current employee") ||
        q.includes("currently employed") ||
        q.includes("previously employed") ||
        q.includes("employed by") ||
        q.includes("ever been employed") ||
        q.includes("been employed") ||
        q.includes("prior employee") ||
        q.includes("past employee") ||
        q.includes("worked for") ||
        q.includes("worked at") ||
        q.includes("worked with") ||
        q.includes("former employee") ||
        q.includes("relative") ||
        q.includes("family member") ||
        q.includes("related to") ||
        q.includes("relationship") ||
        q.includes("conflict of interest") ||
        q.includes("felony") ||
        q.includes("convict") ||
        q.includes("require visa") ||
        q.includes("require sponsorship") ||
        q.includes("need sponsorship") ||
        q.includes("sponsorship")
      ) {
        targetOption = "No";
      } else if (
        q.includes("eligible") ||
        q.includes("authorized") ||
        q.includes("commutable") ||
        q.includes("hybrid") ||
        q.includes("happy to apply") ||
        q.includes("relocate") ||
        q.includes("18 years")
      ) {
        targetOption = "Yes";
      } else if (q.includes("gender") || q.includes("sex")) {
        targetOption = profile.gender || "Male";
      } else if (q.includes("veteran")) {
        targetOption = "I am not a protected veteran";
      } else if (q.includes("disability")) {
        targetOption = "No, I do not have a disability";
      } else if (q.includes("hispanic") || q.includes("latino")) {
        targetOption = "No";
      } else if (q.includes("race") || q.includes("ethnicity")) {
        targetOption = "Asian";
      } else if (q.includes("degree") || q.includes("education")) {
        targetOption = "Bachelor";
      } else if (q.includes("notice") || q.includes("available")) {
        targetOption = "Immediate";
      } else if (q.includes("english") || q.includes("language")) {
        targetOption = "Fluent";
      } else if (q.includes("salary") || q.includes("compensation") || q.includes("gross")) {
        targetOption = "Negotiable";
      } else if (q.includes("country")) {
        targetOption = profile.location?.toLowerCase().includes("india") ? "India" : "United States";
      } else if (q.includes("location") || q.includes("city")) {
        targetOption = profile.location?.toLowerCase().includes("india") ? "India" : "Vadodara";
      }

      // Check if already correctly selected
      if (btnText && !btnText.includes("Select One") && !btnText.includes("Select")) {
        const lowerBtn = btnText.toLowerCase();
        if ((targetOption === "Male" || targetOption === "Man") && lowerBtn.includes("male") && !lowerBtn.includes("female")) {
          continue;
        }
        if (targetOption === "No" && lowerBtn.startsWith("no")) {
          continue;
        }
        if (targetOption === "Yes" && lowerBtn.startsWith("yes")) {
          continue;
        }
        // If it's something else and not one of the conflicting fields, skip
        if (!q.includes("gender") && !q.includes("sex") && !q.includes("employed") && !q.includes("worked")) {
          continue;
        }
      }

      console.log(`  Filling Workday dropdown: "${questionText.slice(0, 40).trim()}..." -> "${targetOption}"`);

      // Click to open dropdown
      await this.clickWorkdayButton(page, btn);
      await page.waitForTimeout(600);

      // Locate option in popup
      let targetOpt: any = null;
      if (targetOption === "Male" || targetOption === "Man") {
        targetOpt = page.locator("[role='option'], li, div[data-automation-id='promptOption']").filter({
          hasText: /^\s*(Male|Man)\b/i
        }).first();
        if (await targetOpt.count() === 0) {
          targetOpt = page.locator("[role='option']:has-text('Male'):not(:has-text('Female')), li:has-text('Male'):not(:has-text('Female')), div[data-automation-id='promptOption']:has-text('Male'):not(:has-text('Female'))").first();
        }
      } else if (targetOption === "No") {
        targetOpt = page.locator("[role='option'], li, div[data-automation-id='promptOption']").filter({
          hasText: /^\s*No\b/i
        }).first();
        if (await targetOpt.count() === 0) {
          targetOpt = page.locator("[role='option']:has-text('No'):not(:has-text('Yes')), li:has-text('No'):not(:has-text('Yes')), div[data-automation-id='promptOption']:has-text('No'):not(:has-text('Yes'))").first();
        }
      } else if (targetOption === "Yes") {
        targetOpt = page.locator("[role='option'], li, div[data-automation-id='promptOption']").filter({
          hasText: /^\s*Yes\b/i
        }).first();
      } else if (targetOption === "Immediate") {
        targetOpt = page.locator("[role='option'], li, div[data-automation-id='promptOption']").filter({
          hasText: /immediate|1 month|30 days|immediately/i
        }).first();
      } else if (targetOption === "Fluent") {
        targetOpt = page.locator("[role='option'], li, div[data-automation-id='promptOption']").filter({
          hasText: /fluent|advanced|proficient|professional|native/i
        }).first();
      } else {
        targetOpt = page.locator(
          `[role='option']:has-text('${targetOption}'), li:has-text('${targetOption}'), div[data-automation-id='promptOption']:has-text('${targetOption}')`
        ).first();
      }

      if (targetOpt && (await targetOpt.count()) > 0) {
        await targetOpt.click({ force: true }).catch(() => {});
      } else {
        // Fallback: search for first non-placeholder option that is NOT "None / Not Applicable"
        const validOpts = page.locator(
          "[role='option']:not(:has-text('Select One')):not(:has-text('None / Not Applicable')):not(:has-text('None')), li[role='option']:not(:has-text('Select One')):not(:has-text('None / Not Applicable')):not(:has-text('None')), div[data-automation-id='promptOption']:not(:has-text('Select One')):not(:has-text('None / Not Applicable')):not(:has-text('None'))"
        );
        if (await validOpts.count() > 0) {
          await validOpts.first().click({ force: true }).catch(() => {});
        } else {
          const fallbackOpt = page.locator(
            "[role='option']:not(:has-text('Select One')), li[role='option']:not(:has-text('Select One')), div[data-automation-id='promptOption']:not(:has-text('Select One'))"
          ).first();
          if (await fallbackOpt.count() > 0) {
            await fallbackOpt.click({ force: true }).catch(() => {});
          }
        }
      }
      await page.waitForTimeout(400);
    }
  }

  private async fillCheckboxes(page: Page): Promise<void> {
    const cbs = page.locator("input[type='checkbox']:not(:checked)");
    const count = await cbs.count();
    for (let i = 0; i < count; i++) {
      const cb = cbs.nth(i);
      await cb.scrollIntoViewIfNeeded().catch(() => {});
      await cb.check({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  private async fillRequiredInputs(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>): Promise<void> {
    // 1. Handle uncompleted work experience or education fields (like "I currently work here")
    const currWorkHere = page.locator("input[type='checkbox'][data-automation-id*='currentlyWorkHere'], input[type='checkbox'][id*='currentlyWorkHere']").first();
    if (await currWorkHere.count() > 0 && await currWorkHere.isVisible().catch(() => false)) {
      if (!(await currWorkHere.isChecked().catch(() => false))) {
        await currWorkHere.check({ force: true }).catch(() => {});
      }
    }

    const emptyRequired = page.locator("input[aria-required='true']:not([type='hidden']):not([type='file']), textarea[aria-required='true'], input[required]:not([type='hidden']):not([type='file']), textarea[required]");
    const count = await emptyRequired.count();

    for (let i = 0; i < count; i++) {
      const input = emptyRequired.nth(i);
      const isVisible = await input.isVisible().catch(() => false);
      if (!isVisible) continue;

      const val = await input.inputValue().catch(() => "");
      if (val.trim()) continue;

      const label = (await input.getAttribute("aria-label").catch(() => "")) || "";
      const id = (await input.getAttribute("id").catch(() => "")) || "";
      const name = (await input.getAttribute("name").catch(() => "")) || "";
      const placeholder = (await input.getAttribute("placeholder").catch(() => "")) || "";
      const parentLabel = await input.evaluate((el) => {
        return el.closest("div[data-automation-id*='formField'], [data-automation-id*='dateInputWrapper'], fieldset, div")?.querySelector("label")?.textContent || "";
      }).catch(() => "");

      const lower = `${label} ${id} ${name} ${placeholder} ${parentLabel}`.toLowerCase();

      let answer = "N/A";
      if (
        placeholder.toLowerCase().includes("yyyy") ||
        placeholder.toLowerCase().includes("mm") ||
        lower.includes("from") ||
        parentLabel.toLowerCase().includes("from") ||
        lower.includes("start date") ||
        parentLabel.toLowerCase().includes("start date") ||
        lower.includes("fromdate")
      ) {
        answer = "01/2024";
      } else if (
        lower.includes("end date") ||
        parentLabel.toLowerCase().includes("end date") ||
        lower.includes("todate")
      ) {
        answer = "01/2026";
      } else if (
        lower.includes("relationship") ||
        parentLabel.toLowerCase().includes("relationship") ||
        lower.includes("which location") ||
        parentLabel.toLowerCase().includes("which location")
      ) {
        answer = "N/A";
      } else if (lower.includes("company") || lower.includes("employer")) answer = "Jobspring";
      else if (lower.includes("job title") || lower.includes("role") || lower.includes("title")) answer = "Full Stack AI Developer";
      else if (lower.includes("first name")) answer = profile.firstName;
      else if (lower.includes("last name")) answer = profile.lastName;
      else if (lower.includes("name") && !lower.includes("user")) answer = `${profile.firstName} ${profile.lastName}`;
      else if (lower.includes("email")) answer = profile.email;
      else if (lower.includes("phone")) answer = profile.phone;
      else if (lower.includes("gender") || lower.includes("sex")) answer = profile.gender || "Male";
      else if (lower.includes("salary") || lower.includes("compensation") || lower.includes("gross")) answer = "Negotiable";
      else if (lower.includes("english") || lower.includes("language")) answer = "Fluent / Professional Working Proficiency";
      else if ((lower.includes("notice") || lower.includes("start")) && !lower.includes("date") && !lower.includes("from")) answer = "Immediate";
      else if (lower.includes("city") && !lower.includes("ethnicity")) answer = profile.location ? (profile.location.toLowerCase().includes("india") ? profile.location.split(",")[0].trim() : "San Francisco") : "San Francisco";
      else if (lower.includes("state") || lower.includes("province")) answer = profile.location?.toLowerCase().includes("india") ? "Gujarat" : "California";
      else if (lower.includes("postal") || lower.includes("zip")) answer = profile.location?.toLowerCase().includes("india") ? "390001" : "94105";
      else if (lower.includes("address") && !lower.includes("email")) answer = "123 Market St";
      else if (lower.includes("country") && !lower.includes("ethnicity")) answer = profile.location?.toLowerCase().includes("india") ? "India" : "United States";
      else if (lower.includes("location") && !lower.includes("salary")) answer = profile.location || "San Francisco, CA, United States";
      else if (
        (lower.includes("years of experience") ||
         lower.includes("total experience") ||
         lower.includes("years experience") ||
         (lower.includes("years") && !lower.includes("18 years") && !lower.includes("graduation")) ||
         (lower.includes("experience") && (lower.includes("how many") || lower.includes("number") || lower.includes("total")))) &&
        !lower.includes("location") &&
        !lower.includes("city") &&
        !lower.includes("company") &&
        !lower.includes("title") &&
        !lower.includes("employer")
      ) {
        answer = `${profile.yearsOfExperience || 3}`;
      }
      else if (lower.includes("linkedin")) answer = profile.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
      else if (lower.includes("github") || lower.includes("portfolio") || lower.includes("website")) answer = profile.githubUrl || profile.portfolioUrl || "https://github.com/hrutinnammi";
      else if (lower.includes("school") || lower.includes("university") || lower.includes("institution")) answer = "Parul University";
      else if (lower.includes("degree")) answer = "Bachelor of Technology";
      else if (lower.includes("field of study") || lower.includes("major")) answer = "Computer Science and Engineering";
      else if (lower.includes("gpa")) answer = "7.1";
      else if (lower.includes("month")) answer = "01";
      else if (lower.includes("year")) answer = "2024";
      else if (additionalAnswers) {
        for (const [qKey, aVal] of Object.entries(additionalAnswers)) {
          if (lower.includes(qKey.toLowerCase()) || qKey.toLowerCase().includes(lower)) {
            answer = aVal;
            break;
          }
        }
      }

      await input.focus().catch(() => {});
      await input.fill(answer).catch(() => {});
      await input.evaluate((el: any, v: string) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(el, v);
        else el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, answer).catch(() => {});
      await input.blur().catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  async validate(page: Page, _fields?: FormField[]): Promise<boolean> {
    const errorCount = await page.locator("[data-automation-id='error-message'], [class*='error-message'], [aria-invalid='true']").count();
    return errorCount === 0;
  }

  async submit(page: Page): Promise<SubmissionResult> {
    const isAutoSubmit = process.env.AUTO_SUBMIT === "true";
    console.log(`🏁 [WorkdayAdapter]: Reached application submission stage (isAutoSubmit: ${isAutoSubmit})...`);

    // Wait briefly for Review page DOM to settle
    await page.waitForTimeout(2500);

    // Strictly verify whether the browser is on the final Review step
    let isReviewPage = await page.evaluate(() => {
      const url = window.location.href.toLowerCase();
      if (url.includes("/review")) return true;
      const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
      if (activeStep.toLowerCase().includes("review")) return true;
      const header = document.querySelector("h2[data-automation-id='pageHeader'], h2, h3")?.textContent || "";
      if (header.toLowerCase().includes("review")) return true;
      const text = document.body?.innerText || "";
      return text.includes("Please review your information before submitting") || text.includes("Review your information");
    }).catch(() => false);

    // Locate final submit button
    const submitBtnLocators = [
      "button[data-automation-id='bottom-navigation-next-button']:has-text('Submit')",
      "button:has-text('Submit')",
      "button[data-automation-id='submitButton']",
      "div[data-automation-id='click_filter'][aria-label='Submit Application']",
      "div[data-automation-id='click_filter'][aria-label='Submit']",
      "div[data-automation-id='click_filter']:has-text('Submit')",
      "button:has-text('Submit Application')"
    ];

    let submitBtn = null;
    for (const sel of submitBtnLocators) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        submitBtn = btn;
        isReviewPage = true; // Button visible on Review screen
        break;
      }
    }

    // Guard: Do not report ready if not actually on Review page or submit button
    if (!submitBtn || !isReviewPage) {
      console.warn("⚠️ [WorkdayAdapter]: Application has not reached the final submit page yet.");
      await updateHUDStatus(page, "In Progress", "Completing application wizard steps...", "warning", 60);
      return {
        success: false,
        errorMessage: "WORKDAY_NOT_AT_SUBMIT_PAGE"
      };
    }

    // If submit button found, scroll and visually illuminate in emerald green
    if (submitBtn) {
      await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(500);

      await page.evaluate(() => {
        const btn = document.querySelector("button[data-automation-id='bottom-navigation-next-button'], button[data-automation-id='submitButton'], div[data-automation-id='click_filter'][aria-label*='Submit']");
        if (btn) {
          (btn as HTMLElement).style.outline = "4px solid #10b981";
          (btn as HTMLElement).style.boxShadow = "0 0 30px rgba(16, 185, 129, 0.9)";
          (btn as HTMLElement).style.borderRadius = "8px";
          (btn as HTMLElement).style.transition = "all 0.3s ease";
        }
      }).catch(() => {});
    }

    // When AUTO_SUBMIT is disabled (default manual submit mode):
    if (!isAutoSubmit) {
      console.log("👉 [WorkdayAdapter]: Ready for manual submission. Submit button is centered & highlighted for you to click!");
      await updateHUDStatus(page, "Ready to Submit", "Workday application completed! Submit button highlighted below for you to submit manually 🎯", "success", 100);
      return {
        success: true,
        confirmation: "READY_FOR_MANUAL_SUBMISSION"
      };
    }

    // Auto submit enabled
    console.log("🔴 [WorkdayAdapter]: AUTO-SUBMIT active — Clicking Workday submit button...");
    await updateHUDStatus(page, "Submitting Application", "Clicking submit button...", "info", 98);

    if (submitBtn) {
      await this.clickWorkdayButton(page, submitBtn);
    }

    await page.waitForTimeout(6000);
    const isSuccess = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      return text.includes("Thank you") || text.includes("Application Submitted") || text.includes("Congratulations");
    }).catch(() => false);

    return {
      success: isSuccess,
      confirmation: isSuccess ? "WORKDAY_SUBMISSION_SUCCESS" : "WORKDAY_SUBMITTED_PENDING_CONFIRMATION"
    };
  }
}
