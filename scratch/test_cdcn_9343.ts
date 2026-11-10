import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://cdcn.avature.net/careers/JobDetail/Caregiver-Dayton-Minden-Surrounding-Areas/9343", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const applyBtn = page.locator("a:has-text('Apply Now'), a:has-text('Apply'), button:has-text('Apply Now'), button:has-text('Apply')").first();
  console.log("Apply button text:", await applyBtn.textContent());
  await applyBtn.click();
  await page.waitForTimeout(3000);
  console.log("Post-apply URL:", page.url());

  await page.screenshot({ path: "scratch/cdcn_9343_after_apply.png", fullPage: true });

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a, select")).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: (el as any).name,
      type: (el as any).type,
      text: el.textContent?.trim().slice(0, 30),
      href: (el as any).href
    })).filter(x => x.id || x.name || (x.text && !x.text.includes("Menu")));
  });
  console.log("Elements found:", inputs.slice(0, 20));
  await browser.close();
}

main();

