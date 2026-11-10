import fs from "fs";
import path from "path";
import { db } from "./db";
import { EducationItem, JobDetails, UserProfile, WorkExperienceItem } from "../ats/ats.interface";
import { resolveLocalResumePath } from "../utils/path-resolver";

/**
 * Parses a combined location string like:
 * "San Francisco, CA, United States" -> { city: "San Francisco", state: "California", country: "United States" }
 * "Austin, Texas, United States" -> { city: "Austin", state: "Texas", country: "United States" }
 * "Vadodara, Gujarat, India" -> { city: "Vadodara", state: "Gujarat", country: "India" }
 */
export function parseLocation(rawLoc: string = ""): {
  street: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
} {
  const clean = (rawLoc || "").trim();
  const parts = clean.split(",").map(p => p.trim()).filter(Boolean);

  let city = "";
  let state = "";
  let country = "United States";
  let zipCode = "";
  let street = "123 Main St";
  let addressLine2 = "";

  if (parts.length >= 3) {
    city = parts[0];
    state = parts[1];
    country = parts[parts.length - 1];
  } else if (parts.length === 2) {
    city = parts[0];
    state = parts[1];
    if (state.toLowerCase().includes("india")) {
      country = "India";
      state = "Gujarat";
    }
  } else if (parts.length === 1) {
    city = parts[0];
  }

  // Normalize US states
  const stateLower = state.toLowerCase();
  if (stateLower === "ca" || stateLower === "california") {
    state = "California";
    zipCode = zipCode || "94105";
    street = "123 Market St";
  } else if (stateLower === "tx" || stateLower === "texas") {
    state = "Texas";
    zipCode = zipCode || "78701";
    street = "500 Congress Ave";
  } else if (stateLower === "ny" || stateLower === "new york") {
    state = "New York";
    zipCode = zipCode || "10001";
    street = "350 5th Ave";
  } else if (country.toLowerCase().includes("india") || stateLower.includes("gujarat")) {
    state = state || "Gujarat";
    country = "India";
    zipCode = zipCode || "390001";
    street = "101 Station Road";
  }

  return {
    street,
    addressLine2,
    city: city || "San Francisco",
    state: state || "California",
    zipCode: zipCode || "94105",
    country: country || "United States"
  };
}

/**
 * Official Blueprint Profile based on Hrutin Nammi.
 * Serves as the golden standard for all ATS autofilling and blueprint for other users.
 */
export const HRUTIN_BLUEPRINT_PROFILE: UserProfile = {
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
  gender: "Male",
  ethnicity: "Asian",
  headline: "Full-Stack AI Developer",
  summary: "Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, developed an AI resume platform serving 50+ users and reduced API latency by 30%.",
  linkedinUrl: "https://linkedin.com/in/hrutinnammi",
  githubUrl: "https://github.com/hrutinnammi",
  portfolioUrl: "https://hrutinnammi.dev",
  workAuthorization: "Authorized to work in the US",
  willingToRelocate: true,
  yearsOfExperience: 3,
  resumePath: resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf") || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf",
  coverLetterPath: resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf") || "resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf",
  websites: [
    "https://linkedin.com/in/hrutinnammi",
    "https://github.com/hrutinnammi"
  ],
  skills: [
    "Python", "FastAPI", "React", "JavaScript", "Docker", "REST APIs", "MySQL", "MongoDB", "Git", "Azure", "NLP", "RAG", "TypeScript", "Node.js"
  ],
  educations: [
    {
      school: "Parul University",
      degree: "Bachelor of Technology",
      fieldOfStudy: "Computer Science and Engineering",
      gpa: "7.1",
      startDate: "2023-08-01",
      startMonth: "08",
      startYear: "2023",
      endDate: "2027-06-01",
      endMonth: "06",
      endYear: "2027"
    }
  ],
  experiences: [
    {
      jobTitle: "Full Stack AI Developer",
      company: "Jobspring",
      location: "San Francisco, CA, United States",
      currentlyWorkHere: true,
      startDate: "2024-01-01",
      startMonth: "01",
      startYear: "2024",
      endDate: "2026-01-01",
      endMonth: "01",
      endYear: "2026",
      description: "Built an AI-powered resume generation platform using OpenAI APIs, generating 50+ customized resumes for users. Designed and implemented scalable FastAPI backend services and React frontend workflows for multi-user applications. Reduced API response latency by 30% through database query optimization and backend performance improvements. Containerized and deployed applications using Docker and Azure App Service, reducing deployment time by 60%."
    },
    {
      jobTitle: "Full Stack Developer",
      company: "Nomadic Trails",
      location: "Remote",
      currentlyWorkHere: false,
      startDate: "2024-09-01",
      startMonth: "09",
      startYear: "2024",
      endDate: "2025-10-01",
      endMonth: "10",
      endYear: "2025",
      description: "Delivered full-stack features for a travel-tech platform serving customer-facing applications. Built scalable backend APIs and responsive frontend interfaces using modern development practices. Integrated third-party APIs for itinerary generation and workflow automation."
    }
  ]
};

/**
 * Loads a single UserProfile completely from the database by ID, email, name, or index.
 * Defaults strictly to Hrutin Nammi (Main Candidate Blueprint) for all testing.
 */
export async function getUserProfile(identifier?: string): Promise<UserProfile> {
  const all = await getAllUserProfiles();
  if (all.length === 0) {
    return HRUTIN_BLUEPRINT_PROFILE;
  }

  // If no identifier provided or requesting default/main/hrutin, return Hrutin Nammi
  if (!identifier || identifier.trim() === "" || identifier.toLowerCase() === "default" || identifier.toLowerCase() === "main" || identifier.toLowerCase() === "hrutin") {
    const hrutin = all.find(p => p.email.toLowerCase().includes("hrutin") || p.firstName.toLowerCase().includes("hrutin") || p.userId?.includes("hrutin"));
    return hrutin || HRUTIN_BLUEPRINT_PROFILE;
  }

  const query = identifier.trim().toLowerCase();

  // 1. Check exact ID match
  const byId = all.find(p => p.userId?.toLowerCase() === query);
  if (byId) return byId;

  // 2. Check email match
  const byEmail = all.find(p => p.email.toLowerCase() === query || p.email.toLowerCase().includes(query));
  if (byEmail) return byEmail;

  // 3. Check name match
  const byName = all.find(p => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(query) || p.firstName.toLowerCase().includes(query) || p.lastName.toLowerCase().includes(query);
  });
  if (byName) return byName;

  // 4. Check index number (1-based: "1" -> Hrutin, "2" -> Candidate #2)
  const idx = parseInt(query, 10);
  if (!isNaN(idx) && idx > 0 && idx <= all.length) {
    return all[idx - 1];
  }

  console.warn(`⚠️ [UserProfileService]: User query "${identifier}" not found. Falling back to Hrutin Nammi:`);
  return all[0];
}

/**
 * Loads ALL UserProfiles from the PostgreSQL database, resolving profiles, resumes, and saved answers dynamically.
 * Works seamlessly whether there are 4 users or 200+ users!
 */
export async function getAllUserProfiles(): Promise<UserProfile[]> {
  let usersRes: any;
  try {
    usersRes = await db.query(`
      SELECT 
        u.id AS user_id,
        u.email,
        p.first_name,
        p.last_name,
        p.phone,
        p.location,
        p.linkedin_url,
        p.github_url,
        p.portfolio_url,
        p.work_authorization,
        p.willing_to_relocate,
        p.years_of_experience,
        p.gender
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ORDER BY u.created_at ASC
    `);
  } catch (dbErr: any) {
    console.warn(`⚠️ [UserProfileService]: Database query failed (${dbErr.message || dbErr}). Falling back to blueprint profiles.`);
    return [HRUTIN_BLUEPRINT_PROFILE];
  }

  if (!usersRes || !usersRes.rows || usersRes.rows.length === 0) {
    return [HRUTIN_BLUEPRINT_PROFILE];
  }

  // Pre-load all active resumes
  const resumesRes = await db.query(`
    SELECT id, user_id, file_name, file_path, resume_type
    FROM resumes
    WHERE is_active = 1
    ORDER BY created_at ASC
  `).catch(() => ({ rows: [] }));

  const resumeMap = new Map<string, string>();
  const coverLetterMap = new Map<string, string>();

  for (const r of (resumesRes.rows || [])) {
    const isCover = (r.file_name || "").toLowerCase().includes("cover") || (r.id || "").toLowerCase().startsWith("cov_");
    const resolved = resolveLocalResumePath(r.file_path);
    if (isCover) {
      coverLetterMap.set(r.user_id, resolved || r.file_path);
    } else {
      resumeMap.set(r.user_id, resolved || r.file_path);
    }
  }

  // Pre-load saved answers per user
  const answersRes = await db.query(`
    SELECT user_id, normalized_question, answer
    FROM user_saved_answers
  `).catch(() => ({ rows: [] }));

  const savedAnswersByUser = new Map<string, Map<string, string>>();
  for (const a of (answersRes.rows || [])) {
    if (!savedAnswersByUser.has(a.user_id)) {
      savedAnswersByUser.set(a.user_id, new Map());
    }
    savedAnswersByUser.get(a.user_id)!.set(a.normalized_question, a.answer);
  }

  const profiles: UserProfile[] = [];

  for (const u of usersRes.rows) {
    const userId = u.user_id;
    const userAnswers = savedAnswersByUser.get(userId) || new Map<string, string>();
    const locInfo = parseLocation(u.location || "");

    const resumePath = resumeMap.get(userId) || "";
    let coverLetterPath = coverLetterMap.get(userId) || "";

    // If cover letter not in DB resumes table, check if sibling PDF exists in user's resume directory
    if (!coverLetterPath && resumePath) {
      const candidateCover = path.join(path.dirname(resumePath), `${u.first_name || "Candidate"}_${u.last_name || "User"}_Cover_Letter.pdf`);
      if (fs.existsSync(candidateCover)) {
        coverLetterPath = candidateCover;
      }
    }

    // Dynamic education from saved answers
    const school = userAnswers.get("school") || userAnswers.get("university") || userAnswers.get("college") || "University";
    const degree = userAnswers.get("degree") || "Bachelor of Science";
    const fieldOfStudy = userAnswers.get("major") || userAnswers.get("field of study") || "Computer Science";
    const gradYear = userAnswers.get("graduation year") || userAnswers.get("graduation date") || "2026";

    const educations: EducationItem[] = [
      {
        school,
        degree,
        fieldOfStudy,
        gpa: userAnswers.get("gpa") || "3.8",
        startDate: "2022-08-01",
        startYear: "2022",
        endDate: `${gradYear}-05-01`,
        endYear: gradYear
      }
    ];

    // Dynamic work experiences from saved answers
    const currentCompany = userAnswers.get("current_company") || userAnswers.get("company") || userAnswers.get("employer") || "Technology Solutions";
    const currentTitle = userAnswers.get("current_title") || userAnswers.get("job_title") || userAnswers.get("title") || "Software Engineer";
    const summary = userAnswers.get("summary") || `${currentTitle} with expertise in building scalable web architectures, modern APIs, and high-performance applications.`;

    const experiences: WorkExperienceItem[] = [
      {
        jobTitle: currentTitle,
        company: currentCompany,
        location: locInfo.city ? `${locInfo.city}, ${locInfo.state}` : "Remote",
        currentlyWorkHere: true,
        startDate: "2024-01-01",
        startMonth: "01",
        startYear: "2024",
        endDate: "2026-01-01",
        endMonth: "01",
        endYear: "2026",
        description: `Architected and delivered high-impact engineering solutions. Collaborated across distributed teams to optimize API response times, improve scalability, and deliver robust software features.`
      }
    ];

    const isHrutin = userId === "usr_hrutin_nammi" || (u.first_name || "").toLowerCase().includes("hrutin") || (u.email || "").toLowerCase().includes("babufakemail");

    const profile: UserProfile = {
      userId,
      firstName: isHrutin ? "Hrutin" : (u.first_name || "Applicant"),
      lastName: isHrutin ? "Nammi" : (u.last_name || "Candidate"),
      email: isHrutin ? "babufakemail@gmail.com" : u.email,
      phone: isHrutin ? "+1 202 555 0198" : (u.phone || "+1 202 555 0198"),
      location: isHrutin ? "San Francisco, CA, United States" : (u.location || `${locInfo.city}, ${locInfo.state}, ${locInfo.country}`),
      street: isHrutin ? "123 Market St" : locInfo.street,
      addressLine2: isHrutin ? "Suite 400" : locInfo.addressLine2,
      city: isHrutin ? "San Francisco" : locInfo.city,
      state: isHrutin ? "California" : locInfo.state,
      zipCode: isHrutin ? "94105" : locInfo.zipCode,
      country: isHrutin ? "United States" : locInfo.country,
      linkedinUrl: isHrutin ? "https://linkedin.com/in/hrutinnammi" : (u.linkedin_url || ""),
      githubUrl: isHrutin ? "https://github.com/hrutinnammi" : (u.github_url || ""),
      portfolioUrl: isHrutin ? "https://hrutinnammi.dev" : (u.portfolio_url || ""),
      workAuthorization: isHrutin ? "Authorized to work in the US" : (u.work_authorization || "Authorized to Work"),
      willingToRelocate: isHrutin ? true : (u.willing_to_relocate === 1),
      yearsOfExperience: isHrutin ? 3 : (u.years_of_experience || 3),
      gender: isHrutin ? "Male" : (u.gender || "Male"),
      ethnicity: isHrutin ? "Asian" : (userAnswers.get("ethnicity") || userAnswers.get("race") || "Asian"),
      headline: isHrutin ? "Full-Stack AI Developer" : currentTitle,
      summary: isHrutin ? HRUTIN_BLUEPRINT_PROFILE.summary : summary,
      resumePath: isHrutin ? (resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Resume.pdf") || resumePath) : resumePath,
      coverLetterPath: isHrutin ? (resolveLocalResumePath("resumes/user_usr_hrutin_nammi/Hrutin_Nammi_Cover_Letter.pdf") || coverLetterPath) : coverLetterPath,
      educations: isHrutin ? HRUTIN_BLUEPRINT_PROFILE.educations : educations,
      experiences: isHrutin ? HRUTIN_BLUEPRINT_PROFILE.experiences : experiences,
      savedAnswers: userAnswers,
      skills: isHrutin ? HRUTIN_BLUEPRINT_PROFILE.skills : ["TypeScript", "Python", "React", "Node.js", "PostgreSQL", "Docker", "REST APIs", "Cloud Infrastructure"]
    };

    profiles.push(profile);
  }

  // Ensure Hrutin Nammi is ALWAYS Candidate #1 (index 0) in the list
  const hrutinIdx = profiles.findIndex(p => p.email.toLowerCase().includes("hrutin") || p.firstName.toLowerCase().includes("hrutin") || p.userId?.includes("hrutin"));
  if (hrutinIdx > 0) {
    const [hrutin] = profiles.splice(hrutinIdx, 1);
    profiles.unshift(hrutin);
  } else if (hrutinIdx < 0) {
    profiles.unshift(HRUTIN_BLUEPRINT_PROFILE);
  }

  return profiles;
}

/**
 * Dynamically generates a customized cover letter for ANY candidate and ANY job.
 * Zero hardcoded names, colleges, or companies!
 */
export function generateCoverLetterText(profile: UserProfile, job?: JobDetails): string {
  const companyName = job?.company && job.company !== "Company" && job.company !== "Startup" ? job.company : "your team";
  const roleTitle = job?.title && job.title !== "Position" ? job.title : "this position";
  const yoe = profile.yearsOfExperience || 3;
  const skillsStr = (profile.skills && profile.skills.length > 0) ? profile.skills.slice(0, 5).join(", ") : "full-stack development, modern APIs, and scalable architectures";

  return `Dear Hiring Team at ${companyName},

I am writing to express my strong interest in the ${roleTitle} opportunity. With over ${yoe} years of hands-on engineering experience in ${skillsStr}, I have developed a strong track record of building reliable, high-performance systems and user-facing applications.

${profile.summary || "Throughout my career, I have focused on writing clean, maintainable code, collaborating closely with cross-functional teams, and solving challenging architectural problems."}

I am confident that my technical skills, proactive communication, and problem-solving mindset make me an immediate contributor to ${companyName}. Thank you for considering my application.

Sincerely,
${profile.firstName} ${profile.lastName}
${profile.email} | ${profile.phone}
${profile.location}`;
}

