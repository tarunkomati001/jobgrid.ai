import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  await p.goto("https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074");
  await p.waitForTimeout(3000);
  
  const c = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await c.count() > 0) await c.click();
  
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);

  // Check what options are shown after clicking adventureButton
  const options = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, [role='button'], div[data-automation-id]")).map(el => ({
      tag: el.tagName,
      automationId: el.getAttribute("data-automation-id"),
      text: el.textContent?.trim()?.slice(0, 60),
      href: (el as HTMLAnchorElement).href,
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(x => x.visible && (x.automationId || x.text));
  });

  console.log("Options after clicking Apply:", JSON.stringify(options, null, 2));
  await p.screenshot({ path: "scratch/accenture_apply_options.png" });

  await b.close();
}

main().catch(console.error);
