import { chromium, Page } from "playwright";

export async function dismissCommonPopups(page: Page): Promise<void> {
  try {
    // 1. Click accept / agree buttons for cookies or modal notices
    const acceptSelectors = [
      "button[data-cy*='agree-to-all']",
      "button[data-testid*='agree-to-all']",
      "button[data-cy*='agree-to-selected']",
      "button[data-testid*='agree-to-selected']",
      "button:has-text('Agree to all')",
      "button:has-text('Agree to necessary')",
      "button:has-text('Accept Cookies')",
      "button:has-text('Accept All')",
      "button:has-text('Allow All')",
      "button:has-text('Accept all cookies')",
      "button:has-text('I Agree')",
      "button:has-text('Accept')",
      "button[data-ui='cookie-consent-accept']",
      "button[data-automation-id='legalNoticeAcceptButton']",
      "button:has-text('Update cookies')",
      "button:has-text('Got it')"
    ];

    for (const sel of acceptSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        console.log(`🍪 [PopupHandler]: Clicking consent button: "${sel}"`);
        await btn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
        break;
      }
    }

    // 2. Click standard dismiss / close buttons for marketing or alert popups
    const closeSelectors = [
      "button[aria-label='Close' i]",
      "button[aria-label='Dismiss' i]",
      "button[title='Close' i]",
      "button.close",
      "[data-cy='modal-close']",
      "[data-testid='modal-close']"
    ];

    for (const sel of closeSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
        const isInsideDialog = await btn.evaluate((el: HTMLElement) => {
          return !!el.closest("[role='dialog'], [class*='modal'], [class*='popup'], [class*='banner'], [class*='overlay']");
        }).catch(() => false);

        if (isInsideDialog) {
          console.log(`❌ [PopupHandler]: Dismissing modal popup via close button: "${sel}"`);
          await btn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(200);
        }
      }
    }

    // 3. Purge / Remove any stubborn cookie dialogs or overlays from the DOM directly
    await page.evaluate(() => {
      // Direct selector cleanup
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

      // Semantic text match for cookie agreement popups
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

      // Re-enable page scrolling if body or html was locked
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }).catch(() => {});
  } catch (e) {}
}

async function runTest() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Testing on companiongroupltd Recruitee job...");
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const beforeCheck = await page.locator("#cookie-dialog-title").count();
  console.log("Before dismissal count:", beforeCheck);

  await dismissCommonPopups(page);
  await page.waitForTimeout(500);

  const afterCheck = await page.locator("#cookie-dialog-title").count();
  console.log("After dismissal count:", afterCheck);

  await browser.close();
}

runTest().catch(console.error);
