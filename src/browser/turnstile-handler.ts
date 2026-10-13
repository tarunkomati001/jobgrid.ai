import { Page, Frame } from "playwright";
import { updateHUDStatus } from "./visual-hud";
import { humanMouseMove, removeCursorVisualizer } from "./human-mouse";

/**
 * Detects and automatically resolves or assists with Cloudflare Turnstile ("Verify you are human") challenges.
 */
export async function handleCloudflareTurnstile(page: Page, maxWaitMs = 25000): Promise<boolean> {
  // Quick check if Cloudflare challenge is present on page
  const isChallengePresent = async (): Promise<boolean> => {
    return await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const isCfText = 
        text.includes("Verify you are human") ||
        text.includes("Checking your browser") ||
        text.includes("Just a moment...") ||
        text.includes("challenges.cloudflare.com") ||
        document.title.includes("Just a moment...");

      const hasCfIframe = !!document.querySelector(
        "iframe[src*='challenges.cloudflare.com'], iframe[src*='turnstile'], iframe[title*='Cloudflare'], #turnstile-wrapper, .cf-turnstile"
      );

      return isCfText || hasCfIframe;
    }).catch(() => false);
  };

  if (!(await isChallengePresent())) {
    // Also check if any frame matches cloudflare
    const cfFrame = page.frames().find(f => f.url().includes("challenges.cloudflare.com") || f.url().includes("turnstile"));
    if (!cfFrame) {
      return true; // No challenge present
    }
  }

  console.log("\n🛡️ [Cloudflare Turnstile]: 'Verify you are human' security challenge detected!");
  await updateHUDStatus(page, "Cloudflare Challenge Detected", "Resolving 'Verify you are human' Turnstile check...", "warning", 15).catch(() => {});

  const startTime = Date.now();

  // Attempt auto-click inside Turnstile iframe
  while (Date.now() - startTime < maxWaitMs) {
    // 1. Locate Cloudflare frame
    const cfFrame = page.frames().find(f => 
      f.url().includes("challenges.cloudflare.com") || 
      f.url().includes("turnstile") ||
      f.url().includes("challenge-platform")
    );

    if (cfFrame) {
      try {
        const checkbox = cfFrame.locator("input[type='checkbox'], #challenge-stage, .ctp-checkbox-label, .ctp-checkbox-container, #challenge-stage input, .mark").first();
        if (await checkbox.count() > 0 && await checkbox.isVisible().catch(() => false)) {
          console.log("👆 [Cloudflare Turnstile]: Found Turnstile checkbox, navigating authentic human cursor...");
          const box = await checkbox.boundingBox().catch(() => null);
          if (box && box.width > 0 && box.height > 0) {
            const targetX = box.x + box.width * (0.35 + Math.random() * 0.3);
            const targetY = box.y + box.height * (0.35 + Math.random() * 0.3);

            // Move mouse naturally with organic curves to the checkbox
            await humanMouseMove(page, targetX, targetY, {
              oscillations: 3,
              amplitude: 8,
              overshoot: true
            }).catch(() => page.mouse.move(targetX, targetY));

            await page.waitForTimeout(150 + Math.floor(Math.random() * 120));

            // Natural mouse press down & up
            await page.mouse.down();
            await page.waitForTimeout(75 + Math.floor(Math.random() * 60));
            await page.mouse.up();
            console.log("✅ [Cloudflare Turnstile]: Dispatched authentic pointer click on checkbox.");
          } else {
            await checkbox.click({ timeout: 5000 }).catch(() => {});
          }
          await page.waitForTimeout(2500);
        }
      } catch (e: any) {
        // Cross-origin frame timing
      }
    }

    // 2. Check if challenge was resolved or main page form loaded
    const resolved = await page.evaluate(() => {
      // If form or workable content is visible
      const form = document.querySelector("form, [data-ui='application-form'], [data-ui='careers-page-content'], input#firstname, input#email");
      const cfIframe = document.querySelector("iframe[src*='challenges.cloudflare.com'], iframe[title*='Cloudflare']");
      
      // If Turnstile was an inline widget, check if cf-turnstile-response has a token
      const turnstileInput = document.querySelector("[name='cf-turnstile-response']") as HTMLInputElement;
      if (turnstileInput && turnstileInput.value) {
        return true;
      }

      // If full page challenge cleared
      if (form && (!cfIframe || (cfIframe as HTMLElement).offsetParent === null)) {
        return true;
      }

      const bodyText = document.body?.innerText || "";
      const stillChallenged = bodyText.includes("Verify you are human") || document.title.includes("Just a moment...");
      return !stillChallenged && !!form;
    }).catch(() => false);

    if (resolved) {
      console.log("🎉 [Cloudflare Turnstile]: Verification cleared successfully!\n");
      await updateHUDStatus(page, "Verification Cleared", "Proceeding with application form autofill...", "success", 20).catch(() => {});
      await page.waitForTimeout(1000);
      return true;
    }

    // Wait 1.5s before next check
    await page.waitForTimeout(1500);
  }

  console.warn("⚠️ [Cloudflare Turnstile]: Auto-resolution wait timed out. If Turnstile is still on screen, please click the checkbox manually.");
  return false;
}
