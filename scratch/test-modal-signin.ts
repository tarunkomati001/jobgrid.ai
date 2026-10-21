import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  // Click Autofill with Resume
  const autofill = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  await autofill.click();
  await page.waitForTimeout(4000);

  // Click Sign In link
  const signIn = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  await signIn.click();
  await page.waitForTimeout(3000);

  // Find the TOPMOST modal/dialog container
  console.log("Inspecting modal container...");
  const modalInfo = await page.evaluate(() => {
    // Look for dialog, popup, or topmost container
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'], [data-behavior-click-outside-close='topmost'], div[class*='css-']"));
    const topmost = dialogs.find(d => {
      const h = d.querySelector("h2, h3, div");
      return (d as HTMLElement).offsetParent !== null && d.textContent?.includes("Sign In") && d.querySelector("input");
    });

    if (topmost) {
      const inputs = Array.from(topmost.querySelectorAll("input")).map(i => ({
        id: i.id,
        autoId: i.getAttribute("data-automation-id"),
        type: i.type,
        placeholder: i.placeholder,
        label: i.getAttribute("aria-label")
      }));
      const btns = Array.from(topmost.querySelectorAll("button, div[role='button']")).map(b => ({
        id: b.getAttribute("data-automation-id"),
        text: (b as HTMLElement).innerText?.trim()
      }));
      return { found: true, inputs, btns, selector: topmost.className };
    }
    return { found: false };
  });

  console.log("Modal Info:", JSON.stringify(modalInfo, null, 2));

  // The modal inputs: the topmost dialog or the last input[data-automation-id='email'] / input[data-automation-id='password']
  const emailInputs = page.locator("input[data-automation-id='email'], input[data-automation-id='userName']");
  const emailCount = await emailInputs.count();
  console.log(`Total email inputs found: ${emailCount}`);
  // Target the LAST one which is in the topmost modal
  const activeEmailInp = emailInputs.last();
  await activeEmailInp.fill("tarunkomati2@gmail.com");

  const pwInputs = page.locator("input[data-automation-id='password']");
  const pwCount = await pwInputs.count();
  console.log(`Total password inputs found: ${pwCount}`);
  const activePwInp = pwInputs.last();
  await activePwInp.fill("Tarun@143");

  await page.screenshot({ path: "scratch/modal_filled_tarun.png" });

  // Submit button in the active modal
  const submitBtns = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton'], button:has-text('Sign In')");
  console.log("Submit buttons count:", await submitBtns.count());
  const activeSubmitBtn = submitBtns.last();
  await activeSubmitBtn.click({ force: true });
  await activePwInp.press("Enter").catch(() => {});

  console.log("Waiting 10s for response...");
  await page.waitForTimeout(10000);

  await page.screenshot({ path: "scratch/modal_after_submit.png" });

  const result = await page.evaluate(() => {
    const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']")?.textContent?.trim() || "";
    const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
    const bodySnippet = document.body?.innerText?.slice(0, 500) || "";
    return { url: window.location.href, err, activeStep, bodySnippet };
  });

  console.log("Result after submit:", JSON.stringify(result, null, 2));

  await browser.close();
}

run().catch(console.error);
