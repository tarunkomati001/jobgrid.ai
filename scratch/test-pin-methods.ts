import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("Navigating to URL:", URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  const emailInput = page.locator("input#primary-email-1, input[type='email']").first();
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill("babufakemail@gmail.com");

  await page.evaluate(() => {
    const cb = document.getElementById("legal-disclaimer-checkbox") as HTMLInputElement;
    if (cb && !cb.checked) {
      const label = document.querySelector("label[for='legal-disclaimer-checkbox'], #legal-disclaimer-checkbox-label") as HTMLElement;
      if (label) label.click();
      else cb.click();
    }
  });
  await page.waitForTimeout(1000);

  const nextBtn = page.locator("button:has-text('Next')").first();
  await nextBtn.click();
  console.log("Clicked Next. Waiting for pin-code screen...");
  await page.waitForSelector("#pin-code-1", { state: "visible", timeout: 15000 });

  console.log("Pin code screen is visible! Testing methods to fill pin code...");

  // Test method A: Check Knockout context on pin-code-1
  const koInfo = await page.evaluate(() => {
    const el = document.getElementById("pin-code-1") as any;
    const win = window as any;
    const hasKo = typeof win.ko !== "undefined";
    const data = hasKo ? win.ko.dataFor(el) : null;
    const ctx = hasKo ? win.ko.contextFor(el) : null;
    return {
      hasKo,
      hasData: !!data,
      hasContext: !!ctx,
      hasSegments: !!(ctx?.$component?.segments)
    };
  });
  console.log("Knockout inspection:", koInfo);

  // Test method B: Simulating paste event with DataTransfer on #pin-code-1
  const pasteResult = await page.evaluate((testOtp) => {
    const el = document.getElementById("pin-code-1");
    if (!el) return { success: false, reason: "no el" };
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", testOtp);
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      el.focus();
      el.dispatchEvent(pasteEvent);

      // Check values of all 6 inputs after paste
      const values = Array.from(document.querySelectorAll("input[id^='pin-code-']")).map((i: any) => i.value);
      return { success: true, values };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, "123456");
  console.log("Paste event result:", pasteResult);

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(console.error);
