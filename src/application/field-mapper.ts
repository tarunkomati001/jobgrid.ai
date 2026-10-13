import { UserProfile } from "../ats/ats.interface";

/**
 * Normalizes a field label by converting it to lowercase, removing non-alphanumeric characters 
 * (except spaces and underscores), and trimming white space.
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps a scraped form field label to the corresponding property of the UserProfile.
 * Returns null if no direct mapping exists (for custom/job-specific questions).
 */
export function mapLabelToProfileKey(label: string): keyof UserProfile | null {
  const norm = normalizeLabel(label);

  // First Name mappings
  if (
    norm.includes("first name") ||
    norm.includes("given name") ||
    norm === "first_name" ||
    norm === "firstname" ||
    norm === "first"
  ) {
    return "firstName";
  }

  // Last Name mappings
  if (
    norm.includes("last name") ||
    norm.includes("family name") ||
    norm.includes("surname") ||
    norm === "last_name" ||
    norm === "lastname" ||
    norm === "last"
  ) {
    return "lastName";
  }

  // Email mappings
  if (norm === "email" || norm.includes("email address") || norm.includes("e-mail")) {
    return "email";
  }

  // Phone mappings
  if (
    norm.includes("phone") ||
    norm.includes("mobile") ||
    norm.includes("telephone") ||
    norm === "tel" ||
    norm.includes("contact number")
  ) {
    return "phone";
  }

  // Street mappings
  if (
    norm.includes("street") ||
    norm.includes("address line") ||
    norm.includes("addressline") ||
    norm.includes("apartment number") ||
    norm.includes("building number") ||
    norm === "address" ||
    norm.includes("street address")
  ) {
    return "street";
  }

  // City mappings
  if (norm === "city" || norm === "town" || norm.includes("city/town")) {
    return "city";
  }

  // Postal Code mappings
  if (norm.includes("postal") || norm.includes("zip") || norm === "zipcode" || norm === "postcode") {
    return "zipCode";
  }

  // Country mappings
  if (norm === "country" || norm.includes("country of residence")) {
    return "country";
  }

  // General Location mappings
  if (
    norm === "location" ||
    norm.includes("where are you located") ||
    norm.includes("country do you intend to work from") ||
    norm.includes("what country") ||
    norm.includes("which country") ||
    norm.includes("current location") ||
    norm.includes("your location") ||
    norm.includes("city and country") ||
    norm.includes("city country") ||
    norm.includes("location city state") ||
    norm.includes("living in")
  ) {
    return "location";
  }

  // LinkedIn mappings
  if (norm.includes("linkedin")) {
    return "linkedinUrl";
  }

  // GitHub mappings
  if (norm.includes("github")) {
    return "githubUrl";
  }

  // Portfolio mappings
  if (
    norm.includes("portfolio") ||
    norm.includes("website") ||
    norm.includes("personal site") ||
    norm.includes("personal link")
  ) {
    return "portfolioUrl";
  }

  // Work Authorization mappings
  if (
    norm.includes("work authorization") ||
    norm.includes("authorized to work") ||
    norm.includes("authorization to work") ||
    norm.includes("legally authorized") ||
    norm.includes("sponsorship") ||
    norm.includes("visa status")
  ) {
    return "workAuthorization";
  }

  // Relocation mappings
  if (norm.includes("relocate") || norm.includes("relocation")) {
    return "willingToRelocate";
  }

  // Gender mappings
  if (
    norm === "gender" ||
    norm.includes("gender identity") ||
    norm.includes("what is your gender") ||
    norm.includes("select your gender") ||
    norm.includes("identify your gender")
  ) {
    return "gender";
  }

  return null;
}
