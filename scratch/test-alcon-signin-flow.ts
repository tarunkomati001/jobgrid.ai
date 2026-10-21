import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function testSignIn() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 900 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
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
  await autofillOption.click();

  await page.waitForSelector("button[data-automation-id='signInLink'], input[data-automation-id='email']", { timeout: 25000 });

  // Click Sign In link
  console.log("Clicking Sign In link...");
  const signInLink = page.locator("button[data-automation-id='signInLink'], a[data-automation-id='signInLink']").first();
  await signInLink.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: "scratch/alcon_signin_screen.png", fullPage: true });

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input")).map(i => ({
      id: i.id,
      name: i.name,
      automationId: i.getAttribute("data-automation-id"),
      type: i.type,
      visible: (i as HTMLElement).offsetParent !== null
    }));
  });
  console.log("Sign In inputs:", JSON.stringify(inputs, null, 2));

  // Try signing in with saved credentials: babufakemail@gmail.com and Tarun@2006
  const emailInp = page.locator("input[data-automation-id='userName'], input[data-automation-id='email'], input[name='userName']").first();
  const pwInp = page.locator("input[data-automation-id='password'], input[name='password']").first();
  await emailInp.fill("babufakemail@gmail.com");
  await pwInp.fill("Tarun@2006");

  const submitBtn = page.locator("div[data-automation-id='click_filter'][aria-label='Sign In'], button[data-automation-id='signInSubmitButton']").first();
  console.log("Submitting Sign In...");
  await submitBtn.click();
  await page.waitForTimeout(6000);

  await page.screenshot({ path: "scratch/alcon_post_signin.png", fullPage: true });
  console.log("Post signin URL:", page.url());

  const postText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || "");
  console.log("Post signin body text:\n", postText);

  await browser.close();
}

testSignIn().catch(console.error);
