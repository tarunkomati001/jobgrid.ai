import fs from "fs";
import path from "path";

const dir = "scratch";
const files = fs.readdirSync(dir);
const passwords = new Set<string>();

files.forEach(f => {
  if (!f.endsWith(".ts") && !f.endsWith(".js")) return;
  const content = fs.readFileSync(path.join(dir, f), "utf-8");
  const matches = content.match(/["']([A-Za-z0-9@!#\$%^&*()_+=-]{8,25})["']/g);
  if (matches) {
    matches.forEach(m => {
      const clean = m.slice(1, -1);
      if (/[A-Z]/.test(clean) && /[0-9]/.test(clean) && /[@!#\$%^&*]/.test(clean) && !clean.includes(" ") && !clean.includes("/") && !clean.includes(":")) {
        passwords.add(clean);
      }
    });
  }
});

console.log("Candidate passwords found:", Array.from(passwords));

