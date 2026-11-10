import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function inspect() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  console.log("Navigating...");
  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4616387", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("input#info\\.firstName, input[name*='firstName'], .form-group", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const el = document.getElementById("public-site-address-address-1") || document.querySelector("[id*='address-1']");
    if (!el) return null;
    return {
      tagName: el.tagName,
      id: el.id,
      role: el.getAttribute("role"),
      className: el.className,
      outerHTML: el.outerHTML
    };
  });

  console.log("Address 1 Element:", JSON.stringify(res, null, 2));

  // Also check all error messages if we submit
  const nextBtn = page.locator("button#btn-submit, button[type='submit'], button:has-text('Next Step')").first();
  await nextBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);

  const errors = await page.evaluate(() => {
    const errEls = Array.from(document.querySelectorAll("span[style*='color: red'], p.text-danger, .has-error span:not(.type-footnote), .field-validation-error, [class*='error']"));
    return errEls.map(e => e.textContent?.trim()).filter(Boolean);
  });
  console.log("Errors shown when clicking Next Step without filling:", errors);

  await browser.close();
}

inspect().catch(console.error);
