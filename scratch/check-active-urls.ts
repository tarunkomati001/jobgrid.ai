import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testUrls() {
  const urls = [
    "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND",
    "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND",
    "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Surgical-Account-Manager----New-Zealand_R-2026-49451-1?codes=IND",
    "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1",
    "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074"
  ];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  for (const u of urls) {
    try {
      console.log("\nTesting:", u);
      await page.goto(u, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(3000);
      const bodyText = await page.evaluate(() => document.body?.innerText || "");
      const notFound = bodyText.includes("page you are looking for doesn't exist");
      const hasApply = await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").count() > 0;
      console.log("Result -> Not found?", notFound, "| Has Apply button?", hasApply);
    } catch (e: any) {
      console.log("Error loading", u, e.message);
    }
  }

  // Also search for fresh active jobs on Alcon career site!
  console.log("\nFetching fresh active jobs from Alcon career site...");
  await page.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const jobLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href*='/details/'], a[data-automation-id='jobTitle']"))
      .map(a => ({ title: a.textContent?.trim(), href: (a as HTMLAnchorElement).href }))
      .slice(0, 5);
  });
  console.log("Fresh Alcon active jobs:", JSON.stringify(jobLinks, null, 2));

  await browser.close();
}

testUrls().catch(console.error);
