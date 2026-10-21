import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) await cookieBtn.click();
  await p.waitForTimeout(1000);

  // Apply -> Autofill with Resume
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);
  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForSelector("button[data-automation-id='signInLink']", { timeout: 20000 });

  // Sign In
  await p.click("button[data-automation-id='signInLink']");
  await p.waitForTimeout(1500);
  await p.fill("input[data-automation-id='email']", "babufakemail@gmail.com");
  await p.fill("input[data-automation-id='password']", "ClucoAi@2026!Secure");
  const sBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  const box = await sBtn.boundingBox();
  if (box) await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  else await sBtn.click({ force: true });

  await p.waitForTimeout(10000);

  // Attach resume
  const fileInput = p.locator("input[type='file']").first();
  await fileInput.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await p.waitForTimeout(6000);
  const cBtn = p.locator("div[data-automation-id='click_filter'][aria-label*='Continue'], button:has-text('Continue')").first();
  const cBox = await cBtn.boundingBox();
  if (cBox) await p.mouse.click(cBox.x + cBox.width / 2, cBox.y + cBox.height / 2);
  else await cBtn.click({ force: true });

  console.log("Waiting for My Information to load (10s)...");
  await p.waitForTimeout(10000);
  console.log("URL:", p.url());

  // 1. Select Phone Device Type
  console.log("Opening Phone Device Type dropdown...");
  const phoneBtn = p.locator("button[id*='phoneType'], button[data-automation-id='phone-device-type']").first();
  await phoneBtn.click();
  await p.waitForTimeout(600);
  const mob = p.locator("li:has-text('Mobile'), [role='option']:has-text('Mobile'), div:has-text('Mobile')").last();
  await mob.click();
  await p.waitForTimeout(600);

  // Inspect phone section
  const phoneDetails = await p.evaluate(() => {
    const sec = Array.from(document.querySelectorAll("*")).filter(el => (el.id || el.getAttribute("data-automation-id") || "").toLowerCase().includes("phone"));
    return sec.map(el => ({
      tag: el.tagName,
      id: el.id,
      autoId: el.getAttribute("data-automation-id"),
      val: (el as HTMLInputElement).value,
      text: (el as HTMLElement).innerText?.slice(0, 30)
    }));
  });
  console.log("Phone details in DOM:", JSON.stringify(phoneDetails, null, 2));

  // Set exact local phone number
  const pInput = p.locator("input[id='phoneNumber--phoneNumber'], input[id*='--phoneNumber']").first();
  await pInput.fill("8688423267");
  await p.waitForTimeout(300);

  // 2. Select How Did You Hear About Us?
  console.log("Opening Source dropdown...");
  const sourceBtn = p.locator("button[data-automation-id='source--source'], button[id*='source--source'], button[id*='source']").first();
  await sourceBtn.click();
  await p.waitForTimeout(600);

  // Choose Job Board - Other or Indeed so it does NOT ask for friend's referral name
  const srcOpt = p.locator("li:has-text('Job Board - Other'), [role='option']:has-text('Job Board - Other'), li:has-text('Indeed'), [role='option']:has-text('Indeed'), li:has-text('Other Source'), [role='option']:has-text('Other Source')").first();
  if (await srcOpt.count() > 0) {
    await srcOpt.click();
  } else {
    const firstOpt = p.locator("li[role='option'], [role='option']").nth(1);
    await firstOpt.click();
  }
  await p.waitForTimeout(600);

  // Fill any empty required inputs
  const emptyReq = p.locator("input[aria-required='true']:not([type='hidden']):not([type='file']), textarea[aria-required='true']");
  const count = await emptyReq.count();
  for (let i = 0; i < count; i++) {
    const inp = emptyReq.nth(i);
    const val = await inp.inputValue().catch(() => "");
    if (!val.trim()) {
      await inp.fill("None / Not Applicable");
    }
  }

  // Click Save and Continue!
  console.log("Clicking Save and Continue...");
  const nextBtn = p.locator("button[data-automation-id='bottom-navigation-next-button'], button:has-text('Save and Continue')").last();
  const nBox = await nextBtn.boundingBox();
  if (nBox) await p.mouse.click(nBox.x + nBox.width / 2, nBox.y + nBox.height / 2);
  else await nextBtn.click({ force: true });

  await p.waitForTimeout(8000);
  console.log("URL after Save and Continue:", p.url());
  await p.screenshot({ path: "scratch/after_step1_success.png" });

  await b.close();
}

main();
