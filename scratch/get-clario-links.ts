import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers");
  await page.waitForSelector('a[data-automation-id="jobTitle"]', { timeout: 15000 });
  const links = await page.$$eval('a[data-automation-id="jobTitle"]', els => els.map(e => (e as HTMLAnchorElement).href));
  console.log("Found Clario job links:", links.slice(0, 5));
  await browser.close();
}

main();
