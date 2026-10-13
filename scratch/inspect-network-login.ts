import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  p.on("request", (req) => {
    if (req.method() === "POST") {
      console.log(`[POST REQUEST] ${req.url()}`);
      console.log("Post data:", req.postData()?.slice(0, 200));
    }
  });

  p.on("response", (res) => {
    if (res.request().method() === "POST") {
      console.log(`[POST RESPONSE] ${res.status()} ${res.url()}`);
    }
  });

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

  console.log("Typing email...");
  const emailInp = p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
  await emailInp.fill("babufakemail@gmail.com");

  console.log("Typing password...");
  const pwInp = p.locator("input[data-automation-id='password']").first();
  await pwInp.fill("Tarun@143");

  console.log("Clicking Sign In button directly with Playwright human mouse or button click...");
  // Find the exact Sign In button inside the form
  const formSubmit = p.locator("button[data-automation-id='signInSubmitButton']").first();
  console.log("formSubmit count:", await formSubmit.count());

  // Click via Playwright
  await formSubmit.click({ force: true });
  await p.waitForTimeout(8000);

  console.log("Final URL:", p.url());
  await p.screenshot({ path: "scratch/alcon_post_click_check.png", fullPage: true });

  await b.close();
}

main().catch(console.error);
