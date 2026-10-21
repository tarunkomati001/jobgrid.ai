import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function check() {
  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Associate-I--Instrumentation---Calibration-Technical-Support_R-2026-49466-1?codes=IND";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.screenshot({ path: "scratch/alcon_page_initial.png" });
  console.log("Current URL:", page.url());
  const title = await page.title();
  console.log("Title:", title);
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, [role='button']")).map(b => ({
      tag: b.tagName,
      text: b.textContent?.trim(),
      automationId: b.getAttribute("data-automation-id"),
      href: (b as HTMLAnchorElement).href,
      visible: (b as HTMLElement).offsetParent !== null
    })).filter(b => b.text || b.automationId);
  });
  console.log("Buttons / Links:", JSON.stringify(buttons, null, 2));
  await browser.close();
}

check().catch(console.error);
