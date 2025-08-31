import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";

import { Document } from "@langchain/core/documents";

export const resumeReaderTool = tool(
  async ({
    filePath,
    extractStructured = true,
  }: {
    filePath: string;
    extractStructured?: boolean;
  }) => {
    console.log("Inside reader tool");
    try {
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      if (!fileExists) {
        return `Error: File not found at path: ${filePath}`;
      }

      const ext = path.extname(filePath).toLowerCase();
      let extractedText = "";

      switch (ext) {
        case ".pdf":
          extractedText = await extractFromPDF(filePath);
          break;
        case ".docx":
          extractedText = await extractFromDOCX(filePath);
          break;
        case ".txt":
        case ".md":
          extractedText = await extractFromText(filePath);
          break;
        default:
          return `Error: Unsupported file format: ${ext}. Supported formats: .pdf, .docx, .txt, .md`;
      }

      if (!extractedText.trim()) {
        return "Error: No text content could be extracted from the file.";
      }

      if (extractStructured) {
        const structuredData = parseResumeContent(extractedText);
        const summary = generateResumeSummary(structuredData);
        console.log(summary);
        return {
          success: true,
          filePath,
          fileType: ext,
          rawText: extractedText,
          structuredData,
          summary: summary,
        };
      }

      return {
        success: true,
        filePath,
        fileType: ext,
        rawText: extractedText,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `Error processing resume: ${error.message}`;
      }
      return `Error processing resume: ${error}`;
    }
  },
  {
    name: "read_resume",
    description:
      "Read and parse resume files (PDF, DOCX, TXT, MD) to extract structured information including contact details, experience, education, and skills",
    schema: z.object({
      filePath: z.string().describe("Path to the resume file"),
      extractStructured: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to extract structured data or just raw text"),
    }),
  }
);

// Helper function to extract text from PDF
async function extractFromPDF(filePath: string): Promise<string> {
  const dataBuffer = await fs.readFile(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

// Helper function to extract text from DOCX
async function extractFromDOCX(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Helper function to extract text from plain text files
async function extractFromText(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

// Parse resume content into structured data
function parseResumeContent(text: string) {
  const lines = text.split("\n").filter((line) => line.trim());

  const resumeData = {
    contactInfo: extractContactInfo(text),
    summary: extractSummary(text),
    experience: extractExperience(text),
    education: extractEducation(text),
    skills: extractSkills(text),
    certifications: extractCertifications(text),
    projects: extractProjects(text),
  };

  return resumeData;
}

// Extract contact information
function extractContactInfo(text: string) {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const linkedinRegex =
    /(?:linkedin\.com\/in\/|linkedin\.com\/profile\/view\?id=)([a-zA-Z0-9-]+)/gi;

  return {
    emails: text.match(emailRegex) || [],
    phones: text.match(phoneRegex) || [],
    linkedin: text.match(linkedinRegex) || [],
    name: extractName(text),
  };
}

// Extract name (basic heuristic - first line that looks like a name)
function extractName(text: string) {
  const lines = text.split("\n").filter((line) => line.trim());
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    // Simple heuristic: 2-4 words, mostly letters, likely a name
    if (
      trimmed.split(" ").length >= 2 &&
      trimmed.split(" ").length <= 4 &&
      /^[A-Za-z\s.]+$/.test(trimmed) &&
      trimmed.length > 5
    ) {
      return trimmed;
    }
  }
  return null;
}

// Extract professional summary/objective
function extractSummary(text: string) {
  const summaryKeywords = /(?:summary|objective|profile|about|overview)[\s:]/i;
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (summaryKeywords.test(lines[i])) {
      // Collect following lines until we hit another section
      let summary = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (!line) continue;
        if (isLikelySectionHeader(line)) break;
        summary.push(line);
        if (summary.length > 10) break; // Reasonable limit
      }
      return summary.join(" ");
    }
  }
  return null;
}

// Extract work experience
function extractExperience(text: string) {
  const experienceKeywords =
    /(?:experience|employment|work\s+history|professional\s+experience)[\s:]/i;
  return extractSection(text, experienceKeywords, parseExperienceEntries);
}

// Extract education
function extractEducation(text: string) {
  const educationKeywords =
    /(?:education|academic|qualifications|degrees?)[\s:]/i;
  return extractSection(text, educationKeywords, parseEducationEntries);
}

// Extract skills
function extractSkills(text: string) {
  const skillsKeywords =
    /(?:skills|technical\s+skills|competencies|technologies)[\s:]/i;
  return extractSection(text, skillsKeywords, parseSkillsEntries);
}

// Extract certifications
function extractCertifications(text: string) {
  const certKeywords = /(?:certifications?|certificates?|licenses?)[\s:]/i;
  return extractSection(text, certKeywords, parseCertificationEntries);
}

// Extract projects
function extractProjects(text: string) {
  const projectKeywords = /(?:projects?|portfolio)[\s:]/i;
  return extractSection(text, projectKeywords, parseProjectEntries);
}

// Generic section extractor
function extractSection(
  text: string,
  sectionRegex: RegExp,
  parser: (lines: string[]) => any[]
) {
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    if (sectionRegex.test(lines[i])) {
      // Collect lines until next major section
      let sectionLines = [];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        if (!line) continue;
        if (isLikelySectionHeader(line) && j > i + 3) break;
        sectionLines.push(line);
      }
      return parser(sectionLines);
    }
  }
  return [];
}

// Check if a line is likely a section header
function isLikelySectionHeader(line: string): boolean {
  const sectionHeaders =
    /^(?:experience|education|skills|projects?|certifications?|summary|objective|contact|about)/i;
  return sectionHeaders.test(line.trim()) && line.length < 50;
}

// Parse experience entries
function parseExperienceEntries(lines: string[]) {
  const entries = [];
  interface ExperienceEntry {
    title: string;
    company: string;
    dates: string;
    description: Array<string>;
  }

  let currentEntry: ExperienceEntry | null = null;

  for (const line of lines) {
    // Check if this looks like a job title/company line
    if (isLikelyJobTitle(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        title: extractJobTitle(line),
        company: extractCompany(line),
        dates: extractDates(line),
        description: [],
      };
    } else if (currentEntry && line.trim()) {
      currentEntry.description.push(line.trim());
    }
  }

  if (currentEntry) entries.push(currentEntry);
  return entries;
}

// Parse education entries
function parseEducationEntries(lines: string[]) {
  const entries = [];
  let currentEntry = null;

  for (const line of lines) {
    if (isLikelyEducationEntry(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        degree: extractDegree(line),
        institution: extractInstitution(line),
        dates: extractDates(line),
        details: [] as string[],
      };
    } else if (currentEntry && line.trim()) {
      currentEntry.details.push(line.trim());
    }
  }

  if (currentEntry) entries.push(currentEntry);
  return entries;
}

// Parse skills entries
function parseSkillsEntries(lines: string[]) {
  const skills = [];
  for (const line of lines) {
    // Split by common delimiters and clean up
    const lineSkills = line
      .split(/[,;|•·]/)
      .map((skill) => skill.trim())
      .filter((skill) => skill.length > 1);
    skills.push(...lineSkills);
  }
  return [...new Set(skills)]; // Remove duplicates
}

// Parse certification entries
function parseCertificationEntries(lines: string[]) {
  return lines
    .map((line) => ({
      name: line.trim(),
      dates: extractDates(line),
    }))
    .filter((cert) => cert.name);
}

// Parse project entries
function parseProjectEntries(lines: string[]) {
  const entries = [];
  let currentEntry = null;

  for (const line of lines) {
    if (isLikelyProjectTitle(line)) {
      if (currentEntry) entries.push(currentEntry);
      currentEntry = {
        name: line.trim(),
        description: [],
        technologies: [],
      };
    } else if (currentEntry && line.trim()) {
      currentEntry.description.push();
    }
  }

  if (currentEntry) entries.push(currentEntry);
  return entries;
}

// Helper functions for parsing
function isLikelyJobTitle(line: string): boolean {
  return (
    /(?:developer|engineer|manager|analyst|specialist|coordinator|director|lead|senior|junior|intern)/i.test(
      line
    ) || /\d{4}[\s-]+(?:\d{4}|present|current)/i.test(line)
  );
}

function isLikelyEducationEntry(line: string): boolean {
  return (
    /(?:bachelor|master|phd|degree|university|college|institute)/i.test(line) ||
    /(?:b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?)/i.test(line)
  );
}

function isLikelyProjectTitle(line: string): boolean {
  return /^[A-Z]/.test(line.trim()) && line.length < 100 && !line.includes("@");
}

function extractJobTitle(line: string): string {
  // Simple extraction - you may want to make this more sophisticated
  const parts = line.split(/[-–|@]|at\s+/i);
  return parts[0].trim();
}

function extractCompany(line: string): string {
  const parts = line.split(/[-–|@]|at\s+/i);
  if (parts.length > 1) {
    return parts[1].split(/\d{4}/)[0].trim();
  }
  return "";
}

function extractDates(line: string): string {
  const dateMatch = line.match(/\d{4}[\s-]+(?:\d{4}|present|current)/i);
  return dateMatch ? dateMatch[0] : "";
}

function extractDegree(line: string): string {
  const degreeMatch = line.match(
    /(?:bachelor|master|phd|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|ph\.?d\.?)[^,]*/i
  );
  return degreeMatch ? degreeMatch[0].trim() : line.split(",")[0].trim();
}

function extractInstitution(line: string): string {
  const parts = line.split(/[-–,]/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : "";
}

// Generate a summary of the resume
function generateResumeSummary(data: any): string {
  const { contactInfo, experience, education, skills } = data;

  return [
    `Resume Analysis for ${contactInfo.name || "Unknown"}`,
    experience?.length
      ? `• ${experience.length} experience entries (latest: ${
          experience[0]?.title || "N/A"
        })`
      : null,
    education?.length
      ? `• ${education.length} education entries (highest: ${
          education[0]?.degree || "N/A"
        })`
      : null,
    skills?.length
      ? `• ${skills.length} skills (top: ${skills.slice(0, 5).join(", ")})`
      : null,
    contactInfo?.emails?.[0] ? `• Contact: ${contactInfo.emails[0]}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

// Additional tool for analyzing resume content with AI
function enrichResume(data: StructuredResumeData): StructuredResumeData {
  const enriched = { ...data };

  // Auto-calc experience if missing
  if (
    !enriched.YearsOfExperience &&
    enriched.EducationSummary?.includes("Graduated")
  ) {
    const match = enriched.EducationSummary.match(/Graduated.*?(\d{4})/);
    if (match) {
      const gradYear = parseInt(match[1]);
      const currentYear = new Date().getFullYear();
      enriched.YearsOfExperience = Math.max(0, currentYear - gradYear);
    }
  }

  // Ensure at least 3 skills
  if (!enriched.KeySkills || enriched.KeySkills.length < 3) {
    const fallbackSkills = ["JavaScript", "TypeScript", "React"]; // can be extended
    enriched.KeySkills = Array.from(
      new Set([...(enriched.KeySkills || []), ...fallbackSkills])
    ).slice(0, 5);
  }

  return enriched;
}

// ---------- Analysis Functions ----------
interface StructuredResumeData {
  CandidateName: string;
  CurrentRole?: string;
  YearsOfExperience?: number;
  KeySkills?: string[];
  Industries?: string[];
  EducationSummary?: string;
  SeniorityLevel?: string;
}
// ---------- Main Tool ----------
export const resumeAnalysisTool = tool(
  async ({
    resumeData,
    analysisType = "general",
  }: {
    resumeData: { structuredData: StructuredResumeData };
    analysisType?: "general" | "skills" | "experience" | "fit";
  }) => {
    console.log("➡️ Into analysis tool");

    if (!resumeData || !resumeData.structuredData) {
      return {
        status: "error",
        message:
          "No structured resume data provided. Please run read_resume tool first.",
      };
    }

    const enrichedData = enrichResume(resumeData.structuredData);

    const analyzers: Record<string, (d: StructuredResumeData) => any> = {
      general: analyzeGeneral,
      skills: analyzeSkills,
      experience: analyzeExperience,
      fit: analyzeFit,
    };

    const analyzeFn = analyzers[analysisType];
    if (!analyzeFn) {
      return {
        status: "error",
        message: `Invalid analysisType: ${analysisType}`,
      };
    }

    return {
      status: "success",
      type: analysisType,
      data: analyzeFn(enrichedData),
    };
  },
  {
    name: "analyze_resume",
    description:
      "Analyze structured resume data to provide insights about skills, experience, or job fit. Auto-fills missing fields when possible.",
    schema: z.object({
      resumeData: z
        .any()
        .describe("Structured resume data from read_resume tool"),
      analysisType: z
        .enum(["general", "skills", "experience", "fit"])
        .optional()
        .describe("Type of analysis to perform"),
    }),
  }
);

// Analysis helper functions
function analyzeSkills(data: any): string {
  const { skills } = data;

  if (!skills || skills.length === 0) {
    return "No skills section found in the resume.";
  }

  // Categorize skills
  const techSkills = skills.filter((skill: string) =>
    /(?:javascript|python|java|react|node|sql|aws|docker|kubernetes|git)/i.test(
      skill
    )
  );

  const softSkills = skills.filter((skill: string) =>
    /(?:leadership|communication|teamwork|problem.solving|management)/i.test(
      skill
    )
  );

  let analysis = `Skills Analysis:\n`;
  analysis += `\n• Total skills: ${skills.length}`;
  analysis += `\n• Technical skills: ${techSkills.length} (${techSkills
    .slice(0, 5)
    .join(", ")})`;
  analysis += `\n• Soft skills: ${softSkills.length} (${softSkills
    .slice(0, 3)
    .join(", ")})`;

  return analysis;
}

function analyzeExperience(data: any): string {
  const { experience } = data;

  if (!experience || experience.length === 0) {
    return "No work experience found in the resume.";
  }

  let analysis = `Experience Analysis:\n`;
  analysis += `\n• Total positions: ${experience.length}`;
  analysis += `\n• Most recent: ${experience[0]?.title} at ${experience[0]?.company}`;

  // Calculate approximate years of experience
  const yearsExp = calculateYearsOfExperience(experience);
  if (yearsExp > 0) {
    analysis += `\n• Estimated total experience: ${yearsExp} years`;
  }

  // Analyze progression
  const titles = experience
    .map((exp: { title: any }) => exp.title)
    .filter(Boolean);
  if (titles.length > 1) {
    analysis += `\n• Career progression: ${titles.join(" → ")}`;
  }

  return analysis;
}

function analyzeGeneral(data: any): string {
  const { contactInfo, experience, education, skills } = data;

  let analysis = `General Resume Analysis:\n`;

  if (contactInfo.name) {
    analysis += `\n• Candidate: ${contactInfo.name}`;
  }

  analysis += `\n• Sections found: ${[
    experience.length > 0 ? "Experience" : "",
    education.length > 0 ? "Education" : "",
    skills.length > 0 ? "Skills" : "",
  ]
    .filter(Boolean)
    .join(", ")}`;

  // Overall completeness score
  let completeness = 0;
  if (contactInfo.emails.length > 0) completeness += 20;
  if (experience.length > 0) completeness += 30;
  if (education.length > 0) completeness += 25;
  if (skills.length > 0) completeness += 25;

  analysis += `\n• Resume completeness: ${completeness}%`;

  return analysis;
}

function analyzeFit(data: any): string {
  // This would typically take a job description as input for comparison
  // For now, provide general fit indicators
  const { experience, skills, education } = data;

  let analysis = `Fit Analysis:\n`;
  analysis += `\n• Experience level: ${
    experience.length > 0 ? "Experienced" : "Entry-level"
  }`;
  analysis += `\n• Education background: ${
    education.length > 0 ? "Formal education" : "No formal education listed"
  }`;
  analysis += `\n• Technical proficiency: ${
    skills.length > 10 ? "High" : skills.length > 5 ? "Medium" : "Basic"
  }`;

  return analysis;
}

function calculateYearsOfExperience(experience: any[]): number {
  let totalYears = 0;

  for (const exp of experience) {
    if (exp.dates) {
      const years = extractYearsFromDateRange(exp.dates);
      totalYears += years;
    }
  }

  return Math.round(totalYears);
}

function extractYearsFromDateRange(dateRange: string): number {
  const match = dateRange.match(/(\d{4})[\s-]+(?:(\d{4})|present|current)/i);
  if (match) {
    const startYear = parseInt(match[1]);
    const endYear = match[2] ? parseInt(match[2]) : new Date().getFullYear();
    return Math.max(0, endYear - startYear);
  }
  return 0;
}
