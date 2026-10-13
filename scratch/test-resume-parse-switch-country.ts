import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  const testEmail = `test_resume_switch_${Date.now()}@gmail.com`;
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
  await page.waitForTimeout(3000);

  // Upload Resume
  console.log("Uploading resume to parse...");
  const fileInp = page.locator("input[type='file']").first();
  await fileInp.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  console.log("Waiting 7s for resume parsing...");
  await page.waitForTimeout(7000);

  // Inspect address & country fields right after resume parsing
  const postParse = await page.evaluate(() => {
    return {
      countryInp: Array.from(document.querySelectorAll("input[name='country'], input[id*='country']")).map(e => ({
        id: e.id,
        name: (e as any).name,
        value: (e as any).value
      })),
      allInputs: Array.from(document.querySelectorAll("input:not([type='hidden'])")).map(e => ({
        id: e.id,
        name: (e as any).name,
        value: (e as any).value?.slice(0, 30)
      }))
    };
  });
  console.log("POST PARSE STATE:\n", JSON.stringify(postParse, null, 2));

  // Now attempt to switch Country to United States
  console.log("Attempting switch to United States...");
  const countryInp = page.locator("input[name='country']:not([id*='phone']):not([name*='phone']), input[id*='country']:not([id*='phone']):not([name*='phone']), select[name='country']").first();
  const cId = await countryInp.getAttribute("id").catch(() => "");
  console.log("Target Country Input ID:", cId, "Target current value:", await countryInp.inputValue());

  // Click reset button
  await page.evaluate((id) => {
    const btn = (id ? document.getElementById(id + "-reset-button") : null) || 
                document.querySelector(`button[id*='${id}'][id*='reset']`) ||
                document.querySelector("button#country-12-reset-button, button#country-13-reset-button, button#country-14-reset-button");
    if (btn) (btn as HTMLElement).click();
  }, cId);
  await page.waitForTimeout(500);

  await countryInp.click();
  await countryInp.fill("United States");
  await page.waitForTimeout(1000);

  const clicked = await page.evaluate((id) => {
    const opts = Array.from(document.querySelectorAll(".cx-select__list-item, [role='option']"));
    const match = opts.find(o => o.textContent?.trim().toLowerCase() === "united states");
    if (match) {
      (match as HTMLElement).click();
      return match.textContent?.trim();
    }
    return null;
  }, cId);
  console.log("Clicked option:", clicked);
  await page.waitForTimeout(3000);

  console.log("Country value after switch:", await countryInp.inputValue());

  // Check what postal/pin input exists now
  const postSwitchInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input:not([type='hidden'])")).map(e => ({
      id: e.id,
      name: (e as any).name,
      value: (e as any).value?.slice(0, 30)
    }));
  });
  console.log("POST SWITCH INPUTS:\n", JSON.stringify(postSwitchInputs, null, 2));

  await browser.close();
}

main().catch(console.error);
