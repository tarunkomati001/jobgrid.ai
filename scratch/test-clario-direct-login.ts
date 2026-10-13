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
  await p.waitForSelector("button[data-automation-id='signInLink']", { timeout: 20000 });
  
  console.log("Switching to Sign In...");
  await p.click("button[data-automation-id='signInLink']");
  await p.waitForTimeout(2000);
  
  await p.fill("input[data-automation-id='email']", "babufakemail@gmail.com");
  await p.fill("input[data-automation-id='password']", "Tarun@2006");
  
  const submitBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  const box = await submitBtn.boundingBox();
  if (box) {
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  
  await p.waitForTimeout(10000);
  console.log("URL after login:", p.url());
  const errorText = await p.evaluate(() => {
    return document.querySelector("[data-automation-id='errorMessage'], [class*='error-message']")?.textContent || "";
  });
  console.log("Error text on screen:", errorText);
  await p.screenshot({ path: "scratch/clario_current_state.png" });
  await b.close();
}

main();
