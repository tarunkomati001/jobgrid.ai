import { chromium } from "playwright";

async function main() {
  const urls = [
    "https://bloomberg.avature.net/careers/JobDetail/Senior-Software-Engineer-Public-Cloud-Engineering/20217#",
    "https://bloomberg.avature.net/careers/JobDetail/Senior-WordPress-Engineer-Marketing-Platforms/45956",
    "https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611",
    "https://koch.avature.net/en_US/careers/JobDetail/United-States-Electrical-Maintenance-Technician-San-Leandro-CA/197452",
    "https://cdcn.avature.net/careers/JobDetail/Caregiver-Dayton-Minden-Surrounding-Areas/9343"
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of urls) {
    console.log(`Checking ${url}...`);
    try {
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      console.log(` -> Final URL: ${page.url()}`);
      console.log(` -> Title: ${await page.title()}`);
      const isError = page.url().includes("Error") || (await page.content()).includes("Page not found");
      console.log(` -> Is Error: ${isError}`);
    } catch (e: any) {
      console.log(` -> Failed to load: ${e.message}`);
    }
  }

  await browser.close();
}

main();

