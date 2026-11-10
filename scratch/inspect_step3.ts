import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";

async function inspectStep3() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: DEFAULT_USER_AGENT });

  console.log("Navigating to Helix requisition...");
  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);
  await page.locator("a:has-text('Apply'), button:has-text('Apply')").first().click();
  await page.waitForTimeout(2000);

  // Step 1
  console.log("Step 1...");
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006!Secure");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006!Secure");
  await page.locator(".oracletaleocwsv2-arrow-nav-next:visible").click();
  await page.waitForTimeout(3000);

  // Now we are on Step 2. Use TaleoAdapter logic or pause
  const adapter = new TaleoAdapter();
  // Call fillForm, but let's intercept when on Step 3
  page.on("framenavigated", async () => {
    console.log("Frame navigated:", page.url());
  });

  // Run the adapter
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

  await page.screenshot({ path: "C:/Users/tarun/.gemini/antigravity/brain/dddad5f7-241b-4571-b41e-01247627bd69/taleo_final_review.png", fullPage: true });
  console.log("Screenshot saved to brain/taleo_final_review.png");
  await browser.close();
}

inspectStep3().catch(console.error);
