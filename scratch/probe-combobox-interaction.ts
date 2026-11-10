import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function probeCombobox() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);
  const page = await context.newPage();

  await page.goto("https://recruiting.paylocity.com/Recruiting/jobs/Apply/4448048", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  // Focus and inspect appliedBefore combobox
  const cb = page.locator("[id='info.haveYouAppliedWithUsBefore']");
  console.log("cb count:", await cb.count());
  console.log("cb HTML:", await cb.evaluate((el: any) => el.outerHTML));

  // Focus and press 'n' or ArrowDown then Enter
  console.log("Testing keyboard navigation on cb...");
  await cb.focus();
  await page.waitForTimeout(100);
  await cb.press("Alt+ArrowDown");
  await page.waitForTimeout(300);

  // Check if popup opened now
  const popupOpen = await page.evaluate(() => {
    const listbox = document.getElementById("info.haveYouAppliedWithUsBefore__listbox");
    return {
      exists: !!listbox,
      html: listbox ? listbox.outerHTML : null,
      parentHtml: listbox ? listbox.parentElement?.outerHTML : null
    };
  });
  console.log("Popup state after Alt+ArrowDown:", JSON.stringify(popupOpen, null, 2));

  // Press ArrowDown and Enter
  await cb.press("ArrowDown");
  await page.waitForTimeout(100);
  await cb.press("Enter");
  await page.waitForTimeout(300);
  console.log("Value after ArrowDown + Enter:", await cb.locator(".rw-input").innerText());

  // Also test pressing 'N' directly
  await cb.focus();
  await cb.press("n");
  await page.waitForTimeout(100);
  await cb.press("Enter");
  await page.waitForTimeout(300);
  console.log("Value after pressing 'n' + Enter:", await cb.locator(".rw-input").innerText());

  // Now test Date input typing
  const dateInput = page.locator("input[id='info.dateAvailableToStart']");
  console.log("dateInput count:", await dateInput.count());
  await dateInput.click();
  await dateInput.pressSequentially("11/01/2026", { delay: 50 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  console.log("dateInput value:", await dateInput.inputValue());

  await browser.close();
}

probeCombobox().catch(console.error);
