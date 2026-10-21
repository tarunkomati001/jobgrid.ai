import { chromium } from "playwright";

async function inspectPreviousApplicantsScreen() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4862", { waitUntil: "networkidle" });

  // Step 1
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  console.log("Current URL:", page.url());

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a")).map(i => ({
      tag: i.tagName,
      type: (i as any).type,
      id: i.id,
      name: (i as any).name,
      text: i.textContent?.trim(),
      value: (i as any).value
    })).filter(i => i.type !== "hidden");
  });

  console.log("Inputs on screen:", JSON.stringify(inputs, null, 2));

  await browser.close();
}

inspectPreviousApplicantsScreen().catch(console.error);
