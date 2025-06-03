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
    const result = await agent.invoke({
      messages: [
        new SystemMessage(
          "You are on chain agent can do transfer on behalf of users , you also have capability to convert native currency to another native currency and USD to Eth or vice versa, do not assume any information use this tools to convert values. Whenever someone says native currency first convert it to USD and then find appropriate eth of the currency"
        ),
        new HumanMessage(req.body.message),
      ],
    });

    console.log(result.messages[result.messages.length - 1].content);
    res.send(result.messages[result.messages.length - 1].content);
  } catch (error) {
    console.error("Error: ", error);
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
