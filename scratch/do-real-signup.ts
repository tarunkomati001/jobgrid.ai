import { createPersistentBrowserContext } from "../src/browser/browser-manager";
import { fetchWellfoundVerificationCode, fetchWellfoundVerificationLink } from "../src/ats/wellfound/wellfound-email-verifier";
import { typeLikeHuman, humanClick } from "../src/browser/form-filler";

async function main() {
  console.log("===============================================================================");
  console.log("🚀 CREATING BRAND NEW WELLFOUND ACCOUNT FOR THARUN");
  console.log("===============================================================================\n");

  const email = "tharunkomite7@gmail.com";
  const pass = "TharunDev@2024!";
  const name = "Tharun Komite";

  const context = await createPersistentBrowserContext(false);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // 1. Clear all cookies to guarantee clean slate
  console.log("🧹 Clearing cookies and storage...");
  await context.clearCookies();

  // 2. Navigate directly to jobs signup
  console.log("👉 Navigating to https://wellfound.com/jobs/signup...");
  await page.goto("https://wellfound.com/jobs/signup", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  console.log("Current URL:", page.url());
  console.log("Page Title:", await page.title());

  // 3. Fill Name
  console.log(`✍️ Filling Name: ${name}...`);
  const nameInput = page.locator("input#user_name, input[name='user[name]'], input[name*='name' i]").first();
  await nameInput.waitFor({ state: "visible", timeout: 5000 });
  await nameInput.fill(name);
  await page.waitForTimeout(400);

  // 4. Fill Email
  console.log(`✍️ Filling Email: ${email}...`);
  const emailInput = page.locator("input#user_email, input[name='username'], input[type='email']").first();
  await emailInput.waitFor({ state: "visible", timeout: 5000 });
  await emailInput.fill(email);
  await page.waitForTimeout(400);

  // 5. Fill Password
  console.log(`✍️ Filling Password...`);
  const passInput = page.locator("input#user_password, input[name='password'], input[type='password']").first();
  await passInput.waitFor({ state: "visible", timeout: 5000 });
  await passInput.fill(pass);
  await page.waitForTimeout(400);

  await page.screenshot({ path: "scratch/signup_step3_filled.png" });

  // 6. Submit form
  console.log("🚀 Clicking Submit button...");
  const submitBtn = page.locator("input[type='submit'], button[type='submit'], button:has-text('Sign up'), button:has-text('Create account')").first();
  await humanClick(page, submitBtn);
  await page.waitForTimeout(5000);

  console.log("URL after submission:", page.url());
  await page.screenshot({ path: "scratch/signup_step4_after_submit.png" });

  // 7. Check if verification is needed
  const pageText = await page.locator("body").innerText().catch(() => "");
  console.log("Page text excerpt:\n", pageText.slice(0, 400));

  if (pageText.toLowerCase().includes("verify") || pageText.toLowerCase().includes("code") || pageText.toLowerCase().includes("inbox") || pageText.toLowerCase().includes("sent you an email")) {
    console.log("\n📧 Verification required! Checking Gmail via IMAP for OTP / Link...");
    const otpInput = page.locator("input[name*='code' i], input[placeholder*='code' i], input[maxlength='6']").first();
    const hasOtpField = await otpInput.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasOtpField) {
      console.log("🔢 Detected OTP input. Polling Gmail...");
      const code = await fetchWellfoundVerificationCode(90000, 5000, email, "nviaxddgsnzcxmhc");
      if (code) {
        console.log(`✅ Entering code: ${code}`);
        await otpInput.fill(code);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(5000);
      }
    } else {
      console.log("🔗 No OTP input. Polling Gmail for verification link...");
      const link = await fetchWellfoundVerificationLink(90000, 5000, email, "nviaxddgsnzcxmhc");
      if (link) {
        console.log(`✅ Navigating to verification link: ${link}`);
        await page.goto(link, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForTimeout(5000);
      }
    }
  }

  await page.screenshot({ path: "scratch/signup_step5_final.png" });
  console.log("\nURL at end of flow:", page.url());
  console.log("Holding browser open for 15 seconds...");
  await page.waitForTimeout(15000);
  await context.close();
}

main().catch(console.error);
