import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  // Test URL: Alcon or Clario
  const testUrl = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  console.log("Navigating to:", testUrl);
  await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // 1. Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // 2. Check direct Sign In button on header or click Apply
  console.log("Clicking Apply button...");
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }

  // 3. Select Autofill with Resume or Apply Manually
  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  if (await autofillOption.count() > 0 && await autofillOption.isVisible()) {
    console.log("Clicking Autofill with Resume...");
    await autofillOption.click();
    await page.waitForTimeout(3000);
  }

  // 4. Wait for auth modal / screen
  await page.waitForSelector(
    "button[data-automation-id='signInLink'], input[data-automation-id='userName'], input[data-automation-id='email'], input[data-automation-id='verifyPassword']",
    { timeout: 25000 }
  );

  // 5. Directly click Sign In link / tab
  console.log("Directly switching to Sign In / Login...");
  const signInLink = page.locator(
    "button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], div[data-automation-id='click_filter'][aria-label='Sign In'], button:has-text('Sign In'), a:has-text('Sign In')"
  ).first();

  if (await signInLink.count() > 0 && await signInLink.isVisible()) {
    console.log("Found Sign In link, clicking...");
    await signInLink.click({ force: true });
    await page.waitForTimeout(2000);
  } else {
    console.log("No separate signInLink found; checking if already on Sign In screen...");
  }

  await page.screenshot({ path: "scratch/tarun_signin_screen.png", fullPage: true });

  // 6. Enter credentials
  console.log("Entering credentials: tarunkomati2@gmail.com / Tarun@143 ...");
  const emailInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
  const pwInp = page.locator("input[data-automation-id='password'], input[name='password']").first();

  await emailInp.waitFor({ state: "visible", timeout: 10000 });
  await emailInp.fill("tarunkomati2@gmail.com");
  await pwInp.fill("Tarun@143");

  await page.screenshot({ path: "scratch/tarun_filled_signin.png", fullPage: true });

  // 7. Click Sign In submit
  console.log("Submitting Sign In...");
  const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton'], button:has-text('Sign In')").first();
  if (await submitBtn.count() > 0) {
    await submitBtn.click({ force: true });
  }
  await pwInp.press("Enter").catch(() => {});

  console.log("Waiting 8 seconds for response...");
  await page.waitForTimeout(8000);

  await page.screenshot({ path: "scratch/tarun_after_signin.png", fullPage: true });
  console.log("Current URL:", page.url());

  const pageStatus = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']")?.textContent?.trim() || "";
    const fileInp = !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
    const nextBtn = !!document.querySelector("[data-automation-id='bottom-navigation-next-button']");
    const stepText = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
    return { textSnippet: text.slice(0, 400), error: err, fileInputPresent: fileInp, nextBtnPresent: nextBtn, step: stepText };
  });

  console.log("Page Status:", JSON.stringify(pageStatus, null, 2));

  await browser.close();
}

main().catch(console.error);
