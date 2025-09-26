// scripts/registerAgent.ts
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import bs58 from "bs58";
import crc from "crc";
dotenv.config();

// Minimal ABI for the IdentityRegistry functions used
const IDENTITY_REGISTRY_ABI = [
  "function nonces(address) view returns (uint256)",
  "function newAgentByDeveloperDID(string developerDID, string agentDID, address agentAddress, string description, uint256 expiry, bytes signature) returns (uint256)",
];

/**
 * Generate Privado ID DID from Ethereum address
 * @param ethAddress Ethereum address (0x-prefixed, 20 bytes)
 * @param chain "polygon"
 * @param network "amoy" | "main" | etc.
 * @returns DID string
 */
function generatePrivadoDID(
  ethAddress: string,
  chain: string,
  network: string
): string {
  // Normalize address
  const addrBytes = Buffer.from(ethAddress.replace(/^0x/, ""), "hex");
  if (addrBytes.length !== 20) {
    throw new Error("Ethereum address must be 20 bytes");
  }

  // Step 1: idType (2 bytes)
  const idType = Buffer.from([0x0d, 0x01]); // standard for iden3

  // Step 2: zero padding (7 bytes)
  const zeroPadding = Buffer.alloc(7, 0);

  // Step 3: assemble first 29 bytes
  const base = Buffer.concat([idType, zeroPadding, addrBytes]); // 29 bytes

  // Step 4: checksum (CRC16, 2 bytes LE)
  const checksumVal = crc.crc16xmodem(base);
  const checksum = Buffer.alloc(2);
  checksum.writeUInt16LE(checksumVal);

  // Step 5: final 31 bytes
  const fullBytes = Buffer.concat([base, checksum]);

  // Step 6: Base58 encode
  const base58Id = bs58.encode(fullBytes);

  // Step 7: Assemble DID
  return `did:iden3:${chain}:${network}:${base58Id}`;
}

async function main() {
  const RPC_URL = process.env.AMOY_RPC!;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const developerPublicKey = "0xc3C1E99B2aee35e1E7D3eBF810976aa6d595ea54";
  const identityRegistryAddress = "0xF1dc8773D2e2a5De4187ea4F25230dA5d335fD3f";
  const description =
    process.env.AGENT_DESCRIPTION ?? "agent registered by script";
  const expiry = Math.floor(Date.now() / 1000) + 24 * 3600; // now + 1 day
  const chain = process.env.CHAIN ?? "polygon";
  const network = process.env.NETWORK ?? "amoy";

  // Generate random private key for agent
  const agentWallet = ethers.Wallet.createRandom();

  // Calculate DIDs from addresses using Privado ID format
  const developerDid = generatePrivadoDID(developerPublicKey, chain, network);
  const agentDid = generatePrivadoDID(agentWallet.address, chain, network);

  const identityRegistry = new ethers.Contract(
    identityRegistryAddress,
    IDENTITY_REGISTRY_ABI,
    provider
  );

  // types & typehashes (must match exact solidity strings)
  const AGENT_TYPE_STRING =
    "AgentRegistration(string developerDID,string agentDID,address agentAddress,string description,uint256 nonce,uint256 expiry)";
  const EIP712DOMAIN_TYPE_STRING =
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)";

  const AGENT_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(AGENT_TYPE_STRING)
  );
  const EIP712DOMAIN_TYPEHASH = ethers.keccak256(
    ethers.toUtf8Bytes(EIP712DOMAIN_TYPE_STRING)
  );

  // get nonce (BigNumber)
  const agentAddress = agentWallet.address;
  const nonceBn = await identityRegistry.nonces(agentAddress);
  const nonceStr = nonceBn.toString();

  // structHash = keccak256(abi.encode(
  //   AGENT_TYPEHASH,
  //   keccak256(bytes(developerDid)),
  //   keccak256(bytes(agentDid)),
  //   agent,
  //   keccak256(bytes(description)),
  //   nonce,
  //   expiry
  // ));
  const developerDidHash = ethers.keccak256(ethers.toUtf8Bytes(developerDid));
  const agentDidHash = ethers.keccak256(ethers.toUtf8Bytes(agentDid));
  const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));

  const structEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      "bytes32",
      "bytes32",
      "bytes32",
      "address",
      "bytes32",
      "uint256",
      "uint256",
    ],
    [
      AGENT_TYPEHASH,
      developerDidHash,
      agentDidHash,
      agentAddress,
      descriptionHash,
      nonceStr,
      expiry,
    ]
  );
  const structHash = ethers.keccak256(structEncoded);

  // Domain separator:
  // keccak256(abi.encode(
  //   EIP712DOMAIN_TYPEHASH,
  //   keccak256(bytes("IdentityRegistry")), // name
  //   keccak256(bytes("1")),                // version
  //   chainId,
  //   identityRegistryAddress
  // ));
  const nameHash = ethers.keccak256(ethers.toUtf8Bytes("IdentityRegistry"));
  const versionHash = ethers.keccak256(ethers.toUtf8Bytes("1"));

  const networkInfo = await provider.getNetwork();
  const chainId = networkInfo.chainId;

  const domainEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "bytes32", "bytes32", "uint256", "address"],
    [
      EIP712DOMAIN_TYPEHASH,
      nameHash,
      versionHash,
      chainId,
      identityRegistryAddress,
    ]
  );
  const domainSeparator = ethers.keccak256(domainEncoded);

  // final digest: keccak256("\x19\x01" || domainSeparator || structHash)
  const digest = ethers.keccak256(
    ethers.concat(["0x1901", domainSeparator, structHash])
  );

  // sign digest with agent private key (EIP-712 digest)
  const signature = await agentWallet.signTypedData(
    {
      name: "IdentityRegistry",
      version: "1",
      chainId: chainId,
      verifyingContract: identityRegistryAddress,
    },
    {
      AgentRegistration: [
        { name: "developerDID", type: "string" },
        { name: "agentDID", type: "string" },
        { name: "agentAddress", type: "address" },
        { name: "description", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" },
      ],
    },
    {
      developerDID: developerDid,
      agentDID: agentDid,
      agentAddress: agentAddress,
      description: description,
      nonce: nonceStr,
      expiry: expiry,
    }
  );

  // Return the results
  const result = {
    developerAddress: developerPublicKey,
    developerDID: developerDid,
    agentAddress: agentAddress,
    agentDID: agentDid,
    agentPrivateKey: agentWallet.privateKey,
    nonce: nonceStr,
    expiry: expiry,
    signature: signature,
  };

  console.log("EIP-712 Signature Generation Complete:");
  console.log("Developer Address:", result.developerAddress);
  console.log("Developer DID:", result.developerDID);
  console.log("Agent Address:", result.agentAddress);
  console.log("Agent DID:", result.agentDID);
  console.log("Agent Private Key:", result.agentPrivateKey);
  console.log("Nonce:", result.nonce);
  console.log("Expiry:", result.expiry);
  console.log("EIP-712 Signature:", result.signature);

  return result;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
