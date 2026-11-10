import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to https://wellfound.com/login...");
  await page.goto("https://wellfound.com/login", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  
  await page.locator("input#user_email, input[type='email']").first().fill("tharunkomite7@gmail.com");
  await page.waitForTimeout(300);
  await page.locator("input#user_password, input[type='password']").first().fill("TharunDev@2024!");
  await page.waitForTimeout(300);
  
  await page.locator("input[type='submit'][value*='Log in' i], button[type='submit']").first().click();
  await page.waitForTimeout(4000);
  
  console.log("URL after login:", page.url());
  const errorLocator = page.locator(".flash, [role='alert'], [class*='error'], [class*='styles_banner']").first();
  if (await errorLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("Error text:", await errorLocator.innerText());
  } else {
    console.log("No error displayed!");
  }
  
  await page.screenshot({ path: "scratch/check_login_result.png" });
  await browser.close();
}

main().catch(console.error);

