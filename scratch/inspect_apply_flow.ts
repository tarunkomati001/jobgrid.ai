import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  console.log("JobDetail URL:", page.url());
  const applyLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button")).map(el => ({
      tagName: el.tagName,
      id: el.id,
      text: (el as HTMLElement).innerText?.trim(),
      href: el.getAttribute("href")
    })).filter(x => x.text.toLowerCase().includes("apply"));
  });
  console.log("APPLY LINKS:", JSON.stringify(applyLinks, null, 2));

  // Click the apply button
  const applyBtn = page.locator("a:has-text('Apply')").first();
  await applyBtn.click();
  await page.waitForTimeout(3000);

  console.log("URL after clicking apply:", page.url());
  console.log("Title after clicking apply:", await page.title());

  const pageButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, input[type='button'], input[type='submit']")).map(el => ({
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      text: (el as HTMLElement).innerText?.trim() || (el as any).value || "",
      href: el.getAttribute("href")
    })).filter(x => (x.text && x.text.length < 50) || x.href);
  });
  console.log("ELEMENTS ON LANDING PAGE:", JSON.stringify(pageButtons.slice(0, 15), null, 2));

  await browser.close();
}

main();

