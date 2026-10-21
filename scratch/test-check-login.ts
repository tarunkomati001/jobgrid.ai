import { chromium } from "playwright";

async function checkLogin() {
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
  await p.waitForTimeout(4000);

  const signInTab = p.locator("button[data-automation-id='signInLink']").first();
  if (await signInTab.count() > 0) await signInTab.click();
  await p.waitForTimeout(1000);

  // Test Tarun@143
  console.log("Trying Tarun@143...");
  await p.locator("input[data-automation-id='userName'], input[data-automation-id='email']").fill("babufakemail@gmail.com");
  await p.locator("input[data-automation-id='password']").fill("Tarun@143");
  
  const clickFilter = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  if (await clickFilter.count() > 0) {
    await clickFilter.click({ force: true });
  } else {
    await p.locator("button[data-automation-id='signInSubmitButton']").click({ force: true });
  }
  await p.waitForTimeout(5000);
  console.log("URL after Tarun@143:", p.url());
  let bodyText = await p.evaluate(() => document.body.innerText);
  console.log("Page text contains error:", bodyText.includes("Invalid") || bodyText.includes("Error") || bodyText.includes("incorrect") ? "YES" : "NO");
  if (bodyText.includes("Invalid") || bodyText.includes("incorrect")) {
    console.log("Snippet:", bodyText.slice(0, 300));
  }

  if (p.url().includes("/login") || await p.locator("input[data-automation-id='password']").count() > 0) {
    console.log("\nTrying ClucoAi@2026!Secure...");
    await p.locator("input[data-automation-id='password']").fill("ClucoAi@2026!Secure");
    const cf = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
    if (await cf.count() > 0) await cf.click({ force: true });
    else await p.locator("button[data-automation-id='signInSubmitButton']").click({ force: true });
    await p.waitForTimeout(5000);
    console.log("URL after ClucoAi@2026!Secure:", p.url());
    bodyText = await p.evaluate(() => document.body.innerText);
    console.log("Contains error:", bodyText.includes("Invalid") || bodyText.includes("incorrect") ? "YES" : "NO");
  }

  await b.close();
}

checkLogin();
