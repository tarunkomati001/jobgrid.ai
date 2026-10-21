import { chromium } from "playwright";

async function testReload() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume']").first();
  if (await autofillOption.count() > 0) {
    await autofillOption.click({ force: true });
    await p.waitForTimeout(4000);
  }

  // Check where it goes
  console.log("Current URL:", p.url());
  const text = await p.evaluate(() => document.body?.innerText || "");
  console.log("Page text snippet:", text.slice(0, 300));
  await p.screenshot({ path: "scratch/clario_current_state.png" });

  await b.close();
}

testReload().catch(console.error);
