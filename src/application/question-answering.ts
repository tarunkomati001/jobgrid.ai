import { normalizeLabel } from "./field-mapper";

let fallbackAnswerIndex = 0;

export function suggestAnswerForQuestion(label: string, optionsLabels?: string[]): string {
  const norm = normalizeLabel(label);

  // 1. Specific Greenhouse / Vercel Screening Questions
  if (norm.includes("privacy notice") || norm.includes("privacy policy") || norm.includes("acknowledge that i have read")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /yes|agree|acknowledge/i.test(o));
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

  if (norm.includes("hear about this") || norm.includes("first hear") || norm.includes("how did you hear") || norm.includes("source")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /linkedin/i.test(o)) || optionsLabels.find(o => /job board|website|other/i.test(o));
      if (match) return match;
    }
    return "LinkedIn";
  }

  if (norm.includes("access control") || norm.includes("oauth") || norm.includes("authentication") || norm.includes("rbac")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /^yes/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  if (norm.includes("based in any of these countries") || norm.includes("accepting applications") || norm.includes("countries where we are accepting")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /india/i.test(o)) || optionsLabels.find(o => /^yes/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  if (norm.includes("authorization") || norm.includes("work authorization") || norm.includes("authorized to work")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /authorized|citizen|permanent resident|yes/i.test(o));
      if (match) return match;
    }
    return "Yes";
  }

  if (norm.includes("sponsorship") || norm.includes("require visa") || norm.includes("need visa")) {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /^no/i.test(o));
      if (match) return match;
    }
    return "No";
  }

  // 2. Essays & Open-Ended Text Questions
  if (norm.includes("cover letter") || norm.includes("letter") || norm.includes("statement of interest") || norm.includes("tell us why you want") || norm.includes("join our team") || norm.includes("why join")) {
    return "Dear Hiring Manager,\n\nI am a Full-Stack AI Developer experienced in building scalable AI applications, RAG pipelines, FastAPI backends, and React interfaces. At Jobspring, I developed an AI resume generation platform serving 50+ users and reduced API latency by 30%. I am excited to bring my expertise in Python, React, LLMs, and cloud deployments to your team.\n\nBest regards,\nHrutin Nammi";
  }
  if (norm.includes("tell us more") || norm.includes("something you built") || norm.includes("project") || norm.includes("portfolio") || norm.includes("built") || norm.includes("technical achievement") || norm.includes("what did you build")) {
    return "One of my flagship projects is LocalMind OS—an offline AI workspace for querying PDFs, code repositories, and notes using local LLMs. I developed a custom RAG pipeline utilizing FAISS vector search, document chunking, and FastAPI backend services to enable intelligent semantic retrieval and conversational AI capabilities.";
  }
  if (norm.includes("achievement") || norm.includes("accomplishment") || norm.includes("proudest") || norm.includes("award")) {
    return "Receiving SSIP Startup Funding support of 1 Lakh for our HR Tech startup and reaching the finals in Smart India Hackathon 2024 and HackVerse 2025.";
  }
  if (norm.includes("leadership") || norm.includes("mentor") || norm.includes("community")) {
    return "Serving as Senior Head of CodeX Fusion Coding Community, where I mentored over 300+ students in AI, Data Structures & Algorithms, and full-stack software development.";
  }
  if (norm.includes("referred") || norm.includes("referral") || norm.includes("referred by") || norm.includes("include their name") || norm.includes("reference") || norm.includes("who referred") || norm.includes("employee referral") || norm.includes("current employee")) {
    return "Tarun Komati";
  }
  if (norm === "x" || norm.includes("twitter") || norm.includes("x profile") || norm.includes("x url") || norm.includes("x link")) {
    return "https://x.com/hrutin_dev";
  }
  if (norm.includes("gender") || norm.includes("gender identity") || norm === "sex") {
    if (optionsLabels && optionsLabels.length > 0) {
      const match = optionsLabels.find(o => /^male$/i.test(o.trim())) ||
                    optionsLabels.find(o => /male/i.test(o)) ||
                    optionsLabels.find(o => /^man$/i.test(o.trim()));
      if (match) return match;
    }
    return "Male";
  }
  if (norm.includes("week") || norm.includes("through the week") || norm.includes("working days") || norm.includes("schedule") || norm.includes("availability")) {
    return "Available full-time Monday through Friday during standard business hours.";
  }
  if (/\b(age|how old|your age)\b/i.test(norm) && !norm.includes("outage") && !norm.includes("manage")) {
    return "Under 30";
  }
  if (norm.includes("notice period") || norm.includes("start date") || norm.includes("start work")) {
    return "Immediate";
  }
  if (norm.includes("salary") || norm.includes("compensation") || norm.includes("expect")) {
    return "Negotiable";
  }
  if (norm.includes("company") || norm.includes("employer") || norm.includes("current job") || norm.includes("most recent")) {
    return "Jobspring";
  }
  if (norm.includes("title") || norm.includes("role") || norm.includes("position")) {
    return "Full Stack AI Developer";
  }
  if (norm.includes("why do you want") || norm.includes("interest in") || norm.includes("why work")) {
    return "I am passionate about building AI-powered web applications and scalable cloud architecture, and eager to bring my expertise in FastAPI, React, RAG pipelines, and LLM integrations to your team.";
  }
  if (norm.includes("phonetic") || norm.includes("pronounce")) {
    return "ROO-tin NAM-mee";
  }
  if (norm.includes("pronoun")) {
    return "He/Him";
  }
  if (norm.includes("managed a team") || norm.includes("team of 5+")) {
    return "Yes";
  }
  if (norm.includes("based in") || norm.includes("united states or canada")) {
    return "No";
  }
  if (norm.includes("i agree") || norm.includes("agree") || norm.includes("consent") || norm.includes("terms")) {
    return "Yes";
  }
  if (norm.includes("troubleshoot") || norm.includes("technical issue") || norm.includes("customer") || norm.includes("specific time") || norm.includes("challenge") || norm.includes("hardest")) {
    return "While developing LocalMind OS, I optimized document chunking and FAISS vector index retrieval pipelines, reducing query latency by 30% for local LLM text generation under heavy payload bursts.";
  }
  if (norm.includes("working hours") || norm.includes("preferred hours") || norm.includes("shift") || norm.includes("timezone")) {
    return "Flexible / Full-time";
  }
  if (norm.includes("school") || norm.includes("university") || norm.includes("college") || norm.includes("education")) {
    return "Parul University";
  }
  if (norm.includes("degree")) {
    return "Bachelor of Technology";
  }
  if (norm.includes("major") || norm.includes("field of study") || norm.includes("discipline")) {
    return "Computer Science Engineering (AI & ML)";
  }
  if (norm.includes("graduation year") || norm.includes("year graduated") || norm.includes("graduation date")) {
    return "2027";
  }

  // Fallback options matching if options exist
  if (optionsLabels && optionsLabels.length > 0) {
    const positive = optionsLabels.find(o => /^yes|^agree|^authorized/i.test(o));
    if (positive) return positive;
    return optionsLabels[0];
  }

  // Rotating fallback text
  const fallbackAnswers = [
    "I am a Full-Stack AI Developer passionate about building high-performance web applications, scalable RAG systems, and AI-driven solutions using FastAPI, React, and local LLMs.",
    "At Jobspring, I engineered an AI-powered career platform using OpenAI APIs and React, optimizing backend API latency by 30% through query optimization and Docker containerization.",
    "Architected SkillSense AI—an automated candidate skill assessment platform using NLP workflows, OpenAI APIs, and custom resume evaluation pipelines."
  ];

  const selectedFallback = fallbackAnswers[fallbackAnswerIndex % fallbackAnswers.length];
  fallbackAnswerIndex++;
  return selectedFallback;
}
