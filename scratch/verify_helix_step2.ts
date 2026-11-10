import { chromium } from "playwright";
import { TaleoAdapter } from "../src/ats/taleo/taleo.adapter";
import { HRUTIN_BLUEPRINT_PROFILE } from "../src/database/user-profile.service";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function verifyHelixStep2() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  const page = await context.newPage();

  const profile = {
    ...HRUTIN_BLUEPRINT_PROFILE,
    street: "500 Oracle Parkway",
    addressLine2: "Suite 100",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    country: "United States",
    phone: "4155552671"
  };

  await page.goto("https://phf.tbe.taleo.net/phf01/ats/careers/v2/viewRequisition?org=HELIXESG&cws=45&rid=1023");
  await page.waitForTimeout(2000);

  const adapter = new TaleoAdapter();
  // Fill Step 1 & Step 2
  await adapter.fillForm(page, profile);

  console.log("Fill completed. Final URL:", page.url(), "Title:", await page.title());
  await page.screenshot({ path: "scratch/helix_step2_verified.png", fullPage: true });
  await browser.close();
}

verifyHelixStep2().catch(console.error);

