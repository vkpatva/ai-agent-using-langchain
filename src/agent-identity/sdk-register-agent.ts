// registerAgent.js
import { Wallet, ethers } from "ethers";
import {
  IdentityWallet,
  KMS,
  KmsKeyType,
  BjjProvider,
  InMemoryPrivateKeyStore,
  CredentialStatusResolverRegistry,
  CredentialStatusType,
  IssuerResolver,
  RHSResolver,
  InMemoryDataSource,
  CredentialStorage,
  IdentityStorage,
  InMemoryMerkleTreeStorage,
  EthStateStorage,
  defaultEthConnectionConfig,
  CredentialWallet,
  Sec256k1Provider,
} from "@0xpolygonid/js-sdk";
import { Blockchain, DidMethod, NetworkId } from "@iden3/js-iden3-core";
import dotenv from "dotenv";

dotenv.config();

// -------------------- CONFIG --------------------
const RPC_URL = "https://rpc-amoy.polygon.technology"; // Amoy testnet
const CHAIN_ID = 80002;
const STATE_CONTRACT = "0x134B1BE34911E39A8397ec6289782989729807a4"; // PolygonID state contract
const IDENTITY_REGISTRY = "0xF663447E650A3bcdc041A4dD00c2cD88a1B19bB6";
// ------------------------------------------------

// ----------------- Polygon ID Setup -------------
const dataStorage = {
  credential: new CredentialStorage(new InMemoryDataSource()),
  identity: new IdentityStorage(
    new InMemoryDataSource(),
    new InMemoryDataSource()
  ),
  mt: new InMemoryMerkleTreeStorage(40),
  states: new EthStateStorage({
    ...defaultEthConnectionConfig,
    url: RPC_URL,
    chainId: CHAIN_ID,
    contractAddress: STATE_CONTRACT,
  }),
};

const kms = new KMS();
const memoryKeyStore = new InMemoryPrivateKeyStore();
kms.registerKeyProvider(
  KmsKeyType.BabyJubJub,
  new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore)
);
kms.registerKeyProvider(
  KmsKeyType.Secp256k1,
  new Sec256k1Provider(KmsKeyType.Secp256k1, memoryKeyStore)
);

const statusRegistry = new CredentialStatusResolverRegistry();
statusRegistry.register(
  CredentialStatusType.SparseMerkleTreeProof,
  new IssuerResolver()
);
statusRegistry.register(
  CredentialStatusType.SparseMerkleTreeProof,
  new RHSResolver(dataStorage.states)
);

const credentialWallet = new CredentialWallet(dataStorage, statusRegistry);
const idWallet = new IdentityWallet(kms, dataStorage, credentialWallet);
// ------------------------------------------------

// -------- Generate DID using provided PK --------
async function createEthDID(privateKey: string) {
  const ethWallet = new Wallet(privateKey, dataStorage.states.getRpcProvider());
  const seed = Buffer.from(ethWallet.privateKey.replace(/^0x/, ""), "hex");

  const { did } = await idWallet.createEthereumBasedIdentity({
    method: DidMethod.Iden3,
    blockchain: Blockchain.Polygon,
    networkId: NetworkId.Amoy,
    seed,
    ethSigner: ethWallet,
    revocationOpts: {    import { Wallet, ethers } from "ethers";
    import bs58 from "bs58";
    import crc from "crc";
    import dotenv from "dotenv";
    
    dotenv.config();
    
    // -------------------- CONFIG --------------------
    const RPC_URL = "https://rpc-amoy.polygon.technology";
    const CHAIN_ID = 80002;
    const IDENTITY_REGISTRY = "0xF663447E650A3bcdc041A4dD00c2cD88a1B19bB6";
    
    const DOMAIN = {
      name: 'AgentRegistry',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: IDENTITY_REGISTRY
    };
    
    const TYPES = {
      ForwardRequest: [
        { name: 'agent', type: 'address' },
        { name: 'did', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'serviceEndpoint', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' }
      ]
    };
    
    interface ForwardRequest {
      agent: string;
      did: string;
      description: string;
      serviceEndpoint: string;
      nonce: number;
      expiry: number;
    }
    
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
        "function nonces(address) view returns (uint256)"
      ];
      
      const registry = new ethers.Contract(IDENTITY_REGISTRY, abi, forwarder);
    
      // Get current nonce
      const nonce = await registry.nonces(agent.address);
      
      // Prepare request
      const request: ForwardRequest = {
        agent: agent.address,
        did: did,
        description: description,
        serviceEndpoint: `https://api.example.com/agent/${agent.address}`,
        nonce: nonce,
        expiry: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      };
    
      // Get signature from agent
      const signature = await agent.signTypedData(DOMAIN, TYPES, request);
      
      // Registration fee
      const registrationFee = ethers.parseEther("0.01");
    
      // Submit transaction by forwarder
      const tx = await registry.registerAgentWithSig(request, signature, {
        value: registrationFee
      });
    
      console.log("⏳ Tx sent:", tx.hash);
      console.log("💰 Registration fee:", ethers.formatEther(registrationFee), "ETH");
    
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
    
    // Run section
    (async () => {
      try {
        const FORWARDER_KEY = process.env.FORWARDER_KEY;
        const AGENT_KEY = process.env.AGENT_KEY;
        const DESCRIPTION = process.env.AGENT_DESCRIPTION || "Trustless agent";
    
        if (!FORWARDER_KEY) throw new Error("Missing FORWARDER_KEY in .env");
        if (!AGENT_KEY) throw new Error("Missing AGENT_KEY in .env");
    
        await registerAgentWithSig(
          FORWARDER_KEY.startsWith("0x") ? FORWARDER_KEY : `0x${FORWARDER_KEY}`,
          AGENT_KEY.startsWith("0x") ? AGENT_KEY : `0x${AGENT_KEY}`,
          DESCRIPTION
        );
      } catch (err: any) {
        console.error("❌ Error:", err.message);
      }
    })();
      id: "https://rhs-staging.polygonid.me",
      type: CredentialStatusType.SparseMerkleTreeProof,
    },
  });

  return { did: did.string(), address: ethWallet.address, signer: ethWallet };
}
// ------------------------------------------------

// ---------- Register Agent on Smart Contract -----

// Update the register agent function
async function registerAgent(privateKey: string, description: string) {
  const { did, address, signer } = await createEthDID(privateKey);

  console.log("✅ DID generated:", did);
  console.log("✅ Agent address:", address);
  const abi = [
    "function registerAgent(string did, string description, string serviceEndpoint) external payable",
  ];
  const registry = new ethers.Contract(IDENTITY_REGISTRY, abi, signer);

  // Registration fee of 0.01 ETH
  const registrationFee = ethers.parseEther("0.01");

  // Dummy service endpoint - replace with actual endpoint in production
  const serviceEndpoint = "https://api.example.com/agent/";

  const tx = await registry.registerAgent(did, description, serviceEndpoint, {
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
  console.log("✅ Service Endpoint:", serviceEndpoint);
}

// ------------------------------------------------

// ------------------- RUN ------------------------
(async () => {
  try {
    const PRIVATE_KEY = process.env.PRIVATE_KEY; // must have balance
    const DESCRIPTION = process.env.AGENT_DESCRIPTION || "Trustless agent";

    if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");
    if (!IDENTITY_REGISTRY)
      throw new Error("Missing IDENTITY_REGISTRY in .env");

    await registerAgent(
      PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`,
      DESCRIPTION
    );
  } catch (err: any) {
    console.error("❌ Error:", err.message);
  }
})();
