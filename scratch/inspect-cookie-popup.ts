import { chromium } from "playwright";

async function inspectCookieModal() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to https://companiongroupltd.recruitee.com/o/senior-backend-engineer...");
  await page.goto("https://companiongroupltd.recruitee.com/o/senior-backend-engineer", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const cookieInfo = await page.evaluate(() => {
    // Search for any element containing "Cookies agreement"
    const elements = Array.from(document.querySelectorAll("*"));
    const match = elements.find(el => el.children.length === 0 && el.textContent?.trim() === "Cookies agreement");
    if (!match) return { found: false };

    // Get the container
    let container: Element | null = match;
    for (let i = 0; i < 5 && container?.parentElement; i++) {
      if (container.parentElement.tagName === "BODY" || container.parentElement.tagName === "HTML") break;
      container = container.parentElement;
    }

    return {
      found: true,
      tag: match.tagName,
      containerTag: container?.tagName,
      containerClass: container?.className,
      containerId: container?.id,
      containerOuterHTML: container?.outerHTML?.slice(0, 1500),
      buttons: Array.from(container?.querySelectorAll("button, a, input") || []).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim(),
        type: (b as any).type,
        class: b.className,
        id: b.id
      }))
    };
  });

  console.log("Cookie Info:", JSON.stringify(cookieInfo, null, 2));
  await browser.close();
}

inspectCookieModal().catch(console.error);
