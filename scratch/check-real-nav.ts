import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/Register?jobId=8611");
  await page.waitForTimeout(2000);

  // Fill all inputs
  await page.fill("[id='162']", "Hrutin");
  await page.fill("[id='163']", "Nammi");
  await page.fill("[id='164']", "babufakemail@gmail.com");
  await page.fill("[id='165']", "2025550198");
  await page.fill("[id='251']", "123 Market St");
  await page.fill("[id='168']", "San Francisco");

  // Select California for State
  const calVal = await page.evaluate(() => {
    const sel = document.getElementById("169") as HTMLSelectElement;
    const opt = Array.from(sel.options).find(o => o.text.includes("California"));
    return opt?.value;
  });
  await page.selectOption("[id='169']", calVal || "4803");

  // Zip Code
  await page.fill("[id='683']", "94105");

  // Check consent checkbox (209)
  await page.check("[id='209']");

  // Click Continue
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(() => null),
    page.click("button[name='next'], .WizardButtonPrimary")
  ]);

  await page.waitForTimeout(3000);
  console.log("Current URL after navigation:", page.url());
  const title = await page.title();
  console.log("Page title:", title);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("Body text preview:", bodyText);

  await page.screenshot({ path: "scratch/cdcn_after_real_nav.png", fullPage: true });
  await browser.close();
}

run();

