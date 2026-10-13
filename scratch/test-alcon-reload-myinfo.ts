import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import * as path from "path";

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

  const formSubmit = p.locator("button[data-automation-id='signInSubmitButton']").first();
  await formSubmit.click({ force: true });
  await p.waitForTimeout(6000);

  const fileInput = p.locator("input[type='file']").first();
  const resumePath = path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await fileInput.setInputFiles(resumePath);
  await p.waitForTimeout(5000);

  const continueBtn = p.locator("div[data-automation-id='click_filter'][aria-label*='Continue'], button:has-text('Continue'), button[data-automation-id='bottom-navigation-next-button']").first();
  await continueBtn.click({ force: true });
  await p.waitForTimeout(6000);

  console.log("Checking transient error...");
  const hasError = await p.evaluate(() => (document.body?.innerText || "").includes("Something went wrong"));
  console.log("Has transient error?", hasError);
  if (hasError) {
    console.log("Reloading page...");
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(6000);
  }

  console.log("After reload, current URL:", p.url());
  const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 600) || "");
  console.log("Body text after reload:\n", bodyText);
  await p.screenshot({ path: "scratch/alcon_my_information_loaded.png", fullPage: true });

  await b.close();
}

main().catch(console.error);
