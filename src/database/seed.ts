import { db } from "./db";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

interface DemoUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  linkedin: string;
  github: string;
  portfolio: string;
  sponsorship: boolean;
  workEligible: boolean;
  relocation: boolean;
  resumeFileName: string;
  b2bSaasSupport: string;
  supportCasesPerDay: string;
  enterpriseCSYears: number;
  engineeringYears: number;
  engineersManaged: string;
  operationalImprovement?: string;
  hiringMistake?: string;
  regionalSupportProcess?: string;
  technicalCustomerIssue?: string;
  bestEngineer?: string;
  leadershipCourage?: string;
  productUsers?: string;
  designSystemExperience?: string;
  designLinks?: string;
  age?: string;
  gender?: string;
  ethnicity?: string;
  communities?: string;
  preferNotToAnswer?: string;
}

const DEMO_USERS: DemoUser[] = [
  {
    id: "usr_demo_001",
    firstName: "Aarav",
    lastName: "Mehta",
    email: "aarav.mehta.demo@example.com",
    phone: "+91 90000 00001",
    city: "Vadodara",
    country: "India",
    linkedin: "https://linkedin.com/in/aarav-mehta-demo",
    github: "https://github.com/aarav-mehta-demo",
    portfolio: "https://aarav-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Aarav_Mehta_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "10–12",
    enterpriseCSYears: 4,
    engineeringYears: 4,
    engineersManaged: "5–10",
    operationalImprovement: "Implemented automated ticket categorization reducing initial response time by 40%.",
    hiringMistake: "Hired a candidate based solely on technical skills without assessing team communication.",
    regionalSupportProcess: "Established 24/7 follow-the-sun support handoff procedures between APAC and EMEA.",
    technicalCustomerIssue: "Resolved database query timeouts for a top enterprise customer by optimizing SQL indexes.",
    bestEngineer: "Mentored a junior developer into a tech lead by providing structured feedback and architecture ownership.",
    leadershipCourage: "Advocated for refactoring core authentication services despite tight product launch deadlines.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://aarav-demo.dev/design",
    age: "25-34",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Software Engineering Group",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_002",
    firstName: "Rohan",
    lastName: "Sharma",
    email: "rohan.sharma.demo@example.com",
    phone: "+91 90000 00002",
    city: "Bengaluru",
    country: "India",
    linkedin: "https://linkedin.com/in/rohan-sharma-demo",
    github: "https://github.com/rohan-sharma-demo",
    portfolio: "https://rohan-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: false,
    resumeFileName: "Rohan_Sharma_Resume.pdf",
    b2bSaasSupport: "No",
    supportCasesPerDay: "5–8",
    enterpriseCSYears: 2,
    engineeringYears: 3,
    engineersManaged: "0",
    operationalImprovement: "Streamlined API documentation to reduce customer integration support calls.",
    hiringMistake: "Overestimated project velocity during initial onboarding phase.",
    regionalSupportProcess: "Standardized regional escalation paths for critical production bugs.",
    technicalCustomerIssue: "Debugged memory leak in websocket gateway under high connection concurrency.",
    bestEngineer: "Paired with peer developers to establish unit test code coverage standards.",
    leadershipCourage: "Proposed dropping legacy browser support to speed up frontend feature releases.",
    productUsers: "500-1000",
    designSystemExperience: "true",
    designLinks: "https://rohan-demo.dev/ui",
    age: "25-34",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Open Source Contributors",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_003",
    firstName: "Ananya",
    lastName: "Patel",
    email: "ananya.patel.demo@example.com",
    phone: "+91 90000 00003",
    city: "Ahmedabad",
    country: "India",
    linkedin: "https://linkedin.com/in/ananya-patel-demo",
    github: "https://github.com/ananya-patel-demo",
    portfolio: "https://ananya-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Ananya_Patel_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "15–20",
    enterpriseCSYears: 3,
    engineeringYears: 2,
    engineersManaged: "3–5",
    operationalImprovement: "Built automated dashboard for tracking customer health scores and churn risks.",
    hiringMistake: "Rushed hiring decision without full panel evaluation.",
    regionalSupportProcess: "Created localized onboarding guides for regional enterprise accounts.",
    technicalCustomerIssue: "Identified CORS configuration error preventing enterprise Single Sign-On.",
    bestEngineer: "Helped junior developer master modular UI component design.",
    leadershipCourage: "Championed WCAG 2.1 accessibility compliance across product lines.",
    productUsers: "500-1000",
    designSystemExperience: "true",
    designLinks: "https://ananya-demo.dev/portfolio",
    age: "25-34",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "Women in Tech",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_004",
    firstName: "Vikram",
    lastName: "Rao",
    email: "vikram.rao.demo@example.com",
    phone: "+91 90000 00004",
    city: "Hyderabad",
    country: "India",
    linkedin: "https://linkedin.com/in/vikram-rao-demo",
    github: "https://github.com/vikram-rao-demo",
    portfolio: "https://vikram-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Vikram_Rao_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "20–25",
    enterpriseCSYears: 5,
    engineeringYears: 5,
    engineersManaged: "10–15",
    operationalImprovement: "Re-architected support workflow achieving 99.2% SLA compliance.",
    hiringMistake: "Delayed performance feedback for contractor personnel.",
    regionalSupportProcess: "Managed multi-region support teams spanning US East and India timezones.",
    technicalCustomerIssue: "Diagnosed distributed cache synchronization failures across Redis clusters.",
    bestEngineer: "Guided senior engineer through multi-month microservices architectural migration.",
    leadershipCourage: "Pushed back against unvetted scope expansion to prevent developer burnout.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://vikram-demo.dev/architecture",
    age: "35-44",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Engineering Leadership Network",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_005",
    firstName: "Neha",
    lastName: "Kapoor",
    email: "neha.kapoor.demo@example.com",
    phone: "+91 90000 00005",
    city: "Pune",
    country: "India",
    linkedin: "https://linkedin.com/in/neha-kapoor-demo",
    github: "https://github.com/neha-kapoor-demo",
    portfolio: "https://neha-demo.dev",
    sponsorship: true,
    workEligible: true,
    relocation: false,
    resumeFileName: "Neha_Kapoor_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "8–10",
    enterpriseCSYears: 4,
    engineeringYears: 4,
    engineersManaged: "5–10",
    operationalImprovement: "Introduced weekly root-cause analysis retrospectives between Support and Dev teams.",
    hiringMistake: "Selected candidate for immediate capacity rather than long-term strategic fit.",
    regionalSupportProcess: "Standardized SLA response matrix for EMEA and India business hours.",
    technicalCustomerIssue: "Resolved Webhook delivery failure by implementing exponential backoff queues.",
    bestEngineer: "Coached engineering team on clear technical writing and customer communication.",
    leadershipCourage: "Halted production deployment when automated security test suite flagged regression.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://neha-demo.dev/projects",
    age: "25-34",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "DevOps & Cloud Advocates",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_006",
    firstName: "Arjun",
    lastName: "Nair",
    email: "arjun.nair.demo@example.com",
    phone: "+91 90000 00006",
    city: "Kochi",
    country: "India",
    linkedin: "https://linkedin.com/in/arjun-nair-demo",
    github: "https://github.com/arjun-nair-demo",
    portfolio: "https://arjun-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Arjun_Nair_Resume.pdf",
    b2bSaasSupport: "No",
    supportCasesPerDay: "6–9",
    enterpriseCSYears: 1,
    engineeringYears: 3,
    engineersManaged: "0",
    operationalImprovement: "Automated test dataset generation for regression runs.",
    hiringMistake: "Focusing overly on syntax speed during interview evaluation.",
    regionalSupportProcess: "Followed standard incident response protocol.",
    technicalCustomerIssue: "Fixed API response schema validation mismatch.",
    bestEngineer: "Encouraged peer review culture across junior developers.",
    leadershipCourage: "Advocated for static analysis tools integration into CI pipeline.",
    productUsers: "100-500",
    designSystemExperience: "false",
    designLinks: "https://arjun-demo.dev",
    age: "25-34",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Full Stack Developers",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_007",
    firstName: "Priya",
    lastName: "Reddy",
    email: "priya.reddy.demo@example.com",
    phone: "+91 90000 00007",
    city: "Chennai",
    country: "India",
    linkedin: "https://linkedin.com/in/priya-reddy-demo",
    github: "https://github.com/priya-reddy-demo",
    portfolio: "https://priya-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Priya_Reddy_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "12–15",
    enterpriseCSYears: 3,
    engineeringYears: 2,
    engineersManaged: "3–5",
    operationalImprovement: "Created customer self-service knowledge base reducing ticket volume by 25%.",
    hiringMistake: "Underestimating onboarding timeline for complex SaaS domain.",
    regionalSupportProcess: "Coordinated support coverage across South Asia business shifts.",
    technicalCustomerIssue: "Resolved OAuth2 token expiration issues in enterprise integrations.",
    bestEngineer: "Supported engineer transitioning into product owner responsibilities.",
    leadershipCourage: "Insisted on thorough security audit prior to launching enterprise portal.",
    productUsers: "500-1000",
    designSystemExperience: "true",
    designLinks: "https://priya-demo.dev/work",
    age: "25-34",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "Product & Engineering",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_008",
    firstName: "Karan",
    lastName: "Singh",
    email: "karan.singh.demo@example.com",
    phone: "+91 90000 00008",
    city: "Delhi",
    country: "India",
    linkedin: "https://linkedin.com/in/karan-singh-demo",
    github: "https://github.com/karan-singh-demo",
    portfolio: "https://karan-demo.dev",
    sponsorship: true,
    workEligible: true,
    relocation: false,
    resumeFileName: "Karan_Singh_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "18–22",
    enterpriseCSYears: 6,
    engineeringYears: 6,
    engineersManaged: "10–15",
    operationalImprovement: "Built multi-tier escalation triage engine.",
    hiringMistake: "Skipping behavioral interview round due to timeline pressures.",
    regionalSupportProcess: "Led global Enterprise Support operations across US and India.",
    technicalCustomerIssue: "Resolved zero-downtime database migration deadlock.",
    bestEngineer: "Mentored two engineers into principal role status.",
    leadershipCourage: "Vetoed unstable release candidates despite marketing launch window.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://karan-demo.dev/tech",
    age: "35-44",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Senior Tech Leaders",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_009",
    firstName: "Sneha",
    lastName: "Iyer",
    email: "sneha.iyer.demo@example.com",
    phone: "+91 90000 00009",
    city: "Mumbai",
    country: "India",
    linkedin: "https://linkedin.com/in/sneha-iyer-demo",
    github: "https://github.com/sneha-iyer-demo",
    portfolio: "https://sneha-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Sneha_Iyer_Resume.pdf",
    b2bSaasSupport: "No",
    supportCasesPerDay: "5–7",
    enterpriseCSYears: 2,
    engineeringYears: 2,
    engineersManaged: "0",
    operationalImprovement: "Updated frontend component library for better responsiveness.",
    hiringMistake: "Not clarifying remote communication expectations early.",
    regionalSupportProcess: "Participated in daily standups and escalation reviews.",
    technicalCustomerIssue: "Fixed cross-browser styling rendering bug.",
    bestEngineer: "Provided comprehensive code review comments to peers.",
    leadershipCourage: "Suggested adopting TypeScript for better type safety across projects.",
    productUsers: "100-500",
    designSystemExperience: "true",
    designLinks: "https://sneha-demo.dev/design",
    age: "18-24",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "Frontend Engineers",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_010",
    firstName: "Aditya",
    lastName: "Joshi",
    email: "aditya.joshi.demo@example.com",
    phone: "+91 90000 00010",
    city: "Jaipur",
    country: "India",
    linkedin: "https://linkedin.com/in/aditya-joshi-demo",
    github: "https://github.com/aditya-joshi-demo",
    portfolio: "https://aditya-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: false,
    resumeFileName: "Aditya_Joshi_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "10–15",
    enterpriseCSYears: 4,
    engineeringYears: 4,
    engineersManaged: "5–10",
    operationalImprovement: "Automated error log aggregation with alerting webhooks.",
    hiringMistake: "Misjudging technical depth during initial screen.",
    regionalSupportProcess: "Managed regional client accounts with dedicated SLAs.",
    technicalCustomerIssue: "Diagnosed high CPU utilization in microservice worker.",
    bestEngineer: "Helped team transition to automated CI/CD workflows.",
    leadershipCourage: "Refactored legacy backend routes to improve security headers.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://aditya-demo.dev/projects",
    age: "25-34",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Backend & Systems Developers",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_011",
    firstName: "Kavya",
    lastName: "Verma",
    email: "kavya.verma.demo@example.com",
    phone: "+91 90000 00011",
    city: "Gurugram",
    country: "India",
    linkedin: "https://linkedin.com/in/kavya-verma-demo",
    github: "https://github.com/kavya-verma-demo",
    portfolio: "https://kavya-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Kavya_Verma_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "12–18",
    enterpriseCSYears: 3,
    engineeringYears: 4,
    engineersManaged: "3–5",
    operationalImprovement: "Built customer onboarding automation reducing time-to-value by 35%.",
    hiringMistake: "Assessed candidates primarily on live coding speed rather than architecture design.",
    regionalSupportProcess: "Coordinated support coverage across India and European business shifts.",
    technicalCustomerIssue: "Resolved distributed transaction rollback errors during payment gateway integrations.",
    bestEngineer: "Coached junior engineer on effective unit testing and clean code principles.",
    leadershipCourage: "Advocated for accessibility standards across enterprise web applications.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://kavya-demo.dev/ui",
    age: "25-34",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "Women in Tech",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_012",
    firstName: "Rahul",
    lastName: "Saxena",
    email: "rahul.saxena.demo@example.com",
    phone: "+91 90000 00012",
    city: "Noida",
    country: "India",
    linkedin: "https://linkedin.com/in/rahul-saxena-demo",
    github: "https://github.com/rahul-saxena-demo",
    portfolio: "https://rahul-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: false,
    resumeFileName: "Rahul_Saxena_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "15–20",
    enterpriseCSYears: 5,
    engineeringYears: 5,
    engineersManaged: "5–10",
    operationalImprovement: "Implemented central telemetry logging system for real-time error tracking.",
    hiringMistake: "Rushed onboarding process without clear 30-60-90 day milestone expectations.",
    regionalSupportProcess: "Established escalation channels between Tier 2 support and core engineering.",
    technicalCustomerIssue: "Optimized elasticsearch index mapping to handle multi-tenant search workloads.",
    bestEngineer: "Supported senior developer in leading microservices breaking change transition.",
    leadershipCourage: "Pushed for deprecation of legacy security protocols across API endpoints.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://rahul-demo.dev/architecture",
    age: "25-34",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Cloud Architecture Advocates",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_013",
    firstName: "Divya",
    lastName: "Sundaram",
    email: "divya.sundaram.demo@example.com",
    phone: "+91 90000 00013",
    city: "Bengaluru",
    country: "India",
    linkedin: "https://linkedin.com/in/divya-sundaram-demo",
    github: "https://github.com/divya-sundaram-demo",
    portfolio: "https://divya-demo.dev",
    sponsorship: true,
    workEligible: true,
    relocation: true,
    resumeFileName: "Divya_Sundaram_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "10–14",
    enterpriseCSYears: 4,
    engineeringYears: 3,
    engineersManaged: "3–5",
    operationalImprovement: "Automated SLA tracking and customer notification workflows.",
    hiringMistake: "Evaluated contractors solely on immediate project needs.",
    regionalSupportProcess: "Managed customer success relationships across South Asia and APAC accounts.",
    technicalCustomerIssue: "Identified memory leak in backend cache manager under high load.",
    bestEngineer: "Helped peer developers build scalable frontend state management modules.",
    leadershipCourage: "Championed customer data privacy guidelines ahead of compliance audit.",
    productUsers: "500-1000",
    designSystemExperience: "true",
    designLinks: "https://divya-demo.dev/cs",
    age: "25-34",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "Enterprise Success Network",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_014",
    firstName: "Siddharth",
    lastName: "Chawla",
    email: "siddharth.chawla.demo@example.com",
    phone: "+91 90000 00014",
    city: "Chandigarh",
    country: "India",
    linkedin: "https://linkedin.com/in/siddharth-chawla-demo",
    github: "https://github.com/siddharth-chawla-demo",
    portfolio: "https://siddharth-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: true,
    resumeFileName: "Siddharth_Chawla_Resume.pdf",
    b2bSaasSupport: "No",
    supportCasesPerDay: "6–10",
    enterpriseCSYears: 2,
    engineeringYears: 6,
    engineersManaged: "10–15",
    operationalImprovement: "Introduced automated integration test pipelines reducing production regressions.",
    hiringMistake: "Skipped team culture alignment round during rapid team scaling.",
    regionalSupportProcess: "Followed global engineering on-call rotation schedules.",
    technicalCustomerIssue: "Re-architected WebSocket connection pool for zero-drop real-time streaming.",
    bestEngineer: "Mentored senior developers to take ownership of major platform initiatives.",
    leadershipCourage: "Vetoed releasing unverified software builds prior to holiday freezes.",
    productUsers: "1000 or more",
    designSystemExperience: "true",
    designLinks: "https://siddharth-demo.dev/systems",
    age: "35-44",
    gender: "Male",
    ethnicity: "Asian / South Asian",
    communities: "Systems Engineering Guild",
    preferNotToAnswer: "false",
  },
  {
    id: "usr_demo_015",
    firstName: "Meera",
    lastName: "Kulkarni",
    email: "meera.kulkarni.demo@example.com",
    phone: "+91 90000 00015",
    city: "Nagpur",
    country: "India",
    linkedin: "https://linkedin.com/in/meera-kulkarni-demo",
    github: "https://github.com/meera-kulkarni-demo",
    portfolio: "https://meera-demo.dev",
    sponsorship: false,
    workEligible: true,
    relocation: false,
    resumeFileName: "Meera_Kulkarni_Resume.pdf",
    b2bSaasSupport: "Yes",
    supportCasesPerDay: "8–12",
    enterpriseCSYears: 3,
    engineeringYears: 3,
    engineersManaged: "0",
    operationalImprovement: "Created responsive UI template library reducing component build time.",
    hiringMistake: "Underestimated remote communication onboarding effort.",
    regionalSupportProcess: "Provided Tier 2 support during regional peak business hours.",
    technicalCustomerIssue: "Fixed cross-browser hydration issues in server-rendered React apps.",
    bestEngineer: "Collaborated with designers to enforce strict design system token guidelines.",
    leadershipCourage: "Advocated for WCAG accessibility audits on all user-facing web portals.",
    productUsers: "500-1000",
    designSystemExperience: "true",
    designLinks: "https://meera-demo.dev/design-system",
    age: "25-34",
    gender: "Female",
    ethnicity: "Asian / South Asian",
    communities: "Design & UX Engineers",
    preferNotToAnswer: "false",
  },
];

async function seedDatabase() {
  console.log("🌱 Starting Database Seed for 10 Ashby Demo User Profiles...");
  const resumesDir = path.resolve(__dirname, "../../resumes");

  if (!fs.existsSync(resumesDir)) {
    fs.mkdirSync(resumesDir, { recursive: true });
  }

  for (const user of DEMO_USERS) {
    console.log(`\n👤 Seeding User: ${user.firstName} ${user.lastName} (${user.email})`);

    // 1. Ensure user resume file exists on disk with valid binary PDF format
    const userResumeDir = path.join(resumesDir, `user_${user.id}`);
    if (!fs.existsSync(userResumeDir)) {
      fs.mkdirSync(userResumeDir, { recursive: true });
    }
    const resumePath = path.join(userResumeDir, user.resumeFileName);
    const validPdfTemplate = path.join(resumesDir, "user_bb5c54fd-79ee-41fd-917b-6553a09195d1", "Aarav_Mehta_Resume.pdf");
    if (!fs.existsSync(resumePath) || fs.readFileSync(resumePath).toString("utf-8", 0, 5) !== "%PDF-") {
      if (fs.existsSync(validPdfTemplate)) {
        fs.copyFileSync(validPdfTemplate, resumePath);
      } else {
        fs.writeFileSync(resumePath, Buffer.from("%PDF-1.4\n%\n1 0 obj\n<</Title (Resume)>>\nendobj\n", "binary"));
      }
      console.log(`  📄 Created valid binary PDF resume file at: ${resumePath}`);
    }

    // 2. Insert or update User in `users` table
    await db.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [user.id, user.email, "demo_password_hash_123"]
    );

    // 3. Insert or update Profile in `user_profiles` table
    const locationStr = `${user.city}, ${user.country}`;
    const workAuthStr = user.sponsorship ? "Requires Sponsorship" : "Authorized to Work";

    await db.query(
      `INSERT INTO user_profiles 
       (id, user_id, first_name, last_name, phone, location, linkedin_url, github_url, portfolio_url, work_authorization, willing_to_relocate, years_of_experience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (user_id) DO UPDATE SET
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone,
         location = EXCLUDED.location,
         linkedin_url = EXCLUDED.linkedin_url,
         github_url = EXCLUDED.github_url,
         portfolio_url = EXCLUDED.portfolio_url,
         work_authorization = EXCLUDED.work_authorization,
         willing_to_relocate = EXCLUDED.willing_to_relocate,
         years_of_experience = EXCLUDED.years_of_experience`,
      [
        `prof_${user.id}`,
        user.id,
        user.firstName,
        user.lastName,
        user.phone,
        locationStr,
        user.linkedin,
        user.github,
        user.portfolio,
        workAuthStr,
        user.relocation ? 1 : 0,
        user.engineeringYears,
      ]
    );

    // 4. Insert or update active Resume in `resumes` table
    const relativeResumePath = `resumes/user_${user.id}/${user.resumeFileName}`;
    await db.query(
      `INSERT INTO resumes (id, user_id, file_name, file_path, resume_type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET file_path = EXCLUDED.file_path, is_active = 1`,
      [`res_${user.id}`, user.id, user.resumeFileName, relativeResumePath, "PDF", 1]
    );

    // 5. Store key-value mappings in `user_saved_answers` table
    const answersMap: Record<string, string> = {
      // Basic Profile & Location
      country: user.country,
      city: user.city,
      location: locationStr,
      linkedin: user.linkedin,
      github: user.github,
      portfolio: user.portfolio,
      // Work Authorization
      eligible_to_work: user.workEligible ? "Yes" : "No",
      requires_sponsorship: user.sponsorship ? "Yes" : "No",
      relocation: user.relocation ? "Yes" : "No",
      // Experience
      b2b_saas_support: user.b2bSaasSupport,
      support_cases_per_day: user.supportCasesPerDay,
      support_schedule: "Flexible / Full-time",
      enterprise_customer_success_years: `${user.enterpriseCSYears} years`,
      full_time_engineering_years: `${user.engineeringYears} years`,
      engineers_managed: user.engineersManaged,
      // Screening Answers
      operational_improvement: user.operationalImprovement || "Implemented continuous delivery and automated test suites.",
      hiring_mistake: user.hiringMistake || "Selected candidate based solely on technical speed without assessing communication.",
      regional_support_process: user.regionalSupportProcess || "Established 24/7 follow-the-sun support handoff procedures.",
      technical_customer_issue: user.technicalCustomerIssue || "Resolved database query timeouts for enterprise customer.",
      best_engineer: user.bestEngineer || "Mentored developer into tech lead through structured ownership.",
      leadership_courage_example: user.leadershipCourage || "Advocated for refactoring core architecture despite deadlines.",
      // Product / Design
      product_users: user.productUsers || "1000 or more",
      design_system_experience: user.designSystemExperience || "true",
      design_work_links: user.designLinks || user.portfolio,
      // Diversity
      age: user.age || "25-34",
      gender: user.gender || "Male",
      ethnicity: user.ethnicity || "Asian / South Asian",
      communities: user.communities || "Engineering Group",
      prefer_not_to_answer: user.preferNotToAnswer || "false",
    };

    for (const [key, val] of Object.entries(answersMap)) {
      const answerId = `ans_${user.id}_${key}`;
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [answerId, user.id, key, key, val, "USER"]
      );
    }

    console.log(`  ✅ Successfully seeded profile and ${Object.keys(answersMap).length} saved answers for ${user.firstName}.`);
  }

  console.log("\n🎉 Database Seed Completed Successfully for all 10 User Profiles!");
  await db.close();
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error("❌ Seed failed with error:", err);
  process.exit(1);
});
