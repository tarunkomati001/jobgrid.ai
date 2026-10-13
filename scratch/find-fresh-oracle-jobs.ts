import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  console.log("Navigating to Oracle search page...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/jobs?keyword=engineer", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(6000);

  const jobLinks = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll("a"));
    return list.map(a => ({
      text: a.textContent?.trim().replace(/\s+/g, " "),
      href: a.href
    })).filter(x => x.href && (x.href.includes("/preview/") || x.href.includes("/job/")));
  });

  console.log("Job links found:", jobLinks.slice(0, 15));
  await browser.close();
}

main().catch(console.error);
