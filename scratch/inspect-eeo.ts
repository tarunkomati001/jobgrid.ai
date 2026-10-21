import { chromium } from "playwright";
import * as fs from "fs";

async function main() {
  const browser = await chromium.launch({
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const url = "https://jobs.ashbyhq.com/veritycloud/infra-engineer";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "networkidle" });
  
  console.log("Waiting 5 seconds for any client-side hydration or rendering...");
  await page.waitForTimeout(5000);
  
  const screenshotPath = "C:\\Users\\Asus\\Desktop\\cluco.ai\\scratch\\verity_debug.png";
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);
  
  const html = await page.content();
  fs.writeFileSync("C:\\Users\\Asus\\Desktop\\cluco.ai\\scratch\\verity_debug.html", html);
  console.log("HTML content saved to scratch/verity_debug.html");
  
  const mainInputs = await page.$$("input, textarea, select");
  console.log(`Main page inputs count: ${mainInputs.length}`);
  
  await browser.close();
}

main().catch(console.error);
