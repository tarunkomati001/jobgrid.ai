import { chromium } from "playwright";

async function testPrevLogin() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("https://phh.tbe.taleo.net/phh01/ats/careers/v2/applyRequisition?org=BASESOLU&cws=37&rid=4862", { waitUntil: "networkidle" });

  // Step 1
  await page.fill("input[name='email']", "babufakemail@gmail.com");
  await page.fill("input[name='cwsPassword']", "Tarun@2006");
  await page.fill("input[name='cwsPassword_2']", "Tarun@2006");
  await page.locator(".oracletaleocwsv2-arrow-nav-next").click();
  await page.waitForTimeout(3000);

  console.log("URL after Next:", page.url());

  // Check if candidateLogin screen
  if (page.url().includes("candidateLogin")) {
    console.log("On candidateLogin page! Entering password Tarun@2006 and clicking Login...");
    await page.fill("input[name='cwsPassword']", "Tarun@2006");
    await page.locator("button[name='login'], button:has-text('Login')").click();
    await page.waitForTimeout(4000);
    console.log("URL after Login:", page.url());
  }

  // Check active step
  const active = await page.evaluate(() => {
    const s = document.querySelector(".oracletaleocwsv2-step.oracletaleocwsv2-active");
    return {
      id: s ? s.id : null,
      title: s ? s.querySelector(".title")?.textContent?.trim() : null
    };
  });
  console.log("Current step:", JSON.stringify(active, null, 2));

  await page.screenshot({ path: "scratch/after_existing_login.png" });

  await browser.close();
}

testPrevLogin().catch(console.error);
