import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Navigating to TTEC Taleo job...");
  await page.goto("https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Click "I Accept"
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton']").first();
  if (await acceptBtn.isVisible()) {
    console.log("Clicking I Accept...");
    await acceptBtn.click();
    await page.waitForTimeout(4000);
  }

  // Click "Apply as Guest"
  const guestBtn = page.locator("input[id*='guestapply'], input[value='Apply as Guest']").first();
  if (await guestBtn.isVisible()) {
    console.log("Clicking Apply as Guest...");
    await guestBtn.click();
    await page.waitForTimeout(4000);
  }

  // Fill email on Guest Apply
  const emailInp = page.locator("input[id*='email']").first();
  if (await emailInp.isVisible()) {
    console.log("Entering guest email: babufakemail@gmail.com...");
    await emailInp.fill("babufakemail@gmail.com");
    await page.waitForTimeout(500);

    const contBtn = page.locator("input[id*='niceCommandButton_continue'], input[value='Continue']").first();
    await contBtn.click();
    await page.waitForTimeout(5000);
  }

  console.log("URL after entering email:", page.url());
  console.log("Title after entering email:", await page.title());

  const fields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden']), select, textarea")).map(el => {
      const inp = el as any;
      return {
        tagName: el.tagName,
        id: el.id,
        name: inp.name,
        type: inp.type,
        label: (inp.labels && inp.labels[0]?.innerText) || el.closest("tr, td, div")?.querySelector("label, .label")?.innerText || ""
      };
    });
  });
  console.log("APPLICATION FORM FIELDS:", JSON.stringify(fields.slice(0, 20), null, 2));

  await browser.close();
}

main();
