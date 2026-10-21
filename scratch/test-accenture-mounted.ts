import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  console.log("Navigating to Accenture...");
  await p.goto("https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074");
  await p.waitForTimeout(3000);
  
  const c = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await c.count() > 0) await c.click();
  
  console.log("Clicking adventureButton...");
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);

  console.log("Clicking autofillWithResume...");
  await p.click("a[data-automation-id='autofillWithResume']");

  console.log("Waiting for inputs to mount...");
  await p.waitForSelector("input, button[data-automation-id='signInLink'], div[data-automation-id='click_filter']", { timeout: 30000 });
  await p.waitForTimeout(4000);

  const elements = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, [role='button']"))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => ({
        tag: el.tagName,
        type: (el as HTMLInputElement).type,
        automationId: el.getAttribute("data-automation-id"),
        text: el.textContent?.trim()?.slice(0, 40)
      })).filter(x => x.automationId || x.type === "password" || x.type === "email");
  });

  console.log("Accenture Elements:", JSON.stringify(elements, null, 2));
  await p.screenshot({ path: "scratch/accenture_mounted.png", fullPage: true });
  await b.close();
}

main().catch(console.error);
