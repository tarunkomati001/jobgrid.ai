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
  await p.waitForTimeout(2000);
  
  console.log("Looking for Create Account button/link on the screen...");
  const createLinks = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("*")).filter(el => {
      const text = (el as HTMLElement).innerText?.trim() || "";
      return text === "Create Account" && (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button" || el.getAttribute("data-automation-id")?.includes("create"));
    }).map(el => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      autoId: el.getAttribute("data-automation-id"),
      classes: el.className
    }));
  });
  console.log("Create Account elements:", JSON.stringify(createLinks, null, 2));
  
  const createBtn = p.locator("button:has-text('Create Account'), a:has-text('Create Account'), [data-automation-id*='createAccount']").last();
  if (await createBtn.count() > 0) {
    console.log("Clicking Create Account button...");
    await createBtn.click();
    await p.waitForTimeout(3000);
    
    console.log("Checking if verifyPassword is visible now:");
    const hasVerify = (await p.locator("input[data-automation-id='verifyPassword']").count()) > 0;
    console.log("Has verifyPassword:", hasVerify);
    await p.screenshot({ path: "scratch/create_account_clicked.png" });
  }

  await b.close();
}

main();
