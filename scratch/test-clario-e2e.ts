import { createBrowser, applyStealthScripts } from '../src/browser/browser-manager';
import { WorkdayAdapter } from '../src/ats/workday/workday.adapter';
import { UserProfile } from '../src/ats/ats.interface';
import path from 'path';

async function main() {
  console.log("🚀 Testing Workday autofill on Clario Clinical...");
  const browser = await createBrowser(false);
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });
  await applyStealthScripts(context);
  const page = await context.newPage();

  const url = "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293";
  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  const profile: UserProfile = {
    firstName: "Hrutin",
    lastName: "Nammi",
    email: "babufakemail+clario1791812147225@gmail.com",
    phone: "8688423267",
    location: "Vadodara, Gujarat, India",
    address: "B-402, Shree Krishna Heights",
    city: "Vadodara",
    state: "Gujarat",
    zipCode: "390001",
    country: "India",
    linkedinUrl: "https://linkedin.com/in/hrutinnammi",
    githubUrl: "https://github.com/hrutinnammi",
    resumePath: path.resolve("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf")
  };

  const adapter = new WorkdayAdapter();
  await adapter.fillForm(page, profile, {}, []);

  console.log("Final page URL:", page.url());
  const reviewStatus = await page.evaluate(() => {
    return {
      text: (document.body?.innerText || "").slice(0, 300),
      isReview: (document.body?.innerText || "").toLowerCase().includes("review")
    };
  });
  console.log("Review Status:", reviewStatus);

  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch(console.error);
