import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function checkForgotPassword() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  console.log("Navigating to https://wellfound.com/password/new...");
  const res = await page.goto("https://wellfound.com/password/new", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(e => null);
  console.log("URL:", page.url());
  console.log("Title:", await page.title());

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("input, button, a")).map(el => ({
      tag: el.tagName.toLowerCase(),
      name: el.getAttribute("name") || "",
      id: el.id || "",
      placeholder: el.getAttribute("placeholder") || "",
      type: el.getAttribute("type") || "",
      text: el.textContent?.trim().slice(0, 50) || ""
    })).filter(i => i.name || i.id || i.type === 'submit' || i.text);
  });

  console.log("Found on password reset page:", JSON.stringify(inputs, null, 2));
  await page.screenshot({ path: "scratch/forgot_password_page.png" });
  await context.close();
}

checkForgotPassword().catch(console.error);

