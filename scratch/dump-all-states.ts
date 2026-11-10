import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function dumpAllStates() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/3873766", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);
  await page.locator("#onetrust-accept-btn-handler, button:has-text('Accept All Cookies')").first().click().catch(() => {});
  await page.waitForTimeout(1000);

  // Click the input or icon without typing
  const icon = page.locator("#public-site-address-us-state-select-wrapper .pcty-input-select__dropdown-icon").first();
  await icon.click();
  await page.waitForTimeout(500);

  const menuText = await page.evaluate(() => {
    const menu = document.querySelector(".pcty-input-select__menu-list");
    if (!menu) return "NO MENU";
    const children = Array.from(menu.children);
    return children.map(c => ({
      tag: c.tagName,
      cls: c.className,
      text: c.textContent?.trim(),
      id: c.id
    }));
  });
  console.log("MENU ITEMS (first 20):\n", JSON.stringify(menuText.slice(0, 20), null, 2));

  await browser.close();
}

dumpAllStates().catch(console.error);
