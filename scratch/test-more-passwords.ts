import { chromium } from "playwright";

async function testMorePasswords() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });
  await p.waitForTimeout(3000);

  const signInLink = p.locator("[data-automation-id='signInLink'], a:has-text('Sign In'), button:has-text('Sign In')").filter({ hasText: /Sign In/i }).first();
  if (await signInLink.count() > 0) {
    await signInLink.click();
    await p.waitForTimeout(2000);
  }

  const pws = ["Tarun@2006", "Tarunbabu@2006", "Hrutin@12345", "Tarun@143!"];
  for (const pw of pws) {
    console.log(`Trying ${pw}...`);
    await p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first().fill("babufakemail@gmail.com");
    await p.locator("input[data-automation-id='password']").first().fill(pw);
    const submitBtn = p.locator("button[data-automation-id='signInSubmitButton']").first();
    await submitBtn.click({ force: true });
    await p.waitForTimeout(4000);
    const errText = await p.evaluate(() => {
      const err = document.querySelector("[data-automation-id='errorMessage'], [class*='error'], [role='alert']");
      return err?.textContent || "";
    });
    console.log(`Result for ${pw}:`, errText ? `FAILED: ${errText}` : "SUCCESS OR REDIRECT");
    console.log("Current URL:", p.url());
    if (!p.url().includes("/apply/autofillWithResume") || !errText) {
      console.log(`🎉 SUCCESS WITH PASSWORD: ${pw}`);
      break;
    }
  }

  await b.close();
}

testMorePasswords();
