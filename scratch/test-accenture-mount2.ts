import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  const url = "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/job/Pernambuco---Recife/Analistas-e-Consultores-SAP-BTP_R00253074/apply/autofillWithResume";
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(2000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
  }

  console.log("Waiting for auth inputs on Accenture...");
  await p.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName'], input[type='password'], button[data-automation-id='signInLink']", { timeout: 25000 });
  console.log("Accenture inputs mounted!");

  const elements = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button")).filter(el => (el as HTMLElement).offsetParent !== null).map(el => ({
      tag: el.tagName,
      type: (el as HTMLInputElement).type,
      autoId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.textContent?.trim()
    })).filter(x => x.autoId || x.type === "password");
  });
  console.log("Accenture inputs:", JSON.stringify(elements, null, 2));

  await b.close();
}

main().catch(console.error);
