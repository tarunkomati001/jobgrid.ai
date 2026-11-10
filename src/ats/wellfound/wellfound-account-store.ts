import fs from "fs";
import path from "path";
import { db } from "../../database/db";
import { UserProfile, WorkExperienceItem, EducationItem } from "../ats.interface";

export interface WellfoundCredential {
  email: string;
  password: string;
  name?: string;
  updatedAt: string;
}

const LOCAL_STORE_PATH = path.resolve(process.cwd(), "data", "wellfound_credentials.json");

export const DEFAULT_HRUTIN_WELLFOUND_EXPERIENCES: WorkExperienceItem[] = [
  {
    jobTitle: "Full Stack AI Developer",
    company: "Jobspring",
    location: "San Francisco, CA, United States",
    currentlyWorkHere: true,
    startDate: "01/2024",
    startMonth: "01",
    startYear: "2024",
    endDate: "01/2026",
    endMonth: "01",
    endYear: "2026",
    description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications. Reduced API response latency by 30% through database query optimization and backend performance improvements. Containerized and deployed applications using Docker and Azure App Service, reducing deployment time by 60%."
  },
  {
    jobTitle: "Full Stack Developer",
    company: "Nomadic Trails",
    location: "Remote",
    currentlyWorkHere: false,
    startDate: "09/2025",
    startMonth: "09",
    startYear: "2025",
    endDate: "10/2025",
    endMonth: "10",
    endYear: "2025",
    description: "Delivered full-stack features for a travel-tech platform serving customer-facing applications. Built scalable backend APIs and responsive frontend interfaces using modern development practices. Integrated third-party APIs for itinerary generation and workflow automation."
  }
];

export const DEFAULT_HRUTIN_WELLFOUND_EDUCATIONS: EducationItem[] = [
  {
    school: "Parul University",
    degree: "Bachelor of Technology",
    fieldOfStudy: "Computer Science Engineering (AI & ML)",
    gpa: "7.1",
    startDate: "08/2023",
    startYear: "2023",
    endDate: "06/2027",
    endYear: "2027"
  }
];

export const DEFAULT_HRUTIN_WELLFOUND_SKILLS = [
  "Python", "FastAPI", "React", "JavaScript", "Docker", "REST APIs", 
  "MySQL", "MongoDB", "Supabase", "Git", "Azure", "NLP", "RAG", "OpenAI"
];

export const DEFAULT_HRUTIN_WELLFOUND_LINKS = {
  linkedin: "https://linkedin.com/in/hrutinnammi",
  github: "https://github.com/hrutinnammi",
  portfolio: "https://github.com/hrutinnammi",
  twitter: "https://x.com/hrutin_dev",
  website: "https://github.com/hrutinnammi",
  blog: "https://github.com/hrutinnammi"
};

export const DEFAULT_HRUTIN_WELLFOUND_PROFILE: UserProfile = {
  userId: "usr_hrutin_nammi",
  firstName: "Hrutin",
  lastName: "Nammi",
  email: "babufakemail@gmail.com",
  phone: "+1 202 555 0198",
  location: "San Francisco, CA, United States",
  street: "123 Market St",
  addressLine2: "Suite 400",
  city: "San Francisco",
  state: "California",
  zipCode: "94105",
  country: "United States",
  linkedinUrl: DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
  githubUrl: DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
  portfolioUrl: DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio,
  websites: [
    DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
    DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
    DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
    DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio
  ],
  workAuthorization: "Authorized to Work",
  willingToRelocate: true,
  yearsOfExperience: 2,
  gender: "Male",
  skills: DEFAULT_HRUTIN_WELLFOUND_SKILLS,
  experiences: DEFAULT_HRUTIN_WELLFOUND_EXPERIENCES,
  educations: DEFAULT_HRUTIN_WELLFOUND_EDUCATIONS,
  resumePath: "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf"
};

export const DEFAULT_HRUTIN_WELLFOUND_PITCH = 
  "Hi, I am a Full-Stack AI Developer with production experience building scalable AI solutions using Python, FastAPI, React, and RAG architectures. At Jobspring, I reduced API response latency by 30% and containerized backend services with Docker and Azure. I am very interested in this role and excited to contribute to your engineering team. Thank you!";

/**
 * Retrieves local credentials from data/wellfound_credentials.json
 */
export function getLocalWellfoundCredentials(): Record<string, WellfoundCredential> {
  try {
    const dir = path.dirname(LOCAL_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const data = fs.readFileSync(LOCAL_STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err: any) {
    console.warn("⚠️ [WellfoundAccountStore]: Failed to read local credentials file:", err.message);
  }
  return {};
}

/**
 * Saves credentials locally in data/wellfound_credentials.json
 */
export function saveLocalWellfoundCredentials(store: Record<string, WellfoundCredential>): void {
  try {
    const dir = path.dirname(LOCAL_STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err: any) {
    console.warn("⚠️ [WellfoundAccountStore]: Failed to write local credentials file:", err.message);
  }
}

/**
 * Retrieves stored Wellfound credentials by email, checking DB, local JSON, and environment variables.
 */
export async function getWellfoundCredentials(email: string = "babufakemail@gmail.com"): Promise<WellfoundCredential | null> {
  // 1. Try local JSON store first
  const local = getLocalWellfoundCredentials();
  if (local[email]) {
    return local[email];
  }

  // 2. Try DB ats_credentials table
  try {
    const res = await db.query(
      `SELECT domain, email, password, updated_at FROM public.ats_credentials WHERE domain = 'wellfound.com' AND email = $1 LIMIT 1`,
      [email]
    );
    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        email: row.email,
        password: row.password,
        name: "Hrutin Nammi",
        updatedAt: row.updated_at ? row.updated_at.toISOString() : new Date().toISOString()
      };
    }
  } catch (e: any) {
    // Database fallback
  }

  // 3. Fallback to env or default Hrutin password
  const defaultPw = process.env.WELLFOUND_PASSWORD || process.env.DEFAULT_USER_PASSWORD || "HrutinDev@2024!";
  return {
    email: email,
    password: defaultPw,
    name: "Hrutin Nammi",
    updatedAt: new Date().toISOString()
  };
}

/**
 * Saves or updates Wellfound credentials across both local file and DB
 */
export async function saveWellfoundCredentials(credential: WellfoundCredential): Promise<void> {
  // Save locally
  const local = getLocalWellfoundCredentials();
  local[credential.email] = credential;
  saveLocalWellfoundCredentials(local);

  // Save to DB
  try {
    await db.query(
      `INSERT INTO public.ats_credentials (domain, email, password, updated_at)
       VALUES ('wellfound.com', $1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (domain, email) DO UPDATE SET password = EXCLUDED.password, updated_at = CURRENT_TIMESTAMP`,
      [credential.email, credential.password]
    );
  } catch (e: any) {
    // DB error logging
  }
}

