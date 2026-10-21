import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const context = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const p = await context.newPage();

  const loginUrl = "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/login?redirect=%2Fen-US%2FAccentureCareers%2Fjob%2FPernambuco---Recife%2FAnalistas-e-Consultores-SAP-BTP_R00253074%2Fapply%2FautofillWithResume";
  await p.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await p.waitForTimeout(3000);

  const cardText = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("div, p, h1, h2, h3, span")).map(el => el.textContent?.trim()).filter(Boolean).filter(t => t!.length > 10 && t!.length < 200);
  });
  console.log("Card texts:", JSON.stringify(cardText, null, 2));

  await b.close();
}

main().catch(console.error);
