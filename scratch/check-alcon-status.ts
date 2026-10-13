import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';

async function main() {
  const browser = await createBrowser(false);
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Ing-Tech-Cial-Equipements---Cataracte--Phaco-Manager----59-60-62-80-95-_R-2026-49596-1?codes=IND";
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  console.log("Page URL:", page.url());
  console.log("Page title:", await page.title());
  const text = await page.innerText('body');
  console.log("Body snippet:", text.slice(0, 300));
  await page.screenshot({ path: "scratch/alcon-page.png" });
  await browser.close();
}

main().catch(console.error);
