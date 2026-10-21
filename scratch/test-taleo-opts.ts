import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const url = "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5008";
  await page.goto(url, { waitUntil: "networkidle" });

  const applyBtn = page.locator("a:has-text('Apply Now'), button:has-text('Apply Now')").first();
  if (await applyBtn.count() > 0) {
    await applyBtn.click();
    await page.waitForTimeout(3000);
  }

  // Login
  if (await page.locator("input[name='email']").count() > 0) {
    await page.fill("input[name='email']", "babufakemail@gmail.com");
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.fill("input[name='cwsPassword_2']", "Tarun@2006");
    await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
    await page.waitForTimeout(3000);
  }

  if (page.url().includes("candidateLogin")) {
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.locator("button[name='login'], button:has-text('Login')").first().click();
    await page.waitForTimeout(4000);
  }

  // Check state options
  const stateOpts = await page.evaluate(() => {
    const sel = document.querySelector("select[name='state']") as HTMLSelectElement;
    if (!sel) return [];
    return Array.from(sel.options).map(o => ({ text: o.text, value: o.value }));
  });
  console.log("State options count before country change:", stateOpts.length);
  console.log("Sample state options:", stateOpts.slice(0, 10));

  // Check what happens when country changes
  const countryOpts = await page.evaluate(() => {
    const sel = document.querySelector("select[name='country']") as HTMLSelectElement;
    if (!sel) return [];
    return Array.from(sel.options).map(o => ({ text: o.text, value: o.value }));
  });
  console.log("Country options sample:", countryOpts.filter(c => c.text.includes("United States") || c.text.includes("India")));

  await browser.close();
}

main().catch(console.error);
