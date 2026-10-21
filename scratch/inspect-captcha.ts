import { chromium } from "playwright";

async function inspectCaptcha() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/details/Dlgue-Commercial--Dpartements-22--29-et-35-_R-2026-49499-1?codes=IND");
  await p.waitForTimeout(3000);

  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();

  const applyBtn = p.locator("a[data-automation-id='adventureButton']").first();
  await applyBtn.click({ force: true });
  await p.waitForTimeout(3000);

  const autofillOption = p.locator("a[data-automation-id='autofillWithResume']").first();
  await autofillOption.click({ force: true });

  await p.waitForSelector("input[data-automation-id='email']", { timeout: 30000 });

  const captchaHtml = await p.evaluate(() => {
    const el = document.querySelector("[data-automation-id='noCaptchaWrapper']");
    const iframes = Array.from(document.querySelectorAll("iframe")).map(f => ({
      src: f.src,
      id: f.id,
      title: f.title
    }));
    return {
      wrapperHtml: el?.outerHTML,
      iframes: iframes
    };
  });
  console.log("Captcha details:", JSON.stringify(captchaHtml, null, 2));

  await b.close();
}

inspectCaptcha().catch(console.error);
