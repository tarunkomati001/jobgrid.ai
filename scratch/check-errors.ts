import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import path from "path";

async function checkErrors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating directly to Apply URL...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Click Next Step immediately with empty form to trigger all validation errors
  console.log("Clicking Next Step to trigger validation...");
  const nextBtn = page.locator("button#btn-submit, button[type='submit']").first();
  await nextBtn.click({ force: true });
  await page.waitForTimeout(1500);

  // Query all error elements
  const errors = await page.evaluate(() => {
    // Look for elements with error classes, aria-invalid, red color, or invalid styles
    const errorEls = Array.from(document.querySelectorAll("[class*='error'], [class*='invalid'], [aria-invalid='true'], span, p, div"));
    const redTexts: Array<{ tag: string; className: string; text: string; parentId: string }> = [];

    for (const el of errorEls) {
      const style = window.getComputedStyle(el);
      const isRed = style.color.includes("255, 0, 0") || style.color.includes("rgb(21") || style.color.includes("rgb(22") || style.color.includes("rgb(19");
      const hasErrorClass = /error|invalid|danger/i.test(el.className);
      if ((isRed || hasErrorClass) && el.textContent?.trim() && el.children.length === 0) {
        redTexts.push({
          tag: el.tagName.toLowerCase(),
          className: el.className,
          text: el.textContent.trim(),
          parentId: el.parentElement?.id || el.closest(".form-group")?.id || ""
        });
      }
    }
    return redTexts;
  });

  console.log(`Discovered ${errors.length} validation message elements:`);
  errors.forEach((e, i) => {
    console.log(`[${i+1}] <${e.tag} class="${e.className}"> Text: "${e.text}" (Parent: ${e.parentId})`);
  });

  await browser.close();
}

checkErrors().catch(console.error);
