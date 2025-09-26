// registerAgent.js
import { Wallet, ethers } from "ethers";
import bs58 from "bs58";
import crc from "crc";
import dotenv from "dotenv";

dotenv.config();

// -------------------- CONFIG --------------------
const RPC_URL = "https://rpc-amoy.polygon.technology";
const CHAIN_ID = 80002;
const IDENTITY_REGISTRY = "0xF663447E650A3bcdc041A4dD00c2cD88a1B19bB6";

const DOMAIN = {
  name: "AgentRegistry", // matches SIGNING_DOMAIN in contract
  version: "1", // matches SIGNATURE_VERSION in contract
  chainId: CHAIN_ID,
  verifyingContract: IDENTITY_REGISTRY,
};

const TYPES = {
  AgentRegistration: [
    { name: "agent", type: "address" },
    { name: "did", type: "string" },
    { name: "description", type: "string" },
    { name: "serviceEndpoint", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
};

// Define AgentRegistration interface
interface AgentRegistration {
  agent: string;
  did: string;
  description: string;
  serviceEndpoint: string;
  nonce: bigint;
  expiry: bigint;
}

// Add this new function after registerAgent function
async function registerAgentWithSig(
  forwarderKey: string,
  agentKey: string,
  description: string
) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Create wallets for both forwarder and agent
  const forwarder = new Wallet(forwarderKey, provider);
  const agent = new Wallet(agentKey, provider);

  // Generate DID for the agent
  const did = generatePrivadoDID(agent.address, "polygon", "amoy");

  console.log("✅ DID generated:", did);
  console.log("✅ Agent address:", agent.address);
  console.log("✅ Forwarder address:", forwarder.address);

  // Setup contract
  const abi = [
    "function registerAgentWithSig((address agent, string did, string description, string serviceEndpoint, uint256 nonce, uint256 expiry) request, bytes signature) external payable",
    "function nonces(address) view returns (uint256)",
  ];

  const registry = new ethers.Contract(IDENTITY_REGISTRY, abi, forwarder);

  // Get current nonce
  const nonce = await registry.nonces(agent.address);

  // Modify the DOMAIN object to ensure exact match with contract
  const DOMAIN = {
    name: "AgentRegistry",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: IDENTITY_REGISTRY.toLowerCase(), // ensure lowercase
  };

  // Prepare request with explicit BigInt for nonce
  const request: AgentRegistration = {
    agent: agent.address.toLowerCase(), // ensure lowercase
    did: did,
    description: description,
    serviceEndpoint: `https://api.example.com/agent/${agent.address.toLowerCase()}`,
    nonce: BigInt(nonce), // Convert to BigInt
    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600), // Convert to BigInt
  };

  // Log the exact data being signed for debugging
  console.log("Signing domain:", DOMAIN);
  console.log("Signing data:", request);

  // Get signature from agent using signTypedData v4
  const signature = await agent.signTypedData(DOMAIN, TYPES, request);

  console.log("Generated signature:", signature);

  // Registration fee
  const registrationFee = ethers.parseEther("0.01");

  // Submit transaction by forwarder
  const tx = await registry.registerAgentWithSig(request, signature, {
    value: registrationFee,
  });

  console.log("⏳ Tx sent:", tx.hash);
  console.log(
    "💰 Registration fee:",
    ethers.formatEther(registrationFee),
    "ETH"
  );

  const receipt = await tx.wait();
  console.log("✅ Agent registered in block:", receipt.blockNumber);
  console.log("✅ Agent DID:", did);
  console.log("✅ Description:", description);
  console.log("✅ Service Endpoint:", request.serviceEndpoint);
}
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

  const idType = Buffer.from([0x0d, 0x01]);
  const zeroPadding = Buffer.alloc(7, 0);
  const base = Buffer.concat([idType, zeroPadding, addrBytes]);
  const checksumVal = crc.crc16xmodem(base);
  const checksum = Buffer.alloc(2);
  checksum.writeUInt16LE(checksumVal);
  const fullBytes = Buffer.concat([base, checksum]);
  const base58Id = bs58.encode(fullBytes);
  return `did:iden3:${chain}:${network}:${base58Id}`;
}

// Update the run section
// ------------------- RUN ------------------------
(async () => {
  try {
    const FORWARDER_KEY = process.env.FORWARDER_KEY;
    const AGENT_KEY = ethers.Wallet.createRandom();
    const DESCRIPTION = process.env.AGENT_DESCRIPTION || "Trustless agent";

    if (!FORWARDER_KEY) throw new Error("Missing FORWARDER_KEY in .env");
    if (!AGENT_KEY) throw new Error("Missing AGENT_KEY in .env");

    await registerAgentWithSig(
      FORWARDER_KEY.startsWith("0x") ? FORWARDER_KEY : `0x${FORWARDER_KEY}`,
      AGENT_KEY.privateKey,
      DESCRIPTION
    );
  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
})();
