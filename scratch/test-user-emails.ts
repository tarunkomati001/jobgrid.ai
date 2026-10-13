import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1";
  console.log("Navigating to Alcon...");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Apply -> Autofill
  await page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first().click({ force: true });
  await page.waitForTimeout(2000);
  await page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first().click({ force: true });
  await page.waitForTimeout(4000);

  const emailsToTest = [
    "babu020106@gmail.com",
    "chetanmidde@gmail.com",
    "komatitarun@yahoo.com"
  ];

  const passwordsToTest = [
    "Tarun@2006",
    "Tarun@143",
    "Nithin@6677"
  ];

  // Make sure we are on Sign In screen
  const signInTab = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], [data-automation-id='click_filter'][aria-label*='Sign In']").first();
  if (await signInTab.count() > 0 && await signInTab.isVisible()) {
    await signInTab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  for (const email of emailsToTest) {
    for (const pw of passwordsToTest) {
      console.log(`Checking Sign In for ${email} with ${pw}...`);
      const emailInp = page.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
      await emailInp.fill(email);
      await emailInp.press("Tab");

      const pwInp = page.locator("input[data-automation-id='password']").first();
      await pwInp.fill(pw);

      const submitBtn = page.locator("button[data-automation-id='signInSubmitButton']").first();
      await submitBtn.click({ force: true });
      await page.waitForTimeout(4000);

      const status = await page.evaluate(() => {
        const text = document.body.innerText || "";
        const isWrong = text.includes("wrong email address or password") || text.includes("locked");
        const isVerification = text.includes("Verify your account");
        const isLoggedIn = text.includes("Candidate Home") || text.includes("Settings") || !document.querySelector("input[data-automation-id='password']");
        return { isWrong, isVerification, isLoggedIn, url: window.location.href };
      });

      console.log(`-> ${email} (${pw}): loggedIn=${status.isLoggedIn}, isWrong=${status.isWrong}, isVerification=${status.isVerification}`);
      if (status.isLoggedIn) {
        console.log(`🎉 LOGGED IN SUCCESSFULLY WITH ${email} / ${pw}!`);
        await page.screenshot({ path: "scratch/alcon_user_success.png" });
        await browser.close();
        process.exit(0);
      }
    }
  }

  console.log("None of the accounts could sign in directly. Testing account creation...");
  await browser.close();
}

main().catch(console.error);
