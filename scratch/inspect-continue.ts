import { chromium } from "playwright";

async function inspectContinue() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/Hungary-Remote/Medical-Imaging-Technologist-I_R18142-1/apply/autofillWithResume");
  await p.waitForTimeout(4000);

  const btns = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("button, [role='button'], div[data-automation-id]")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      label: el.getAttribute("aria-label"),
      text: (el as HTMLElement).innerText?.trim()
    })).filter(x => x.text?.toLowerCase().includes("continue"));
  });
  console.log("Continue buttons:", JSON.stringify(btns, null, 2));

  await b.close();
}

inspectContinue().catch(console.error);
