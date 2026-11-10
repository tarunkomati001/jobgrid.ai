import { createPersistentBrowserContext } from "../src/browser/browser-manager";

async function dumpProfileNavigation() {
  const context = await createPersistentBrowserContext(true);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  await page.goto("https://wellfound.com/profile/edit", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const navLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a, button, [role='tab']")).map(el => ({
      text: el.textContent?.trim().slice(0, 50),
      href: el.getAttribute("href"),
      tag: el.tagName.toLowerCase()
    })).filter(i => i.text && (i.href?.includes("profile") || i.href?.includes("job") || i.href?.includes("setting")));
  });

  console.log("Profile Edit Subnavigation / Tabs:", JSON.stringify(navLinks, null, 2));
  await context.close();
}

dumpProfileNavigation().catch(console.error);

