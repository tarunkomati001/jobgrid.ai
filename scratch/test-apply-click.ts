import { chromium } from "playwright";

async function checkApplyLinks() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://zeromotorcycles.recruitee.com/o/functional-safety-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyEls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button")).filter(e => /apply/i.test(e.textContent || "")).map(e => ({
      tag: e.tagName,
      href: (e as HTMLAnchorElement).href,
      onclick: e.getAttribute("onclick"),
      class: e.className,
      outerHtml: e.outerHTML.slice(0, 300)
    }));
  });

  console.log("Apply elements:", applyEls);
  await browser.close();
}
checkApplyLinks().catch(console.error);
