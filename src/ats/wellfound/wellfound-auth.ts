import { Page } from "playwright";
import { UserProfile } from "../ats.interface";
import {
  DEFAULT_HRUTIN_WELLFOUND_PROFILE,
  DEFAULT_HRUTIN_WELLFOUND_LINKS,
  DEFAULT_HRUTIN_WELLFOUND_PITCH,
  getWellfoundCredentials,
  saveWellfoundCredentials,
  WellfoundCredential
} from "./wellfound-account-store";
import {
  fetchWellfoundVerificationCode,
  fetchWellfoundVerificationLink
} from "./wellfound-email-verifier";
import { humanClick, typeLikeHuman, simulateHumanMouse } from "../../browser/form-filler";
import { dismissCommonPopups } from "../../browser/popup-handler";
import { injectVisualHUD, updateHUDStatus } from "../../browser/visual-hud";
import { resolveLocalResumePath } from "../../utils/path-resolver";

/**
 * Checks if the current page has an active authenticated Wellfound session.
 */
export async function isWellfoundLoggedIn(page: Page): Promise<boolean> {
  try {
    const isProfileAvatar = await page.locator(
      "button[data-test='header-profile-menu'], [data-test='user-nav-dropdown'], [class*='styles_avatar'], a[href*='/profile'], [aria-label*='profile' i], button:has-text('Profile')"
    ).first().isVisible({ timeout: 2500 }).catch(() => false);

    if (isProfileAvatar) return true;

    // Check if login/join buttons are completely absent and user menu is present
    const hasLoginBtn = await page.locator("a[href*='/login'], a:has-text('Log In'), button:has-text('Log In')").first().isVisible({ timeout: 1500 }).catch(() => false);
    return !hasLoginBtn && page.url().includes("wellfound.com") && !page.url().includes("/login") && !page.url().includes("/join");
  } catch (e) {
    return false;
  }
}

/**
 * Fully logs out of Wellfound by clearing all cookies, session storage, and local storage.
 */
export async function logoutWellfound(page: Page): Promise<void> {
  console.log("🚪 [WellfoundAuth]: Clearing session and logging out of Wellfound...");
  try {
    // 1. Clear Playwright browser context cookies for Wellfound / AngelList
    await page.context().clearCookies();

    // 2. Clear browser storage
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
    }).catch(() => {});

    // 3. Navigate to logout endpoint as backup
    await page.goto("https://wellfound.com/logout", { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // 4. Clear cookies again to ensure complete reset
    await page.context().clearCookies();
    console.log("✅ [WellfoundAuth]: Successfully logged out of Wellfound.");
  } catch (err: any) {
    console.warn("⚠️ [WellfoundAuth]: Notice during logout:", err.message);
  }
}

/**
 * Determines the email or identifier of the currently active Wellfound session if available.
 */
export async function getWellfoundLoggedInEmail(page: Page): Promise<string | null> {
  try {
    const isLogged = await isWellfoundLoggedIn(page);
    if (!isLogged) return null;

    const detected = await page.evaluate(() => {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          const val = localStorage.getItem(key) || "";
          if (val.includes("@") && (key.includes("user") || key.includes("email") || key.includes("auth"))) {
            const match = val.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match) return match[0];
          }
        }
      } catch (e) {}
      return null;
    }).catch(() => null);

    return detected;
  } catch (e) {
    return null;
  }
}

/**
 * Ensures an active authenticated session exists on Wellfound for the SPECIFIC requested user.
 * If logged in as a different user, logs out first.
 * If not authenticated, automatically navigates to /login and fills in credentials.
 * If the account doesn't exist, it will attempt to create one via signup.
 */
export async function ensureWellfoundSession(
  page: Page,
  profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE,
  customCreds?: WellfoundCredential
): Promise<boolean> {
  await injectVisualHUD(page);
  await updateHUDStatus(page, "Checking Wellfound Authentication...", `Verifying session for ${profile.email}`, "info", 10);

  const loggedIn = await isWellfoundLoggedIn(page);
  if (loggedIn) {
    const currentEmail = await getWellfoundLoggedInEmail(page);
    if (currentEmail && profile.email && currentEmail.toLowerCase() !== profile.email.toLowerCase()) {
      console.log(`🔄 [WellfoundAuth]: Active session is for ${currentEmail}, but requested candidate is ${profile.email}. Logging out...`);
      await logoutWellfound(page);
    } else {
      console.log(`✅ [WellfoundAuth]: Already logged in to Wellfound as ${profile.email}.`);
      await updateHUDStatus(page, "Wellfound Session Active", `Logged in as ${profile.firstName} ${profile.lastName}`, "success", 20);
      return true;
    }
  }

  console.log(`🔐 [WellfoundAuth]: Initiating Wellfound authentication for ${profile.email}...`);
  await updateHUDStatus(page, "Authenticating with Wellfound...", `Signing in as ${profile.email}`, "warning", 25);

  const creds = customCreds || (await getWellfoundCredentials(profile.email)) || {
    email: profile.email,
    password: process.env.WELLFOUND_PASSWORD || "HrutinDev@2024!",
    updatedAt: new Date().toISOString()
  };

  // Step 1: Try to login first
  const loginSuccess = await attemptWellfoundLogin(page, creds, profile);
  
  if (loginSuccess) {
    return true;
  }

  // Step 2: Check if login failed due to "incorrect email/password" → need to create account
  const loginErrorText = await page.locator(
    "[class*='error'], [class*='alert'], [role='alert'], .flash, [data-test*='error']"
  ).first().innerText().catch(() => "");

  const isCredentialError = loginErrorText.toLowerCase().includes("incorrect") ||
    loginErrorText.toLowerCase().includes("invalid") ||
    loginErrorText.toLowerCase().includes("not found") ||
    loginErrorText.toLowerCase().includes("doesn't exist") ||
    loginErrorText.toLowerCase().includes("no account");

  if (isCredentialError) {
    console.log("🆕 [WellfoundAuth]: Account doesn't exist or credentials are wrong. Attempting signup...");
    await updateHUDStatus(page, "Creating Wellfound Account...", `Signing up as ${profile.firstName} ${profile.lastName}`, "warning", 30);
    
    const signupSuccess = await createWellfoundAccount(page, creds, profile);
    if (signupSuccess) {
      // Save the working credentials
      await saveWellfoundCredentials(creds);
      return true;
    }
  } else {
    // Try signup anyway as a fallback
    console.log("🆕 [WellfoundAuth]: Login didn't succeed. Attempting signup as fallback...");
    const signupSuccess = await createWellfoundAccount(page, creds, profile);
    if (signupSuccess) {
      await saveWellfoundCredentials(creds);
      return true;
    }
  }

  console.log("ℹ️ [WellfoundAuth]: Authentication flow completed. Proceeding with current browser state.");
  return false;
}

/**
 * Attempts to login to Wellfound with the given credentials.
 */
async function attemptWellfoundLogin(
  page: Page,
  creds: WellfoundCredential,
  profile: UserProfile
): Promise<boolean> {
  const isLogged = await isWellfoundLoggedIn(page);
  if (isLogged) {
    console.log("🧹 [WellfoundLogin]: Logging out previous user session before signing in...");
    await logoutWellfound(page);
  }

  // Navigate to Wellfound login page
  const currentUrl = page.url();
  if (!currentUrl.includes("/login")) {
    console.log("👉 [WellfoundAuth]: Navigating to https://wellfound.com/login...");
    await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  await dismissCommonPopups(page);

  // 1. Fill Email
  const emailInput = page.locator(
    "input#user_email, input[name='user[email]'], input[name='email'], input[type='email'], input[placeholder*='email' i]"
  ).first();

  if (await emailInput.isVisible({ timeout: 8000 }).catch(() => false)) {
    console.log(`✍️ [WellfoundAuth]: Filling email address: ${creds.email}...`);
    await emailInput.clear().catch(() => {});
    await typeLikeHuman(page, emailInput, creds.email);
    await page.waitForTimeout(500);
  } else {
    console.warn("⚠️ [WellfoundAuth]: Email field not found on login page.");
  }

  // 2. Fill Password
  const passwordInput = page.locator(
    "input#user_password, input[name='user[password]'], input[name='password'], input[type='password']"
  ).first();

  if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("✍️ [WellfoundAuth]: Filling password...");
    await passwordInput.clear().catch(() => {});
    await typeLikeHuman(page, passwordInput, creds.password);
    await page.waitForTimeout(500);
  }

  // 3. Remember Me Checkbox
  const rememberMe = page.locator(
    "input#user_remember_me, input[name='user[remember_me]'], input[type='checkbox']"
  ).first();
  if (await rememberMe.isVisible().catch(() => false)) {
    const isChecked = await rememberMe.isChecked().catch(() => false);
    if (!isChecked) {
      await rememberMe.check({ force: true }).catch(() => {});
    }
  }

  // 4. Submit Login
  const submitBtn = page.locator(
    "input[type='submit'][value*='Log In' i], input[type='submit'][value*='Log in' i], button:has-text('Log in'), button:has-text('Log In'), button[type='submit']"
  ).first();

  if (await submitBtn.isVisible().catch(() => false)) {
    console.log("🚀 [WellfoundAuth]: Submitting Wellfound login form...");
    await humanClick(page, submitBtn);
    await page.waitForTimeout(5000);
  }

  // 5. Check for Cloudflare challenge
  const cloudflareTurnstile = await page.locator("iframe[src*='cloudflare'], iframe[src*='turnstile'], [id*='cf-turnstile']").isVisible().catch(() => false);
  if (cloudflareTurnstile) {
    console.warn("⚠️ [WellfoundAuth]: Cloudflare Turnstile challenge detected. Waiting...");
    await updateHUDStatus(page, "Cloudflare Challenge Detected", "Waiting for challenge resolution...", "warning", 35);
    await page.waitForTimeout(8000);
  }

  // Check login success
  const isNowLoggedIn = await isWellfoundLoggedIn(page);
  if (isNowLoggedIn) {
    console.log(`✅ [WellfoundAuth]: Successfully logged into Wellfound as ${profile.firstName} ${profile.lastName}!`);
    await updateHUDStatus(page, "Wellfound Authentication Successful", `Logged in as ${creds.email}`, "success", 40);
    return true;
  }

  return false;
}

/**
 * Creates a new Wellfound account using the signup flow:
 * 1. Navigate to /signup (or /join)
 * 2. Select "I'm looking for a job"
 * 3. Fill name, email, password
 * 4. Handle email verification via Gmail IMAP
 * 5. Complete onboarding wizard
 */
export async function createWellfoundAccount(
  page: Page,
  creds: WellfoundCredential,
  profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE
): Promise<boolean> {
  console.log("===============================================================================");
  console.log("🆕 CREATING NEW WELLFOUND ACCOUNT");
  console.log(`👤 Name: ${profile.firstName} ${profile.lastName}`);
  console.log(`📧 Email: ${creds.email}`);
  console.log("===============================================================================\n");

  await injectVisualHUD(page);
  await updateHUDStatus(page, "Creating Wellfound Account...", `Registering ${profile.firstName} ${profile.lastName}`, "info", 15);

  // Step 0: Ensure logged out before attempting signup
  console.log("🧹 [WellfoundSignup]: Ensuring any previous user session is logged out before signup...");
  await logoutWellfound(page);

  // Step 1: Navigate to signup page
  console.log("👉 [WellfoundSignup]: Navigating to https://wellfound.com/signup...");
  await page.goto("https://wellfound.com/signup", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await dismissCommonPopups(page);

  // Take screenshot for debugging
  await page.screenshot({ path: "scratch/wellfound_signup_page.png" }).catch(() => {});

  // Step 2: Click "I'm looking for a job" if present
  console.log("👉 [WellfoundSignup]: Looking for 'I'm looking for a job' option...");
  const jobSeekerBtn = page.locator(
    "a:has-text('looking for a job'), button:has-text('looking for a job'), " +
    "a:has-text('Find a job'), button:has-text('Find a job'), " +
    "a:has-text('Job Seeker'), button:has-text('Job Seeker'), " +
    "[data-test*='jobseeker' i], [data-test*='candidate' i], " +
    "a[href*='/join'], a[href*='/signup/candidate'], a[href*='/signup/jobseeker']"
  ).first();

  if (await jobSeekerBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log("✅ [WellfoundSignup]: Found job seeker button. Clicking...");
    await humanClick(page, jobSeekerBtn);
    await page.waitForTimeout(3000);
  } else {
    // Try navigating directly to candidate signup
    console.log("👉 [WellfoundSignup]: Trying direct navigation to candidate signup...");
    // Try /join route as fallback
    await page.goto("https://wellfound.com/join", { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);
    
    // Check for job seeker option again  
    const jobSeekerBtn2 = page.locator(
      "a:has-text('looking for a job'), button:has-text('looking for a job'), " +
      "a:has-text('I want a job'), button:has-text('I want a job'), " +
      "[role='link']:has-text('job'), [role='button']:has-text('job')"
    ).first();
    
    if (await jobSeekerBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await humanClick(page, jobSeekerBtn2);
      await page.waitForTimeout(2000);
    }
  }

  await dismissCommonPopups(page);
  await page.screenshot({ path: "scratch/wellfound_signup_form.png" }).catch(() => {});

  // Step 3: Fill signup form fields
  console.log("✍️ [WellfoundSignup]: Filling signup form fields...");
  await updateHUDStatus(page, "Filling Signup Form", "Entering name, email, and password", "info", 25);

  // Name field(s) - could be single "full name" or split first/last
  const fullNameInput = page.locator(
    "input[name*='name' i]:not([name*='email']):not([name*='password']):not([type='hidden']), " +
    "input[placeholder*='name' i]:not([placeholder*='email']):not([placeholder*='password']), " +
    "input[id*='name' i]:not([id*='email']):not([id*='password']):not([type='hidden']), " +
    "input[aria-label*='name' i]:not([aria-label*='email']):not([aria-label*='password'])"
  ).first();

  const firstNameInput = page.locator(
    "input[name*='first_name' i], input[name*='firstName' i], input[placeholder*='first name' i]"
  ).first();

  const lastNameInput = page.locator(
    "input[name*='last_name' i], input[name*='lastName' i], input[placeholder*='last name' i]"
  ).first();

  // Try split first/last name fields first
  if (await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`✍️ [WellfoundSignup]: Filling first name: ${profile.firstName}`);
    await firstNameInput.clear().catch(() => {});
    await typeLikeHuman(page, firstNameInput, profile.firstName);
    await page.waitForTimeout(300);

    if (await lastNameInput.isVisible().catch(() => false)) {
      console.log(`✍️ [WellfoundSignup]: Filling last name: ${profile.lastName}`);
      await lastNameInput.clear().catch(() => {});
      await typeLikeHuman(page, lastNameInput, profile.lastName);
      await page.waitForTimeout(300);
    }
  } else if (await fullNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const fullName = `${profile.firstName} ${profile.lastName}`;
    console.log(`✍️ [WellfoundSignup]: Filling full name: ${fullName}`);
    await fullNameInput.clear().catch(() => {});
    await typeLikeHuman(page, fullNameInput, fullName);
    await page.waitForTimeout(300);
  }

  // Email field
  const emailInput = page.locator(
    "input[name*='email' i], input[type='email'], input[placeholder*='email' i], input[id*='email' i]"
  ).first();

  if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log(`✍️ [WellfoundSignup]: Filling email: ${creds.email}`);
    await emailInput.clear().catch(() => {});
    await typeLikeHuman(page, emailInput, creds.email);
    await page.waitForTimeout(300);
  }

  // Password field
  const passwordInput = page.locator(
    "input[name*='password' i], input[type='password'], input[placeholder*='password' i]"
  ).first();

  if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("✍️ [WellfoundSignup]: Filling password...");
    await passwordInput.clear().catch(() => {});
    await typeLikeHuman(page, passwordInput, creds.password);
    await page.waitForTimeout(300);
  }

  // Confirm password (if exists)
  const confirmPasswordInput = page.locator(
    "input[name*='confirm' i], input[name*='password_confirmation' i], input[placeholder*='confirm' i]"
  ).first();

  if (await confirmPasswordInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("✍️ [WellfoundSignup]: Filling password confirmation...");
    await confirmPasswordInput.clear().catch(() => {});
    await typeLikeHuman(page, confirmPasswordInput, creds.password);
    await page.waitForTimeout(300);
  }

  // Check any terms/privacy checkboxes
  const termsCheckbox = page.locator(
    "input[type='checkbox'][name*='terms' i], input[type='checkbox'][name*='agree' i], " +
    "input[type='checkbox'][name*='accept' i], input[type='checkbox'][name*='tos' i], " +
    "input[type='checkbox']"
  );
  const checkboxCount = await termsCheckbox.count().catch(() => 0);
  for (let i = 0; i < checkboxCount; i++) {
    const cb = termsCheckbox.nth(i);
    const isChecked = await cb.isChecked().catch(() => false);
    if (!isChecked) {
      await cb.check({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  await page.screenshot({ path: "scratch/wellfound_signup_filled.png" }).catch(() => {});

  // Step 4: Submit signup form
  console.log("🚀 [WellfoundSignup]: Submitting signup form...");
  const signupBtn = page.locator(
    "button:has-text('Create account'), button:has-text('Sign up'), button:has-text('Sign Up'), " +
    "button:has-text('Join'), button:has-text('Register'), " +
    "input[type='submit'][value*='Sign up' i], input[type='submit'][value*='Create' i], " +
    "input[type='submit'][value*='Join' i], button[type='submit']"
  ).first();

  if (await signupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await humanClick(page, signupBtn);
    console.log("✅ [WellfoundSignup]: Signup form submitted!");
    await page.waitForTimeout(5000);
  } else {
    // Try pressing Enter as fallback
    console.log("⚠️ [WellfoundSignup]: No submit button found. Pressing Enter...");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);
  }

  await page.screenshot({ path: "scratch/wellfound_after_signup_submit.png" }).catch(() => {});
  await dismissCommonPopups(page);

  // Step 5: Handle Cloudflare Turnstile if present
  const hasTurnstile = await page.locator(
    "iframe[src*='cloudflare'], iframe[src*='turnstile'], [id*='cf-turnstile'], .cf-turnstile"
  ).isVisible().catch(() => false);

  if (hasTurnstile) {
    console.log("🛡️ [WellfoundSignup]: Cloudflare Turnstile detected. Waiting for resolution...");
    await updateHUDStatus(page, "Cloudflare Challenge", "Waiting for CAPTCHA resolution...", "warning", 30);
    // Wait for turnstile to auto-resolve or manual intervention
    await page.waitForTimeout(15000);
  }

  // Step 6: Handle email verification
  console.log("\n📧 [WellfoundSignup]: Checking if email verification is required...");
  await updateHUDStatus(page, "Email Verification", "Checking for verification requirement...", "info", 35);

  const pageText = await page.locator("body").innerText().catch(() => "");
  const needsVerification = 
    pageText.toLowerCase().includes("verify your email") ||
    pageText.toLowerCase().includes("verification") ||
    pageText.toLowerCase().includes("check your email") ||
    pageText.toLowerCase().includes("confirm your email") ||
    pageText.toLowerCase().includes("sent you an email") ||
    pageText.toLowerCase().includes("check your inbox") ||
    page.url().includes("verify") ||
    page.url().includes("confirm");

  if (needsVerification) {
    console.log("📧 [WellfoundSignup]: Email verification required! Checking Gmail for verification code/link...");
    await updateHUDStatus(page, "Email Verification Required", "Checking Gmail for verification code...", "warning", 40);

    // Check for OTP code input field on the page
    const otpInput = page.locator(
      "input[name*='code' i], input[name*='otp' i], input[name*='token' i], " +
      "input[name*='verification' i], input[placeholder*='code' i], " +
      "input[placeholder*='verification' i], input[maxlength='6'], input[maxlength='4']"
    ).first();

    const hasOtpField = await otpInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasOtpField) {
      // OTP code-based verification
      console.log("🔢 [WellfoundSignup]: OTP input field detected. Fetching code from Gmail...");
      const code = await fetchWellfoundVerificationCode(90000, 5000, creds.email, (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""));
      if (code) {
        console.log(`✅ [WellfoundSignup]: Entering verification code: ${code}`);
        await otpInput.clear().catch(() => {});
        await typeLikeHuman(page, otpInput, code);
        await page.waitForTimeout(500);

        // Submit the code
        const verifyBtn = page.locator(
          "button:has-text('Verify'), button:has-text('Confirm'), button:has-text('Submit'), button[type='submit']"
        ).first();
        if (await verifyBtn.isVisible().catch(() => false)) {
          await humanClick(page, verifyBtn);
        } else {
          await page.keyboard.press("Enter");
        }
        await page.waitForTimeout(5000);
      } else {
        console.warn("⚠️ [WellfoundSignup]: Could not retrieve verification code from Gmail.");
      }
    } else {
      // Link-based verification — fetch from email and navigate
      console.log("🔗 [WellfoundSignup]: No OTP field found. Checking for verification link in email...");
      const verificationLink = await fetchWellfoundVerificationLink(90000, 5000, creds.email, (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""));
      if (verificationLink) {
        console.log(`✅ [WellfoundSignup]: Found verification link! Navigating to: ${verificationLink}`);
        await page.goto(verificationLink, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(5000);
      } else {
        console.warn("⚠️ [WellfoundSignup]: Could not retrieve verification link from Gmail.");
        // Try clicking a resend button if available
        const resendBtn = page.locator(
          "button:has-text('Resend'), a:has-text('Resend'), button:has-text('Send again'), a:has-text('Send again')"
        ).first();
        if (await resendBtn.isVisible().catch(() => false)) {
          console.log("🔄 [WellfoundSignup]: Clicking resend verification...");
          await humanClick(page, resendBtn);
          await page.waitForTimeout(10000);
          
          // Retry fetching
          const retryLink = await fetchWellfoundVerificationLink(60000, 5000, creds.email, (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""));
          if (retryLink) {
            console.log(`✅ [WellfoundSignup]: Found verification link on retry: ${retryLink}`);
            await page.goto(retryLink, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
            await page.waitForTimeout(5000);
          }
        }
      }
    }
  }

  await page.screenshot({ path: "scratch/wellfound_after_verification.png" }).catch(() => {});

  // Step 7: Handle onboarding wizard if present
  console.log("\n🧙 [WellfoundSignup]: Checking for onboarding wizard...");
  await handleOnboardingWizard(page, profile);

  // Step 8: Check if we're now logged in
  const isNowLoggedIn = await isWellfoundLoggedIn(page);
  if (isNowLoggedIn) {
    console.log(`✅ [WellfoundSignup]: Successfully created and logged into Wellfound account!`);
    await updateHUDStatus(page, "Account Created Successfully!", `Logged in as ${creds.email}`, "success", 50);
    return true;
  }

  // Sometimes the page needs more time or another redirect
  await page.waitForTimeout(3000);
  const retryLogin = await isWellfoundLoggedIn(page);
  if (retryLogin) {
    console.log(`✅ [WellfoundSignup]: Account active after redirect!`);
    return true;
  }

  console.log("ℹ️ [WellfoundSignup]: Signup flow completed. Attempting login with new credentials...");
  // Try to login with the new credentials
  return await attemptWellfoundLogin(page, creds, profile);
}

/**
 * Handles the Wellfound post-signup onboarding wizard.
 * Fills in role, experience, location, skills, preferences, etc.
 */
async function handleOnboardingWizard(
  page: Page,
  profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE
): Promise<void> {
  const pageUrl = page.url();
  const pageText = await page.locator("body").innerText().catch(() => "");

  const isOnboarding = pageUrl.includes("/onboarding") ||
    pageUrl.includes("/getting-started") ||
    pageUrl.includes("/setup") ||
    pageText.toLowerCase().includes("what are you looking for") ||
    pageText.toLowerCase().includes("tell us about yourself") ||
    pageText.toLowerCase().includes("primary role") ||
    pageText.toLowerCase().includes("years of experience");

  if (!isOnboarding) {
    console.log("ℹ️ [WellfoundOnboarding]: No onboarding wizard detected. Skipping.");
    return;
  }

  console.log("🧙 [WellfoundOnboarding]: Onboarding wizard detected! Filling preferences...");
  await updateHUDStatus(page, "Completing Onboarding", "Filling profile preferences...", "info", 45);

  // Handle multiple steps/pages of the wizard
  for (let wizardStep = 0; wizardStep < 8; wizardStep++) {
    await page.waitForTimeout(2000);
    await dismissCommonPopups(page);

    // Fill role/title fields
    const roleInput = page.locator(
      "input[name*='role' i], input[name*='title' i], input[placeholder*='role' i], " +
      "input[placeholder*='title' i], input[aria-label*='role' i]"
    ).first();
    if (await roleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const curVal = await roleInput.inputValue().catch(() => "");
      if (!curVal) {
        await typeLikeHuman(page, roleInput, "Full Stack AI Developer");
        await page.waitForTimeout(800);
        // Select autocomplete suggestion if shown
        const suggestion = page.locator("[role='option'], [class*='suggestion'], [class*='autocomplete'] li, [class*='dropdown'] li").first();
        if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
          await suggestion.click().catch(() => {});
          await page.waitForTimeout(500);
        }
      }
    }

    // Fill years of experience
    const expSelect = page.locator("select[name*='experience' i], select[name*='years' i]").first();
    if (await expSelect.isVisible({ timeout: 1500 }).catch(() => false)) {
      await expSelect.selectOption({ index: 2 }).catch(() => {});
    }

    // Fill location
    const locationInput = page.locator(
      "input[name*='location' i], input[placeholder*='location' i], input[aria-label*='location' i], " +
      "input[placeholder*='city' i]"
    ).first();
    if (await locationInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      const curVal = await locationInput.inputValue().catch(() => "");
      if (!curVal) {
        await typeLikeHuman(page, locationInput, profile.location || "San Francisco, CA");
        await page.waitForTimeout(1000);
        const suggestion = page.locator("[role='option'], [class*='suggestion'] li, [class*='autocomplete'] li").first();
        if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
          await suggestion.click().catch(() => {});
        }
      }
    }

    // Fill skills
    const skillsInput = page.locator(
      "input[name*='skill' i], input[placeholder*='skill' i], input[aria-label*='skill' i], " +
      "input[placeholder*='technology' i], input[placeholder*='tech' i]"
    ).first();
    if (await skillsInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      const topSkills = ["Python", "React", "FastAPI", "Docker", "OpenAI"];
      for (const skill of topSkills) {
        await skillsInput.clear().catch(() => {});
        await typeLikeHuman(page, skillsInput, skill);
        await page.waitForTimeout(800);
        const suggestion = page.locator("[role='option'], [class*='suggestion'] li, [class*='dropdown'] li").first();
        if (await suggestion.isVisible({ timeout: 1500 }).catch(() => false)) {
          await suggestion.click().catch(() => {});
          await page.waitForTimeout(300);
        } else {
          await page.keyboard.press("Enter");
          await page.waitForTimeout(300);
        }
      }
    }

    // Fill salary expectation
    const salaryInput = page.locator(
      "input[name*='salary' i], input[placeholder*='salary' i], input[name*='compensation' i]"
    ).first();
    if (await salaryInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      const curVal = await salaryInput.inputValue().catch(() => "");
      if (!curVal) {
        await typeLikeHuman(page, salaryInput, "95000");
      }
    }

    // Check "open to remote" or similar checkboxes
    const remoteCheckbox = page.locator(
      "input[type='checkbox'][name*='remote' i], label:has-text('Remote') input[type='checkbox'], " +
      "label:has-text('Open to remote') input[type='checkbox']"
    ).first();
    if (await remoteCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isChecked = await remoteCheckbox.isChecked().catch(() => false);
      if (!isChecked) {
        await remoteCheckbox.check({ force: true }).catch(() => {});
      }
    }

    // Handle radio buttons for job type preferences (Full-time, Part-time)
    const fullTimeRadio = page.locator(
      "input[type='radio'][value*='full' i], label:has-text('Full-time') input[type='radio'], " +
      "input[type='checkbox'][name*='full_time' i]"
    ).first();
    if (await fullTimeRadio.isVisible({ timeout: 1000 }).catch(() => false)) {
      const isChecked = await fullTimeRadio.isChecked().catch(() => false);
      if (!isChecked) {
        await fullTimeRadio.check({ force: true }).catch(() => {});
      }
    }

    // Resume upload if available
    const fileInput = page.locator("input[type='file']").first();
    if (await fileInput.isVisible().catch(() => false) || (await fileInput.count().catch(() => 0)) > 0) {
      const resumePath = resolveLocalResumePath(profile.resumePath || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
      if (resumePath) {
        console.log(`📄 [WellfoundOnboarding]: Uploading resume: ${resumePath}`);
        await fileInput.setInputFiles(resumePath).catch((err) => {
          console.warn("⚠️ Resume upload notice:", err.message);
        });
        await page.waitForTimeout(2000);
      }
    }

    // Click Next/Continue/Skip/Save button to advance wizard
    const nextBtn = page.locator(
      "button:has-text('Next'), button:has-text('Continue'), button:has-text('Save'), " +
      "button:has-text('Done'), button:has-text('Finish'), button:has-text('Get started'), " +
      "button:has-text('Skip'), a:has-text('Skip'), button[type='submit']"
    ).first();

    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const btnText = await nextBtn.innerText().catch(() => "Next");
      console.log(`👉 [WellfoundOnboarding]: Clicking '${btnText.trim()}' button (step ${wizardStep + 1})...`);
      await humanClick(page, nextBtn);
      await page.waitForTimeout(3000);
    } else {
      console.log("ℹ️ [WellfoundOnboarding]: No more wizard steps detected.");
      break;
    }

    // Check if wizard completed (redirected to dashboard/jobs)
    const currentUrl = page.url();
    if (
      currentUrl.includes("/jobs") ||
      currentUrl.includes("/discover") ||
      currentUrl.includes("/dashboard") ||
      currentUrl.includes("/feed")
    ) {
      console.log("✅ [WellfoundOnboarding]: Onboarding completed! Redirected to main page.");
      break;
    }
  }

  await page.screenshot({ path: "scratch/wellfound_onboarding_completed.png" }).catch(() => {});
}

/**
 * Synchronizes the candidate's complete profile on Wellfound, ensuring EVERY field
 * and ALL links (LinkedIn, GitHub, Twitter/X, Portfolio, Personal Website) are filled in.
 */
export async function syncWellfoundProfile(
  page: Page,
  profile: UserProfile = DEFAULT_HRUTIN_WELLFOUND_PROFILE
): Promise<boolean> {
  console.log("===============================================================================");
  console.log("🌐 SYNCING WELLFOUND PROFILE & ALL SOCIAL/PORTFOLIO LINKS");
  console.log(`👤 Candidate: ${profile.firstName} ${profile.lastName} (${profile.email})`);
  console.log("===============================================================================\n");

  await injectVisualHUD(page);
  await updateHUDStatus(page, "Syncing Wellfound Profile...", "Filling all fields and social links", "info", 45);

  const editProfileUrl = "https://wellfound.com/profile/edit";
  if (!page.url().includes("/profile")) {
    console.log(`👉 [WellfoundProfile]: Navigating to ${editProfileUrl}...`);
    await page.goto(editProfileUrl, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  await dismissCommonPopups(page);

  // 1. FILL NAMES & BASIC DETAILS
  console.log("📝 [WellfoundProfile]: Checking and filling basic details...");
  const firstNameInput = page.locator("input[name*='first_name' i], input[name='user[first_name]'], input[placeholder*='first name' i]").first();
  if (await firstNameInput.isVisible().catch(() => false)) {
    const curVal = await firstNameInput.inputValue().catch(() => "");
    if (!curVal || curVal.trim().length === 0) {
      await typeLikeHuman(page, firstNameInput, profile.firstName);
    }
  }

  const lastNameInput = page.locator("input[name*='last_name' i], input[name='user[last_name]'], input[placeholder*='last name' i]").first();
  if (await lastNameInput.isVisible().catch(() => false)) {
    const curVal = await lastNameInput.inputValue().catch(() => "");
    if (!curVal || curVal.trim().length === 0) {
      await typeLikeHuman(page, lastNameInput, profile.lastName);
    }
  }

  // 2. FILL LOCATION
  const locationInput = page.locator("input[name*='location' i], input[placeholder*='location' i], input[aria-label*='location' i]").first();
  if (await locationInput.isVisible().catch(() => false)) {
    const curVal = await locationInput.inputValue().catch(() => "");
    if (!curVal) {
      await typeLikeHuman(page, locationInput, profile.location || "San Francisco, CA, United States");
      await page.waitForTimeout(600);
      // Select first autocomplete dropdown suggestion if shown
      const autoOption = page.locator("[role='option'], [class*='suggestion'], [class*='autocomplete'] li").first();
      if (await autoOption.isVisible().catch(() => false)) {
        await autoOption.click().catch(() => {});
      }
    }
  }

  // 3. FILL PRIMARY ROLE / CURRENT TITLE
  const roleInput = page.locator("input[name*='primary_role' i], input[name*='title' i], input[placeholder*='role' i], input[placeholder*='title' i]").first();
  if (await roleInput.isVisible().catch(() => false)) {
    const curVal = await roleInput.inputValue().catch(() => "");
    if (!curVal) {
      await typeLikeHuman(page, roleInput, "Full Stack AI Developer");
    }
  }

  // 4. FILL ELEVATOR PITCH / BIO SUMMARY
  const bioInput = page.locator("textarea[name*='bio' i], textarea[name*='summary' i], textarea[placeholder*='bio' i], textarea[placeholder*='pitch' i]").first();
  if (await bioInput.isVisible().catch(() => false)) {
    const curVal = await bioInput.inputValue().catch(() => "");
    if (!curVal || curVal.length < 20) {
      console.log("✍️ [WellfoundProfile]: Filling Bio/Pitch summary...");
      await typeLikeHuman(page, bioInput, DEFAULT_HRUTIN_WELLFOUND_PITCH);
    }
  }

  // =========================================================================
  // 5. FILL ALL SOCIAL & PORTFOLIO LINKS (EXPLICIT USER REQUIREMENT)
  // =========================================================================
  console.log("🔗 [WellfoundProfile]: Filling ALL Links for Hrutin Nammi...");
  await updateHUDStatus(page, "Filling Social & Portfolio Links", "LinkedIn, GitHub, Twitter/X, Portfolio", "info", 55);

  const links = {
    linkedin: profile.linkedinUrl || DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
    github: profile.githubUrl || DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
    twitter: DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
    portfolio: profile.portfolioUrl || DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio,
    website: DEFAULT_HRUTIN_WELLFOUND_LINKS.website
  };

  // A. LinkedIn URL
  const linkedinInput = page.locator(
    "input[name*='linkedin' i], input[id*='linkedin' i], input[placeholder*='linkedin.com' i], input[aria-label*='linkedin' i]"
  ).first();
  if (await linkedinInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`🔗 [WellfoundProfile]: Filling LinkedIn -> ${links.linkedin}`);
    await typeLikeHuman(page, linkedinInput, links.linkedin);
  }

  // B. GitHub URL
  const githubInput = page.locator(
    "input[name*='github' i], input[id*='github' i], input[placeholder*='github.com' i], input[aria-label*='github' i]"
  ).first();
  if (await githubInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`🔗 [WellfoundProfile]: Filling GitHub -> ${links.github}`);
    await typeLikeHuman(page, githubInput, links.github);
  }

  // C. Twitter / X URL
  const twitterInput = page.locator(
    "input[name*='twitter' i], input[name*='x_url' i], input[id*='twitter' i], input[placeholder*='twitter.com' i], input[placeholder*='x.com' i], input[aria-label*='twitter' i]"
  ).first();
  if (await twitterInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`🔗 [WellfoundProfile]: Filling Twitter/X -> ${links.twitter}`);
    await typeLikeHuman(page, twitterInput, links.twitter);
  }

  // D. Portfolio / Personal Website URL
  const portfolioInput = page.locator(
    "input[name*='portfolio' i], input[name*='website' i], input[id*='portfolio' i], input[placeholder*='portfolio' i], input[placeholder*='personal website' i], input[aria-label*='portfolio' i]"
  ).first();
  if (await portfolioInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`🔗 [WellfoundProfile]: Filling Portfolio/Website -> ${links.portfolio}`);
    await typeLikeHuman(page, portfolioInput, links.portfolio);
  }

  // E. Generic Link or Blog inputs if any exist
  const genericLinkInputs = page.locator("input[placeholder*='http' i], input[name*='url' i], input[placeholder*='blog' i]");
  const count = await genericLinkInputs.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const inp = genericLinkInputs.nth(i);
    const val = await inp.inputValue().catch(() => "");
    if (!val) {
      await typeLikeHuman(page, inp, links.portfolio).catch(() => {});
    }
  }

  // 6. UPLOAD RESUME PDF IF REQUESTED / EMPTY
  const resumeInput = page.locator("input[type='file'][accept*='pdf' i], input[type='file']").first();
  if (await resumeInput.isVisible().catch(() => false) || (await resumeInput.count().catch(() => 0)) > 0) {
    const resolvedPath = resolveLocalResumePath(profile.resumePath || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    if (resolvedPath) {
      console.log(`📄 [WellfoundProfile]: Uploading resume: ${resolvedPath}...`);
      await resumeInput.setInputFiles(resolvedPath).catch((err) => {
        console.warn("⚠️ Resume upload warning:", err.message);
      });
      await page.waitForTimeout(1500);
    }
  }

  // 7. SAVE PROFILE CHANGES
  const saveBtn = page.locator(
    "button:has-text('Save changes'), button:has-text('Save'), button:has-text('Update profile'), input[type='submit'][value*='Save' i]"
  ).first();

  if (await saveBtn.isVisible().catch(() => false)) {
    console.log("💾 [WellfoundProfile]: Clicking Save changes button...");
    await humanClick(page, saveBtn);
    await page.waitForTimeout(3000);
    console.log("✅ [WellfoundProfile]: Profile details and all links successfully saved!");
  }

  // 8. UPDATE VISA & WORK AUTHORIZATION PREFERENCES
  console.log("🌐 [WellfoundProfile]: Enforcing Visa Sponsorship = No & US Authorized = Yes in preferences...");
  await page.goto("https://wellfound.com/profile/edit/preferences", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const noSponsorshipRadio = page.locator("#form-input--requireSponsorship--false").first();
  if (await noSponsorshipRadio.isVisible().catch(() => false)) {
    await noSponsorshipRadio.check({ force: true }).catch(() => {});
  }
  const usAuthorizedRadio = page.locator("#form-input--usAuthorized--true").first();
  if (await usAuthorizedRadio.isVisible().catch(() => false)) {
    await usAuthorizedRadio.check({ force: true }).catch(() => {});
  }
  const savePrefBtn = page.locator("button:has-text('Save'), button:has-text('Save changes')").first();
  if (await savePrefBtn.isVisible().catch(() => false)) {
    await humanClick(page, savePrefBtn).catch(() => {});
    await page.waitForTimeout(2000);
    console.log("✅ [WellfoundProfile]: Work authorization & visa sponsorship preferences updated!");
  }

  await updateHUDStatus(page, "Profile & Links Synchronized", "All fields successfully updated", "success", 60);
  return true;

  console.log("ℹ️ [WellfoundProfile]: Profile inspection completed.");
  return true;
}
