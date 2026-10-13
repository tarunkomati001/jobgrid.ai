import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://accenture.wd103.myworkdayjobs.com/en-US/AccentureCareers/details/Analistas-e-Consultores-SAP-BTP_R00253074");
  await p.waitForTimeout(3000);
  
  const c = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await c.count() > 0) await c.click();
  
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);
  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForTimeout(3000);
  
  const emailSignInBtn = p.locator("button:has-text('Sign in with email'), [data-automation-id*='signInWithEmail'], div:has-text('Sign in with email')").last();
  console.log("Sign in with email count:", await emailSignInBtn.count());
  if (await emailSignInBtn.count() > 0) {
    await emailSignInBtn.click();
    await p.waitForTimeout(2500);
  }
  
  const inputs = await p.evaluate(() => Array.from(document.querySelectorAll("input")).map(i => ({ id: i.id, autoId: i.getAttribute("data-automation-id"), type: i.type })));
  console.log("Inputs after click:", JSON.stringify(inputs, null, 2));
  await p.screenshot({ path: "scratch/accenture_after_email_click.png" });
  await b.close();
}

main();
