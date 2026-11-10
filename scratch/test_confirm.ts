import { chromium } from "playwright";
import { DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_USER_AGENT,
    viewport: { width: 1280, height: 950 }
  });
  const page = await context.newPage();
  const url = "https://phe.tbe.taleo.net/dispatcher/servlet/DispatcherServlet?org=TECHNATOMY&act=redirectCws&cws=38&redirectUrl=%2Fats%2Fcareers%2FCWSProspectConfirmation.jsp%3FcurrentTime%3D1794299768714%26passwordUpdateId%3D38975%26org%3DTECHNATOMY%26entityId%3D32039%26rid%3D2771%26cws%3D38%26et%3DPROSP%26signature%3Dlq9xcxecgByZYSMYvtFSF2otK5Q0EMoYpvOsG9TCXCo%253D";
  
  console.log("Navigating to verification URL...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);
  
  console.log("Confirmed URL:", page.url());
  console.log("Confirmed Title:", await page.title());
  
  const continueLink = page.locator("a:has-text('Continue')").first();
  if (await continueLink.count() > 0) {
    console.log("Clicking Continue link...");
    await continueLink.click();
    await page.waitForTimeout(4000);
    console.log("After Continue URL:", page.url());
    console.log("After Continue Title:", await page.title());
  }

  await page.screenshot({ path: "scratch/technatomy_confirmed.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
