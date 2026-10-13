import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  const c = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await c.count() > 0) await c.click();
  
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);
  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForSelector("input[data-automation-id='email'], input[data-automation-id='verifyPassword']", { timeout: 20000 });
  
  console.log("Filling registration fields...");
  await p.fill("input[data-automation-id='email']", "babufakemail+1@gmail.com");
  await p.fill("input[data-automation-id='password']", "Tarun@2006");
  await p.fill("input[data-automation-id='verifyPassword']", "Tarun@2006");
  
  const cb = p.locator("div[data-automation-id='createAccountCheckbox'] input[type='checkbox']").first();
  if (await cb.count() > 0) {
    await cb.scrollIntoViewIfNeeded();
    await cb.check({ force: true });
  }
  
  const createBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Create Account'], button[data-automation-id='createAccountSubmitButton']").first();
  await createBtn.scrollIntoViewIfNeeded();
  await p.waitForTimeout(500);
  
  const box = await createBtn.boundingBox();
  console.log("Create button bounding box:", box);
  if (box) {
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await createBtn.click({ force: true });
  }
  
  console.log("Waiting 12s for account creation and redirect...");
  await p.waitForTimeout(12000);
  console.log("Current URL:", p.url());
  
  await p.screenshot({ path: "scratch/after_create_scrolled.png", fullPage: true });
  await b.close();
}

main();
