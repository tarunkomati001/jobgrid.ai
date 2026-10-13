import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Apply -> Autofill with resume
  await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first().click({ force: true });
  console.log("Waiting 6s for auth form...");
  await page.waitForTimeout(6000);

  // Click Sign In tab
  const signInBtn = page.locator("button[data-automation-id='signInLink']").first();
  if (await signInBtn.isVisible().catch(() => false)) {
    console.log("Clicking Sign In link...");
    await signInBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Type Email and Password
  await page.locator("input[data-automation-id='email']").first().fill("babufakemail@gmail.com");
  await page.locator("input[data-automation-id='password']").first().fill("Tarun@143");

  console.log("Clicking Sign In submit button...");
  await page.locator("button[data-automation-id='signInSubmitButton']").first().click({ force: true });

  console.log("Watching screen state for 12 seconds...");
  for (let i = 1; i <= 12; i++) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const step = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
      const text = document.body?.innerText?.slice(0, 150) || "";
      const hasPw = !!document.querySelector("input[data-automation-id='password']");
      const hasUpload = !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
      const hasCandHome = !!document.querySelector("[data-automation-id='navigationItem-Candidate Home']");
      const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner']")?.textContent || "";
      return { step, hasPw, hasUpload, hasCandHome, err, text };
    });
    console.log(`[T+${i}s] hasCandHome: ${info.hasCandHome} | hasPw: ${info.hasPw} | hasUpload: ${info.hasUpload} | step: "${info.step}" | err: "${info.err}"`);
  }

  await browser.close();
}

main().catch(console.error);
