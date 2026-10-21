import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Click Apply -> Autofill
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill')").first();
  await autofillBtn.click({ force: true });
  await page.waitForTimeout(5000);

  // Switch to Sign In if on Create Account
  const signInLink = page.locator("button[data-automation-id='signInLink']").first();
  if (await signInLink.count() > 0) {
    await signInLink.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Type credentials
  const emailInput = page.locator("input[data-automation-id='userName'], input[data-automation-id='email']").first();
  await emailInput.fill("babufakemail+clario1791812147225@gmail.com");
  const pwInput = page.locator("input[data-automation-id='password']").first();
  await pwInput.fill("Tarun@143");

  const submitBtn = page.locator("button[data-automation-id='signInSubmitButton']").first();
  await submitBtn.click({ force: true });
  console.log("Clicked submit, waiting 6s...");
  await page.waitForTimeout(6000);

  console.log("URL after sign in:", page.url());
  const text = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("Page text snippet:\n", text);

  await browser.close();
}

main().catch(console.error);
