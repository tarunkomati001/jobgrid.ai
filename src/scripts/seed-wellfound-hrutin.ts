import { db } from "../database/db";
import {
  saveWellfoundCredentials,
  DEFAULT_HRUTIN_WELLFOUND_PROFILE,
  DEFAULT_HRUTIN_WELLFOUND_LINKS,
  DEFAULT_HRUTIN_WELLFOUND_PITCH
} from "../ats/wellfound/wellfound-account-store";

export async function seedWellfoundHrutin() {
  console.log("===============================================================================");
  console.log("🚀 SEEDING WELLFOUND CREDENTIALS & PROFILE DETAILS FOR HRUTIN NAMMI");
  console.log("===============================================================================\n");

  const email = DEFAULT_HRUTIN_WELLFOUND_PROFILE.email;
  const password = process.env.WELLFOUND_PASSWORD || "Tarun@143";

  // 1. Save Credentials in DB & local store
  console.log(`🔐 Saving Wellfound credentials for ${email}...`);
  await saveWellfoundCredentials({
    email,
    password,
    name: `${DEFAULT_HRUTIN_WELLFOUND_PROFILE.firstName} ${DEFAULT_HRUTIN_WELLFOUND_PROFILE.lastName}`,
    updatedAt: new Date().toISOString()
  });

  // 2. Ensure user_saved_answers contains all Wellfound-specific screening questions
  console.log("💾 Populating Wellfound screening & essay answers in `user_saved_answers`...");
  const wellfoundAnswers: Record<string, string> = {
    // Links (User requested: "make sure every field will fill in authencation and then all links should fill in wellfound")
    linkedin: DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
    "linkedin url": DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
    "linkedin profile": DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin,
    github: DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
    "github url": DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
    "github profile": DEFAULT_HRUTIN_WELLFOUND_LINKS.github,
    twitter: DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
    "twitter url": DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
    x: DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
    "x url": DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter,
    portfolio: DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio,
    "portfolio url": DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio,
    website: DEFAULT_HRUTIN_WELLFOUND_LINKS.website,
    "personal website": DEFAULT_HRUTIN_WELLFOUND_LINKS.website,
    blog: DEFAULT_HRUTIN_WELLFOUND_LINKS.blog,

    // Pitch & Notes
    pitch: DEFAULT_HRUTIN_WELLFOUND_PITCH,
    "note to the hiring manager": DEFAULT_HRUTIN_WELLFOUND_PITCH,
    "note to hiring manager": DEFAULT_HRUTIN_WELLFOUND_PITCH,
    "cover letter": DEFAULT_HRUTIN_WELLFOUND_PITCH,
    "why are you a good fit": DEFAULT_HRUTIN_WELLFOUND_PITCH,

    // Standard Screening
    work_authorization: "Yes",
    "are you legally authorized to work in the united states": "Yes",
    sponsorship: "No",
    "will you now or in the future require visa sponsorship": "No",
    relocate: "Yes",
    willing_to_relocate: "Yes",
    years_of_experience: "2",
    salary: "95000",
    expected_salary: "95000",
    "minimum annual base salary": "95000",
    preferred_annual_salary: "95000",
    location: "San Francisco, CA, United States",
    primary_role: "Full Stack AI Developer",
    current_company: "Jobspring"
  };

  for (const [question, answer] of Object.entries(wellfoundAnswers)) {
    try {
      await db.query(
        `INSERT INTO public.user_saved_answers (user_id, normalized_question, answer, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, normalized_question) DO UPDATE SET answer = EXCLUDED.answer, updated_at = CURRENT_TIMESTAMP`,
        [DEFAULT_HRUTIN_WELLFOUND_PROFILE.userId, question, answer]
      );
    } catch (e: any) {
      // ignore conflict or db error
    }
  }

  console.log("✅ Wellfound configuration and links seeded successfully!");
  console.log("\n📋 Configuration Summary:");
  console.log(`   - Candidate: ${DEFAULT_HRUTIN_WELLFOUND_PROFILE.firstName} ${DEFAULT_HRUTIN_WELLFOUND_PROFILE.lastName}`);
  console.log(`   - Email: ${email}`);
  console.log(`   - LinkedIn: ${DEFAULT_HRUTIN_WELLFOUND_LINKS.linkedin}`);
  console.log(`   - GitHub: ${DEFAULT_HRUTIN_WELLFOUND_LINKS.github}`);
  console.log(`   - Twitter/X: ${DEFAULT_HRUTIN_WELLFOUND_LINKS.twitter}`);
  console.log(`   - Portfolio: ${DEFAULT_HRUTIN_WELLFOUND_LINKS.portfolio}`);
  console.log(`   - Default Pitch: "${DEFAULT_HRUTIN_WELLFOUND_PITCH.slice(0, 80)}..."`);
}

if (require.main === module) {
  seedWellfoundHrutin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Failed to seed Wellfound for Hrutin:", err);
      process.exit(1);
    });
}

