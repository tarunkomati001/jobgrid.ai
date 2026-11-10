import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("https://bloomberg.avature.net/careers/JobDetail/Senior-Software-Engineer-Public-Cloud-Engineering/20217", { waitUntil: "domcontentloaded" });
  const text = await page.evaluate(() => document.body.innerText.toLowerCase());
  console.log("Includes my profile:", text.includes("my profile"));
  console.log("Includes log out:", text.includes("log out"));
  console.log("Includes sign out:", text.includes("sign out"));
  await browser.close();
}

main().catch(console.error);

