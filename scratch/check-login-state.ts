import { chromium } from "playwright";

async function checkLoginState() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/Login?jobId=9343", { waitUntil: "domcontentloaded" });

  const uInput = page.locator("#tpt_loginUsername, #username").first();
  const pInput = page.locator("#tpt_loginPassword, #password").first();
  const submitLogin = page.locator("button[name='Login'], button[type='submit']").first();

  await uInput.fill("babufakemail@gmail.com");
  await pInput.fill("HrutinDev@2024!");
  await submitLogin.click();
  await page.waitForTimeout(3000);

  const errors = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".form__error, .error, .errorMessage, [role='alert'], .notification, .flash-message")).map(el => el.textContent?.trim()).filter(Boolean);
  });
  console.log("Errors after login submit:", errors);

  await browser.close();
}

checkLoginState().catch(console.error);

