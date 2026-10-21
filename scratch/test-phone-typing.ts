import { chromium } from "playwright";

const URLS = [
  "https://zeromotorcycles.recruitee.com/o/functional-safety-engineer/c/new",
  "https://companiongroupltd.recruitee.com/o/senior-backend-engineer/c/new",
  "https://dvtcareers.recruitee.com/o/senior-ai-software-engineer-net-azure-ozha/c/new",
  "https://jobs.emergentsoftware.net/o/shipping-logistics-coordinator/c/new"
];

async function testPhone() {
  const browser = await chromium.launch({ headless: true });
  for (const url of URLS) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const countryBtn = page.locator("button[id*='country-select'], button[aria-label*='Select country calling code']").first();
    const phoneInput = page.locator("input[name='candidate.phone'], input[type='tel']").first();

    console.log(`\nURL: ${url}`);
    console.log("Before: Country btn:", await countryBtn.innerText().catch(() => "none"));
    console.log("Before: Phone val:", await phoneInput.inputValue().catch(() => "none"));

    // Type +1 868 842 3267
    await phoneInput.click();
    await phoneInput.fill("");
    await phoneInput.pressSequentially("+1 868 842 3267", { delay: 40 });
    await page.waitForTimeout(500);

    console.log("After: Country btn:", await countryBtn.innerText().catch(() => "none"));
    console.log("After: Phone val:", await phoneInput.inputValue().catch(() => "none"));

    await page.close();
  }
  await browser.close();
}

testPhone().catch(console.error);
