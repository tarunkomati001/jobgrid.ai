import { chromium } from "playwright";

async function inspectAlconLogin() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();

  console.log("Navigating to Alcon login...");
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/login?redirect=%2Fen-US%2Fcareers_alcon%2Fjob%2FRueil-Malmaison---Itin%25C3%25A9rant%2FDlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1%2Fapply%2FautofillWithResume%3Fcodes%3DIND");
  await p.waitForTimeout(4000);

  // Accept cookies
  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  console.log("Waiting for inputs on /login...");
  await p.waitForSelector("input", { timeout: 15000 });

  const inputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, [data-automation-id='click_filter']")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label"),
      type: (el as HTMLInputElement).type,
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 30),
      visible: (el as HTMLElement).offsetParent !== null
    })).filter(x => x.visible);
  });
  console.log("Inputs on Alcon /login:", JSON.stringify(inputs, null, 2));

  console.log("Attempting Sign In...");
  const emailInp = p.locator("input[data-automation-id='userName'], input[data-automation-id='email']").first();
  await emailInp.fill("babufakemail@gmail.com");

  const pwInp = p.locator("input[data-automation-id='password']").first();
  await pwInp.fill("ClucoAi@2026!Secure");

  const signInBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
  await signInBtn.click();
  await p.waitForTimeout(6000);

  console.log("Current URL after sign in click:", p.url());
  await p.screenshot({ path: "scratch/alcon_post_login_attempt.png", fullPage: true });

  const bodyText = await p.evaluate(() => document.body?.innerText || "");
  console.log("Body snippet:", bodyText.slice(0, 400));

  await b.close();
}

inspectAlconLogin().catch(console.error);
