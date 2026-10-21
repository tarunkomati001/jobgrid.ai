import { chromium } from "playwright";

async function testInitScript() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addInitScript(() => {
    const dismissCookiePopups = () => {
      try {
        const cookieButtons = document.querySelectorAll(
          "button[data-cy*='agree-to-all'], button[data-testid*='agree-to-all'], button[data-cy*='cookie'], button[data-testid*='cookie'], button[data-ui='cookie-consent-accept'], button[data-automation-id='legalNoticeAcceptButton'], button[id*='cookie-accept']"
        );
        for (const btn of cookieButtons) {
          if ((btn as HTMLElement).offsetParent !== null) {
            (btn as HTMLElement).click();
          }
        }

        const cookieDialogs = document.querySelectorAll(
          "[role='dialog'][aria-labelledby*='cookie'], [aria-describedby*='cookie'], #cookie-dialog-title"
        );
        for (const cd of cookieDialogs) {
          const top = cd.closest("[role='dialog']") || cd.closest("div[tabindex='-1']") || cd;
          top.remove();
        }

        if (!document.getElementById("cluco-cookie-suppress-style")) {
          const style = document.createElement("style");
          style.id = "cluco-cookie-suppress-style";
          style.textContent = `
            [role='dialog'][aria-labelledby*='cookie'],
            [aria-describedby*='cookie'],
            div[role='dialog']:has(#cookie-dialog-title),
            [id*='cookie-dialog'],
            [class*='cookie-agreement'],
            [id*='cookie-agreement'] {
              display: none !important;
              visibility: hidden !important;
              pointer-events: none !important;
              opacity: 0 !important;
            }
          `;
          (document.head || document.documentElement).appendChild(style);
        }
      } catch (e) {}
    };

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", dismissCookiePopups);
      } else {
        dismissCookiePopups();
      }
      const observer = new MutationObserver(dismissCookiePopups);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  });

  const page = await context.newPage();
  console.log("Navigating to Recruitee job with init script enabled...");
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const foundText = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4, div, p"))
      .filter(el => el.textContent?.trim() === "Cookies agreement")
      .map(el => ({ tag: el.tagName, text: el.textContent }));
  });
  console.log("Found text elements:", foundText);

  const isVisible = await page.locator("text='Cookies agreement'").first().isVisible().catch(() => false);
  console.log("Is Cookies agreement visible?", isVisible);

  await browser.close();
}

testInitScript().catch(console.error);
