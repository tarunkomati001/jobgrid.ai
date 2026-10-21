import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(4000);

  // 1. Accept cookies FIRST
  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) {
    console.log("Accepting cookies...");
    await cookieBtn.click();
    await p.waitForTimeout(1500);
  }

  // 2. Click Apply
  console.log("Clicking Apply...");
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);

  // 3. Click Autofill with Resume
  console.log("Clicking Autofill with Resume...");
  await p.click("a[data-automation-id='autofillWithResume']");

  // Wait for inputs to mount
  console.log("Waiting for auth inputs to mount...");
  await p.waitForSelector("input[data-automation-id='email'], input[data-automation-id='userName']", { timeout: 25000 });
  console.log("Auth inputs mounted!");

  const items = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("button, a, input, div[data-automation-id]")).map(el => ({
      tag: el.tagName,
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 50),
      aria: el.getAttribute("aria-label"),
      type: (el as HTMLInputElement).type
    })).filter(x => x.autoId?.includes("create") || x.autoId?.includes("sign") || x.autoId?.includes("password") || x.autoId?.includes("email") || x.type === "password" || x.type === "email");
  });

  console.log("Auth elements found:", JSON.stringify(items, null, 2));
  await p.screenshot({ path: "scratch/modal_loaded.png" });
  await b.close();
}

main();
