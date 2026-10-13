import { chromium } from "playwright";

async function testSignInEnter() {
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

  // Click Sign In link
  const signInLink = p.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink'], [data-automation-id='signInLink']").first();
  if (await signInLink.count() > 0) {
    console.log("Clicking Sign In link...");
    await signInLink.click();
    await p.waitForTimeout(2000);
  }

  console.log("Filling inputs...");
  const emailInp = p.locator("input[data-automation-id='email'], input[data-automation-id='userName']").first();
  await emailInp.fill("babufakemail@gmail.com");

  const pwInp = p.locator("input[data-automation-id='password']").first();
  await pwInp.fill("Tarun@143");

  console.log("Pressing Enter in password field...");
  await pwInp.press("Enter");
  await p.waitForTimeout(5000);

  console.log("URL after Enter:", p.url());
  const bodySnippet = (await p.evaluate(() => document.body.innerText)).slice(0, 300);
  console.log("Body snippet:", bodySnippet);

  await p.screenshot({ path: "scratch/signin_enter_result.png", fullPage: true });

  await b.close();
}

testSignInEnter();
