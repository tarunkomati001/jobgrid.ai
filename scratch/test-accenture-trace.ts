import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  p.on("response", (res) => {
    if (res.url().includes("/apply") || res.url().includes("/auth") || res.url().includes("/login")) {
      console.log(`[API RESPONSE] ${res.status()} ${res.url().slice(0, 100)}`);
    }
  });

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

  console.log("Waiting up to 45s for inputs to mount...");
  try {
    await p.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName'], input[type='password'], button[data-automation-id='signInLink']", { timeout: 45000 });
    console.log("SUCCESS! Inputs mounted on Accenture!");
    await p.screenshot({ path: "scratch/accenture_auth_mounted.png", fullPage: true });
  } catch (e: any) {
    console.log("Failed to mount within 45s:", e.message);
    await p.screenshot({ path: "scratch/accenture_auth_failed.png", fullPage: true });
    const text = await p.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
    console.log("Body text on failure:\n", text);
  }

  await b.close();
}

main().catch(console.error);
