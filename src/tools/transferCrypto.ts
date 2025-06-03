import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const transferCrypto = tool(
  async ({
    fromAddress,
    toAddress,
    Amount,
  }: {
    fromAddress: string;
    toAddress: string;
    Amount: number;
  }) => {
    console.log(
      `transferring from ${fromAddress} to ${toAddress} amount is ${Amount}`
    );
    return `Tx hash : 0x0001, ${Amount}`;
  },
  {
    name: "transferCrypto",
    description: "Transfer User's crypto from User's wallet to someone",
    schema: z.object({
      fromAddress: z
        .string()
        .describe("Crypto wallet from balance need to be transferred"),
      toAddress: z.string().describe("Crypto Wallet Address of the receiver"),
      Amount: z.number().describe("Crypto Balance that need to be transferred"),
    }),
  }
);
