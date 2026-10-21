import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  await p.goto("https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074", { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click();
  await p.waitForTimeout(2000);

  const autofill = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  await autofill.click();

  const emailProviderBtn = p.locator("button:has-text('Sign in with email'), [data-automation-id*='email'], div[role='button']:has-text('Sign in with email'), button:has-text('email')").first();
  await emailProviderBtn.waitFor({ state: "visible", timeout: 30000 });
  await emailProviderBtn.click();
  await p.waitForTimeout(2000);

  const passwords = ["Tarun@143", "Tarun@2006", "ClucoAi@2026!Secure", "BabuFake123!"];
  for (const pw of passwords) {
    console.log(`\nTesting babufakemail@gmail.com with ${pw} on Accenture...`);
    const emailInp = p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
    const pwInp = p.locator("input[data-automation-id='password']").first();
    await emailInp.fill("babufakemail@gmail.com");
    await pwInp.fill(pw);

    const submitBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
    await submitBtn.click();
    await p.waitForTimeout(5000);

    const bodyText = await p.evaluate(() => document.body?.innerText || "");
    const hasError = bodyText.includes("wrong email address or password") || bodyText.includes("account might be locked") || bodyText.includes("Invalid") || bodyText.includes("incorrect password");

    console.log(`Result: Error? ${hasError} | URL: ${p.url().slice(0, 70)}`);
    if (!hasError && (bodyText.includes("Autofill") || bodyText.includes("Resume") || bodyText.includes("My Information") || bodyText.includes("step 2") || bodyText.includes("step 3") || p.url().includes("/apply/autofillWithResume"))) {
      console.log(`🎉 SUCCESS on Accenture with password ${pw}!`);
      await p.screenshot({ path: "scratch/accenture_login_success.png", fullPage: true });
      break;
    }
  }

  await b.close();
}

main().catch(console.error);
