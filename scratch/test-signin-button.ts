import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(2000);
  
  const c = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await c.count() > 0) await c.click();
  
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);
  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForTimeout(2000);
  
  console.log("Clicking 'Create Account' link...");
  const createLink = p.locator("button[data-automation-id='createAccountLink'], a[data-automation-id='createAccountLink'], button:has-text('Create Account')").first();
  if (await createLink.count() > 0) {
    await createLink.click();
    await p.waitForTimeout(2000);
  }
  
  const verifyPw = p.locator("input[data-automation-id='verifyPassword']").first();
  console.log("Has verifyPassword on Create Account screen:", await verifyPw.count() > 0);
  
  if (await verifyPw.count() > 0) {
    console.log("Creating account with babufakemail@gmail.com and Tarun@2006...");
    await p.fill("input[data-automation-id='email']", "babufakemail@gmail.com");
    await p.fill("input[data-automation-id='password']", "Tarun@2006");
    await verifyPw.fill("Tarun@2006");
    
    const cb = p.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox']").first();
    if (await cb.count() > 0) await cb.check({ force: true });
    
    const createBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account']").first();
    const box = await createBtn.boundingBox();
    if (box) {
      await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
    
    await p.waitForTimeout(6000);
    console.log("URL after Create Account:", p.url());
    const text = await p.evaluate(() => document.body?.innerText || "");
    console.log("Page text after creation attempt:", text.slice(0, 400));
    await p.screenshot({ path: "scratch/clario_create_result.png" });
  }

  await b.close();
}

main();
