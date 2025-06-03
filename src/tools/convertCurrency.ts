import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const convertCurrency = tool(
  async ({
    fromCurrency,
    toCurrency,
    amount,
  }: {
    fromCurrency: string;
    toCurrency: string;
    amount: number;
  }) => {
    console.log("convert currency called", {
      fromCurrency,
      toCurrency,
      amount,
    });
    if (fromCurrency == "INR" && toCurrency == "USD") {
      return `${amount}/88`;
    } else if (fromCurrency == "USD" && toCurrency == "INR") {
      return `${amount}*88`;
    }
    return 1;
  },
  {
    name: "convertCurrency",
    description: "Convert a Native currency to another native currency",
    schema: z.object({
      fromCurrency: z
        .string()
        .describe("The currency to convert from eg : INR , USD , AUD..."),
      toCurrency: z
        .string()
        .describe("The currency to convert to eg: USD, INR ...."),
      amount: z.number().describe("The amount to convert"),
    }),
  }
);
