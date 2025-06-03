import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const EthtoUSD = tool(
  async ({ Amount }: { Amount: number }) => {
    console.log("Eth to USD called", Amount);
    return `${Amount} * 2500`;
  },
  {
    name: "EthtoUSD",
    description: "Convert amount of USD equivalent to Eth",
    schema: z.object({
      address: z.string().describe("Crypto Wallet Address of the User"),
    }),
  }
);
