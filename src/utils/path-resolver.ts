import fs from "fs";
import path from "path";
import { config } from "../config";

/**
 * Resolves a resume file path stored in the database.
 * If the path is an absolute path from another machine (e.g. C:\Users\Asus\...) that doesn't exist,
 * it dynamically resolves the relative path inside the local `resumes` directory.
 */
export function resolveLocalResumePath(filePath: string): string {
  if (!filePath) return filePath;

  // 1. If it's an absolute path and exists on disk, return as is
  if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
    return filePath;
  }

  // 2. Try resolving relative to process.cwd() if path contains "resumes"
  const resumesIndex = filePath.indexOf("resumes");
  if (resumesIndex !== -1) {
    const relativeSubpath = filePath.substring(resumesIndex);
    const resolvedPath = path.join(process.cwd(), relativeSubpath);
    if (fs.existsSync(resolvedPath)) {
      return resolvedPath;
    }
  }

  // 3. Search inside local resumes directory for matching file name
  const baseName = path.basename(filePath);
  const resumesBaseDir = config.resumesDir || path.join(process.cwd(), "resumes");

  if (fs.existsSync(resumesBaseDir)) {
    // Check root resumes dir
    const rootCandidate = path.join(resumesBaseDir, baseName);
    if (fs.existsSync(rootCandidate)) {
      return rootCandidate;
    }

    // Check user subdirectories in resumes dir
    try {
      const entries = fs.readdirSync(resumesBaseDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const userCandidate = path.join(resumesBaseDir, entry.name, baseName);
          if (fs.existsSync(userCandidate)) {
            return userCandidate;
          }
        }
      }
    } catch (e) {}
  }

  return filePath;
}
