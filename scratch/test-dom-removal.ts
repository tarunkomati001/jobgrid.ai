import { chromium } from "playwright";

async function testDomRemoval() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  console.log("Before DOM remove, title count:", await page.locator("#cookie-dialog-title").count());

  await page.evaluate(() => {
    const removeSelectors = [
      "[role='dialog'][aria-labelledby*='cookie']",
      "[role='dialog'][aria-describedby*='cookie']",
      "#cookie-dialog-title",
      "#cookie-dialog-description",
      "[id*='cookie-dialog']",
      "[class*='cookie-dialog']",
      "[class*='cookie-banner']",
      "[class*='cookies-agreement']",
      "[id*='cookie-banner']",
      "[data-cy*='cookie-dialog']",
      "[data-testid*='cookie-dialog']"
    ];

    for (const sel of removeSelectors) {
      document.querySelectorAll(sel).forEach(el => {
        const container = el.closest("[role='dialog']") || el.closest("div[tabindex='-1']") || el;
        container.remove();
      });
    }

    const candidates = Array.from(document.querySelectorAll("div[role='dialog'], div[tabindex='-1'], section, aside, [class*='dialog'], [class*='modal']"));
    for (const el of candidates) {
      const text = el.textContent || "";
      if (
        text.includes("Cookies agreement") ||
        text.includes("We use cookies to ensure that we give you the best experience") ||
        text.includes("manage your cookie preferences")
      ) {
        el.remove();
      }
    }
  });

  console.log("After DOM remove, title count:", await page.locator("#cookie-dialog-title").count());
  await browser.close();
}

testDomRemoval().catch(console.error);
