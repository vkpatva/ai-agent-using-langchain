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
const IDENTITY_REGISTRY =
  process.env.IDENTITY_REGISTRY || "0x4F63A17B23D097E128fBf8187F7AA04f8A4479C3";
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
    revocationOpts: {
      id: "https://rhs-staging.polygonid.me",
      type: CredentialStatusType.SparseMerkleTreeProof,
    },
  });

  return { did: did.string(), address: ethWallet.address, signer: ethWallet };
}
// ------------------------------------------------

// ---------- Register Agent on Smart Contract -----
async function registerAgent(privateKey: string, description: string) {
  const { did, address, signer } = await createEthDID(privateKey);

  console.log("✅ DID generated:", did);
  console.log("✅ Agent address:", address);

  const abi = [
    "function newAgent(string didString, address agent, string description) external",
  ];
  const registry = new ethers.Contract(IDENTITY_REGISTRY, abi, signer);

  const tx = await registry.newAgent(did, address, description);
  console.log("⏳ Tx sent:", tx.hash);

  const receipt = await tx.wait();
  console.log("✅ Agent registered in block:", receipt.blockNumber);
  console.log("✅ Agent DID:", did);
  console.log("✅ Description:", description);
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
