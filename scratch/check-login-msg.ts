import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/login";
  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("Waiting for login inputs on Clario...");
  await page.waitForSelector("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName'], input[type='email']", { timeout: 15000 });
  await page.waitForTimeout(2000);

  const email = "babufakemail+clario1791812147225@gmail.com";
  const password = "Tarun@2006";
  console.log("Testing Clario login for:", email, "with Tarun@2006...");

  const userInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName'], input[type='email']").first();
  await userInp.click();
  await userInp.fill(email);

  const pwInp = page.locator("input[data-automation-id='password'], input[name='password']").first();
  await pwInp.click();
  await pwInp.fill(password);

  const submitBtn = page.locator("button[data-automation-id='signInSubmitButton'], [data-automation-id='click_filter'][aria-label*='Sign In']").first();
  console.log("Clicking Sign In button...");
  await submitBtn.click({ force: true });
  await pwInp.press("Enter");

  for (let s = 1; s <= 10; s++) {
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], div[role='alert']")?.textContent || "";
      const text = document.body?.innerText?.slice(0, 300) || "";
      const hasCandidateHome = !!document.querySelector("[data-automation-id='navigationItem-Candidate Home'], [data-automation-id='utilityButtonBarSettingsMenu'], [data-automation-id='utilityButtonAccountTasksMenu']");
      return { err, text, hasCandidateHome, url: window.location.href };
    });
    console.log(`[T+${s}s] hasCandHome: ${info.hasCandidateHome} | url: ${info.url} | err: "${info.err}"`);
    if (info.err || info.hasCandidateHome) break;
  }

  await browser.close();
}

main().catch(console.error);
