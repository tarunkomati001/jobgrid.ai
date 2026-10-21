import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testTenant(company: string, url: string) {
  console.log(`\n================ Testing ${company} ================`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(3000);

    // Accept cookies
    const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
    if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
      await cookieBtn.click();
      await page.waitForTimeout(1000);
    }

    // Try direct header "Sign In" button first if available!
    const headerSignIn = page.locator("button[data-automation-id='utilityButtonSignIn'], a[data-automation-id='utilityButtonSignIn'], button:has-text('Sign In'), a:has-text('Sign In')").first();
    let clickedHeader = false;
    if (await headerSignIn.count() > 0 && await headerSignIn.isVisible()) {
      console.log(`Found direct header Sign In button on ${company}, clicking...`);
      await headerSignIn.click();
      clickedHeader = true;
      await page.waitForTimeout(3000);
    }

    if (!clickedHeader) {
      const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
      if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
        await applyBtn.click();
        await page.waitForTimeout(3000);
      }
      const autofill = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
      if (await autofill.count() > 0 && await autofill.isVisible()) {
        await autofill.click();
        await page.waitForTimeout(3000);
      }
    }

    // Check if on Create Account and switch to Sign In
    const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], div[data-automation-id='click_filter'][aria-label='Sign In']").first();
    if (await signInLink.count() > 0 && await signInLink.isVisible()) {
      console.log(`Switching to Sign In tab on ${company}...`);
      await signInLink.click({ force: true });
      await page.waitForTimeout(2500);
    }

    // Target active email and password
    const emailInputs = page.locator("input[data-automation-id='email'], input[data-automation-id='userName']");
    const activeEmail = emailInputs.last();
    const pwInputs = page.locator("input[data-automation-id='password']");
    const activePw = pwInputs.last();

    if (await activeEmail.count() > 0 && await activeEmail.isVisible()) {
      console.log(`Entering credentials on ${company}...`);
      await activeEmail.fill("tarunkomati2@gmail.com");
      await activePw.fill("Tarun@143");

      const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").last();
      await submitBtn.click({ force: true });
      await activePw.press("Enter").catch(() => {});

      await page.waitForTimeout(8000);

      const status = await page.evaluate(() => {
        const text = (document.body?.innerText || "").toLowerCase();
        const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], [data-automation-id='errorBanner'], div[role='alert']")?.textContent?.trim() || "";
        const loggedIn = text.includes("candidate home") || text.includes("settings") || text.includes("job alerts") || (!text.includes("sign in") && !text.includes("create account"));
        return { err, loggedIn, url: window.location.href };
      });

      console.log(`Result on ${company}:`, JSON.stringify(status, null, 2));
      await page.screenshot({ path: `scratch/result_${company.toLowerCase()}.png` });
      return status;
    } else {
      console.log(`Could not find active email input on ${company}`);
    }
  } catch (err: any) {
    console.error(`Error on ${company}:`, err.message);
  } finally {
    await browser.close();
  }
}

async function main() {
  await testTenant("Alcon", "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1");
  await testTenant("Workday", "https://workday.wd5.myworkdayjobs.com/en-US/Workday/details/Senior-Responsible-AI-Systems-Engineer_JR-0110115");
}

main().catch(console.error);
