import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Cookie
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  console.log("Apply visible:", await applyBtn.isVisible());
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Take screenshot of options
  await page.screenshot({ path: "scratch/apply_options_clario.png" });

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, [role='button']")).map(el => ({
      tag: el.tagName,
      id: el.getAttribute("data-automation-id"),
      text: (el as HTMLElement).innerText?.trim()
    })).filter(x => x.text || x.id);
  });
  console.log("Visible buttons/links:", JSON.stringify(buttons.slice(0, 15), null, 2));

  // Click autofill if present
  const autofill = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill')").first();
  if (await autofill.count() > 0 && await autofill.isVisible()) {
    console.log("Clicking Autofill with Resume...");
    await autofill.click();
    await page.waitForTimeout(4000);
  }

  await page.screenshot({ path: "scratch/after_autofill_click.png" });

  const authOptions = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, a, button, div[role='button']")).map(el => ({
      tag: el.tagName,
      id: el.getAttribute("data-automation-id"),
      ariaLabel: el.getAttribute("aria-label"),
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 40)
    })).filter(x => x.id || x.ariaLabel);
  });
  console.log("Auth elements:", JSON.stringify(authOptions, null, 2));

  // Check if signInLink is present and click it
  const signIn = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], div[data-automation-id='click_filter'][aria-label='Sign In'], button:has-text('Sign In'), a:has-text('Sign In')").first();
  if (await signIn.count() > 0 && await signIn.isVisible()) {
    console.log("Clicking Sign In...");
    await signIn.click();
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: "scratch/ready_for_creds.png" });

  const credInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({
      id: i.id,
      name: i.name,
      autoId: i.getAttribute("data-automation-id"),
      type: i.type,
      visible: (i as HTMLElement).offsetParent !== null
    }));
  });
  console.log("Inputs ready for creds:", JSON.stringify(credInputs, null, 2));

  // Fill tarunkomati2@gmail.com and Tarun@143
  const emailInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
  const pwInp = page.locator("input[data-automation-id='password'], input[name='password']").first();
  console.log("Filling tarunkomati2@gmail.com and Tarun@143...");
  await emailInp.fill("tarunkomati2@gmail.com");
  await pwInp.fill("Tarun@143");

  // Click Sign In
  const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton'], button:has-text('Sign In')").first();
  console.log("Submitting Sign In...");
  await submitBtn.click();
  await pwInp.press("Enter").catch(() => {});

  await page.waitForTimeout(7000);
  await page.screenshot({ path: "scratch/after_tarun_signin.png" });

  const postStatus = await page.evaluate(() => {
    const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']")?.textContent?.trim() || "";
    const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
    const header = document.querySelector("h2, h1")?.textContent?.trim() || "";
    return { url: window.location.href, err, activeStep, header };
  });

  console.log("Post Sign In Status:", JSON.stringify(postStatus, null, 2));

  await browser.close();
}

run().catch(console.error);
