import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1";
  console.log("1. Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Apply
  console.log("2. Clicking Apply...");
  await page.click("a[data-automation-id='adventureButton']");
  await page.waitForTimeout(3000);

  // Click Autofill with Resume
  console.log("3. Clicking Autofill with Resume...");
  await page.click("a[data-automation-id='autofillWithResume']");
  await page.waitForTimeout(3000);

  // Click Sign In
  console.log("4. Switching to Sign In...");
  const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  await signInLink.click();
  await page.waitForTimeout(3000);

  await page.screenshot({ path: "scratch/debug_alcon_signin_screen.png" });

  // Dump all visible inputs
  const allInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({
      id: i.id,
      autoId: i.getAttribute("data-automation-id"),
      type: i.type,
      name: i.name,
      value: i.value,
      visible: (i as HTMLElement).offsetParent !== null,
      parentDialog: !!i.closest("[role='dialog']")
    }));
  });
  console.log("All inputs found:\n", JSON.stringify(allInputs, null, 2));

  // Fill tarunkomati2@gmail.com and Tarun@143
  console.log("5. Filling tarunkomati2@gmail.com and Tarun@143...");
  const emailInp = page.locator("div[role='dialog'] input[data-automation-id='email'], div[role='dialog'] input[data-automation-id='userName'], input[data-automation-id='userName'], input[data-automation-id='email']").last();
  const pwInp = page.locator("div[role='dialog'] input[data-automation-id='password'], input[data-automation-id='password']").last();

  await emailInp.fill("tarunkomati2@gmail.com");
  await pwInp.fill("Tarun@143");

  const inputsAfterFill = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({
      id: i.id,
      autoId: i.getAttribute("data-automation-id"),
      value: i.type === "password" ? "***" : i.value
    }));
  });
  console.log("Inputs after fill:\n", JSON.stringify(inputsAfterFill, null, 2));

  await page.screenshot({ path: "scratch/debug_alcon_filled.png" });

  console.log("6. Clicking Sign In submit...");
  const submitBtn = page.locator("div[role='dialog'] button[data-automation-id='signInSubmitButton'], div[role='dialog'] div[data-automation-id='click_filter'][aria-label*='Sign In'], button[data-automation-id='signInSubmitButton'], [data-automation-id='click_filter'][aria-label*='Sign In']").last();
  await submitBtn.click({ force: true });
  await pwInp.press("Enter").catch(() => {});

  console.log("7. Waiting 10s for response...");
  await page.waitForTimeout(10000);

  await page.screenshot({ path: "scratch/debug_alcon_after_submit.png" });

  const status = await page.evaluate(() => {
    const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']")?.textContent?.trim() || "";
    const header = document.querySelector("h2, h1")?.textContent?.trim() || "";
    const step = document.querySelector("[data-automation-id='progressBarActiveStep'], .activeStep, [aria-current='step']")?.textContent?.trim() || "";
    const body = document.body?.innerText?.slice(0, 500) || "";
    return { url: window.location.href, err, header, step, body };
  });

  console.log("Status after submit:\n", JSON.stringify(status, null, 2));

  await browser.close();
}

main().catch(console.error);
