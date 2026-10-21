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

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await p.waitForTimeout(2000);
  }

  // Print all elements inside the wizard container
  const html = await p.evaluate(() => {
    return {
      bodyText: document.body?.innerText,
      allTags: Array.from(document.querySelectorAll("*")).filter(el => (el as HTMLElement).offsetParent !== null).map(el => ({
        tag: el.tagName,
        autoId: el.getAttribute("data-automation-id"),
        id: el.id,
        role: el.getAttribute("role"),
        text: el.textContent?.trim()?.slice(0, 50)
      })).filter(x => x.autoId || x.role || x.tag === "INPUT" || x.tag === "BUTTON")
    };
  });

  console.log("Accenture Elements:", JSON.stringify(html.allTags.slice(0, 30), null, 2));
  console.log("Accenture body text:\n", html.bodyText?.slice(0, 500));
  await p.screenshot({ path: "scratch/accenture_debug_dom.png", fullPage: true });

  await b.close();
}

main().catch(console.error);
