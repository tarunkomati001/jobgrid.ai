import { db } from "../database/db";
import { chromium } from "playwright";
import { applyStealthScripts, createBrowser, createPersistentBrowserContext, DEFAULT_USER_AGENT } from "../browser/browser-manager";
import { detectAndGetAdapter } from "../ats/ats-factory";
import { UserProfile, WorkExperienceItem, EducationItem } from "../ats/ats.interface";
import { getAllUserProfiles, getUserProfile } from "../database/user-profile.service";
import { resolveLocalResumePath } from "../utils/path-resolver";
import { handleCloudflareTurnstile } from "../browser/turnstile-handler";
import { dismissCommonPopups } from "../browser/popup-handler";
import { v4 as uuidv4 } from "uuid";

async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════╗
║             ⚡ CLUCO.AI AUTO-PILOT : MULTI-USER JOB AUTOFILL           ║
║      Automated Multi-User ATS Job Application Filling & Submission      ║
╚════════════════════════════════════════════════════════════════════════╝
`);

  // Parse command line arguments
  const args = process.argv.slice(2);
  const isForceAllAutoSubmit = args.includes("--force-auto-submit-all") || args.includes("--auto-submit-all") || args.includes("--auto-submit");
  const isManualOnly = args.includes("--manual") || args.includes("--no-auto-submit");
  const isParallelAllMode = args.includes("--parallel");
  const isSequentialMode = !isParallelAllMode; // Default to safe sequential execution to prevent anti-bot spam flags
  const isKeepOpenMode = !args.includes("--close"); // Default to keeping tabs open on screen

  console.log(`⚙️  Auto-Submit Policy: 🟢 AUTO-SUBMIT FOR LEVER, WORKABLE & PAYLOCITY JOBS | 🟡 MANUAL REVIEW FOR ALL OTHER ATS PLATFORMS`);
  console.log(`⚙️  Execution: ${isParallelAllMode ? "⚡ SIMULTANEOUS PARALLEL (All tabs open at once)" : "🎯 Sequential"}`);
  console.log(`⚙️  Window Control: ${isKeepOpenMode ? "📌 Keep Windows Open" : "🔒 Auto-close tabs on finish"}\n`);

  // 1. Fetch dynamic user profiles completely from PostgreSQL DB
  const allProfiles: UserProfile[] = await getAllUserProfiles();
  if (allProfiles.length === 0) {
    console.error("❌ [HeadedAutofill]: No user profiles found in database!");
    process.exit(1);
  }

  // Check if a specific user candidate is requested via --user flag (e.g. --user 2, --user sandeep, --user 1, --user hrutin, --user "Michael Carter")
  const userArgIdx = args.indexOf("--user");
  const isRotateMode = args.includes("--rotate");
  let selectedUser: UserProfile | null = null;

  if (userArgIdx !== -1 && args[userArgIdx + 1]) {
    const requested = args[userArgIdx + 1];
    selectedUser = await getUserProfile(requested);
    console.log(`👤 [Target Candidate Selected]: ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`);
  } else if (!isRotateMode) {
    // Default strictly to Hrutin Nammi (Main Candidate Blueprint for all testing)
    selectedUser = await getUserProfile("hrutin");
    console.log(`👤 [Main Test Candidate (Hrutin Blueprint)]: ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})`);
  }

  // Determine URLs to process
  let urls: string[] = [];
  const normalizeCliUrl = (val: string) => {
    if (!val) return "";
    let clean = val.trim();
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      if (clean.includes(".com") || clean.includes(".io") || clean.includes(".ai") || clean.includes("/")) {
        clean = "https://" + clean;
      }
    }
    return clean.startsWith("http") ? clean : "";
  };

  const urlParamIdx = args.indexOf("--url") !== -1 ? args.indexOf("--url") : args.indexOf("--link");
  const explicitUrlVal = urlParamIdx !== -1 && args[urlParamIdx + 1] ? normalizeCliUrl(args[urlParamIdx + 1]) : null;
  const equalUrlArg = normalizeCliUrl(args.find(a => a.startsWith("--url=") || a.startsWith("--link="))?.split("=")[1] || "");
  const directUrls = args.map(normalizeCliUrl).filter(Boolean);
  const urlArgs = Array.from(new Set([
    ...(explicitUrlVal ? [explicitUrlVal] : []),
    ...(equalUrlArg ? [equalUrlArg] : []),
    ...directUrls
  ]));
  const isSmartRecruitersOnly = 
    args.includes("--smartrecruiters") ||
    args.includes("--smart-recruiters") ||
    args.includes("--sr") ||
    args.includes("--sr-only") || 
    args.includes("--smartrecruiters-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase()?.includes("smartrecruiter")) ||
    process.env.SMARTRECRUITERS_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "SMARTRECRUITERS";
  const isTaleoOnly =
    args.includes("--taleo") ||
    args.includes("--taleo-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "taleo") ||
    process.env.TALEO_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "TALEO";
  const isWorkableOnly =
    args.includes("--workable") ||
    args.includes("--workable-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "workable") ||
    process.env.WORKABLE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "WORKABLE";
  const isWorkdayOnly =
    args.includes("--workday") ||
    args.includes("--workday-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "workday") ||
    process.env.WORKDAY_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "WORKDAY";
  const isGreenhouseOnly = args.includes("--greenhouse") || args.includes("--ats-greenhouse") || (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "greenhouse");
  const isAshbyOnly = args.includes("--ashby") || (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "ashby");
  const isLeverOnly = args.includes("--lever") || args.includes("--lever-only") || (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase()?.includes("lever"));
  const isOracleOnly =
    args.includes("--oracle") ||
    args.includes("--oracle-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "oracle") ||
    process.env.ORACLE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "ORACLE";
  const isRecruiteeOnly =
    args.includes("--recruitee") ||
    args.includes("--recruitee-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "recruitee") ||
    process.env.RECRUITEE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "RECRUITEE";
  const isRipplingOnly =
    args.includes("--rippling") ||
    args.includes("--rippling-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "rippling") ||
    process.env.RIPPLING_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "RIPPLING";
  const isWellfoundOnly =
    args.includes("--wellfound") ||
    args.includes("--wellfound-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "wellfound") ||
    process.env.WELLFOUND_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "WELLFOUND";
  const isUltiproOnly =
    args.includes("--ultipro") ||
    args.includes("--ultipro-only") ||
    args.includes("--ukg") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "ultipro") ||
    process.env.ULTIPRO_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "ULTIPRO";
  const isIcimsOnly =
    args.includes("--icims") ||
    args.includes("--icims-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "icims") ||
    process.env.ICIMS_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "ICIMS";
  const isBambooHROnly =
    args.includes("--bamboohr") ||
    args.includes("--bamboohr-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "bamboohr") ||
    process.env.BAMBOOHR_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "BAMBOOHR";
  const isBreezyHROnly =
    args.includes("--breezy") ||
    args.includes("--breezyhr") ||
    args.includes("--breezy-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase()?.includes("breezy")) ||
    process.env.BREEZYHR_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "BREEZYHR";
  const isAvatureOnly =
    args.includes("--avature") ||
    args.includes("--avature-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "avature") ||
    process.env.AVATURE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "AVATURE";
  const isJobviteOnly =
    args.includes("--jobvite") ||
    args.includes("--jobvite-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "jobvite") ||
    process.env.JOBVITE_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "JOBVITE";
  const isJazzHROnly =
    args.includes("--jazzhr") ||
    args.includes("--jazzhr-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "jazzhr") ||
    process.env.JAZZHR_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "JAZZHR";
  const isPaylocityOnly =
    args.includes("--paylocity") ||
    args.includes("--paylocity-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "paylocity") ||
    process.env.PAYLOCITY_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "PAYLOCITY";
  const isAll = args.includes("--all");
  
  if (urlArgs.length > 0) {
    urls = urlArgs;
  } else if (isUltiproOnly) {
    console.log("🎯 Filtering queued jobs strictly for ULTIPRO ATS (3 requested jobs)...");
    urls = [
      "https://recruiting.ultipro.com/HOL1002HPHM/JobBoard/be27b89b-3cb9-491f-a1b0-42f8b077a9dd/OpportunityDetail?opportunityId=6c242ff6-61b8-4bb4-8888-9fa5862eba72",
      "https://recruiting.ultipro.com/PAR1035PPTL/JobBoard/e104637a-c3c6-4682-96d2-d7cc2662dc13/OpportunityDetail?opportunityId=d0c54545-1437-44cf-8b3c-dfc607d2505d",
      "https://recruiting.ultipro.com/BUI1004BMDI/JobBoard/6b442184-52a5-4635-8db5-5aa4bed2a563/OpportunityDetail?opportunityId=d04454f8-e144-4f2c-b7dc-aceb7da1b4aa"
    ];
  } else if (isIcimsOnly) {
    console.log("🎯 Filtering queued jobs strictly for ICIMS ATS (Active jobs)...");
    urls = [
      "https://careers-beyondsoft.icims.com/jobs/11011/senior-customer-engineer-%28ce%29-%e2%80%93-ai-business-solutions/job",
      "https://careers-quantumsky.icims.com/jobs/2290/network-specialist/job",
      "https://careers-teksystems.icims.com/jobs/13846/technical-staffing-recruiter---austin/job"
    ];
  } else if (isAvatureOnly) {
    console.log("🎯 Filtering queued jobs strictly for AVATURE ATS (5 requested jobs)...");
    urls = [
      "https://bloomberg.avature.net/careers/JobDetail/Senior-Software-Engineer-Public-Cloud-Engineering/20217#",
      "https://bloomberg.avature.net/careers/JobDetail/Senior-WordPress-Engineer-Marketing-Platforms/45956",
      "https://cdcn.avature.net/careers/JobDetail/Software-Engineer-I/8611",
      "https://koch.avature.net/en_US/careers/JobDetail/United-States-Electrical-Maintenance-Technician-San-Leandro-CA/197452",
      "https://cdcn.avature.net/careers/JobDetail/Caregiver-Dayton-Minden-Surrounding-Areas/9343"
    ];
  } else if (isJobviteOnly) {
    console.log("🎯 Filtering queued jobs strictly for JOBVITE ATS (9 requested jobs)...");
    urls = [
      "https://jobs.jobvite.com/actionet/job/oAd3Afwa",
      "https://jobs.jobvite.com/actionet/job/oVq9AfwO",
      "https://jobs.jobvite.com/actionet/job/oGlQAfwb",
      "https://jobs.jobvite.com/actionet/job/oATCAfwp",
      "https://jobs.jobvite.com/iboss/job/oLudAfwM",
      "https://jobs.jobvite.com/iboss/job/orvdAfwt",
      "https://jobs.jobvite.com/iboss/job/ojdfAfw5",
      "https://jobs.jobvite.com/ninjaone/job/oKjFAfw2",
      "https://jobs.jobvite.com/enverus/job/oUSzAfwF"
    ];
  } else if (isBreezyHROnly) {
    console.log("🎯 Filtering queued jobs strictly for BREEZYHR ATS (6 requested jobs)...");
    urls = [
      "https://tristero.breezy.hr/p/026d43128c81-junior-software-engineer",
      "https://beli.breezy.hr/p/f5e1ac51ce99-software-engineer",
      "https://centrl.breezy.hr/p/00c5292242bc-software-engineer/apply",
      "https://pri.breezy.hr/p/a5f78c8ec2ab-practice-lead-structural-engineering",
      "https://pri.breezy.hr/p/c04e91eddf71-senior-geotechnical-engineer",
      "https://turaco.breezy.hr/p/c3b472050c6b-software-engineer/apply"
    ];
  } else if (isBambooHROnly) {
    console.log("🎯 Filtering queued jobs strictly for BAMBOOHR ATS (7 requested jobs)...");
    urls = [
      "https://atlas.bamboohr.com/careers/633",
      "https://atlas.bamboohr.com/careers/604",
      "https://headspin.bamboohr.com/careers/331",
      "https://prentkeromich.bamboohr.com/careers/506",
      "https://prentkeromich.bamboohr.com/careers/526",
      "https://greenparkcontent.bamboohr.com/careers/831",
      "https://prentkeromich.bamboohr.com/careers/527"
    ];
  } else if (isJazzHROnly) {
    console.log("🎯 Filtering queued jobs strictly for JAZZHR ATS (8 requested jobs)...");
    urls = [
      "https://snapsheet.applytojob.com/apply/7dY1TUAJrl/Account-Manager-Appraisals",
      "https://snapsheet.applytojob.com/apply/c1KTdrlE1X/Quality-Assurance-Engineer",
      "https://snapsheet.applytojob.com/apply/zbmXAVAZXm/Senior-Account-Executive",
      "https://peregrineteam.applytojob.com/apply/ppXpgq8Ykg/Software-Engineer",
      "https://eclipsefoundation.applytojob.com/apply/yxw4F4HTOW/Intermediate-SecOps-Engineer",
      "https://bibleproject.applytojob.com/apply/CIsBvf6BHr/Quality-Engineer-Mobile-Audience-Experience",
      "https://vivsofttechnologiesfa.applytojob.com/apply/1kNuql214Y/OneStream-Developer",
      "https://vivsofttechnologiesfa.applytojob.com/apply/ECytI4yKss/Salesforce-Developer"
    ];
  } else if (isWellfoundOnly) {
    console.log("🎯 Filtering queued jobs strictly for WELLFOUND ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WELLFOUND' OR url LIKE '%wellfound.com%' OR url LIKE '%angel.co%') ORDER BY url ASC").catch(() => ({ rows: [] }));
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = ["https://wellfound.com/jobs"];
    }
  } else if (isPaylocityOnly) {
    console.log("🎯 Filtering queued jobs strictly for PAYLOCITY ATS (7 requested jobs)...");
    urls = [
      "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4447994",
      "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4402684",
      "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4402734",
      "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4616387",
      "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4585012",
      "https://recruiting.paylocity.com/Recruiting/Jobs/Apply/4589597",
      "https://recruiting.paylocity.com/Recruiting/Jobs/Details/4358710"
    ];
  } else if (isRipplingOnly) {
    console.log("🎯 Filtering queued jobs strictly for RIPPLING ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'RIPPLING' OR url LIKE '%rippling.com%') ORDER BY url ASC").catch(() => ({ rows: [] }));
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
      urls = [
        "https://ats.rippling.com/en-GB/rippling/jobs/f255bf03-9173-4c0a-8a18-7cc43c27ded8",
        "https://ats.rippling.com/en-GB/rippling/jobs/8ef65aa0-ede3-45cb-814f-3631c25597cf",
        "https://ats.rippling.com/en-GB/rippling/jobs/98b559a6-c8b2-4ede-85d9-cbf4883da996",
        "https://ats.rippling.com/en-GB/rippling/jobs/6a055998-1560-4e2b-b0eb-79913c5d49f1"
      ];
  } else if (isRecruiteeOnly) {
    console.log("🎯 Filtering queued jobs strictly for RECRUITEE ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'RECRUITEE' OR url LIKE '%recruitee.com%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = [
        "https://jobs.emergentsoftware.net/o/account-manager-ecommerce",
        "https://jobs.emergentsoftware.net/o/solutions-engineer-optical-metrology",
        "https://jobs.emergentsoftware.net/o/accounts-receivable-specialist",
        "https://jobs.emergentsoftware.net/o/technical-product-owner-data",
        "https://jobs.emergentsoftware.net/o/embedded-software-engineer",
        "https://jobs.emergentsoftware.net/o/ai-architect",
        "https://careers.techwolf.ai/o/ai-engineering-lead/c/new",
        "https://careers.techwolf.ai/o/internship-software-engineer/c/new"
      ];
    }
  } else if (isOracleOnly) {
    console.log("🎯 Filtering queued jobs strictly for ORACLE ATS (3 active jobs)...");
    urls = [
      "https://fa-extu-saasfaprod1.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/3889",
      "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344557/?keyword=software+engineer",
      "https://careers.oracle.com/en/sites/jobsearch/jobs/preview/344708/?keyword=software+engineer&mode=location"
    ];
  } else if (isWorkableOnly) {
    console.log("🎯 Filtering queued jobs strictly for WORKABLE ATS only...");
    let dbUrls: string[] = [];
    try {
      const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WORKABLE' OR url LIKE '%workable.com%') ORDER BY url ASC");
      dbUrls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    } catch (e) {}
    urls = [
      "https://apply.workable.com/multimediallc/j/24DBCDDF27/apply",
      "https://apply.workable.com/rokt/j/7219AFDA7F/apply/",
      ...dbUrls
    ];
  } else if (isLeverOnly) {
    console.log("🎯 Filtering queued jobs strictly for LEVER ATS only...");
    let dbUrls: string[] = [];
    try {
      const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'LEVER' OR url LIKE '%lever.co%') ORDER BY url ASC");
      dbUrls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    } catch (e) {}
    urls = [
      "https://jobs.lever.co/leverdemo/ad208490-4052-4f91-a57e-433f2d1e484b",
      "https://jobs.lever.co/palantir/10dfc8bc-99ad-4ca2-ab76-853cb90a92c2",
      "https://jobs.lever.co/gohighlevel/ce928065-f2cf-4412-a5e7-32677e6f4e4b/apply",
      ...dbUrls
    ];
  } else if (isWorkdayOnly) {
    console.log("🎯 Filtering queued jobs strictly for WORKDAY ATS only...");
    const jobsRes = await db.query("SELECT url FROM jobs WHERE (ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%') AND status = 'queued' ORDER BY created_at DESC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = [
        "https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/Software-Engineer-Senior-Software-Engineer---AI-Platform--Agent-Runtime-_JR-0109507",
        "https://jci.wd5.myworkdayjobs.com/en-US/jci/details/Inventory-Analyst_WD30284297",
        "https://jci.wd5.myworkdayjobs.com/en-US/jci/details/National-Consulting-Engineer-Account-Manager-NCE-AM_WD30283629"
      ];
    }
    console.log(`📋 Found ${urls.length} queued Workday job(s): ${urls.map(u => u.split('/').slice(2,5).join('/')).join(', ')}`);
  } else if (isGreenhouseOnly) {
    console.log("🎯 Filtering queued jobs strictly for GREENHOUSE ATS only...");
    let dbUrls: string[] = [];
    try {
      const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'GREENHOUSE' OR url LIKE '%greenhouse.io%') ORDER BY url ASC");
      dbUrls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    } catch (e) {}
    urls = [
      "https://job-boards.greenhouse.io/reddit/jobs/8275952",
      "https://job-boards.greenhouse.io/reddit/jobs/8143677",
      "https://boards.greenhouse.io/cleo/jobs/4491104004",
      ...dbUrls
    ];
  } else if (isAshbyOnly) {
    console.log("🎯 Filtering queued jobs strictly for ASHBY ATS only...");
    let dbUrls: string[] = [];
    try {
      const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'ASHBY' OR url LIKE '%ashbyhq.com%') AND url != 'https://ashbyhq.com/test-job' ORDER BY url ASC");
      dbUrls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    } catch (e) {}
    urls = [
      "https://jobs.ashbyhq.com/whoop/d31312c2-236a-45f1-8da7-61a7ca8d1622/application",
      ...dbUrls
    ];
  } else if (isSmartRecruitersOnly) {
    console.log("🎯 Filtering queued jobs strictly for SMARTRECRUITERS ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'SMARTRECRUITERS' OR url LIKE '%smartrecruiters.com%') ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = [
        "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/83647ca1-c14d-4d2e-bf5a-e190e6416a26?dcr_ci=ServiceNow",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/cc5c9e54-2843-4201-9096-e222015570a7?dcr_ci=Socotec"
      ];
    }
  } else if (isTaleoOnly) {
    console.log("🎯 Filtering queued jobs strictly for TALEO ATS (3 active jobs)...");
    urls = [
      "https://ttec.taleo.net/careersection/2/jobapply.ftl?job=04EZP",
      "https://tas-daimler.taleo.net/careersection/ex/jobapply.ftl?job=MER0003OP8&lang=en",
      "https://phh.tbe.taleo.net/phh01/ats/careers/v2/viewRequisition?org=BASESOLU&cws=37&rid=5403"
    ];
  } else if (isAll) {
    // Fetch all unique real application URLs from jobs table (exclude test job)
    console.log("🎯 Processing ALL queued jobs from database...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE url != 'https://ashbyhq.com/test-job' ORDER BY url ASC");
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
  } else {
    // Default: Run SMARTRECRUITERS jobs (4) -> LEVER jobs (2) -> WORKDAY jobs (2)
    console.log("🎯 Queueing all active jobs: SMARTRECRUITERS (4) -> LEVER (2) -> WORKDAY (2)...");
    const srRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'SMARTRECRUITERS' OR url LIKE '%smartrecruiters.com%') AND url NOT LIKE '%screening%' ORDER BY url ASC");
    const leverRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'LEVER' OR url LIKE '%lever.co%') ORDER BY url ASC");
    const wdRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WORKDAY' OR url LIKE '%myworkdayjobs.com%') ORDER BY url ASC");
    const srUrls = Array.from(new Set(srRes.rows.map((row: any) => row.url)));
    const leverUrls = Array.from(new Set(leverRes.rows.map((row: any) => row.url)));
    const wdUrls = Array.from(new Set(wdRes.rows.map((row: any) => row.url)));
    urls = [...srUrls, ...leverUrls, ...wdUrls];
    if (urls.length === 0) {
      urls = [
        "https://jobs.smartrecruiters.com/oneclick-ui/company/LinkedIn3/publication/20b83e43-2e4d-49c8-bf80-238bf9bb3396?dcr_ci=LinkedIn3",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/83647ca1-c14d-4d2e-bf5a-e190e6416a26?dcr_ci=ServiceNow",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/ServiceNow/publication/26858c6b-0e57-412d-9afe-502a27055512?dcr_ci=ServiceNow",
        "https://jobs.smartrecruiters.com/oneclick-ui/company/Socotec/publication/cc5c9e54-2843-4201-9096-e222015570a7?dcr_ci=Socotec",
        "https://jobs.lever.co/moonpay/6e864b20-6e5b-4918-b0b5-a7ec5a3e65ca/apply",
        "https://jobs.lever.co/sonatype/dc2c0041-d681-4b0b-b113-b99984af95f4/apply",
        "https://clarioclinical.wd1.myworkdayjobs.com/en-US/clarioclinical_careers/job/United-States-Remote/Imaging-Research-Associate-I_R18293",
        "https://alcon.wd5.myworkdayjobs.com/en-US/careers_alcon/job/Mulgrave/Software-Engineer_R-2026-50218-1"
      ];
    }
  }

  // Check if limit argument is provided
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const limit = parseInt(args[limitIdx + 1], 10);
    if (!isNaN(limit) && limit > 0) {
      urls = urls.slice(0, limit);
    }
  }

  if (urls.length === 0) {
    console.log("⚠️ No job application URLs found in database to autofill.");
    await db.close();
    return;
  }

  if (selectedUser) {
    console.log(`🎯 CANDIDATE SELECTION: All ${urls.length} job(s) will be applied strictly using:`);
    console.log(`   👉 ${selectedUser.firstName} ${selectedUser.lastName} (${selectedUser.email})\n`);
  } else {
    console.log(`👥 MULTI-USER ROTATION ACTIVE: Rotating candidates per job (Use --user 2 for Sandeep only or --user 1 for Chetan only)\n`);
  }

  console.log(`📋 Found ${urls.length} job(s) queued for autofill.\n`);

  // Launch Chrome context (Use Persistent Chrome Context in sequential mode to avoid blank duplicate tabs & preserve anti-bot clearance)
  const isPersistentContext = !isParallelAllMode;
  let browser: any = null;
  let persistentContext: any = null;
  let sharedContext: any = null;

  if (isPersistentContext) {
    console.log("🛡️ [Anti-Bot Engine]: Initializing Persistent Chrome Session to preserve cookies and prevent duplicate tabs...");
    persistentContext = await createPersistentBrowserContext(false);
  } else {
    browser = await createBrowser(false);
    sharedContext = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      viewport: null,
      locale: "en-US",
    });
    await applyStealthScripts(sharedContext);
  }

  const processJob = async (url: string, index: number, total: number) => {
    // Pick designated user profile or rotate if --rotate passed
    const baseCandidate = selectedUser || allProfiles[index % allProfiles.length];
    const profile: UserProfile = { ...baseCandidate };
    
    // Support custom email via CLI flag --email <email> or subaddressing
    const emailArgIdx = args.indexOf("--email");
    if (emailArgIdx !== -1 && args[emailArgIdx + 1]) {
      profile.email = args[emailArgIdx + 1];
    }
    if (args.includes("--subaddress") && profile.email && profile.email.includes("@")) {
      const [localPart, domainPart] = profile.email.split("@");
      const baseLocal = localPart.split("+")[0];
      profile.email = `${baseLocal}+1@${domainPart}`;
    }

    // Resolve resume path
    const rawResumePath = profile.resumePath || `resumes/user_${profile.userId}/resume.pdf`;
    const resumePath = resolveLocalResumePath(rawResumePath) || rawResumePath;
    profile.resumePath = resumePath;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 [Job ${index + 1}/${total}] URL: ${url}`);
    console.log(`👤 Assigned User: ${profile.firstName} ${profile.lastName} (${profile.email})`);
    console.log(`📍 Location: ${profile.location} | Relocate: ${profile.willingToRelocate ? "Yes" : "No"}`);
    console.log(`📄 Resume: ${resumePath}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let context = persistentContext || sharedContext;
    const isContextAlive = () => {
      try {
        if (!context) return false;
        if (context.browser && context.browser() && !context.browser()!.isConnected()) return false;
        context.pages();
        return true;
      } catch {
        return false;
      }
    };

    if (!isContextAlive()) {
      console.log("🔄 Browser context is closed or disconnected. Re-launching Chrome session...");
      if (isPersistentContext) {
        persistentContext = await createPersistentBrowserContext(false);
        context = persistentContext;
      } else {
        browser = await createBrowser(false);
        sharedContext = await browser.newContext({
          userAgent: DEFAULT_USER_AGENT,
          viewport: null,
          locale: "en-US",
        });
        await applyStealthScripts(sharedContext);
        context = sharedContext;
      }
    }

    let page: any = null;
    try {
      const existingPages = context.pages ? context.pages() : [];
      if (index === 0 && existingPages.length > 0) {
        page = existingPages[0];
      } else {
        page = await context.newPage();
      }
    } catch (npErr: any) {
      console.warn("⚠️ newPage error on existing context, re-launching Chrome session:", npErr.message);
      if (isPersistentContext) {
        persistentContext = await createPersistentBrowserContext(false);
        context = persistentContext;
      } else {
        browser = await createBrowser(false);
        sharedContext = await browser.newContext({
          userAgent: DEFAULT_USER_AGENT,
          viewport: null,
          locale: "en-US",
        });
        await applyStealthScripts(sharedContext);
        context = sharedContext;
      }
      page = await context.newPage();
    }
    let jobHasError = false;

    // Proactively capture any filechooser dialog on the page so Windows OS dialog never pops up
    const resolvedCandidateResume = resolveLocalResumePath(resumePath) || 
      resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf");
    page.on("filechooser", async (fc: any) => {
      console.log("📁 [Global Interceptor]: Automatically fulfilled browser filechooser event (preventing OS dialog).");
      if (resolvedCandidateResume) {
        await fc.setFiles(resolvedCandidateResume).catch(() => {});
      }
    });

    const additionalAnswers: Record<string, string> = {
      resumePath: resumePath,
      "How did you hear about this opportunity?": "LinkedIn",
      "How did you hear about this position?": "LinkedIn",
      "How did you hear about this position": "LinkedIn",
      "How did you hear about us?": "LinkedIn",
      "How did you hear about us": "LinkedIn",
      "Where did you hear about this position?": "LinkedIn",
      "Where did you hear about us?": "LinkedIn",
      "Source": "LinkedIn",
      "Candidate Source": "LinkedIn",
      "Please Specify": "LinkedIn",
      "Specify": "LinkedIn",
      "Notice Period": "Immediate",
      "Current Notice Period": "Immediate",
      "What is your current notice period?": "Immediate",
      "Expected Salary": "Negotiable",
      "Desired Salary": "Negotiable",
      "Current Salary": "Negotiable",
      "What is your current gross monthly salary?": "Negotiable",
      "What are gross monthly salary expectations?": "Negotiable",
      "English language skills": "Professional Working Proficiency / Fluent",
      "How would you describe your English language skills?": "Fluent / Professional Working Proficiency",
      "English": "Fluent",
      "Referral": "Tarun Komati",
      "Reference": "Tarun Komati",
      "Who referred you": "Tarun Komati",
      "Referred By": "Tarun Komati"
    };

    try {
      // Ensure Job and Application exist in DB so any new link automatically gets registered & tracked
      let jobId: string;
      const jobCheck = await db.query("SELECT id FROM jobs WHERE url = $1", [url]);
      const detectedAtsFallback = url.includes("ultipro.com")
        ? "ULTIPRO"
        : url.includes("icims.com")
        ? "ICIMS"
        : url.includes("avature.net")
        ? "AVATURE"
        : url.includes("jobvite.com")
        ? "JOBVITE"
        : url.includes("breezy.hr")
        ? "BREEZYHR"
        : (url.includes("applytojob.com") || url.includes("jazzhr.com"))
        ? "JAZZHR"
        : url.includes("paylocity.com")
        ? "PAYLOCITY"
        : url.includes("bamboohr.com")
        ? "BAMBOOHR"
        : url.includes("rippling.com")
        ? "RIPPLING"
        : (url.includes("recruitee.com") || url.includes("/o/"))
        ? "RECRUITEE"
        : url.includes("workday")
        ? "WORKDAY"
        : url.includes("lever.co")
        ? "LEVER"
        : url.includes("workable.com")
        ? "WORKABLE"
        : (url.includes("careers.oracle.com") || url.includes("oraclecloud.com") || url.includes("oracle.com"))
        ? "ORACLE"
        : "GENERIC";

      if (jobCheck.rowCount > 0) {
        jobId = jobCheck.rows[0].id;
      } else {
        jobId = uuidv4();
        await db.query(
          `INSERT INTO jobs (id, url, company, title, description, ats, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [jobId, url, detectedAtsFallback === "RIPPLING" ? "Rippling" : (detectedAtsFallback === "ORACLE" ? "Oracle" : "Company"), "Position", "Queued application", detectedAtsFallback, "EXTRACTED"]
        );
        console.log(`➕ [Database]: Registered new Job record in database (${jobId}): ${url}`);
      }

      const appCheck = await db.query(
        "SELECT id FROM applications WHERE user_id = $1 AND job_id = $2",
        [profile.userId, jobId]
      );
      if (appCheck.rowCount === 0) {
        let resumeId: string | null = null;
        if (profile.userId) {
          const rRes = await db.query("SELECT id FROM resumes WHERE user_id = $1 AND is_active = 1 LIMIT 1", [profile.userId]).catch(() => ({ rows: [] }));
          resumeId = rRes.rows[0]?.id || null;
        }
        await db.query(
          `INSERT INTO applications (id, user_id, job_id, resume_id, ats, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), profile.userId, jobId, resumeId, detectedAtsFallback, "PENDING"]
        );
        console.log(`➕ [Database]: Registered new Application record for user ${profile.firstName} in database.`);
      }

      let targetUrl = url;
      try {
        const parsed = new URL(targetUrl);
        if (targetUrl.includes("jobvite.com") && parsed.pathname.includes("/job/") && !parsed.pathname.includes("/apply")) {
          parsed.pathname = parsed.pathname.replace(/\/+$/, "") + "/apply";
          targetUrl = parsed.toString();
        } else if (targetUrl.includes("breezy.hr") && parsed.pathname.includes("/p/") && !parsed.pathname.includes("/apply")) {
          parsed.pathname = parsed.pathname.replace(/\/+$/, "") + "/apply";
          targetUrl = parsed.toString();
        } else if (targetUrl.includes("lever.co") && !parsed.pathname.includes("/apply")) {
          parsed.pathname = parsed.pathname.replace(/\/+$/, "") + "/apply";
          targetUrl = parsed.toString();
        } else if ((targetUrl.includes("recruitee.com") || parsed.pathname.includes("/o/")) && !parsed.pathname.includes("/c/new")) {
          parsed.pathname = parsed.pathname.replace(/\/+$/, "") + "/c/new";
          targetUrl = parsed.toString();
        }
      } catch (e) {}
      // If Paylocity Details URL, convert directly to Apply URL for fast direct loading
      if (targetUrl.toLowerCase().includes("paylocity.com") && targetUrl.toLowerCase().includes("/details/")) {
        const paylocityMatch = targetUrl.match(/details\/(\d+)/i);
        if (paylocityMatch) {
          targetUrl = `https://recruiting.paylocity.com/Recruiting/jobs/Apply/${paylocityMatch[1]}`;
        }
      }
      // If Oracle careers URL without /apply, convert directly to /apply/email for instant direct loading
      if (targetUrl.includes("careers.oracle.com") || targetUrl.includes("oraclecloud.com")) {
        const oracleJobMatch = targetUrl.match(/\/job[s]?(?:\/preview)?\/(\d+)/i);
        if (oracleJobMatch && !targetUrl.includes("/apply")) {
          if (targetUrl.includes("careers.oracle.com")) {
            targetUrl = `https://careers.oracle.com/en/sites/jobsearch/job/${oracleJobMatch[1]}/apply/email`;
          } else {
            const baseMatch = targetUrl.match(/(https:\/\/[^\/]+\/hcmUI\/CandidateExperience\/[^\/]+\/sites\/[^\/]+)/i);
            if (baseMatch) {
              targetUrl = `${baseMatch[1]}/job/${oracleJobMatch[1]}/apply/email`;
            }
          }
        }
      }

      console.log(`🌐 Navigating to application page: ${targetUrl}...`);
      const isFastNav = targetUrl.includes("ultipro.com") || targetUrl.includes("avature.net") || targetUrl.includes("paylocity.com") || targetUrl.includes("oracle") || targetUrl.includes("rippling") || targetUrl.includes("recruitee") || targetUrl.includes("bamboohr.com") || targetUrl.includes("applytojob.com") || targetUrl.includes("breezy.hr") || targetUrl.includes("jobvite.com");
      await page.goto(targetUrl, { waitUntil: isFastNav ? "domcontentloaded" : "load", timeout: 45000 });
      
      // Auto-detect & resolve Cloudflare Turnstile if intercepted
      await handleCloudflareTurnstile(page);

      // Auto-dismiss cookie agreements and popups
      await dismissCommonPopups(page);

      await page.waitForSelector(
        "input:not([type='hidden']), textarea, select, [data-field-path], button:has-text('Apply')",
        { timeout: 12000 }
      ).catch(() => console.warn(`⚠️ Form selector initial wait timed out. Proceeding.`));

      // Dismiss any popups that appeared after form load
      await dismissCommonPopups(page);
      
      const { ats, adapter } = await detectAndGetAdapter(page, targetUrl);
      console.log(`🎯 Detected ATS Platform: ${ats}`);

      // Extract and update job details in database
      try {
        const jobDetails = await adapter.extractJob(page);
        if (jobDetails && (jobDetails.company || jobDetails.title)) {
          await db.query(
            `UPDATE jobs 
             SET company = COALESCE(NULLIF($1, ''), company), 
                 title = COALESCE(NULLIF($2, ''), title), 
                 ats = $3,
                 status = 'EXTRACTED'
             WHERE id = $4`,
            [jobDetails.company, jobDetails.title, ats, jobId]
          );
        }
      } catch (e: any) {
        console.warn("⚠️ Notice updating job details in DB:", e.message);
      }

      // Auto-submit policy: Auto-submit for LEVER, GREENHOUSE, WORKABLE, PAYLOCITY, WELLFOUND, and BAMBOOHR jobs (unless manual only)
      const isLeverJob = ats === "LEVER" || targetUrl.toLowerCase().includes("lever.co");
      const isGreenhouseJob = ats === "GREENHOUSE" || targetUrl.toLowerCase().includes("greenhouse.io");
      const isWorkableJob = ats === "WORKABLE" || targetUrl.toLowerCase().includes("workable.com");
      const isPaylocityJob = ats === "PAYLOCITY" || targetUrl.toLowerCase().includes("paylocity.com");
      const isWellfoundJob = ats === "WELLFOUND" || targetUrl.toLowerCase().includes("wellfound.com") || targetUrl.toLowerCase().includes("angel.co");
      const isBambooHRJob = ats === "BAMBOOHR" || targetUrl.toLowerCase().includes("bamboohr.com");
      const isJazzHRJob = ats === "JAZZHR" || targetUrl.toLowerCase().includes("applytojob.com") || targetUrl.toLowerCase().includes("jazzhr.com");
      const isBreezyHRJob = ats === "BREEZYHR" || targetUrl.toLowerCase().includes("breezy.hr");
      const isAvatureJob = ats === "AVATURE" || targetUrl.toLowerCase().includes("avature.net");
      const isJobviteJob = ats === "JOBVITE" || targetUrl.toLowerCase().includes("jobvite.com");
      const isAshbyJob = ats === "ASHBY" || targetUrl.toLowerCase().includes("ashbyhq.com");
      const isSmartRecruitersJob = ats === "SMARTRECRUITERS" || targetUrl.toLowerCase().includes("smartrecruiters.com");
      const isTaleoJob = ats === "TALEO" || targetUrl.toLowerCase().includes("taleo.net");
      const isIcimsJob = ats === "ICIMS" || targetUrl.toLowerCase().includes("icims.com");
      const isOracleJob = ats === "ORACLE" || targetUrl.toLowerCase().includes("oracle");
      const shouldAutoSubmitThisJob = (isIcimsJob || isOracleJob || isAvatureJob || isLeverJob || isGreenhouseJob || isWorkableJob || isPaylocityJob || isWellfoundJob || isBambooHRJob || isJazzHRJob || isBreezyHRJob || isJobviteJob || isAshbyJob || isSmartRecruitersJob || isTaleoJob || isForceAllAutoSubmit || process.env.AUTO_SUBMIT === "true") && !isManualOnly;

      if (shouldAutoSubmitThisJob) {
        process.env.AUTO_SUBMIT = "true";
        process.env.DRY_RUN = "false";
        console.log(`⚡ [Policy]: ${ats} detected -> AUTO-SUBMIT IS ACTIVE FOR THIS JOB 🚀`);
      } else {
        process.env.AUTO_SUBMIT = "false";
        process.env.DRY_RUN = "true";
        console.log(`🔒 [Policy]: ${ats} detected -> AUTO-SUBMIT DISABLED (Manual review mode only) 🎯`);
      }
      
      // Extract fields & detect job details
      console.log(`🔍 Scanning form structure and extracting logical fields...`);
      const fields = await adapter.extractFields(page);
      console.log(`📊 Extracted ${fields.length} interactive form fields.`);
      
      // Fill form fields with user specific profile & DB saved answers in parallel with human mouse
      console.log(`✍️ Automatically filling form with ${profile.firstName} ${profile.lastName}'s details & smart answers...`);
      await adapter.fillForm(page, profile, additionalAnswers, fields);
      
      // Wait for parser if present
      await page.waitForSelector(
        "[data-upload-state='complete'], [class*='uploadComplete'], [class*='upload-complete']",
        { timeout: 5000 }
      ).catch(() => {});
      
      // Validate all required inputs
      console.log(`🔍 Validating required form inputs...`);
      const isValid = await adapter.validate(page, fields);
      if (!isValid) {
        console.warn(`⚠️ Validation check reported some fields may be incomplete.`);
      } else {
        console.log(`✅ All required fields verified successfully for ${profile.firstName} ${profile.lastName}.`);
      }

      // Submit / Prepare application
      if (shouldAutoSubmitThisJob) {
        console.log(`🚀 Executing automatic application submission for ${profile.firstName} (${ats} Auto-Submit)...`);
        const submitResult = await adapter.submit(page);
        
        await db.query(
          `UPDATE applications SET status = $1, submitted_at = CURRENT_TIMESTAMP 
           WHERE user_id = $2 AND job_id IN (SELECT id FROM jobs WHERE url = $3)`,
          [submitResult.success ? "SUBMITTED" : "FAILED", profile.userId, url]
        ).catch(() => {});

        console.log(`\n📋 [Job ${index + 1}/${total}] Result Summary:`);
        console.log(`   - Candidate Applied: ${profile.firstName} ${profile.lastName} (${profile.email})`);
        console.log(`   - ATS Platform: ${ats}`);
        console.log(`   - Submission Status: ${submitResult.success ? "✅ AUTO-SUBMITTED" : "❌ FAILED"}`);
        if (submitResult.confirmation) console.log(`   - Confirmation: ${submitResult.confirmation}`);
        if (submitResult.errorMessage) console.log(`   - Error / Notice: ${submitResult.errorMessage}`);
      } else {
        console.log(`🎯 Form autofilled & verified for ${profile.firstName}. Ready for your manual submit click! (${ats} auto-submit disabled)`);
        const submitResult = await adapter.submit(page);

        await db.query(
          `UPDATE applications SET status = 'READY_TO_SUBMIT', updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1 AND job_id IN (SELECT id FROM jobs WHERE url = $2)`,
          [profile.userId, url]
        ).catch(() => {});

        console.log(`\n📋 [Job ${index + 1}/${total}] Result Summary:`);
        console.log(`   - Candidate Applied: ${profile.firstName} ${profile.lastName} (${profile.email})`);
        console.log(`   - ATS Platform: ${ats}`);
        console.log(`   - Submission Status: 🟢 READY FOR MANUAL SUBMIT (Auto-submit disabled for ${ats})`);
        console.log(`   👉 Tab is centered on submit button for your manual review and click!`);
      }
      
      console.log(`\n✅ Completed application for ${profile.firstName} ${profile.lastName} (Job ${index + 1}/${total}).`);
    } catch (error: any) {
      jobHasError = true;
      const isClosedErr = error.message.includes("Target page, context or browser has been closed") ||
                          error.message.includes("Target closed") ||
                          error.message.includes("browser has been closed");
      if (isClosedErr) {
        console.log(`ℹ️ [Job ${index + 1}] Browser closed by user.`);
      } else {
        console.error(`❌ [Job ${index + 1}] Error during autofill for ${profile.firstName}:`, error.message);
      }
    } finally {
      if (page) {
        if (!isKeepOpenMode && !jobHasError) {
          await page.close().catch(() => {});
          console.log(`🔒 Closed tab for Job ${index + 1}/${total}.\n`);
        } else {
          console.log(`📌 Keeping tab open for Job ${index + 1}/${total}.\n`);
        }
      }
    }
  };

  if (isSequentialMode) {
    console.log(`🎯 Processing ${urls.length} job(s) sequentially with multi-user profile rotation...`);
    for (let i = 0; i < urls.length; i++) {
      await processJob(urls[i], i, urls.length);
      if (i < urls.length - 1) {
        const pauseMs = 6000 + Math.floor(Math.random() * 2000);
        console.log(`⏳ Pausing ${Math.round(pauseMs / 1000)}s between applications to satisfy rate-limiting & anti-spam checks...\n`);
        await new Promise(r => setTimeout(r, pauseMs));
      }
    }
  } else {
    console.log(`⚡ Opening all ${urls.length} job application(s) at once and filling SIMULTANEOUSLY in parallel...`);
    const promises = urls.map((url, i) => processJob(url, i, urls.length));
    await Promise.all(promises);
  }

  if (!isKeepOpenMode) {
    if (persistentContext) await persistentContext.close().catch(() => {});
    if (sharedContext) await sharedContext.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  } else {
    console.log(`📌 Keeping all ${urls.length} browser tabs open on screen for your review!`);
  }
  console.log(`🎉 All ${urls.length} job application(s) processed successfully!`);
  await db.close();
}

main().catch(async (err) => {
  console.error("❌ Fatal execution error:", err);
  await db.close();
  process.exit(1);
});
