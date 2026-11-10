import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://tas-daimler.taleo.net/careersection/ex/jobsearch.ftl?lang=en", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // If privacy statement, accept
  const acceptBtn = page.locator("input[value='I Accept'], input[id*='ContinueButton']").first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForTimeout(3000);
  }

  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a")).map(a => ({
      text: a.innerText.trim(),
      href: a.href
    })).filter(x => x.href && !x.href.startsWith("javascript") && !x.href.includes("#"));
  });
  console.log("ALL LINKS:", JSON.stringify(allLinks.slice(0, 15), null, 2));

  await browser.close();
}

main();
