import { chromium } from "playwright";

const URLS = [
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4862",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4806",
  "https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4680"
];

async function checkNewJobs() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of URLS) {
    console.log(`\nNavigating: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });
    const title = await page.title();
    console.log("Title:", title);

    const step2Fields = await page.evaluate(() => {
      const s2 = document.getElementById("step-02");
      if (!s2) return [];
      return Array.from(s2.querySelectorAll("input, select, textarea")).map(i => ({
        tag: i.tagName,
        type: (i as any).type,
        name: (i as any).name,
        id: i.id
      })).filter(f => f.type !== "hidden");
    });

    console.log(`Found ${step2Fields.length} fields in Step 2:`, step2Fields.map(f => f.name || f.id).join(", "));
  }

  await browser.close();
}

checkNewJobs().catch(console.error);
