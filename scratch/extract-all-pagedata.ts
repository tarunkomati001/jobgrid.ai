import { chromium } from "playwright";
import { applyStealthScripts, DEFAULT_USER_AGENT } from "../src/browser/browser-manager";
import fs from "fs";

const jobs = [
  { id: 1, applyId: "4448048" },
  { id: 2, applyId: "4358710" },
  { id: 3, applyId: "4606392" },
  { id: 4, applyId: "4605123" }
];

async function extractAllPageData() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: DEFAULT_USER_AGENT });
  await applyStealthScripts(context);

  const results: any[] = [];

  for (const job of jobs) {
    const page = await context.newPage();
    const url = `https://recruiting.paylocity.com/Recruiting/jobs/Apply/${job.applyId}`;
    console.log(`Extracting pageData for Job ${job.id}: ${url}...`);

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
      await page.waitForTimeout(3000);

      const pageData = await page.evaluate(() => {
        const pd = (window as any).pageData;
        if (!pd) return null;

        const screener = pd.application?.job?.screener || {};
        const questions = screener.questions || [];
        const cleanQuestions = questions.map((q: any) => ({
          title: q.title,
          data: q.data,
          isRequired: q.isRequired
        }));

        const jobInfo = pd.application?.job || {};

        return {
          jobId: jobInfo.jobId,
          companyName: jobInfo.companyName,
          title: jobInfo.title,
          wizardStepsCompletedCSV: jobInfo.wizardStepsCompletedCSV,
          acknowledgementText: pd.acknowledgementText,
          screenerQuestions: cleanQuestions,
          applicationFields: {
            howDidYouHearAboutUs: pd.application?.howDidYouHearAboutUs,
            skills: pd.application?.skills,
            desiredSalaryType: pd.application?.desiredSalaryType
          }
        };
      });

      console.log(`Job ${job.id} Data:`, JSON.stringify(pageData, null, 2));
      results.push({ job, pageData });

    } catch (err: any) {
      console.error(`Error on Job ${job.id}:`, err.message);
    } finally {
      await page.close();
    }
  }

  fs.writeFileSync("scratch/all_jobs_pagedata.json", JSON.stringify(results, null, 2));
  console.log("Saved scratch/all_jobs_pagedata.json");

  await browser.close();
}

extractAllPageData().catch(console.error);
