import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { identityTool } from "./tools/identity";
import { resumeAnalysisTool, resumeReaderTool } from "./tools/resume-reader";
import { jobMatchTool } from "./tools/job-match";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

export const agent = createReactAgent({
  llm: model,
  tools: [identityTool, resumeReaderTool, resumeAnalysisTool, jobMatchTool],
});
