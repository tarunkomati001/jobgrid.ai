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

  // Click Create Account
  console.log("Clicking Create Account link...");
  const createLink = p.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink']").first();
  await createLink.click();
  await p.waitForTimeout(2000);

  await p.screenshot({ path: "scratch/accenture_create_screen.png", fullPage: true });

  const email = "babufakemail@gmail.com";
  const pw = "Tarun@143";

  await p.locator("input[data-automation-id='email']").fill(email);
  await p.locator("input[data-automation-id='password']").fill(pw);
  await p.locator("input[data-automation-id='verifyPassword']").fill(pw);

  // Check agreement checkbox if present
  const cb = p.locator("input[type='checkbox']").first();
  if (await cb.count() > 0 && !(await cb.isChecked())) {
    await cb.check({ force: true });
  }

  console.log("Submitting Create Account...");
  await p.evaluate(() => {
    const overlay = document.querySelector("div[data-automation-id='click_filter'][aria-label*='Create'], [data-automation-id='click_filter']") as HTMLElement;
    if (overlay) overlay.click();
    const btn = document.querySelector("button[data-automation-id='createAccountSubmitButton']") as HTMLButtonElement;
    if (btn) btn.click();
  });
  await p.waitForTimeout(6000);

  console.log("Post Create Account URL:", p.url());
  const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  console.log("Post Create Account text:\n", bodyText);
  await p.screenshot({ path: "scratch/accenture_post_create.png", fullPage: true });

  await b.close();
}

main().catch(console.error);
