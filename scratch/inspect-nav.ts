import { chromium } from "playwright";
import fs from "fs";
import path from "path";

async function inspectNavigation() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4742";
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // Look for wizard navigation, buttons at bottom, or script functions
  const navInfo = await page.evaluate(() => {
    // Find all elements with 'next', 'continue', or navigation classes
    const navElements = Array.from(document.querySelectorAll(".navigation, .wizard-navigation, [class*='nav'], [class*='btn']")).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: el.textContent?.trim().replace(/\s+/g, " "),
      onclick: el.getAttribute("onclick")
    })).filter(el => el.text && el.text.length < 50);

    // Look for step indicators or next buttons
    const nextButtons = Array.from(document.querySelectorAll("button, a, input")).filter(el => {
      const txt = (el.textContent || (el as any).value || "").toLowerCase();
      return txt.includes("next") || txt.includes("continue") || txt.includes("submit");
    }).map(el => ({
      tag: el.tagName,
      id: el.id,
      className: el.className,
      text: (el.textContent || (el as any).value || "").trim(),
      onclick: el.getAttribute("onclick"),
      outerHTML: el.outerHTML
    }));

    return {
      navElements: navElements.slice(0, 30),
      nextButtons
    };
  });

  console.log("Nav info:", JSON.stringify(navInfo, null, 2));

  await browser.close();
}

inspectNavigation().catch(console.error);
