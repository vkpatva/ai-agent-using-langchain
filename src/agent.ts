import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { convertCurrency } from "./tools/convertCurrency";
import { transferCrypto } from "./tools/transferCrypto";
import { getBalance } from "./tools/getBalance";
import { EthtoUSD } from "./tools/EthtoUSD";
import { USDtoEth } from "./tools/USDtoEth";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

export const agent = createReactAgent({
  llm: model,
  tools: [convertCurrency, transferCrypto, getBalance, EthtoUSD, USDtoEth],
});
