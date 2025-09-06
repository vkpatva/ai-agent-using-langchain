import { tool } from "@langchain/core/tools";
import { z } from "zod";
import createIdentityFromPrivateKey from "../agent-identity/create-identity";
import { CredentialWallet, W3CCredential } from "@0xpolygonid/js-sdk";
let DID: string;
let CREDENTIAL: W3CCredential;
let wallet: CredentialWallet;
import { ethers, SigningKey, Wallet } from "ethers";
export const identityTool = tool(
  async () => {
    try {
      // if (!DID || !CREDENTIAL) {
      //   console.log("about to call create identity");
      //   const { did, credential, credentialWallet } =
      //     await createIdentityFromPrivateKey();
      //   const AllAuthBJJ = await credentialWallet.getAllAuthBJJCredentials(did);
      //   console.log("All AuthBJJ", AllAuthBJJ);
      //   DID = did.string();
      //   CREDENTIAL = credential;
      //   return { did: did.string(), credential };
      // } else {
      //   return { DID, CREDENTIAL };
      // }'
      const ethSigner = new Wallet(process.env.PRIVATE_KEY as string);
      const { did } = await createIdentityFromPrivateKey({ ethSigner });
      return did;
    } catch (err) {
      console.log(err);
    }
  },
  {
    name: "get_identity",
    description:
      "The function gets unique DID for the agent with this function user can get the DID of the AI Agent",
  }
);
