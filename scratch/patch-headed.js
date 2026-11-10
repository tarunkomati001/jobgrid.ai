const fs = require("fs");
const file = "src/scripts/headed-autofill.ts";
let text = fs.readFileSync(file, "utf8");

if (!text.includes("isWellfoundOnly")) {
  const target1 = "const isPaylocityOnly =";
  const replacement1 = `const isWellfoundOnly =
    args.includes("--wellfound") ||
    args.includes("--wellfound-only") ||
    (args.includes("--ats") && args[args.indexOf("--ats") + 1]?.toLowerCase() === "wellfound") ||
    process.env.WELLFOUND_ONLY === "true" ||
    process.env.ATS_FILTER?.toUpperCase() === "WELLFOUND";
  const isPaylocityOnly =`;

  text = text.replace(target1, replacement1);

  const target2 = "} else if (isPaylocityOnly) {";
  const replacement2 = `} else if (isWellfoundOnly) {
    console.log("🎯 Filtering queued jobs strictly for WELLFOUND ATS only...");
    const jobsRes = await db.query("SELECT DISTINCT url FROM jobs WHERE (ats = 'WELLFOUND' OR url LIKE '%wellfound.com%' OR url LIKE '%angel.co%') ORDER BY url ASC").catch(() => ({ rows: [] }));
    urls = Array.from(new Set(jobsRes.rows.map((row: any) => row.url)));
    if (urls.length === 0) {
      urls = ["https://wellfound.com/jobs"];
    }
  } else if (isPaylocityOnly) {`;

  text = text.replace(target2, replacement2);
  fs.writeFileSync(file, text, "utf8");
  console.log("Successfully patched headed-autofill.ts for Wellfound");
} else {
  console.log("Already patched");
}

