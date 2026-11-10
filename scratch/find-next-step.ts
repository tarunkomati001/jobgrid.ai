import { chromium } from "playwright";

const urls = [
  "https://jobs.jobvite.com/actionet/job/oAd3Afwa",
  "https://jobs.jobvite.com/actionet/job/oVq9AfwO",
  "https://jobs.jobvite.com/actionet/job/oGlQAfwb",
  "https://jobs.jobvite.com/actionet/job/oATCAfwp",
  "https://jobs.jobvite.com/iboss/job/oLudAfwM",
  "https://jobs.jobvite.com/iboss/job/orvdAfwt",
  "https://jobs.jobvite.com/iboss/job/ojdfAfw5",
  "https://jobs.jobvite.com/ninjaone/job/oKjFAfw2",
  "https://jobs.jobvite.com/enverus/job/oUSzAfwF"
];

async function findNextStep() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const u of urls) {
    const applyUrl = u.replace(/\/+$/, "") + "/apply";
    console.log(`Checking ${applyUrl}...`);
    try {
      await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(2000);

      const gate = page.locator("#jv-country-select");
      if (await gate.isVisible({ timeout: 1500 }).catch(() => false)) {
        await page.selectOption("#jv-country-select", { index: 1 });
        await page.waitForTimeout(1000);
        const accept = page.locator("button:has-text('I Accept'), button:has-text('Accept'), button:has-text('Continue')").first();
        if (await accept.isVisible().catch(() => false)) {
          await accept.click();
          await page.waitForTimeout(2000);
        }
      }

      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("button, a, input[type='button'], input[type='submit']")).map(b => ({
          text: b.textContent?.trim(),
          id: b.id,
          className: b.className,
          visible: (b as HTMLElement).offsetParent !== null
        })).filter(b => /next/i.test(b.text || ""));
      });

      console.log(`  Buttons matching 'next':`, buttons);
    } catch (e: any) {
      console.log(`  Error: ${e.message}`);
    }
  }

  await browser.close();
}

findNextStep().catch(console.error);

