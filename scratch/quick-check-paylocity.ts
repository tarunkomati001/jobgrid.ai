import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testQuick() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"]
  });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://recruiting.paylocity.com/recruiting/jobs/Details/3873766/Etegent-Technologies-LTD/Software-Engineer";
  console.log("Navigating with commit...");
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "commit", timeout: 30000 });
  console.log(`Commit reached in ${Date.now() - t0}ms, current URL: ${page.url()}`);
  await page.waitForTimeout(3000);
  console.log("Title:", await page.title());
  await browser.close();
}

testQuick().catch(console.error);
