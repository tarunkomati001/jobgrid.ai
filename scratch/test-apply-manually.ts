import { chromium } from "playwright";

async function testApplyManually() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(2000);

  const applyManually = p.locator("a[data-automation-id='applyManually']").first();
  await applyManually.click({ force: true });
  await p.waitForTimeout(4000);

  console.log("URL after Apply Manually:", p.url());
  await p.screenshot({ path: "scratch/alcon_apply_manually.png" });

  await b.close();
}

testApplyManually().catch(console.error);
