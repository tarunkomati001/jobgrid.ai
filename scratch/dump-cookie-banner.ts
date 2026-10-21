import { chromium } from "playwright";

async function dumpCookieBanner() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const bannerDetails = await page.evaluate(() => {
    // Find the element containing "Cookies agreement"
    const headers = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, div, span, p"));
    const h = headers.find(el => el.textContent?.trim() === "Cookies agreement");
    if (!h) return "Not found";

    // Traverse up to find dialog / banner container
    let container = h as HTMLElement;
    while (container.parentElement && container.parentElement.tagName !== "BODY") {
      container = container.parentElement;
      if (container.getAttribute("role") === "dialog" || container.style.position === "fixed" || window.getComputedStyle(container).position === "fixed") {
        break;
      }
    }

    return {
      tag: container.tagName,
      role: container.getAttribute("role"),
      className: container.className,
      style: container.getAttribute("style"),
      allButtons: Array.from(container.querySelectorAll("button, a")).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim(),
        className: b.className
      })),
      html: container.outerHTML.slice(0, 1500)
    };
  });

  console.log("Banner details:", JSON.stringify(bannerDetails, null, 2));

  await browser.close();
}

dumpCookieBanner().catch(console.error);
