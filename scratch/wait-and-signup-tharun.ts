import { chromium } from "playwright";
import { fetchWellfoundVerificationCode } from "../src/ats/wellfound/wellfound-email-verifier";
import { saveWellfoundCredentials } from "../src/ats/wellfound/wellfound-account-store";

async function main() {
  console.log("===============================================================================");
  console.log("⏳ WAITING FOR 3-MINUTE RATE LIMIT TO CLEAR (UNTIL 18:59)...");
  console.log("===============================================================================\n");

  const email = "tharunkomite7@gmail.com";
  const pass = "TharunDev@2024!";
  const name = "Tharun Komite";

  // Countdown 180 seconds
  for (let remaining = 180; remaining > 0; remaining -= 30) {
    console.log(`⏳ Cooldown active... ${remaining} seconds remaining before signup`);
    await new Promise(r => setTimeout(r, 30000));
  }

  console.log("\n🚀 Rate limit cleared! Launching clean browser for signup...");
  const browser = await chromium.launch({
    headless: false,
    slowMo: 120,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  console.log("👉 1. Navigating to https://wellfound.com/jobs/signup...");
  await page.goto("https://wellfound.com/jobs/signup", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  console.log(`✍️ 2. Filling Name: ${name}, Email: ${email}, Password...`);
  await page.locator("input#user_name").fill(name);
  await page.waitForTimeout(400);
  await page.locator("input#user_email").fill(email);
  await page.waitForTimeout(400);
  await page.locator("input#user_password").fill(pass);
  await page.waitForTimeout(500);

  console.log("🚀 3. Clicking Continue to trigger verification code email...");
  const continueBtn = page.locator("input[type='submit'][value*='Continue'], button[type='submit']").first();
  await continueBtn.click();
  await page.waitForTimeout(4000);

  // Check if rate limit error is still present
  const errorText = await page.locator(".auth-errors, .auth-field__error").first().innerText().catch(() => "");
  if (errorText.includes("Too many attempts")) {
    console.warn("⚠️ Rate limit still active. Waiting another 60 seconds...");
    await page.waitForTimeout(60000);
    await continueBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log("⏳ 4. Waiting for input#email_verification_code to appear...");
  const otpInput = page.locator("input#email_verification_code");
  await otpInput.waitFor({ state: "visible", timeout: 20000 });
  console.log("✅ OTP input is visible!");

  console.log("📧 5. Polling Gmail for newest verification code...");
  await page.waitForTimeout(4000);
  const code = await fetchWellfoundVerificationCode(90000, 3000, email, "nviaxddgsnzcxmhc");
  if (!code) {
    throw new Error("Could not retrieve verification code from Gmail.");
  }
  console.log(`✅ Retrieved verification code: ${code}`);

  console.log(`✍️ 6. Entering verification code ${code}...`);
  await otpInput.click();
  await page.keyboard.type(code, { delay: 150 });
  await page.waitForTimeout(1500);

  console.log("🚀 7. Submitting registration...");
  const createAccountBtn = page.locator("input[type='submit'][value*='Create account'], input[type='submit'][name='commit']").first();
  const isEnabled = await createAccountBtn.isEnabled({ timeout: 5000 }).catch(() => false);
  if (isEnabled) {
    await createAccountBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  console.log("⏳ 8. Waiting for account creation redirect...");
  await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);

  console.log("\n===============================================================================");
  console.log("Final Page URL:", page.url());
  console.log("Final Page Title:", await page.title());
  console.log("===============================================================================\n");

  await page.screenshot({ path: "scratch/tharun_signup_completed.png" });
  await saveWellfoundCredentials({
    email,
    password: pass,
    name,
    updatedAt: new Date().toISOString()
  });

  console.log("🎉 Account creation completed and credentials saved!");
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch(console.error);

