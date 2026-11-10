import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const applyBtn = page.locator("a:has-text('Apply Now'), a:has-text('Apply'), button:has-text('Apply Now'), button:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);
  console.log("Current URL after Apply click:", page.url());

  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button")).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 50),
      href: (el as any).href || (el as any).getAttribute("href")
    }));
  });
  console.log("Links on page:", links);
  await browser.close();
}
main();

