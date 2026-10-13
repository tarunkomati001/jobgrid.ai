import fs from "fs";
import path from "path";
import { chromium } from "playwright";

async function main() {
  const resumesDir = path.resolve(__dirname, "../resumes");
  console.log(`📁 Scanning resumes directory: ${resumesDir}`);

  if (!fs.existsSync(resumesDir)) {
    console.error("❌ Resumes directory does not exist.");
    return;
  }

  const browser = await chromium.launch({ headless: true });

  const userDirs = fs.readdirSync(resumesDir).filter(f => {
    const fullPath = path.join(resumesDir, f);
    return fs.statSync(fullPath).isDirectory() && f.startsWith("user_");
  });

  for (const userDir of userDirs) {
    const userDirPath = path.join(resumesDir, userDir);
    const files = fs.readdirSync(userDirPath).filter(f => f.endsWith(".pdf"));

    for (const file of files) {
      const filePath = path.join(userDirPath, file);
      const content = fs.readFileSync(filePath);

      // Check if the file is a PDF by reading the magic bytes (%PDF)
      const isRealPdf = content.slice(0, 4).toString() === "%PDF";
      if (isRealPdf) {
        console.log(`✅ ${file} in ${userDir} is already a valid PDF. Skipping.`);
        continue;
      }

      console.log(`⚠️ ${file} in ${userDir} is plain text disguised as PDF. Generating real PDF...`);
      const textContent = content.toString("utf-8");

      // Parse lines
      const lines = textContent.split("\n").map(l => l.trim()).filter(Boolean);
      const name = lines[0] || "Resume";
      const contactInfo = lines[1] || "";
      const links = lines[2] || "";
      const remainingLines = lines.slice(3);

      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>${name} - Resume</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              margin: 40px;
              color: #333;
              line-height: 1.6;
              font-size: 14px;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            h1 {
              margin: 0 0 5px 0;
              font-size: 28px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .contact, .links {
              margin: 5px 0;
              font-size: 12px;
              color: #666;
            }
            .content {
              margin-top: 20px;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-weight: bold;
              font-size: 16px;
              border-bottom: 1px solid #ddd;
              margin-bottom: 10px;
              padding-bottom: 3px;
              text-transform: uppercase;
            }
            p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${name}</h1>
            <div class="contact">${contactInfo}</div>
            <div class="links">${links}</div>
          </div>
          <div class="content">
            ${remainingLines.map(line => {
              if (line.toLowerCase().startsWith("skills:") || line.toLowerCase().startsWith("education:") || line.toLowerCase().startsWith("experience:")) {
                return `
                  <div class="section">
                    <div class="section-title">${line.split(":")[0]}</div>
                    <p>${line.split(":").slice(1).join(":")}</p>
                  </div>
                `;
              }
              return `<p>${line}</p>`;
            }).join("")}
          </div>
        </body>
        </html>
      `;

      const page = await browser.newPage();
      await page.setContent(html);
      
      // Print to PDF
      await page.pdf({
        path: filePath,
        format: "A4",
        margin: {
          top: "0.4in",
          right: "0.4in",
          bottom: "0.4in",
          left: "0.4in"
        }
      });
      await page.close();
      console.log(`✅ Generated real PDF for ${file} in ${userDir}.`);
    }
  }

  await browser.close();
  console.log("🎉 PDF fixing process completed successfully!");
}

main().catch(console.error);
