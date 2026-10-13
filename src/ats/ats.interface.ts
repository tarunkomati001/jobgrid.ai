import { Page } from "playwright";

export interface JobDetails {
  company?: string;
  title?: string;
  description?: string;
  ats: string;
}

export type FormFieldType = 
  | "text" 
  | "email" 
  | "tel" 
  | "textarea" 
  | "select" 
  | "file" 
  | "checkbox" 
  | "radio" 
  | "unknown";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string; // Internal identifier (like DOM name, id, or selector)
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[]; // For select, checkbox groups, or radio groups
}

export interface SubmissionResult {
  success: boolean;
  confirmation?: string;
  errorMessage?: string;
}

export interface WorkExperienceItem {
  jobTitle: string;
  company: string;
  location?: string;
  currentlyWorkHere?: boolean;
  startDate?: string;
  startMonth?: string;
  startYear?: string;
  endDate?: string;
  endMonth?: string;
  endYear?: string;
  description?: string;
}

export interface EducationItem {
  school: string;
  degree: string;
  fieldOfStudy?: string;
  gpa?: string;
  startDate?: string;
  startYear?: string;
  endDate?: string;
  endYear?: string;
}

export interface UserProfile {
  userId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  street?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  workAuthorization?: string;
  willingToRelocate: boolean;
  yearsOfExperience: number;
  gender?: string;
  experiences?: WorkExperienceItem[];
  educations?: EducationItem[];
  skills?: string[];
  websites?: string[];
  resumePath?: string;
}

export interface ATSAdapter {
  /**
   * Checks if the active page matches this specific ATS.
   */
  detect(page: Page): Promise<boolean>;

  /**
   * Extracts job info (title, description, etc.) from the page.
   */
  extractJob(page: Page): Promise<JobDetails>;

  /**
   * Scrapes the page form fields and returns them as a structured list.
   */
  extractFields(page: Page): Promise<FormField[]>;

  /**
   * Automates the input values into the page form based on normalized user profile fields.
   */
  fillForm(page: Page, profile: UserProfile, additionalAnswers?: Record<string, string>, fields?: FormField[]): Promise<void>;

  /**
   * Uploads the resume file using Playwright file input handling.
   */
  uploadResume(page: Page, resumePath: string, fields?: FormField[]): Promise<void>;

  /**
   * Validates if the page form has been correctly filled out.
   */
  validate(page: Page, fields?: FormField[]): Promise<boolean>;

  /**
   * Triggers the final submission and returns the status/confirmation.
   */
  submit(page: Page): Promise<SubmissionResult>;
}
