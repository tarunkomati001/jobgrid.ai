import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(c);
  const p = await c.newPage();

  console.log("1. Navigating to Software-Developer_R18300...");
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Software-Developer_R18300", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept Cookies'), button:has-text('Accept All')").first();
  console.log("Cookie button count:", await cookieBtn.count());
  if (await cookieBtn.count() > 0) {
    console.log("Clicking Accept Cookies...");
    await cookieBtn.click();
    await p.waitForTimeout(2000);
  }

  await p.screenshot({ path: "scratch/clario_after_cookies.png" });

  const applyBtn = p.locator("button:has-text('Apply'), a:has-text('Apply'), [data-automation-id='adventureButton']").first();
  console.log("Apply button count:", await applyBtn.count());
  if (await applyBtn.count() > 0) {
    console.log("Clicking Apply button...");
    await applyBtn.click({ force: true });
    await p.waitForTimeout(3000);
  }

  await p.screenshot({ path: "scratch/clario_after_apply_click.png" });

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
  console.log("Autofill option count:", await autofillOption.count());
  if (await autofillOption.count() > 0) {
    console.log("Clicking Autofill with Resume...");
    await autofillOption.click({ force: true });
    await p.waitForTimeout(5000);
  }

  await p.screenshot({ path: "scratch/clario_after_autofill_option.png" });
  console.log("Final URL:", p.url());

  await b.close();
}

main().catch(console.error);
