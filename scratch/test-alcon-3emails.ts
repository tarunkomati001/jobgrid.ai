import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1/apply/autofillWithResume";
  console.log("Navigating to Alcon application URL...");
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  // Click Sign In link to ensure we are on the Sign In form
  const signInLoc = page.locator("[data-automation-id='signInLink'], a:has-text('Sign In'), button:has-text('Sign In')").first();
  if (await signInLoc.count() > 0) {
    console.log("Clicking Sign In tab/link...");
    await signInLoc.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // Wait for email and password inputs to mount
  await page.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 15000 });

  const emails = [
    "babu020106@gmail.com",
    "chetanmidde@gmail.com",
    "komatitarun@yahoo.com"
  ];

  const passwords = [
    "Tarun@2006",
    "Tarun@143",
    "Nithin@6677"
  ];

  for (const email of emails) {
    for (const pw of passwords) {
      console.log(`\n👉 Testing email: ${email} | password: ${pw}...`);
      const emailInp = page.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
      await emailInp.focus();
      await emailInp.fill(email);
      await emailInp.press("Tab");

      const pwInp = page.locator("input[data-automation-id='password']").first();
      await pwInp.focus();
      await pwInp.fill(pw);

      const submitBtn = page.locator("button[data-automation-id='signInSubmitButton']").first();
      await submitBtn.click({ force: true });
      await page.waitForTimeout(4000);

      const status = await page.evaluate(() => {
        const text = (document.body.innerText || "").toLowerCase();
        const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='errorBanner'], div[role='alert']")?.textContent?.trim() || "";
        const isWrong = err.toLowerCase().includes("wrong email") || err.toLowerCase().includes("locked");
        const isVerification = text.includes("verify your account");
        const isLoggedIn = text.includes("candidate home") || text.includes("settings") || !document.querySelector("input[data-automation-id='password']");
        return { isWrong, isVerification, isLoggedIn, err, url: window.location.href };
      });

      console.log(`Status -> loggedIn: ${status.isLoggedIn}, isWrong: ${status.isWrong}, isVerification: ${status.isVerification}`);
      if (status.err) console.log(`Error banner: "${status.err}"`);

      if (status.isLoggedIn) {
        console.log(`🎉 SUCCESS! Logged in with ${email} / ${pw}!`);
        await page.screenshot({ path: "scratch/alcon_login_success.png" });
        await browser.close();
        process.exit(0);
      }
    }
  }

  console.log("\nNone of the 3 accounts exist/logged in. Will test account creation next.");
  await page.screenshot({ path: "scratch/alcon_tested_3emails.png" });
  await browser.close();
}

main().catch(console.error);
