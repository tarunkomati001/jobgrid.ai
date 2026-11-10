import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER00045QI&lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton'], button:has-text('I Accept')").first();
  if (await acceptBtn.isVisible()) {
    console.log("Clicking Accept...");
    await acceptBtn.click();
    await page.waitForTimeout(4000);
  }

  console.log("Current URL:", page.url());
  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      value: (el as any).value,
      text: el.textContent?.trim().slice(0, 40)
    })).filter(x => x.id || x.value || x.text);
  });
  console.log("Elements after accept:", JSON.stringify(elements, null, 2));
  await page.screenshot({ path: "scratch/daimler_login_step.png" });
  await browser.close();
}

main();
