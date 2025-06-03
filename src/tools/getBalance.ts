import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const getBalance = tool(
  async ({ address }: { address: string }) => {
    console.log("get Balance called", address);
    return "12 ETH";
  },
  {
    name: "getBalance",
    description: "Gets onchain balance of user's crypto wallet in Eth",
    schema: z.object({
      address: z.string().describe("Crypto Wallet Address of the User"),
    }),
  }
);
