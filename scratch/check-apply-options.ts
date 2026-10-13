import { chromium } from "playwright";

async function checkApplyOptions() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(2000);

  const options = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, [role='button']")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      text: (el as HTMLElement).innerText?.trim()
    })).filter(x => x.text && (x.text.includes("Apply") || x.text.includes("Resume") || x.text.includes("Manual")));
  });
  console.log("Apply options on Alcon:", JSON.stringify(options, null, 2));

  await b.close();
}

checkApplyOptions().catch(console.error);
