import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function captureReview() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });
  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006!Secure");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006!Secure");
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(3000);

  const adapter = new TaleoAdapter();
  await adapter.fillForm(page, {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail@gmail.com",
    phone: "4155552671",
    street: "500 Oracle Parkway",
    addressLine2: "Suite 100",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    country: "United States"
  } as any);

  // Close any open datepicker
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  // Get summary of the review section
  const reviewText = await page.evaluate(() => {
    return document.querySelector(".oracletaleocwsv2-review-container, #step-06, body")?.innerText || "";
  });
  console.log("REVIEW SECTION TEXT:\n", reviewText.substring(0, 3000));
  await page.screenshot({ path: "C:/Users/tarun/.gemini/antigravity/brain/dddad5f7-241b-4571-b41e-01247627bd69/full_review.png", fullPage: true });
  await browser.close();
}
captureReview().catch(console.error);

