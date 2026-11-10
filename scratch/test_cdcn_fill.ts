import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto("https://cdcn.avature.net/careers/Register?jobId=8611", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);

    const fn = page.locator("input[id='162'], input[id*='162'], input[name*='firstName' i], input[placeholder*='First Name' i]").first();
    console.log("fn count:", await fn.count(), "visible:", await fn.isVisible());
    if (await fn.isVisible()) {
      await fn.fill("Hrutin");
    }

    const ln = page.locator("input[id='163'], input[id*='163'], input[name*='lastName' i], input[placeholder*='Last Name' i]").first();
    console.log("ln count:", await ln.count(), "visible:", await ln.isVisible());
    if (await ln.isVisible()) {
      await ln.fill("Nammi");
    }

    const em = page.locator("input[id='164'], input[id*='164'], input[id='2700'], input[id*='2700'], input[type='email'], input[name*='email' i]").first();
    console.log("em count:", await em.count(), "visible:", await em.isVisible());
    if (await em.isVisible()) {
      await em.fill("babufakemail@gmail.com");
    }

    const ph = page.locator("input[id='165'], input[id*='165'], input[id='6378'], input[id*='6378'], input[type='tel'], input[name*='phone' i]").first();
    console.log("ph count:", await ph.count(), "visible:", await ph.isVisible());
    if (await ph.isVisible()) {
      await ph.fill("2025550198");
    }

    const countrySel = page.locator("select[id='170'], select[id*='170'], select[name*='country' i]").first();
    console.log("countrySel count:", await countrySel.count(), "visible:", await countrySel.isVisible());
    if (await countrySel.isVisible()) {
      const coVal = await countrySel.inputValue();
      console.log("current country val:", coVal);
      // Wait for State options
      const stOptsBefore = await page.locator("select[id='169'] option").count();
      console.log("State options count before country change:", stOptsBefore);
    }

    const stateSel = page.locator("select[name='169'], select[id='169'], select[name*='state' i]").first();
    console.log("stateSel count:", await stateSel.count(), "visible:", await stateSel.isVisible());
    const opts = await page.locator("select[id='169'] option").allInnerTexts();
    console.log("State options:", opts.slice(0, 5));

  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

main();

