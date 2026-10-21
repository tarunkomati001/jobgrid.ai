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
  console.log("Waiting 6s...");
  await page.waitForTimeout(6000);

  // Check if candidate home is already in navbar
  const isCandidateHome = await page.evaluate(() => {
    return !!document.querySelector("[data-automation-id='navigationItem-Candidate Home'], [data-automation-id='utilityButtonBarSettingsMenu'], [data-automation-id='utilityButtonAccountTasksMenu']");
  });
  console.log("Candidate already logged in?", isCandidateHome);

  if (!isCandidateHome) {
    // Switch to Sign In and log in
    const signInBtn = page.locator("button[data-automation-id='signInLink']").first();
    if (await signInBtn.isVisible().catch(() => false)) {
      await signInBtn.click({ force: true });
      await page.waitForTimeout(2000);
    }
    await page.locator("input[data-automation-id='email']").first().fill("babufakemail@gmail.com");
    await page.locator("input[data-automation-id='password']").first().fill("Tarun@143");
    await page.locator("button[data-automation-id='signInSubmitButton']").first().click({ force: true });
    await page.waitForTimeout(4000);
  }

  // Now inspect what is on screen
  const state1 = await page.evaluate(() => {
    const url = window.location.href;
    const step = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
    const hasCandidateHome = !!document.querySelector("[data-automation-id='navigationItem-Candidate Home']");
    const hasUpload = !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
    const buttons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => (b.textContent || "").trim()).filter(Boolean);
    return { url, step, hasCandidateHome, hasUpload, buttons };
  });
  console.log("State after login:", JSON.stringify(state1, null, 2));

  // If still on auth screen but hasCandidateHome is true, what happens if we reload or re-click Apply?
  if (state1.hasCandidateHome && !state1.hasUpload) {
    console.log("Candidate is logged in in navbar! Reloading page...");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    const state2 = await page.evaluate(() => {
      const url = window.location.href;
      const step = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
      const hasUpload = !!document.querySelector("input[type='file'], [data-automation-id='file-upload-drop-zone']");
      const buttons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => (b.textContent || "").trim()).filter(Boolean);
      return { url, step, hasUpload, buttons };
    });
    console.log("State after reload:", JSON.stringify(state2, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
