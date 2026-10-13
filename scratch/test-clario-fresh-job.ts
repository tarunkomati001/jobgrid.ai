import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";

async function main() {
  const b = await chromium.launch({ headless: true });
  const c = await b.newContext({ userAgent: DEFAULT_USER_AGENT, viewport: { width: 1280, height: 950 } });
  await applyStealthScripts(c);
  const p = await c.newPage();

  console.log("Navigating to Clario careers search...");
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton'], button:has-text('Accept')").first();
  if (await cookieBtn.count() > 0 && await cookieBtn.isVisible()) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  // Click the first job title
  const firstJob = p.locator("a[data-automation-id='jobTitle']").first();
  const title = await firstJob.innerText();
  const href = await firstJob.getAttribute("href");
  console.log("First Job Title:", title);
  console.log("First Job Href:", href);

  await firstJob.click();
  await p.waitForTimeout(3000);

  console.log("Job details URL:", p.url());
  await p.screenshot({ path: "scratch/clario_fresh_job_details.png" });

  const applyBtn = p.locator("a[data-automation-id='adventureButton'], button[data-automation-id='adventureButton'], a:has-text('Apply'), button:has-text('Apply')").first();
  console.log("Apply button count on fresh job:", await applyBtn.count());
  if (await applyBtn.count() > 0) {
    await applyBtn.click({ force: true });
    await p.waitForTimeout(2000);
  }

  await p.screenshot({ path: "scratch/clario_fresh_after_apply.png" });

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume'], button[data-automation-id='autofillWithResume'], [role='button']:has-text('Autofill with Resume')").first();
  console.log("Autofill option count:", await autofillOption.count());
  if (await autofillOption.count() > 0) {
    await autofillOption.click({ force: true });
    await p.waitForTimeout(4000);
  }

  await p.screenshot({ path: "scratch/clario_fresh_auth_screen.png" });
  console.log("Fresh Auth Screen URL:", p.url());

  await b.close();
}

main().catch(console.error);
