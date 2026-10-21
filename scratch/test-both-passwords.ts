import { chromium } from "playwright";

async function testBothPasswords() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });
  await p.waitForTimeout(3000);

  // Switch to sign in
  const signInLink = p.locator("[data-automation-id='signInLink'], a:has-text('Sign In'), button:has-text('Sign In')").filter({ hasText: /Sign In/i }).first();
  if (await signInLink.count() > 0) {
    await signInLink.click();
    await p.waitForTimeout(2000);
  }

  // 1. Try Tarun@143
  console.log("=== Trying Tarun@143 ===");
  await p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first().fill("babufakemail@gmail.com");
  await p.locator("input[data-automation-id='password']").first().fill("Tarun@143");

  const submitBtn = p.locator("button[data-automation-id='signInSubmitButton']").first();
  await submitBtn.click({ force: true });
  await p.waitForTimeout(5000);

  let errText = await p.evaluate(() => {
    const err = document.querySelector("[data-automation-id='errorMessage'], [class*='error'], [role='alert'], [data-automation-id='error-message']");
    return err?.textContent || "";
  });
  console.log("Error with Tarun@143:", errText || "NONE FOUND");
  console.log("URL after Tarun@143:", p.url());

  // 2. If still on login, try ClucoAi@2026!Secure
  if (p.url().includes("/apply/autofillWithResume") && (await submitBtn.count() > 0)) {
    console.log("\n=== Trying ClucoAi@2026!Secure ===");
    await p.locator("input[data-automation-id='password']").first().fill("ClucoAi@2026!Secure");
    await submitBtn.click({ force: true });
    await p.waitForTimeout(5000);

    errText = await p.evaluate(() => {
      const err = document.querySelector("[data-automation-id='errorMessage'], [class*='error'], [role='alert'], [data-automation-id='error-message']");
      return err?.textContent || "";
    });
    console.log("Error with ClucoAi@2026!Secure:", errText || "NONE FOUND");
    console.log("URL after ClucoAi@2026!Secure:", p.url());
  }

  // 3. If both failed, what if we CREATE account with babufakemail@gmail.com and Tarun@143?
  if (p.url().includes("/apply/autofillWithResume") && (await submitBtn.count() > 0)) {
    console.log("\n=== Checking Create Account ===");
    const createLink = p.locator("[data-automation-id='createAccountLink'], a:has-text('Create Account')").first();
    if (await createLink.count() > 0) {
      await createLink.click();
      await p.waitForTimeout(2000);
      await p.locator("input[data-automation-id='email']").first().fill("babufakemail@gmail.com");
      await p.locator("input[data-automation-id='password']").first().fill("Tarun@143");
      await p.locator("input[data-automation-id='verifyPassword']").first().fill("Tarun@143");
      const cSubmit = p.locator("button[data-automation-id='createAccountSubmitButton']").first();
      await cSubmit.click({ force: true });
      await p.waitForTimeout(6000);
      console.log("URL after Create Account:", p.url());
      const body = await p.evaluate(() => document.body.innerText.slice(0, 300));
      console.log("Body after Create Account:", body);
    }
  }

  await b.close();
}

testBothPasswords();
