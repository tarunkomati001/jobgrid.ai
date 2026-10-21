import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Madurai/Sr-Associate-I--Ocular-Health-Pharma-General-Field-Sales---Account-Management_R-2026-49856-1";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Click Apply -> Autofill
  const applyBtn = page.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const autofillBtn = page.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill')").first();
  await autofillBtn.click({ force: true });
  await page.waitForTimeout(5000);

  // Switch to Sign In
  const signInLink = page.locator("button[data-automation-id='signInLink']").first();
  if (await signInLink.count() > 0) {
    await signInLink.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Type credentials
  const emailInput = page.locator("input[data-automation-id='userName'], input[data-automation-id='email']").first();
  await emailInput.fill("babufakemail@gmail.com");
  const pwInput = page.locator("input[data-automation-id='password']").first();
  await pwInput.fill("Tarun@143");

  const submitBtn = page.locator("button[data-automation-id='signInSubmitButton'], [data-automation-id='click_filter'][aria-label*='Sign In']").first();
  await submitBtn.click({ force: true });
  console.log("Logged in! Waiting 8s for next screen...");
  await page.waitForTimeout(8000);

  console.log("Active step URL:", page.url());
  const stepInfo = await page.evaluate(() => {
    const activeStep = document.querySelector("[data-automation-id='progressBarActiveStep']")?.textContent || "";
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], div[data-automation-id]")).map(b => ({
      tag: b.tagName,
      autoId: b.getAttribute("data-automation-id"),
      ariaLabel: b.getAttribute("aria-label"),
      text: (b.textContent || "").trim().slice(0, 40)
    })).filter(x => x.text || x.autoId);

    const inputs = Array.from(document.querySelectorAll("input")).map(i => ({
      type: i.type,
      autoId: i.getAttribute("data-automation-id"),
      name: i.name
    }));

    return { activeStep, buttons, inputs };
  });

  console.log("Active Step:", stepInfo.activeStep);
  console.log("Inputs on screen:", JSON.stringify(stepInfo.inputs, null, 2));
  console.log("Buttons on screen:", JSON.stringify(stepInfo.buttons, null, 2));

  await browser.close();
}

main().catch(console.error);
