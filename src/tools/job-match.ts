import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ---- JOB MATCH TOOL ----
export const jobMatchTool = tool(
  async ({
    resumeData,
    jobDescription,
    requirements,
  }: {
    resumeData: any;
    jobDescription: string;
    requirements: string[];
  }) => {
    console.log("➡️ Into jobMatch tool");

    if (!resumeData || !resumeData.structuredData) {
      return {
        status: "error",
        message:
          "No structured resume data provided. Please use read_resume tool first.",
        matchPercent: 0,
      };
    }

    const { structuredData } = resumeData;
    const candidateSkills =
      structuredData.KeySkills?.map((s: string) => s.toLowerCase()) || [];
    const candidateExperience =
      structuredData.YearsOfExperience ?? structuredData.Experience ?? 0;
    const candidateEducation = structuredData.EducationSummary || "";

    let matched: string[] = [];
    let missing: string[] = [];

    // ---- Skill-based matching ----
    for (const req of requirements) {
      const lowerReq = req.toLowerCase();
      if (candidateSkills.some((s: string) => s.includes(lowerReq))) {
        matched.push(req);
      } else {
        missing.push(req);
      }
    }

    // ---- Simple scoring → % of matched requirements ----
    const matchPercent =
      requirements.length > 0
        ? Math.round((matched.length / requirements.length) * 100)
        : 0;

    // ---- Suggestions ----
    let suggestions: string[] = [];
    if (missing.length > 0) {
      suggestions.push(
        `Candidate should improve or gain skills in: ${missing.join(", ")}`
      );
    }
    if (!candidateExperience || candidateExperience === 0) {
      suggestions.push(
        "Add more professional/work experience to strengthen profile."
      );
    }
    if (!candidateEducation) {
      suggestions.push(
        "Include education background for better qualification match."
      );
    }

    console.log({
      jobDescription,
      requirements,
      matched,
      missing,
      suggestions,
      matchPercent, // always included
      finalScore: `${matchPercent}%`, // explicit string at the end
    });
    // ---- Final structured response ----
    return {
      jobDescription,
      requirements,
      matched,
      missing,
      suggestions,
      matchPercent, // always included
      finalScore: `${matchPercent}%`, // explicit string at the end
    };
  },
  {
    name: "match_resume_to_job",
    description:
      "Compare a candidate's structured resume data against a job description and requirements, return a match percentage and personalized suggestions",
    schema: z.object({
      resumeData: z
        .any()
        .describe("Structured resume data from read_resume tool"),
      jobDescription: z.string().describe("Full job description text"),
      requirements: z
        .array(z.string())
        .describe("List of required skills or qualifications for the job"),
    }),
  }
);
