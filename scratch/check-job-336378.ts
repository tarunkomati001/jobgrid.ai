import { chromium } from "playwright";

const URL = "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/336378/?location=India&locationId=300000000106947";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log("Snippet of page text:", bodyText.slice(0, 500));

  const hasApply = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button, a"));
    return btns.filter(b => b.textContent?.toLowerCase().includes("apply")).map(b => ({
      tag: b.tagName,
      text: b.textContent?.trim(),
      href: (b as HTMLAnchorElement).href,
      visible: (b as HTMLElement).offsetWidth > 0
    }));
  });
  console.log("Apply buttons/links:", hasApply);

  await page.screenshot({ path: "scratch/oracle_job_336378.png", fullPage: true });
  await browser.close();
}

main().catch(console.error);
