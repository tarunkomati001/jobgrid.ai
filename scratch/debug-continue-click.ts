import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("https://wellfound.com/jobs/signup", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const email = "tharunkomite7@gmail.com";
  const pass = "TharunDev@2024!";
  const name = "Tharun Komite";

  await page.locator("input#user_name").fill(name);
  await page.locator("input#user_email").fill(email);
  await page.locator("input#user_password").fill(pass);
  await page.waitForTimeout(500);

  await page.screenshot({ path: "scratch/debug_before_continue.png" });

  const continueBtn = page.locator("input[type='submit'][value*='Continue']").first();
  await continueBtn.click();
  await page.waitForTimeout(4000);

  await page.screenshot({ path: "scratch/debug_after_continue.png" });

  const pageText = await page.locator("body").innerText();
  console.log("PAGE TEXT AFTER CONTINUE:\n", pageText);

  const errors = await page.locator(".auth-errors, .auth-field__error, [role='alert'], [aria-invalid='true']").all();
  console.log(`Found ${errors.length} error elements:`);
  for (let i = 0; i < errors.length; i++) {
    const text = await errors[i].innerText().catch(() => "");
    const isVis = await errors[i].isVisible().catch(() => false);
    console.log(`  Error[${i}] (visible=${isVis}): "${text.trim()}"`);
  }

  await browser.close();
}

main().catch(console.error);

