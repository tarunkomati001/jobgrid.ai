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
  console.log("On URL:", p.url());

  // Attach resume
  const fileInput = p.locator("input[type='file']").first();
  await fileInput.setInputFiles("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
  await p.waitForTimeout(6000);
  const cBtn = p.locator("button[data-automation-id='bottom-navigation-next-button']").first();
  await cBtn.click({ force: true });
  await p.waitForTimeout(8000);

  console.log("Landed on My Information:", p.url());

  // Inspect Phone Device Type dropdown
  const phoneBtn = p.locator("button[id*='phoneType'], button[data-automation-id='phone-device-type']").first();
  console.log("Phone button text:", await phoneBtn.innerText());
  await phoneBtn.click();
  await p.waitForTimeout(1000);

  // Inspect all elements that appeared in popup/list
  const popupEls = await p.evaluate(() => {
    const all = Array.from(document.querySelectorAll("li, div[role='option'], [role='option'], [data-automation-id*='select'], ul, [id*='listbox']"));
    return all.map(el => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      id: el.id,
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 30),
      autoId: el.getAttribute("data-automation-id")
    })).filter(x => x.text && (x.text.includes("Mobile") || x.text.includes("Landline") || x.text.includes("LinkedIn")));
  });
  console.log("Popup elements for Phone Type:", JSON.stringify(popupEls, null, 2));

  // Now inspect Source dropdown
  const sourceBtn = p.locator("button[data-automation-id='source--source'], button[id*='source--source'], button[id*='source']").first();
  console.log("Source button text:", await sourceBtn.innerText().catch(() => "not found"));
  await sourceBtn.click();
  await p.waitForTimeout(1000);

  const sourcePopupEls = await p.evaluate(() => {
    const all = Array.from(document.querySelectorAll("li, div[role='option'], [role='option'], ul, [id*='listbox'], div[data-automation-label]"));
    return all.map(el => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      id: el.id,
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 30)
    })).filter(x => x.text && (x.text.includes("LinkedIn") || x.text.includes("Other") || x.text.includes("Indeed") || x.text.includes("Job Board")));
  });
  console.log("Popup elements for Source:", JSON.stringify(sourcePopupEls, null, 2));

  await b.close();
}

main();
