import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  const loginUrl = "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/login?redirect=%2Fen-US%2FAccentureCareers%2Fjob%2FPernambuco---Recife%2FAnalistas-e-Consultores-SAP-BTP_R00253074%2Fapply%2FautofillWithResume";
  console.log("Navigating to login page...");
  await p.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  // Check if "Sign in with email" is present
  const emailProviderBtn = p.locator("button:has-text('Sign in with email'), [data-automation-id*='email'], div[role='button']:has-text('Sign in with email'), button:has-text('email')").first();
  if (await emailProviderBtn.count() > 0 && await emailProviderBtn.isVisible()) {
    console.log("Clicking Sign in with email...");
    await emailProviderBtn.click();
    await p.waitForTimeout(2000);
  }

  await p.waitForSelector("input[data-automation-id='userName'], input[data-automation-id='email'], input[type='email'], input[type='text']", { timeout: 25000 });
  console.log("Inputs mounted on login page!");

  const emailInp = p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
  const pwInp = p.locator("input[data-automation-id='password']").first();
  await emailInp.fill("babufakemail@gmail.com");
  await pwInp.fill("Tarun@143");

  console.log("Submitting sign in credentials...");
  await p.evaluate(() => {
    const overlay = document.querySelector("div[data-automation-id='click_filter'][aria-label*='Sign'], div[data-automation-id='click_filter'][aria-label*='Submit'], [data-automation-id='click_filter']") as HTMLElement;
    if (overlay) overlay.click();
    const btn = document.querySelector("button[data-automation-id='signInSubmitButton']") as HTMLButtonElement;
    if (btn) btn.click();
  });
  await pwInp.press("Enter").catch(() => {});
  await p.waitForTimeout(6000);

  console.log("Post sign in URL:", p.url());
  const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  console.log("Post sign in text:\n", bodyText);
  await p.screenshot({ path: "scratch/accenture_post_login_redirect.png", fullPage: true });

  await b.close();
}

main().catch(console.error);
