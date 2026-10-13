import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);

  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForTimeout(3000);

  const signInLink = p.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  await signInLink.waitFor({ state: "visible", timeout: 20000 });
  await signInLink.click();
  await p.waitForTimeout(2000);

  await p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first().fill("babufakemail@gmail.com");
  const pwInp = p.locator("input[data-automation-id='password']").first();
  await pwInp.fill("Tarun@143");

  console.log("Submitting sign in...");
  await p.evaluate(() => {
    const overlay = document.querySelector("div[data-automation-id='click_filter'][aria-label*='Sign'], [data-automation-id='click_filter']") as HTMLElement;
    if (overlay) overlay.click();
    const btn = document.querySelector("button[data-automation-id='signInSubmitButton']") as HTMLButtonElement;
    if (btn) btn.click();
  });
  await pwInp.press("Enter");
  await p.waitForTimeout(5000);

  console.log("Logged in! Checking if wizard advances automatically or if we wait...");
  await p.waitForTimeout(5000);
  console.log("URL after 10s total:", p.url());
  let bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  console.log("Body text:\n", bodyText);
  await p.screenshot({ path: "scratch/alcon_after_10s.png", fullPage: true });

  // If still showing sign in form or step 1, what happens if we navigate back to details or reload?
  if (bodyText.includes("Sign In") && bodyText.includes("Email Address*")) {
    console.log("Still on sign in form. Reloading page or re-clicking apply...");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(5000);
    console.log("URL after reload:", p.url());
    bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
    console.log("Body text after reload:\n", bodyText);
    await p.screenshot({ path: "scratch/alcon_after_reload.png", fullPage: true });
  }

  await b.close();
}

main().catch(console.error);
