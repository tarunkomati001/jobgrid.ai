import { chromium } from "playwright";

async function inspectError() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton']").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click({ force: true });
    await p.waitForTimeout(3000);
  }

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume']").first();
  if (await autofillOption.count() > 0) {
    await autofillOption.click({ force: true });
  }

  await p.waitForSelector("input[data-automation-id='email']", { timeout: 30000 });

  const email = "babufakemail@gmail.com";
  const pw = "ClucoAi@2026!Secure";

  await p.locator("input[data-automation-id='email']").fill(email);
  await p.locator("input[data-automation-id='password']").fill(pw);
  await p.locator("input[data-automation-id='verifyPassword']").fill(pw);

  // Check if there is a terms checkbox or anything else
  const allInputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, [role='checkbox'], [data-automation-id]")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      type: (el as HTMLInputElement).type,
      text: (el as HTMLElement).innerText?.slice(0, 30),
      ariaChecked: el.getAttribute("aria-checked"),
      id: el.id,
      name: (el as HTMLInputElement).name
    }));
  });
  console.log("All inputs and interactive elements:", JSON.stringify(allInputs, null, 2));

  // Try clicking create button using dispatchEvent and click
  console.log("Clicking create account button...");
  const createBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
  await createBtn.click({ force: true });
  await p.waitForTimeout(5000);

  // Look for any alert, error, or validation message
  const alerts = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("[role='alert'], [data-automation-id*='error'], [data-automation-id*='alert'], [class*='error'], [class*='alert'], [aria-invalid='true']")).map(el => ({
      text: (el as HTMLElement).innerText?.trim(),
      html: el.outerHTML?.slice(0, 200)
    }));
  });
  console.log("Alerts or errors found:", JSON.stringify(alerts, null, 2));

  // Also check if account already exists! What if account already exists on Alcon?
  // Let's check Sign In!
  console.log("Checking if Sign In works with babufakemail@gmail.com / ClucoAi@2026!Secure...");
  const signInLink = p.locator("button[data-automation-id='signInLink']").first();
  if (await signInLink.count() > 0) {
    await signInLink.click();
    await p.waitForTimeout(2000);

    await p.locator("input[data-automation-id='userName'], input[data-automation-id='email']").fill(email);
    await p.locator("input[data-automation-id='password']").fill(pw);

    const signInBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
    await signInBtn.click({ force: true });
    await p.waitForTimeout(8000);

    console.log("URL after Sign In:", p.url());
    await p.screenshot({ path: "scratch/alcon_after_sign_in.png" });
  }

  await b.close();
}

inspectError().catch(console.error);
