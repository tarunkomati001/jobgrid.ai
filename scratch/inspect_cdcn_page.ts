import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const res = await page.goto("https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611", { waitUntil: "domcontentloaded" });
  console.log("Status:", res?.status());
  console.log("Final URL:", page.url());
  const title = await page.title();
  console.log("Page title:", title);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
  console.log("Body text start:", bodyText);

  const buttonsAndLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, input[type='button'], input[type='submit']")).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim().slice(0, 40),
      href: (el as any).href || (el as any).getAttribute("href"),
      id: el.id,
      className: el.className
    }));
  });
  console.log("Buttons and links:", JSON.stringify(buttonsAndLinks.filter(x => x.text || x.id), null, 2));
  await browser.close();
}
main();

