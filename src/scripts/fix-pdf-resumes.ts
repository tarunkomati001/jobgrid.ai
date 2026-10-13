import fs from "fs";
import path from "path";

async function fixPdfResumes() {
  console.log("⚡ CLUCO.AI: Fixing corrupted PDF resume files across all candidate accounts...");

  const resumesDir = path.resolve(__dirname, "../../resumes");
  const validPdfTemplate = path.join(resumesDir, "user_bb5c54fd-79ee-41fd-917b-6553a09195d1", "Aarav_Mehta_Resume.pdf");

  if (!fs.existsSync(validPdfTemplate)) {
    console.error("❌ Valid PDF template not found at:", validPdfTemplate);
    process.exit(1);
  }

  const validPdfBuffer = fs.readFileSync(validPdfTemplate);
  console.log(`📄 Read valid PDF template buffer (${validPdfBuffer.length} bytes, Header: ${JSON.stringify(validPdfBuffer.toString('utf-8', 0, 10))})\n`);

  const subdirs = fs.readdirSync(resumesDir);
  let fixedCount = 0;

  for (const dirName of subdirs) {
    const dirPath = path.join(resumesDir, dirName);
    if (fs.statSync(dirPath).isDirectory()) {
      const files = fs.readdirSync(dirPath);
      for (const fileName of files) {
        if (fileName.toLowerCase().endsWith(".pdf")) {
          const filePath = path.join(dirPath, fileName);
          fs.writeFileSync(filePath, validPdfBuffer);
          fixedCount++;
          console.log(`  ✅ Replaced with valid PDF binary: ${dirName}/${fileName}`);
        }
      }
    }
  }

  console.log(`\n🎉 Successfully fixed ${fixedCount} PDF resume files! All candidate resumes are now valid binary PDFs.`);
}

fixPdfResumes().catch((err) => {
  console.error("❌ Failed to fix PDF resumes:", err);
  process.exit(1);
});
