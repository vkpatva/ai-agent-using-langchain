import express from "express";
import multer from "multer";
import { agent } from "./agent";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads/"); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Modified /agent endpoint to handle file upload
app.post("/agent", upload.single("resume"), async (req, res) => {
  try {
    const { thread, message } = req.body;
    const resumeFile = req.file; // This contains the uploaded file info

    if (!app.locals.threads) {
      app.locals.threads = {};
    }
    const threads = app.locals.threads;

    if (!threads[thread]) {
      threads[thread] = [
        new SystemMessage(
          `
          You are an expert resume analysis agent. Your task is to carefully read and analyze the candidate's resume data.  

          Steps:  
          1. Parse and validate the structured resume JSON.  
            - Ensure the following fields are captured: Candidate Name, Current Role, Total Years of Experience, Key Skills, Industries/Domains, Education Summary, and Seniority Level.  
            - If any field is missing, check if it can be inferred from the given data.  

          2. Identify if the resume contains the **minimum required information** to run a job match:
            - Candidate Name  
            - Current Role  
            - Years of Experience  
            - At least 3 Key Skills  
            - Industry/Domain  
            - Education Summary  

          3. If these requirements are met → format a clean, concise candidate profile JSON and PASS it to the Job Match tool.  
          4. If critical fields are missing (not inferrable), return a request for exactly which fields are needed (no vague responses like “more details required”).  

          Be cost-efficient:  
          - Do not repeat the full resume text back.  
          - Only output structured JSON or a short clarification request.

            `
        ),
      ];
    }

    // If a file was uploaded, add its path to the message
    const userMessage = resumeFile
      ? `${message} [Resume File: ${resumeFile.path}]`
      : message;

    threads[thread].push(new HumanMessage(userMessage));
    console.log(JSON.stringify(threads[thread]));

    const result = await agent.invoke({
      messages: threads[thread],
    });

    threads[thread].push(result.messages[result.messages.length - 1]);

    res.send(result.messages[result.messages.length - 1].content);
  } catch (error) {
    console.error("Error: ", error);
    res.status(500).send({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
