import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  const url = "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/job/Pernambuco---Recife/Analistas-e-Consultores-SAP-BTP_R00253074/apply/autofillWithResume";
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await p.waitForTimeout(3000);
  }

  await p.screenshot({ path: "scratch/accenture_after_cookies.png", fullPage: true });

  const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 700) || "");
  console.log("Body text after cookies:\n", bodyText);

  const inputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a"))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type,
        automationId: el.getAttribute("data-automation-id"),
        text: el.textContent?.trim()?.slice(0, 40)
      })).filter(x => x.automationId || x.type === "password" || x.type === "email" || x.type === "text");
  });
  console.log("Inputs:", JSON.stringify(inputs, null, 2));

  await b.close();
}

main().catch(console.error);
