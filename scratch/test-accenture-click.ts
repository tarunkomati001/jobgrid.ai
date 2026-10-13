import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  const url = "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/job/Pernambuco---Recife/Analistas-e-Consultores-SAP-BTP_R00253074/apply/autofillWithResume";
  console.log("Navigating directly to apply/autofillWithResume...");
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(4000);

  console.log("URL after direct goto:", p.url());
  const bodyText = await p.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  console.log("Body text:\n", bodyText);
  await p.screenshot({ path: "scratch/accenture_direct_goto.png", fullPage: true });

  await b.close();
}

main().catch(console.error);
