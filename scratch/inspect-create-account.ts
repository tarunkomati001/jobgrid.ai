import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) {
      console.log(">>> MAIN FRAME NAVIGATED TO:", frame.url());
    }
  });

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Apply -> Autofill
  await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first().click({ force: true });
  console.log("Waiting 8s for auth screen...");
  await page.waitForTimeout(8000);

  // Create account with a fresh alias
  const aliasEmail = `babufakemail+alcon${Date.now()}@gmail.com`;
  console.log("Creating new account with alias:", aliasEmail);

  await page.locator("input[data-automation-id='email']").first().fill(aliasEmail);
  await page.locator("input[data-automation-id='password']").first().fill("Tarun@143");
  await page.locator("input[data-automation-id='verifyPassword']").first().fill("Tarun@143");

  const submitBtn = page.locator("button[data-automation-id='createAccountSubmitButton']").first();
  await submitBtn.click({ force: true });

  console.log("Clicked Create Account button, waiting 10s for redirect to settle...");
  await page.waitForTimeout(10000);

  console.log("Current URL after create account:", page.url());

  // If on /login page, sign in with the new credentials!
  if (page.url().includes("/login")) {
    console.log("On dedicated /login page! Signing in with alias credentials...");
    const emailInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName'], input[type='email']").first();
    await emailInp.fill(aliasEmail);

    const pwInp = page.locator("input[data-automation-id='password'], input[name='password']").first();
    await pwInp.fill("Tarun@143");

    const signInBtn = page.locator("button[data-automation-id='signInSubmitButton']").first();
    await signInBtn.click({ force: true });

    console.log("Submitted sign in! Waiting 10s for redirect to job application...");
    await page.waitForTimeout(10000);

    console.log("URL after signing in on /login:", page.url());
    const finalState = await page.evaluate(() => {
      const step = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
      const hasUpload = !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
      const nextBtn = document.querySelector("button[data-automation-id='bottom-navigation-next-button'], button:has-text('Continue')")?.textContent || "";
      return { step, hasUpload, nextBtn };
    });
    console.log("Application Wizard state:", JSON.stringify(finalState, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
