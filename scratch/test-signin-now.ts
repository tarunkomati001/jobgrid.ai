import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Apply -> Autofill with resume
  await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first().click({ force: true });
  console.log("Waiting for loading page to clear...");
  await page.waitForTimeout(8000);

  // Switch to Sign In
  const signInBtn = page.locator("button[data-automation-id='signInLink']").first();
  if (await signInBtn.isVisible().catch(() => false)) {
    console.log("Clicking Sign In tab link...");
    await signInBtn.click({ force: true });
    await page.waitForTimeout(3000);
  }

  // Type Email and Password
  const emailInp = page.locator("input[data-automation-id='email']").first();
  await emailInp.click();
  await emailInp.fill("babufakemail@gmail.com");

  const pwInp = page.locator("input[data-automation-id='password']").first();
  await pwInp.click();
  await pwInp.fill("Tarun@143");

  await page.waitForTimeout(1000);

  // Click Sign In button
  console.log("Submitting Sign In form...");
  const submitBtn = page.locator("button[data-automation-id='signInSubmitButton']").first();
  await submitBtn.click({ force: true });

  // Also press Enter on password field
  await pwInp.press("Enter").catch(() => {});

  console.log("Submitted! Watching for page transition for 15 seconds...");
  for (let s = 1; s <= 15; s++) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
      const header = document.querySelector("h2[data-automation-id='pageHeader'], h2, h3")?.textContent || "";
      const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner']")?.textContent || "";
      const hasPw = !!document.querySelector("input[data-automation-id='password']");
      const hasUpload = !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
      const nextBtn = document.querySelector("button[data-automation-id='pageFooterNextButton'], button[data-automation-id='bottom-navigation-next-button']")?.textContent || "";
      return { activeStep, header, err, hasPw, hasUpload, nextBtn, url: window.location.href };
    });
    console.log(`[T+${s}s] hasPw: ${info.hasPw} | hasUpload: ${info.hasUpload} | nextBtn: "${info.nextBtn}" | step: "${info.activeStep}" | header: "${info.header.slice(0, 30)}" | err: "${info.err}"`);
    if (info.hasUpload || info.nextBtn || !info.hasPw) {
      console.log("SUCCESS! Transistioned to wizard screen!");
      break;
    }
  }

  await browser.close();
}

main().catch(console.error);
