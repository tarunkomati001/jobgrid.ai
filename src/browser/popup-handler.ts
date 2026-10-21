import { BrowserContext, Page } from "playwright";

/**
 * Universal Popup and Cookie Banner Handler
 * Automatically detects, dismisses, and removes cookie agreements, consent dialogs,
 * and blocking modal overlays across ATS career pages.
 */

/**
 * Common selectors for cookie consent "Accept" / "Agree" buttons.
 */
const COOKIE_ACCEPT_SELECTORS = [
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
  "button#onetrust-accept-btn-handler",
  "button#hs-eu-confirmation-button",
  "button[id*='cookie-accept']",
  "button:has-text('Update cookies')",
  "button:has-text('Got it')"
];

/**
 * Selectors for close / dismiss buttons in generic marketing or alert popups.
 */
const MODAL_CLOSE_SELECTORS = [
  "button[aria-label='Close' i]",
  "button[aria-label='Dismiss' i]",
  "button[title='Close' i]",
  "button.close",
  "[data-cy='modal-close']",
  "[data-testid='modal-close']",
  "button[data-action='dismiss']"
];

/**
 * Selectors for cookie dialog containers to strip from DOM.
 */
const COOKIE_CONTAINER_SELECTORS = [
  "[role='dialog'][aria-labelledby*='cookie']",
  "[role='dialog'][aria-describedby*='cookie']",
  "#cookie-dialog-title",
  "#cookie-dialog-description",
  "[id*='cookie-dialog']",
  "[class*='cookie-dialog']",
  "[class*='cookie-banner']",
  "[class*='cookies-agreement']",
  "[id*='cookie-banner']",
  "[id*='onetrust-banner-sdk']",
  "[id*='hs-eu-cookie-confirmation']",
  "[data-cy*='cookie-dialog']",
  "[data-testid*='cookie-dialog']"
];

/**
 * Actively dismisses and removes all cookie agreements and modal popups on the given page.
 */
export async function dismissCommonPopups(page: Page): Promise<void> {
  try {
    // 1. Attempt clicking accept/agree buttons
    for (const sel of COOKIE_ACCEPT_SELECTORS) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
          console.log(`🍪 [PopupHandler]: Consent button clicked: "${sel}"`);
          await btn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(150);
          break;
        }
      } catch (e) {}
    }

    // 2. Dismiss non-cookie overlays if present
    for (const sel of MODAL_CLOSE_SELECTORS) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.count() > 0 && await btn.isVisible().catch(() => false)) {
          const isInsideDialog = await btn.evaluate((el: HTMLElement) => {
            return !!el.closest("[role='dialog'], [class*='modal'], [class*='popup'], [class*='banner'], [class*='overlay']");
          }).catch(() => false);

          if (isInsideDialog) {
            console.log(`❌ [PopupHandler]: Closing modal popup via: "${sel}"`);
            await btn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(150);
          }
        }
      } catch (e) {}
    }

    // 3. Purge cookie dialogs and overlays from DOM directly
    await page.evaluate((selectors) => {
      // Direct selector purge
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const container = el.closest("[role='dialog']") || el.closest("div[tabindex='-1']") || el;
          container.remove();
        });
      }

      // Semantic text match for Recruitee & generic cookie notices
      const candidateElements = Array.from(
        document.querySelectorAll("div[role='dialog'], div[tabindex='-1'], section, aside, [class*='dialog'], [class*='modal']")
      );
      for (const el of candidateElements) {
        const text = el.textContent || "";
        if (
          text.includes("Cookies agreement") ||
          text.includes("We use cookies to ensure that we give you the best experience") ||
          text.includes("manage your cookie preferences")
        ) {
          el.remove();
        }
      }

      // Ensure page scroll remains enabled
      if (document.body) document.body.style.overflow = "auto";
      if (document.documentElement) document.documentElement.style.overflow = "auto";
    }, COOKIE_CONTAINER_SELECTORS).catch(() => {});
  } catch (e) {}
}

/**
 * Injects a global script into the BrowserContext to suppress cookie banners
 * and agreement dialogs via CSS and MutationObserver before they render.
 */
export async function injectPopupSuppression(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      const dismiss = () => {
        try {
          // Auto-click accept button if found
          const buttons = document.querySelectorAll<HTMLElement>(
            "button[data-cy*='agree-to-all'], button[data-testid*='agree-to-all'], button[data-cy*='agree-to-selected'], button[data-testid*='agree-to-selected'], button[data-ui='cookie-consent-accept'], button[data-automation-id='legalNoticeAcceptButton'], button#onetrust-accept-btn-handler"
          );
          for (const btn of buttons) {
            btn.click();
          }

          // Direct element cleanup
          const removeSelectors = [
            "[role='dialog'][aria-labelledby*='cookie']",
            "[role='dialog'][aria-describedby*='cookie']",
            "#cookie-dialog-title",
            "#cookie-dialog-description",
            "[id*='cookie-dialog']",
            "[class*='cookie-dialog']",
            "[class*='cookie-banner']",
            "[class*='cookies-agreement']",
            "[id*='onetrust-banner-sdk']"
          ];
          for (const sel of removeSelectors) {
            document.querySelectorAll(sel).forEach(el => {
              const top = el.closest("[role='dialog']") || el.closest("div[tabindex='-1']") || el;
              top.remove();
            });
          }

          // Inject CSS suppression rule
          if (!document.getElementById("cluco-cookie-suppress-style")) {
            const style = document.createElement("style");
            style.id = "cluco-cookie-suppress-style";
            style.textContent = `
              [role='dialog'][aria-labelledby*='cookie'],
              [aria-describedby*='cookie'],
              div[role='dialog']:has(#cookie-dialog-title),
              #cookie-dialog-title,
              #cookie-dialog-description,
              [id*='cookie-dialog'],
              [class*='cookie-dialog'],
              [class*='cookie-banner'],
              [class*='cookies-agreement'],
              [id*='onetrust-banner-sdk'] {
                display: none !important;
                visibility: hidden !important;
                pointer-events: none !important;
                opacity: 0 !important;
              }
            `;
            (document.head || document.documentElement)?.appendChild(style);
          }
        } catch (e) {}
      };

      if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", dismiss);
        } else {
          dismiss();
        }
        const observer = new MutationObserver(dismiss);
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    } catch (e) {}
  });
}
