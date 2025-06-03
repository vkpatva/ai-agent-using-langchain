import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const USDtoEth = tool(
  async ({ Amount }: { Amount: number }) => {
    console.log("USD to Eth Called", USDtoEth);
    return `${Amount}/2500`;
  },
  {
    name: "USDtoEth",
    description: "Convert amount of USD equivalent to Eth",
    schema: z.object({
      address: z.string().describe("Crypto Wallet Address of the User"),
    }),
  }
);
