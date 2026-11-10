import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";

async function dumpStep3Html() {
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

  // Fill Step 2 using TaleoAdapter
  const { TaleoAdapter } = await import("../src/ats/taleo/taleo.adapter");
  const adapter = new TaleoAdapter();
  await (adapter as any).handleTbeWorkflow(page, {
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
  }, "babufakemail@gmail.com", "Tarun@2006!Secure");

  // We want to stop on Step 3 or inspect what's on Step 3
  // Let's re-navigate or go back to Step 3
  await page.waitForTimeout(2000);
  console.log("Current page after workflow:", page.url(), await page.title());

  // Let's click Prev arrow to go back to Step 3 if we advanced past it
  for (let i = 0; i < 5; i++) {
    const title = await page.title();
    console.log(`Step title: ${title}`);
    if (title.toLowerCase().includes("resume")) {
      break;
    }
    const prevBtn = page.locator(".oracletaleocwsv2-arrow-nav-prev:visible").first();
    if (await prevBtn.count() > 0) {
      await prevBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  const html = await page.evaluate(() => {
    return document.body.innerHTML;
  });

  fs.writeFileSync("scratch/step3_raw.html", html);
  console.log("Wrote step3_raw.html. Length:", html.length);
  await page.screenshot({ path: "scratch/step3_current.png", fullPage: true });
  await browser.close();
}

dumpStep3Html().catch(console.error);
