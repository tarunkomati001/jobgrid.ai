import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await page.waitForTimeout(5000);
  const text = await page.innerText('body');
  console.log("Body text:", text.replace(/\n+/g, ' ').substring(0, 300));
  await browser.close();
}

main();
