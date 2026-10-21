import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testTenants() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const candidates = [
    {
      tenant: "Accenture",
      url: "https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074"
    },
    {
      tenant: "Alcon",
      url: "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND"
    }
  ];

  const passwords = ["Tarun@143", "Tarun@2006", "ClucoAi@2026!Secure", "BabuFake123!"];

  for (const item of candidates) {
    console.log(`\n========== Testing ${item.tenant} ==========`);
    await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
    if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
    await applyBtn.click();
    await page.waitForTimeout(3000);

    const autofillOption = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
    if (await autofillOption.count() > 0 && await autofillOption.isVisible()) {
      await autofillOption.click();
      await page.waitForTimeout(4000);
    }

    await page.waitForSelector("button[data-automation-id='signInLink'], input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 20000 });

    const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
    if (await signInLink.count() > 0 && await signInLink.isVisible()) {
      await signInLink.click();
      await page.waitForTimeout(2000);
    }

    for (const pw of passwords) {
      console.log(`Trying babufakemail@gmail.com with ${pw} on ${item.tenant}...`);
      const emailInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email']").first();
      const pwInp = page.locator("input[data-automation-id='password']").first();
      await emailInp.fill("babufakemail@gmail.com");
      await pwInp.fill(pw);

      const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
      await submitBtn.click();
      await page.waitForTimeout(5000);

      const bodyText = await page.evaluate(() => document.body?.innerText || "");
      const hasError = bodyText.includes("wrong email address or password") || bodyText.includes("account might be locked") || bodyText.includes("Invalid") || bodyText.includes("incorrect password");

      console.log(`Result: Error? ${hasError} | URL: ${page.url().slice(0, 70)}`);
      if (!hasError && (bodyText.includes("Autofill") || bodyText.includes("Resume") || bodyText.includes("My Information") || bodyText.includes("step 2") || bodyText.includes("step 3"))) {
        console.log(`🎉 SUCCESS on ${item.tenant} with password ${pw}!`);
        break;
      }
    }
  }

  await browser.close();
}

testTenants().catch(console.error);
