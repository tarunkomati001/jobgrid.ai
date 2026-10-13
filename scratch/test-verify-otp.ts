import { chromium } from "playwright";
import dotenv from "dotenv";
dotenv.config();

const URL = "https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email";

async function main() {
  const browser = await chromium.launch({ headless: true });
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
  console.log("Entering email babufakemail@gmail.com...");
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
  console.log("Clicked Next. Waiting for pin code screen (#pin-code-1)...");
  await page.waitForSelector("#pin-code-1", { state: "visible", timeout: 15000 });

  console.log("Pin code screen is visible! Pasting OTP: 779487...");
  const otp = "779487";

  const pasteResult = await page.evaluate((code) => {
    const el = document.getElementById("pin-code-1");
    if (!el) return false;
    const dt = new DataTransfer();
    dt.setData("text/plain", code);
    const pasteEvent = new ClipboardEvent("paste", {
      clipboardData: dt,
      bubbles: true,
      cancelable: true
    });
    el.focus();
    el.dispatchEvent(pasteEvent);
    return true;
  }, otp);
  console.log("Paste result:", pasteResult);

  await page.waitForTimeout(1000);

  const values = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input[id^='pin-code-']")).map((i: any) => i.value).join("");
  });
  console.log("Values inside PIN inputs:", values);

  console.log("Clicking Verify button...");
  const verifyBtn = page.locator("form.pin-code-verification button[type='submit'], button:has-text('Verify')").first();
  await verifyBtn.click();

  console.log("Waiting 8s to see response...");
  await page.waitForTimeout(8000);

  console.log("URL after verify:", page.url());
  const headings = await page.locator("h1, h2, h3, .heading").allInnerTexts();
  console.log("Headings after verify:", headings);

  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log("Body snippet after verify:\n", bodySnippet);

  await page.screenshot({ path: "scratch/oracle_after_verify.png" });
  await browser.close();
}

main().catch(console.error);
