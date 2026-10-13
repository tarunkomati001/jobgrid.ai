import { chromium } from "playwright";

async function inspectResumeParseEvents() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  page.on("request", req => {
    const u = req.url();
    if (u.includes("resume") || u.includes("parse") || u.includes("profile") || u.includes("attachment")) {
      console.log(`[REQ] ${req.method()} ${u}`);
    }
  });

  page.on("response", async res => {
    const u = res.url();
    if (u.includes("resume") || u.includes("parse") || u.includes("profile") || u.includes("attachment")) {
      console.log(`[RES] ${res.status()} ${u}`);
    }
  });

  const testEmail = `test_parse_evt_${Date.now()}@gmail.com`;
  console.log("Navigating to apply/email...");
  await page.goto("https://careers.oracle.com/en/sites/jobsearch/job/344557/apply/email", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  await page.fill("input#primary-email-1", testEmail);
  await page.evaluate(() => {
    const l = document.querySelector("label[for='legal-disclaimer-checkbox']") as HTMLElement;
    if (l) l.click();
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim().toLowerCase() === "next");
    if (btn) btn.click();
  });

  // Wait for Section 1
  for (let s = 1; s <= 20; s++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/apply/email")) break;
  }
  await page.waitForSelector("input[name='firstName'], input.phone-row__input", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  console.log("Uploading resume...");
  const fileInp = page.locator("input[type='file']").first();
  const startTime = Date.now();
  await fileInp.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");

  // Track inputs second by second
  for (let i = 1; i <= 20; i++) {
    await page.waitForTimeout(1000);
    const snap = await page.evaluate(() => {
      const fn = (document.querySelector("input[name='firstName']") as any)?.value || "";
      const ln = (document.querySelector("input[name='lastName']") as any)?.value || "";
      const country = (document.querySelector("input[name='country']:not([id*='phone'])") as any)?.value || "";
      const phone = (document.querySelector("input.phone-row__input, input[type='tel']") as any)?.value || "";
      const spinner = !!document.querySelector(".loading, .spinner, .oj-loading, [class*='loading']");
      return { fn, ln, country, phone, spinner };
    });
    console.log(`[+${i}s] fn="${snap.fn}" ln="${snap.ln}" country="${snap.country}" phone="${snap.phone}" spinner=${snap.spinner}`);
    if (snap.fn || snap.ln || snap.country) {
      console.log(`✅ Resume parsing populated fields after ${Date.now() - startTime}ms!`);
      break;
    }
  }

  await browser.close();
}

inspectResumeParseEvents().catch(console.error);
