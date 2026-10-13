import { chromium } from "playwright";

async function checkErrorText() {
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

  const createBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
  await createBtn.click({ force: true });
  await p.waitForTimeout(4000);

  const errorDetails = await p.evaluate(() => {
    const errorEl = document.querySelector("#wd-icon-media-error");
    if (!errorEl) return "No wd-icon-media-error found";
    let parent = errorEl.parentElement;
    while (parent && parent.innerText?.trim() === "") {
      parent = parent.parentElement;
    }
    return {
      parentText: parent?.innerText,
      parentHtml: parent?.outerHTML?.slice(0, 500)
    };
  });

  console.log("Error details:", JSON.stringify(errorDetails, null, 2));

  // Also check if account already exists on Alcon!
  console.log("Now clicking Sign In...");
  const signInLink = p.locator("button[data-automation-id='signInLink']").first();
  await signInLink.click();
  await p.waitForTimeout(2000);

  await p.locator("input[data-automation-id='userName'], input[data-automation-id='email']").fill(email);
  await p.locator("input[data-automation-id='password']").fill(pw);
  const signInBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  await signInBtn.click({ force: true });
  await p.waitForTimeout(6000);

  console.log("Post Sign In URL:", p.url());
  const postSignInText = await p.evaluate(() => document.body?.innerText || "");
  console.log("Post Sign In body:", postSignInText.slice(0, 300));
  await p.screenshot({ path: "scratch/alcon_signin_test.png" });

  await b.close();
}

checkErrorText().catch(console.error);
