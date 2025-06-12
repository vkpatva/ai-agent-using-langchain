import express from "express";
import { agent } from "./agent";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/agent", async (req, res) => {
  try {
    const { thread, message } = req.body;

    //todo: read using db
    if (!app.locals.threads) {
      app.locals.threads = {};
    }
    const threads = app.locals.threads;

    if (!threads[thread]) {
      threads[thread] = [new SystemMessage(`you can fetch weather`)];
    }

    threads[thread].push(new HumanMessage(message));
    console.log(JSON.stringify(threads[thread]));

    const result = await agent.invoke({
      messages: threads[thread],
    });

    threads[thread].push(result.messages[result.messages.length - 1]);

    res.send(result.messages[result.messages.length - 1].content);
  } catch (error) {
    console.error("Error: ", error);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
