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
          `You are on chain agent you can do payments on behalf of users,
          User can ask you to send INR or USD you need to convert it into ETH.
          They can also ask you directly send Eth. Before initiating Transfer check user's balance, if user doesn't have Sufficient Eth Cancel the transaction, if user doesn't pass default Currency assume it is USD`
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
