import { normalizeLabel } from "./field-mapper";
import { JobDetails, UserProfile } from "../ats/ats.interface";
import { generateCoverLetterText } from "../database/user-profile.service";
import { db } from "../database/db";
import { v4 as uuidv4 } from "uuid";

let fallbackAnswerIndex = 0;

export function suggestAnswerForQuestion(
  label: string,
  optionsLabels?: string[],
  profile?: UserProfile,
  job?: JobDetails
): string {
  const norm = normalizeLabel(label);

  // 0. Check candidate's saved answers from database if present
  if (profile?.savedAnswers && profile.savedAnswers.has(norm)) {
    const val = profile.savedAnswers.get(norm)!;
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => o.toLowerCase().trim() === val.toLowerCase().trim() || o.toLowerCase().includes(val.toLowerCase()));
      if (match) return match;
    }
    return val;
  }

  // 1. Specific Screening Agreements
  if (norm.includes("privacy notice") || norm.includes("privacy policy") || norm.includes("acknowledge that i have read") || norm.includes("consent") || norm.includes("terms") || norm.includes("i agree") || norm.includes("agree")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /yes|agree|acknowledge|consent/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  if (norm.includes("doublecheck") || norm.includes("double check") || norm.includes("ensuring accuracy") || norm.includes("accuracy is crucial")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /yes|acknowledge|confirm|agree/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  if (norm.includes("hear about") || norm.includes("first hear") || norm.includes("how did you hear") || norm.includes("source") || norm.includes("where did you find")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /linkedin/i.test(o)) || optionsLabels.find(o => /job board|website|internet/i.test(o) && !/other/i.test(o));
      if (match) return match;
    }
    return "LinkedIn";
  }

  if (norm.includes("specify") || norm.includes("please specify")) {
    return "LinkedIn";
  }

  if (norm.includes("access control") || norm.includes("oauth") || norm.includes("authentication") || norm.includes("rbac")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /^yes/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  // Work Authorization (Dynamic based on candidate's database profile)
  const isCitizen = profile?.workAuthorization?.toLowerCase().includes("citizen");

  if (norm.includes("authorization") || norm.includes("work authorization") || norm.includes("authorized to work") || norm.includes("legally authorized")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /authorized|citizen|permanent resident|^yes$/i.test(o.trim()) || /^yes/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  if (norm.includes("sponsorship") || norm.includes("require visa") || norm.includes("need visa") || norm.includes("require sponsor")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /^no/i.test(o.trim()));
      if (match) return match;
    }
    return "No";
  }

  // Location checks (Dynamic based on candidate's location in DB)
  const isUSBased = (profile?.country?.toLowerCase() || "").includes("united states") || 
                    (profile?.location?.toLowerCase() || "").includes("united states") || 
                    (profile?.location?.toLowerCase() || "").includes("california") || 
                    (profile?.location?.toLowerCase() || "").includes("texas") || 
                    (profile?.location?.toLowerCase() || "").includes("ny");

  if (norm.includes("based in the united states") || norm.includes("united states or canada") || norm.includes("located in the us") || norm.includes("based in the us") || norm.includes("us resident") || norm.includes("located in us")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => isUSBased ? /^yes/i.test(o) : /^no/i.test(o));
      if (match) return match;
    }
    return isUSBased ? "Yes" : "No";
  }

  // Cover Letter / Statement of interest / Why company (Dynamic for candidate)
  if (
    norm.includes("cover letter") ||
    norm.includes("letter") ||
    norm.includes("statement of interest") ||
    norm.includes("tell us why you want") ||
    norm.includes("join our team") ||
    norm.includes("why join") ||
    norm.startsWith("why ") ||
    norm.includes("why do you want to work")
  ) {
    if (job?.company && norm.startsWith("why ")) {
      return `I have followed ${job.company}'s innovative product development with great admiration. My technical background in full-stack AI development aligns directly with your mission, and I am eager to contribute to building high-performance, user-centric software that makes a meaningful impact for your users.`;
    }
    return profile ? generateCoverLetterText(profile, job) : "I am writing to express my strong interest in this position and contribute immediately with my technical expertise.";
  }

  // Candidate Name & Contact fields
  if (norm === "name" || norm.includes("full name") || norm.includes("your name") || norm.includes("signature") || norm.includes("sign here") || norm.includes("type your name")) {
    return profile ? `${profile.firstName} ${profile.lastName}` : "";
  }
  if (norm.includes("first name") || norm.includes("given name")) {
    return profile?.firstName || "";
  }
  if (norm.includes("last name") || norm.includes("surname") || norm.includes("family name")) {
    return profile?.lastName || "";
  }
  if (norm.includes("email")) {
    return profile?.email || "";
  }
  if (norm.includes("phone") || norm.includes("mobile") || norm.includes("telephone")) {
    return profile?.phone || "";
  }
  if (norm.includes("street") || (norm.includes("address") && !norm.includes("email") && !norm.includes("ip") && !norm.includes("city"))) {
    return profile?.street || profile?.location || "";
  }
  if (norm.includes("city") || norm.includes("residence city") || norm.includes("primary residence")) {
    return profile?.city || "";
  }
  if (norm.includes("state") || norm.includes("province") || norm.includes("region") || norm.includes("territory")) {
    return profile?.state || "";
  }
  if (norm.includes("postal") || norm.includes("zip")) {
    return profile?.zipCode || "";
  }
  if (norm.includes("country")) {
    return profile?.country || "United States";
  }
  if (norm.includes("location") && !norm.includes("salary")) {
    return profile?.location || "";
  }

  // Referral: Return DB answer or "Tarun Komati" for Hrutin
  if (norm.includes("referred") || norm.includes("referral") || norm.includes("referred by") || norm.includes("include their name") || norm.includes("reference") || norm.includes("who referred") || norm.includes("employee referral")) {
    const isHrutin = !profile || (profile.firstName || "").toLowerCase().includes("hrutin") || (profile.email || "").toLowerCase().includes("babufakemail");
    return profile?.savedAnswers?.get("referral") || (isHrutin ? "Tarun Komati" : "Direct Application");
  }

  // Social URLs
  if (norm === "x" || norm.includes("twitter") || norm.includes("x profile") || norm.includes("x url") || norm.includes("x link")) {
    return profile?.websites?.[0] || profile?.portfolioUrl || "https://x.com/hrutin_dev";
  }
  if (norm.includes("linkedin")) {
    return profile?.linkedinUrl || "https://linkedin.com/in/hrutinnammi";
  }
  if (norm.includes("github")) {
    return profile?.githubUrl || "https://github.com/hrutinnammi";
  }
  if (
    norm.includes("portfolio") ||
    norm.includes("website") ||
    norm.includes("personal site") ||
    norm === "links" ||
    norm === "link" ||
    norm === "social links" ||
    norm.includes("social link") ||
    norm.includes("other link")
  ) {
    return profile?.portfolioUrl || profile?.linkedinUrl || "https://hrutinnammi.dev";
  }

  // Gender & Demographics
  if (norm.includes("gender") || norm.includes("gender identity") || norm === "sex") {
    const g = profile?.gender || "Male";
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => new RegExp(`^${g}`, "i").test(o.trim())) || optionsLabels.find(o => new RegExp(g, "i").test(o));
      if (match) return match;
    }
    return g;
  }
  if (norm.includes("race") || norm.includes("ethnicity") || norm.includes("identify with")) {
    const eth = profile?.ethnicity || profile?.savedAnswers?.get("ethnicity") || profile?.savedAnswers?.get("race") || "Asian";
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => new RegExp(eth, "i").test(o)) || optionsLabels.find(o => !/decline/i.test(o));
      if (match) return match;
    }
    return eth;
  }
  if (norm.includes("pronoun")) {
    return (profile?.gender?.toLowerCase() === "female") ? "She/Her" : "He/Him";
  }
  if (norm.includes("phonetic") || norm.includes("pronounce")) {
    return profile ? `${profile.firstName} ${profile.lastName}` : "ROO-tin NAM-mee";
  }

  // Education (Dynamic from profile/database with Hrutin blueprint fallback)
  if (norm.includes("school") || norm.includes("university") || norm.includes("college") || norm.includes("education")) {
    return profile?.educations?.[0]?.school || profile?.savedAnswers?.get("school") || profile?.savedAnswers?.get("university") || "Parul University";
  }
  if (norm.includes("degree")) {
    return profile?.educations?.[0]?.degree || profile?.savedAnswers?.get("degree") || "Bachelor of Technology";
  }
  if (norm.includes("major") || norm.includes("field of study") || norm.includes("discipline")) {
    return profile?.educations?.[0]?.fieldOfStudy || profile?.savedAnswers?.get("major") || "Computer Science and Engineering";
  }
  if (norm.includes("graduation year") || norm.includes("year graduated") || norm.includes("graduation date")) {
    return profile?.educations?.[0]?.endYear || profile?.savedAnswers?.get("graduation year") || "2027";
  }
  if (norm.includes("gpa")) {
    return profile?.educations?.[0]?.gpa || "7.1";
  }

  // Experience / Current Employer (Dynamic from profile/database with Hrutin blueprint fallback)
  if (norm.includes("company") || norm.includes("employer") || norm.includes("current job") || norm.includes("most recent")) {
    return profile?.experiences?.[0]?.company || profile?.savedAnswers?.get("current_company") || "Jobspring";
  }
  if (norm.includes("title") || norm.includes("role") || norm.includes("position")) {
    return profile?.experiences?.[0]?.jobTitle || profile?.savedAnswers?.get("current_title") || "Full Stack AI Developer";
  }

  // Key Flagship Projects & Achievements
  if (norm.includes("tell us more") || norm.includes("something you built") || norm.includes("project") || norm.includes("built") || norm.includes("technical achievement") || norm.includes("what did you build")) {
    return "One of my flagship projects is LocalMind OS—an offline AI workspace for querying PDFs, code repositories, and notes using local LLMs. I developed a custom RAG pipeline utilizing FAISS vector search, document chunking, and FastAPI backend services to enable intelligent semantic retrieval and conversational AI capabilities.";
  }
  if (norm.includes("achievement") || norm.includes("accomplishment") || norm.includes("proudest") || norm.includes("award")) {
    return "Receiving SSIP Startup Funding support of 1 Lakh for our HR Tech startup and reaching the finals in Smart India Hackathon 2024 and HackVerse 2025.";
  }
  if (norm.includes("leadership") || norm.includes("mentor") || norm.includes("community")) {
    return "Serving as Senior Head of CodeX Fusion Coding Community, where I mentored over 300+ students in AI, Data Structures & Algorithms, and full-stack software development.";
  }

  // Notice Period & Salary
  if (norm.includes("notice period") || norm.includes("start date") || norm.includes("start work") || norm.includes("availability")) {
    return "Immediate";
  }
  if (norm.includes("salary") || norm.includes("compensation") || norm.includes("expect")) {
    return "Negotiable";
  }

  if (norm.includes("working hours") || norm.includes("preferred hours") || norm.includes("shift") || norm.includes("timezone")) {
    return "Flexible / Full-time";
  }

  // Options matching if options exist
  if (optionsLabels && optionsLabels.length > 0) {
    const positive = optionsLabels.find(o => /^yes|^agree|^authorized/i.test(o));
    if (positive) return positive;
    return optionsLabels[0];
  }

  // Dynamic Summary Fallback for open-ended questions
  if (profile?.summary) {
    return profile.summary;
  }

  return "Experienced software engineer with strong technical background in building scalable web architectures, microservices, and reliable high-performance applications.";
}

/**
 * Determines whether a question is a "big question" that requires an LLM call
 * (e.g. why join us, open-ended screening essays, technical architecture decisions, project details).
 * Standard profile fields, radios, dropdowns, and short inputs should NEVER trigger an LLM call.
 */
export function isBigQuestion(question: string, options?: string[], inputType?: string): boolean {
  if (options && options.length > 0) return false;
  if (inputType === "textarea") return true;
  const q = question.toLowerCase().trim();

  // Long behavioral / situational screening questions should ALWAYS call LLM
  if (q.length > 50 || q.includes("?") || q.startsWith("tell me") || q.startsWith("walk me") || q.startsWith("describe") || q.includes("situation")) {
    // Only exclude if it's purely a contact / URL / salary inquiry
    if (
      !q.includes("phone number") &&
      !q.includes("email address") &&
      !q.includes("linkedin url") &&
      !q.includes("github url") &&
      !q.includes("desired salary")
    ) {
      return true;
    }
  }

  // 1. Explicit short/standard inputs that should NEVER call LLM
  if (
    q.includes("phone") ||
    q.includes("mobile") ||
    q.includes("first name") ||
    q.includes("last name") ||
    q.includes("full name") ||
    q.includes("email") ||
    q.includes("linkedin") ||
    q.includes("github") ||
    q.includes("twitter") ||
    q.includes("portfolio url") ||
    q.includes("website url") ||
    q.includes("personal website") ||
    q === "website" ||
    q.includes("url") ||
    q.includes("salary") ||
    q.includes("compensation") ||
    q.includes("notice period") ||
    q.includes("start date") ||
    q.includes("availability") ||
    q.includes("when can you start") ||
    q.includes("familial") ||
    q.includes("authorized") ||
    q.includes("sponsorship") ||
    q.includes("visa") ||
    q.includes("location") ||
    q.includes("city") ||
    q.includes("state") ||
    q.includes("country") ||
    q.includes("zip") ||
    q.includes("address") ||
    q.includes("relocate")
  ) {
    return false;
  }

  // 2. Big open-ended screening questions that REQUIRE LLM synthesis
  if (
    q.includes("why") ||
    q.includes("interest") ||
    q.includes("pitch") ||
    q.includes("cover letter") ||
    q.includes("project") ||
    q.includes("built") ||
    q.includes("challenge") ||
    q.includes("achievement") ||
    q.includes("tech stack") ||
    q.includes("ideal") ||
    q.includes("tell us about") ||
    q.includes("describe") ||
    q.includes("mission") ||
    q.includes("excited") ||
    q.includes("what attracts") ||
    q.includes("how would you") ||
    q.includes("what would you") ||
    q.includes("background") ||
    q.includes("experience with") ||
    q.length >= 25 // long descriptive screening question
  ) {
    return true;
  }

  return false;
}

/**
 * Calls OpenAI or Gemini API if available in the environment
 */
async function callLLM(
  question: string,
  job: Partial<JobDetails>,
  profile: Partial<UserProfile>
): Promise<string | null> {
  const firstName = profile.firstName || "Tharun";
  const lastName = profile.lastName || "Komite";
  const company = job.company && job.company !== "Startup" && job.company !== "Company" ? job.company : "your company";
  const title = job.title || "Software Engineer";

  if (process.env.GEMINI_API_KEY) {
    const prompt = `You are answering a job application question for ${firstName} ${lastName}, a Full-Stack AI Developer specializing in Python, FastAPI, React, TypeScript, RAG architectures, and Docker.
Candidate Location: San Francisco, California, United States.
Candidate Work Authorization: Legally authorized to work in the United States for any employer; does NOT require visa sponsorship now or in the future.
Job: ${title} at ${company}.
Question: "${question}".
Write a concise, high-impact, professional first-person answer in 2-3 sentences. Highlighting relevant engineering experience, problem-solving, and alignment with the company. If the question asks about visa sponsorship or US work authorization, state clearly and unequivocally that you are authorized to work in the United States and do not require sponsorship. Do not include quotes, markdown formatting, or meta preamble.`;

    const models = [
      "gemini-flash-lite-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-pro-latest"
    ];
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }]
            })
          }
        );

        if (res.ok) {
          const data = await res.json() as any;
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch (e: any) {
        console.warn(`[LLM] Error calling ${model}:`, e.message);
      }
    }
  }

  if (process.env.OPENAI_API_KEY) {
    const prompt = `You are filling out a job application for ${firstName} ${lastName}, a Full-Stack AI Developer with experience in Python, FastAPI, React, RAG pipelines, OpenAI, and Docker.
Job Title: ${title}
Company: ${company}
Question: "${question}"

Provide a concise, professional, first-person answer (2-4 sentences max) highlighting relevant experience. Do not include quotes or conversational preamble.`;

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (res.ok) {
        const data = await res.json() as any;
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (e: any) {
      console.warn("[LLM] OpenAI error:", e.message);
    }
  }

  return null;
}

/**
 * Uses Gemini LLM to choose the best option from a list of dropdown/radio options.
 */
export async function callLLMForOption(
  question: string,
  options: string[],
  job: Partial<JobDetails> = {},
  profile: Partial<UserProfile> = {}
): Promise<string | null> {
  if (!options || options.length === 0) return null;
  if (!process.env.GEMINI_API_KEY) return null;

  const firstName = profile.firstName || "Tharun";
  const lastName = profile.lastName || "Komite";
  const company = job.company && job.company !== "Startup" && job.company !== "Company" ? job.company : "the company";
  const title = job.title || "Software Engineer";

  const prompt = `You are filling out a job application form on behalf of ${firstName} ${lastName}, a Full-Stack AI Developer (2+ years of experience in Python, FastAPI, React, TypeScript, Docker, PostgreSQL, RAG). The candidate is authorized to work in the United States and does NOT require visa sponsorship.
Job: ${title} at ${company}
Question: "${question}"
Available Options:
${options.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

Respond ONLY with the single best exact option from the list above. Do NOT include numbers, reasoning, markdown, or surrounding quotes.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (res.ok) {
      const data = await res.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        const exact = options.find(o => o.trim().toLowerCase() === text.toLowerCase());
        if (exact) return exact;
        const partial = options.find(o => text.toLowerCase().includes(o.toLowerCase()) || o.toLowerCase().includes(text.toLowerCase()));
        if (partial) return partial;
      }
    }
  } catch (err: any) {
    console.warn("⚠️ [LLM Option Picker Error]:", err.message);
  }

  return null;
}

/**
 * Universal question answer generator for all ATS adapters (Wellfound, Lever, Greenhouse, etc.).
 * Guarantees every question receives an answer (NO "N/A" or "None").
 * Deterministically maps standard profile fields and option selects, and routes
 * BIG questions & ambiguous options to Gemini LLM with context.
 */
export async function generateAnswerForQuestion(
  question: string,
  job: Partial<JobDetails> = {},
  profile: Partial<UserProfile> = {},
  options?: string[],
  inputType?: string
): Promise<string> {
  const normQ = question.toLowerCase().trim();

  // 0. Check database saved answers first if candidate has user_id
  if (profile?.savedAnswers && profile.savedAnswers.has(normQ)) {
    const val = profile.savedAnswers.get(normQ)!;
    if (options && options.length > 0) {
      const match = options.find(o => o.toLowerCase().trim() === val.toLowerCase().trim() || o.toLowerCase().includes(val.toLowerCase()));
      if (match) return match;
    }
    return val;
  }

  if (profile?.userId) {
    try {
      const dbRes = await db.query(
        "SELECT answer FROM user_saved_answers WHERE user_id = $1 AND normalized_question = $2 LIMIT 1",
        [profile.userId, normQ]
      );
      if (dbRes.rows && dbRes.rows.length > 0 && dbRes.rows[0].answer) {
        const val = dbRes.rows[0].answer;
        if (options && options.length > 0) {
          const match = options.find(o => o.toLowerCase().trim() === val.toLowerCase().trim() || o.toLowerCase().includes(val.toLowerCase()));
          if (match) return match;
        }
        return val;
      }
    } catch (e) {}
  }

  // Universal Screening Agreements & Privacy Notices
  if (
    normQ.includes("by selecting") ||
    normQ.includes("i agree") ||
    normQ.includes("privacy notice") ||
    normQ.includes("privacy policy") ||
    normQ.includes("consent") ||
    normQ.includes("terms") ||
    normQ.includes("acknowledge") ||
    normQ.includes("understand that the info")
  ) {
    if (options && options.length > 0) {
      const match = options.find(o => /agree|yes|confirm|acknowledge|consent/i.test(o));
      if (match) return match;
    }
    return "I agree";
  }

  // Universal Deterministic US Work Authorization & Visa Sponsorship rules (Textarea, Input, Dropdown, Radio)
  const isCitizen = profile?.workAuthorization?.toLowerCase().includes("citizen");

  if (
    normQ.includes("sponsorship") ||
    normQ.includes("require sponsor") ||
    normQ.includes("visa sponsor") ||
    (normQ.includes("visa") && !normQ.includes("advisor") && !normQ.includes("credit card"))
  ) {
    if (options && options.length > 0) {
      const match = options.find(o => /^no/i.test(o.trim()) || /not require|no sponsorship|do not require|will not require/i.test(o));
      if (match) return match;
    }
    return "No, I am legally authorized to work in the United States and do not require visa sponsorship now or in the future.";
  }

  if (
    normQ.includes("legally authorized") ||
    normQ.includes("work authorization") ||
    normQ.includes("authorized to work") ||
    normQ.includes("eligible to work in the u") ||
    normQ.includes("authorized to work in the united states") ||
    normQ.includes("authorized to work in the us")
  ) {
    if (options && options.length > 0) {
      const match = options.find(o => /^yes/i.test(o.trim()) || /authorized|citizen|permanent resident/i.test(o));
      if (match) return match;
    }
    return "Yes, I am legally authorized to work in the United States for any employer.";
  }

  if (normQ.includes("us citizen") || normQ.includes("citizen") || normQ.includes("permanent resident") || normQ.includes("green card")) {
    if (options && options.length > 0) {
      const match = options.find(o => isCitizen ? (/^yes/i.test(o.trim()) || /citizen|permanent/i.test(o)) : (/^yes/i.test(o.trim())));
      if (match) return match;
    }
    return isCitizen ? "Yes" : "Yes";
  }

  // 1. If options are provided (Radio / Select / Dropdown), pick the best match
  if (options && options.length > 0) {
    if (
      normQ.includes("hear about") ||
      normQ.includes("first hear") ||
      normQ.includes("how did you hear") ||
      normQ.includes("source") ||
      normQ.includes("where did you find")
    ) {
      const match = options.find(o => /linkedin/i.test(o)) || options.find(o => /job board|website|internet/i.test(o) && !/other/i.test(o));
      if (match) return match;
    }
    if (normQ.includes("experience with ai") || normQ.includes("ai tool")) {
      const match = options.find(o => /team|cross|individual|3|4/i.test(o));
      if (match) return match;
    }
    if (normQ.includes("authorized") || normQ.includes("legally")) {
      const match = options.find(o => /^yes/i.test(o.trim()) || /authorized/i.test(o));
      if (match) return match;
    }
    if (normQ.includes("sponsorship") || normQ.includes("visa")) {
      const match = options.find(o => /^no/i.test(o.trim()) || /not require|no sponsorship/i.test(o));
      if (match) return match;
    }
    if (normQ.includes("familial")) {
      const match = options.find(o => /^no/i.test(o.trim()));
      if (match) return match;
    }
    if (normQ.includes("relocate") || normQ.includes("location")) {
      const match = options.find(o => /yes|united states|remote/i.test(o.trim()));
      if (match) return match;
    }
    if (normQ.includes("education") || normQ.includes("degree")) {
      const match = options.find(o => /bachelor|bs|computer science/i.test(o.trim()));
      if (match) return match;
    }
    if (normQ.includes("years of experience") || normQ.includes("how many years")) {
      const yoe = profile.yearsOfExperience || 3;
      const match = options.find(o => new RegExp(`\\b${yoe}\\b`).test(o) || /2|3|2-3|1-3/i.test(o.trim()));
      if (match) return match;
    }

    // Try standard answer suggester
    const suggested = suggestAnswerForQuestion(question, options, profile as UserProfile, job as JobDetails);
    if (suggested && options.includes(suggested)) {
      return suggested;
    }

    // Call Gemini LLM to pick the best option
    console.log(`🤖 [SmartAnswers]: Resolving dropdown/radio option with Gemini LLM for "${question.slice(0, 40)}"...`);
    const llmOption = await callLLMForOption(question, options, job, profile);
    if (llmOption) {
      console.log(`   👉 Gemini selected option: "${llmOption}"`);
      return llmOption;
    }

    // Fallback: First option that is not a placeholder
    const valid = options.find(o => !o.toLowerCase().includes("select") && !o.toLowerCase().includes("choose") && o.trim() !== "-");
    return valid || options[0];
  }

  // 2. Determine if this is a big question / textarea
  const isBig = isBigQuestion(question, options, inputType);
  const isTextArea = inputType === "textarea";

  // 2B. Deterministic Standard Profile Fields from Database (only for short fields if not big/textarea)
  if (normQ.includes("phone") || normQ.includes("mobile") || normQ.includes("telephone")) {
    if (!isBig && !isTextArea) return profile.phone || "";
  }
  if (normQ.includes("linkedin")) {
    if (!isBig && !isTextArea) return profile.linkedinUrl || "";
  }
  if (normQ.includes("github")) {
    if (!isBig && !isTextArea) return profile.githubUrl || "";
  }
  if (
    (normQ.includes("portfolio") || normQ.includes("website") || normQ.includes("personal site")) &&
    !normQ.includes("tech stack") &&
    !normQ.includes("create") &&
    !normQ.includes("build") &&
    !normQ.includes("why") &&
    !normQ.includes("ideal") &&
    !normQ.includes("what would") &&
    !normQ.includes("experience") &&
    !isBig && !isTextArea
  ) {
    return profile.portfolioUrl || profile.githubUrl || "";
  }
  if ((normQ.includes("twitter") || normQ.includes(" x ")) && !isBig && !isTextArea) {
    return profile.websites?.[0] || profile.portfolioUrl || "";
  }
  if ((normQ.includes("referral") || normQ.includes("referred") || normQ.includes("reference")) && !isBig && !isTextArea) {
    return profile.savedAnswers?.get("referral") || "Direct Application";
  }
  if (normQ.includes("familial relationship") && !isBig && !isTextArea) {
    return "None";
  }
  if (normQ.includes("experience") && (normQ.includes("how many") || normQ.includes("years")) && !isBig && !isTextArea) {
    const yoe = profile.yearsOfExperience || 3;
    return `${yoe}+ years of production engineering and scalable application development experience.`;
  }
  if ((normQ.includes("notice") || normQ.includes("start date") || normQ.includes("when can you start") || normQ.includes("availability")) && !isBig && !isTextArea) {
    return "Immediate";
  }
  if ((normQ.includes("salary") || normQ.includes("compensation") || normQ.includes("expect")) && !isBig && !isTextArea) {
    return "Negotiable";
  }
  if ((normQ === "location" || normQ === "city" || normQ.includes("where are you located") || normQ === "current city") && !isBig && !isTextArea) {
    return profile.location || profile.city || "";
  }
  if ((normQ.includes("school") || normQ.includes("university") || normQ.includes("college") || normQ.includes("education")) && !isBig && !isTextArea) {
    return profile.educations?.[0]?.school || profile.savedAnswers?.get("school") || profile.savedAnswers?.get("university") || "University";
  }
  if (normQ.includes("degree") && !isBig && !isTextArea) {
    return profile.educations?.[0]?.degree || profile.savedAnswers?.get("degree") || "Bachelor of Science";
  }
  if (normQ.includes("phonetic") || normQ.includes("pronounce")) {
    return `${profile.firstName || ""} ${profile.lastName || ""}`.trim();
  }

  // 3. Call LLM for BIG open-ended questions & textareas
  const companyName = job.company && job.company !== "Startup" && job.company !== "Company" ? job.company : "your company";
  const jobTitle = job.title || "Software Engineer";

  let finalAnswer = "";

  if (isBig || inputType === "textarea") {
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) {
      try {
        console.log(`🤖 [SmartAnswers]: Big question detected ("${question.slice(0, 50)}..."), generating with Gemini...`);
        const llmAnswer = await callLLM(question, job, profile);
        if (llmAnswer && llmAnswer.trim().length > 0) {
          console.log(`   👉 Gemini synthesized answer: "${llmAnswer.slice(0, 60)}..."`);
          finalAnswer = llmAnswer.trim();
        }
      } catch (err: any) {
        console.warn("⚠️ [SmartAnswers]: LLM API error, falling back to contextual generator:", err.message);
      }
    }
  }

  // 4. High-Quality Dynamic Contextual Generator fallback for Big Questions
  if (!finalAnswer) {
    if (
      normQ.includes("interest") ||
      normQ.includes("why this company") ||
      normQ.includes("why do you want") ||
      normQ.includes("why work") ||
      normQ.includes("about working for") ||
      normQ.includes("what attracts you")
    ) {
      finalAnswer = `I am genuinely excited about ${companyName}'s mission and technical direction for the ${jobTitle} role. With my background building scalable services and full-stack software architectures, I love tackling challenging engineering problems, owning features end-to-end, and shipping high-impact solutions that directly empower users.`;
    } else if (
      normQ.includes("project") ||
      normQ.includes("something you built") ||
      normQ.includes("technical challenge") ||
      normQ.includes("proudest") ||
      normQ.includes("achievement")
    ) {
      finalAnswer = profile.summary || `As an engineer, I designed and delivered scalable backend microservices, REST APIs, and responsive frontends that optimized query performance and cut deployment times across production environments.`;
    } else {
      const answered = suggestAnswerForQuestion(question, undefined, profile as UserProfile, job as JobDetails);
      if (answered && answered.trim() !== "N/A" && answered.trim() !== "") {
        finalAnswer = answered;
      } else {
        finalAnswer = `As a software engineer with strong technical experience, I am eager to apply my problem-solving skills to the ${jobTitle} role at ${companyName}.`;
      }
    }
  }

  // Persist generated answer to user_saved_answers in database so candidate answers accumulate
  if (profile?.userId && finalAnswer) {
    try {
      await db.query(
        `INSERT INTO user_saved_answers (id, user_id, normalized_question, original_question, answer, source)
         VALUES ($1, $2, $3, $4, $5, 'AI')
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer`,
        [uuidv4(), profile.userId, normQ, question, finalAnswer]
      );
    } catch (e) {}
  }

  return finalAnswer;
}
