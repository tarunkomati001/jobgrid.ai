import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(2000);
  
  const c = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await c.count() > 0) await c.click();
  
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);
  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForTimeout(3000);
  
  const links = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, span, div[role='button']")).map(el => ({
      tag: el.tagName,
      text: el.textContent?.trim()?.slice(0, 50),
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      href: el.getAttribute("href"),
      aria: el.getAttribute("aria-label")
    })).filter(x => x.text && (x.text.includes("Create") || x.text.includes("Sign") || x.text.includes("Forgot")));
  });
  console.log("Auth links/buttons found:", JSON.stringify(links, null, 2));
  await b.close();
}

main();
