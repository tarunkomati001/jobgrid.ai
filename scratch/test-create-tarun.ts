import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1/apply/autofillWithResume";
  console.log("Navigating to:", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const cookieBtn = page.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check if Create Account tab is present
  const createTab = page.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink']").first();
  if (await createTab.count() > 0 && await createTab.isVisible()) {
    console.log("Switching to Create Account tab...");
    await createTab.click();
    await page.waitForTimeout(2000);
  }

  const emailInp = page.locator("input[data-automation-id='email']:not([name='website'])").first();
  const pwInp = page.locator("input[data-automation-id='password']:not([name='website'])").first();
  const vpwInp = page.locator("input[data-automation-id='verifyPassword']:not([name='website'])").first();
  const cb = page.locator("input[type='checkbox']").first();

  console.log("Filling Create Account form with tarunkomati2@gmail.com / Tarun@143...");
  await emailInp.fill("tarunkomati2@gmail.com");
  await pwInp.fill("Tarun@143");
  await vpwInp.fill("Tarun@143");
  if (await cb.count() > 0) {
    await cb.check({ force: true });
  }

  await page.screenshot({ path: "scratch/alcon_create_tarun_filled.png" });

  const submit = page.locator("button[data-automation-id='createAccountSubmitButton'], div[data-automation-id='click_filter'][aria-label*='Create Account']").first();
  console.log("Submitting Create Account...");
  await submit.click({ force: true });
  await page.waitForTimeout(8000);

  await page.screenshot({ path: "scratch/alcon_create_tarun_after.png" });

  const res = await page.evaluate(() => {
    const err = document.querySelector("[data-automation-id='errorMessage'], [data-automation-id='formErrorBanner'], div[role='alert']")?.textContent?.trim() || "";
    const body = document.body?.innerText?.slice(0, 500) || "";
    return { err, body, url: window.location.href };
  });

  console.log("Create Account Result:\n", JSON.stringify(res, null, 2));

  await browser.close();
}

main().catch(console.error);
