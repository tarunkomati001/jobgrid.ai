import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto("https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/details/Medical-Imaging-Technologist-I_R18142-1");
  await p.waitForTimeout(3000);

  // Accept cookies
  const cookieBtn = p.locator("button[data-automation-id='legalNoticeAcceptButton']").first();
  if (await cookieBtn.count() > 0) {
    await cookieBtn.click();
    await p.waitForTimeout(1000);
  }

  // Click Apply
  await p.click("a[data-automation-id='adventureButton']");
  await p.waitForTimeout(2000);

  // Click Autofill with Resume
  await p.click("a[data-automation-id='autofillWithResume']");
  await p.waitForSelector("input[data-automation-id='email']", { timeout: 20000 });

  // Switch to Sign In
  console.log("Clicking Sign In link ('signInLink')...");
  await p.click("button[data-automation-id='signInLink']");
  await p.waitForTimeout(2000);

  const signInInputs = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      text: (el as HTMLElement).innerText?.trim(),
      type: (el as HTMLInputElement).type
    })).filter(x => x.autoId?.includes("sign") || x.autoId?.includes("password") || x.autoId?.includes("email") || x.autoId?.includes("userName"));
  });
  console.log("Sign In inputs:", JSON.stringify(signInInputs, null, 2));

  // Now fill sign in credentials!
  console.log("Filling sign in credentials...");
  const emailInp = p.locator("input[data-automation-id='userName'], input[data-automation-id='email']").first();
  await emailInp.fill("babufakemail@gmail.com");

  const pwInp = p.locator("input[data-automation-id='password']").first();
  await pwInp.fill("ClucoAi@2026!Secure");

  console.log("Submitting Sign In...");
  const submitBtn = p.locator("div[data-automation-id='click_filter'][aria-label='Sign In']").first();
  const box = await submitBtn.boundingBox();
  if (box) {
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await submitBtn.click({ force: true });
  }

  console.log("Waiting 10s for post-login transition...");
  await p.waitForTimeout(10000);
  console.log("URL after login:", p.url());
  await p.screenshot({ path: "scratch/post_login_screen.png" });

  const postLoginEls = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, [data-automation-id]")).map(el => ({
      tag: el.tagName,
      autoId: el.getAttribute("data-automation-id"),
      text: (el as HTMLElement).innerText?.trim()?.slice(0, 40),
      type: (el as HTMLInputElement).type
    })).filter(x => x.autoId || x.type === "file");
  });
  console.log("Post login elements count:", postLoginEls.length);
  console.log("Sample post-login elements:", JSON.stringify(postLoginEls.slice(0, 10), null, 2));

  await b.close();
}

main();
