import { chromium } from 'playwright';
import { applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext();
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Click apply -> Autofill with resume
  await page.click("button[data-automation-id='adventureButton']");
  await page.waitForTimeout(1500);
  const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [data-automation-id='click_filter'][aria-label*='Autofill']").first();
  await autofillOption.click();
  await page.waitForTimeout(4000);

  console.log("Current page URL:", page.url());

  // Inspect all links and buttons on page
  const elements = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll("button, a, div[data-automation-id], input"));
    return els.map(el => ({
      tag: el.tagName,
      id: el.id,
      automationId: el.getAttribute("data-automation-id"),
      ariaLabel: el.getAttribute("aria-label"),
      text: (el.textContent || "").trim().slice(0, 50),
      type: el.getAttribute("type")
    })).filter(x => x.automationId || x.ariaLabel || x.text.includes("Sign") || x.text.includes("Create"));
  });

  console.log("Found relevant auth elements:", JSON.stringify(elements, null, 2));
  await browser.close();
}

main().catch(console.error);
