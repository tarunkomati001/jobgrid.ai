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
  "button:has-text('Got it')",
  // JazzHR tracking consent banner buttons
  "button.tracking-consent-button.allow",
  "#tracking-consent-banner button.allow",
  ".tracking-consent-button.allow",
  "button:has-text('Allow')"
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
  "button[data-action='dismiss']",
  // JazzHR tracking consent dismiss / reject buttons
  "button.tracking-consent-button.dismiss",
  "#tracking-consent-banner button.dismiss",
  ".tracking-consent-button.dismiss",
  "button.tracking-consent-button.reject",
  "[onclick*='grantConsent']",
  "[onclick*='denyConsent']"
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
  "[data-testid*='cookie-dialog']",
  // JazzHR consent banner
  "#tracking-consent-banner",
  ".tracking-consent-banner-content",
  "div[id*='tracking-consent']"
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
    // 3b. Handle Wellfound "We want to feature you to recruiters!" and interview popups
    try {
      const wellfoundFeatureModal = page.locator(
        "div:has-text('We want to feature you to recruiters'), [class*='ReactModal']:has-text('feature you'), [role='dialog']:has-text('feature you')"
      ).first();

      if (await wellfoundFeatureModal.isVisible({ timeout: 600 }).catch(() => false)) {
        console.log("💎 [PopupHandler]: Detected Wellfound 'Feature you to recruiters' modal. Dismissing...");
        const skipLink = page.locator(
          "button:has-text('Skip for now'), a:has-text('Skip for now'), :text('Skip for now'), button:has-text('I\\'m not ready yet')"
        ).first();

        if (await skipLink.isVisible({ timeout: 1000 }).catch(() => false)) {
          await skipLink.click({ force: true }).catch(() => {});
          await page.waitForTimeout(300);
        } else {
          // Alternatively check boxes and click feature
          const cbs = page.locator(".ReactModalPortal input[type='checkbox']");
          const count = await cbs.count();
          for (let i = 0; i < count; i++) {
            await cbs.nth(i).check({ force: true }).catch(() => {});
          }
          const featBtn = page.locator("button:has-text('Feature my profile')").first();
          if (await featBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await featBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(400);
          }
        }

        // Remove overlay from DOM to prevent pointer interception
        await page.evaluate(() => {
          document.querySelectorAll(".ReactModalPortal, .ReactModal__Overlay").forEach(el => {
            if ((el.textContent || "").includes("feature you to recruiters")) {
              el.remove();
            }
          });
        }).catch(() => {});
      }

      // Check interview readiness modal
      const interviewModal = page.locator(
        "div:has-text('When will you be ready to interview'), [class*='ReactModal']:has-text('ready to interview')"
      ).first();
      if (await interviewModal.isVisible({ timeout: 400 }).catch(() => false)) {
        console.log("📅 [PopupHandler]: Detected Wellfound 'When will you be ready to interview' modal. Answering...");
        const opt = page.locator("button:has-text('In two weeks'), button:has-text('Not interested')").first();
        if (await opt.isVisible({ timeout: 600 }).catch(() => false)) {
          await opt.click({ force: true }).catch(() => {});
          await page.waitForTimeout(300);
        }
      }

      // Check "We read your resume" banner - strictly click Dismiss without removing DOM elements
      const resumeDismissBtn = page.locator("div:has-text('We read your resume') button:has-text('Dismiss'), div:has-text('We read your resume') a:has-text('Dismiss')").first();
      if (await resumeDismissBtn.isVisible({ timeout: 300 }).catch(() => false)) {
        console.log("📄 [PopupHandler]: Clicking Dismiss on 'We read your resume' banner...");
        await resumeDismissBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
      }

      // Check JazzHR tracking consent banner
      const jazzhrBanner = page.locator("#tracking-consent-banner, .tracking-consent-banner-content").first();
      if (await jazzhrBanner.isVisible({ timeout: 400 }).catch(() => false)) {
        console.log("🍪 [PopupHandler]: Detected JazzHR tracking consent banner. Dismissing...");
        const allowBtn = page.locator(".tracking-consent-button.allow, #tracking-consent-banner button.allow, button:has-text('Allow')").first();
        if (await allowBtn.isVisible({ timeout: 300 }).catch(() => false)) {
          await allowBtn.click({ force: true }).catch(() => {});
          await page.waitForTimeout(150);
        }
        await page.evaluate(() => {
          const b = document.getElementById("tracking-consent-banner");
          if (b) b.remove();
          try { window.localStorage.setItem("trackingConsentGranted", "true"); } catch (e) {}
        }).catch(() => {});
      }
    } catch (e) {}
    await page.evaluate((selectors) => {
      // Direct selector purge with strict safety guards (NEVER remove root/main page containers)
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const container = el.closest("[role='dialog']") || el;
          if (
            container.id === "__next" ||
            container.id === "root" ||
            container.tagName === "BODY" ||
            container.tagName === "HTML" ||
            container.querySelector("main, #__next, [data-test='JobListing'], form")
          ) {
            return;
          }
          container.remove();
        });
      }

      // Semantic text match for cookie notices with strict safety checks
      const candidateElements = Array.from(
        document.querySelectorAll("div[role='dialog'], section, aside, [class*='cookie'], [class*='consent']")
      );
      for (const el of candidateElements) {
        if (
          el.id === "__next" ||
          el.id === "root" ||
          el.tagName === "BODY" ||
          el.querySelector("main, #__next, [data-test='JobListing'], form")
        ) {
          continue;
        }
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
      // Pre-set JazzHR tracking consent in localStorage to prevent popup banner from rendering
      try {
        window.localStorage.setItem("trackingConsentGranted", "true");
      } catch (e) {}

      const dismiss = () => {
        try {
          // JazzHR banner direct auto-dismiss
          const jazzhrBanner = document.getElementById("tracking-consent-banner");
          if (jazzhrBanner) {
            const allowBtn = jazzhrBanner.querySelector<HTMLElement>(".tracking-consent-button.allow, .allow, .dismiss");
            if (allowBtn) allowBtn.click();
            jazzhrBanner.remove();
          }

          // Auto-click accept button if found
          const buttons = document.querySelectorAll<HTMLElement>(
            "button[data-cy*='agree-to-all'], button[data-testid*='agree-to-all'], button[data-cy*='agree-to-selected'], button[data-testid*='agree-to-selected'], button[data-ui='cookie-consent-accept'], button[data-automation-id='legalNoticeAcceptButton'], button#onetrust-accept-btn-handler, button.tracking-consent-button.allow"
          );
          for (const btn of buttons) {
            btn.click();
          }

          // Wellfound "We want to feature you to recruiters!" & interview popups suppression
          // Strictly target standalone modal portals; NEVER remove layout containers, forms, or main content
          const modals = document.querySelectorAll<HTMLElement>("body > .ReactModalPortal, body > .ReactModal__Overlay");
          for (const m of modals) {
            // Guard: never remove if it contains a form or application inputs
            if (m.querySelector("form, textarea, input[name*='customQuestionAnswers']")) continue;

            const text = (m.textContent || "").toLowerCase();
            if (text.includes("we want to feature you to recruiters")) {
              const allLinks = Array.from(m.querySelectorAll<HTMLElement>("a, button, span"));
              const skipLink = allLinks.find(el => (el.textContent || "").toLowerCase().includes("skip for now") || (el.textContent || "").toLowerCase().includes("not ready"));
              if (skipLink) {
                skipLink.click();
              } else {
                // Check checkboxes if available
                const checkboxes = Array.from(m.querySelectorAll<HTMLInputElement>("input[type='checkbox']"));
                checkboxes.forEach(cb => { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); });
                const featBtn = Array.from(m.querySelectorAll<HTMLElement>("button")).find(b => (b.textContent || "").includes("Feature my profile"));
                if (featBtn) featBtn.click();
              }
            } else if (text.includes("when will you be ready to interview")) {
              const opt = Array.from(m.querySelectorAll<HTMLElement>("button, a")).find(el => (el.textContent || "").toLowerCase().includes("two weeks") || (el.textContent || "").toLowerCase().includes("not interested"));
              if (opt) opt.click();
            }
          }

          // Wellfound "We read your resume" banner suppression: click Dismiss without removing any container
          const allDismissBtns = Array.from(document.querySelectorAll<HTMLElement>("button, a, span"));
          for (const btn of allDismissBtns) {
            const txt = (btn.textContent || "").trim().toLowerCase();
            if (txt === "dismiss") {
              const parentText = (btn.closest("div, aside, section")?.textContent || "").toLowerCase();
              if (parentText.includes("we read your resume")) {
                btn.click();
              }
            }
          }

          // Direct element cleanup with strict safety guards (NEVER remove root/main page containers)
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
              const top = el.closest("[role='dialog']") || el;
              if (
                top.id === "__next" ||
                top.id === "root" ||
                top.tagName === "BODY" ||
                top.tagName === "HTML" ||
                top.querySelector("main, #__next, [data-test='JobListing'], form")
              ) {
                return;
              }
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
              [id*='onetrust-banner-sdk'],
              #tracking-consent-banner,
              .tracking-consent-banner-content {
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
