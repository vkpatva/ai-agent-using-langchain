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
    // Define conversion rates
    const rates: Record<string, number> = {
      "ETH-USD": 2500,
      "USD-ETH": 1 / 2500,
      "USD-INR": 88,
      "INR-USD": 1 / 88,
      "ETH-INR": 2500 * 88,
      "INR-ETH": 1 / (2500 * 88),
    };

    const key = `${fromCurrency}-${toCurrency}`;
    const rate = rates[key];

    if (rate === undefined) {
      throw new Error(
        `Conversion from ${fromCurrency} to ${toCurrency} not supported.`
      );
    }
    console.log(amount * rate);
    return amount * rate;
  },
  {
    name: "convertCurrency",
    description:
      "Give rate of one currency to another, accepts only ETH INR and USD conversion",
    schema: z.object({
      fromCurrency: z
        .string()
        .describe("The currency to convert from eg : INR , ETH , USD..."),
      toCurrency: z
        .string()
        .describe("The currency to convert to eg: ETH, USD, INR ...."),
      amount: z.number().describe("The amount to convert"),
    }),
  }
);
