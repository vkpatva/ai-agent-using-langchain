import {
  BjjProvider,
  core,
  CredentialStatusResolverRegistry,
  CredentialStatusType,
  CredentialStorage,
  CredentialWallet,
  defaultEthConnectionConfig,
  EthStateStorage,
  Identity,
  IdentityCreationOptions,
  IdentityStorage,
  IdentityWallet,
  InMemoryDataSource,
  InMemoryMerkleTreeStorage,
  InMemoryPrivateKeyStore,
  IssuerResolver,
  KMS,
  KmsKeyType,
  Profile,
  RHSResolver,
  W3CCredential,
} from "@0xpolygonid/js-sdk";
import { poseidon } from "@iden3/js-crypto";
import { Blockchain, DidMethod, NetworkId } from "@iden3/js-iden3-core";
import { ethers, SigningKey, Wallet } from "ethers";
import identityRegistryABI from "../contracts/IndentityRegistry.json";
const createIdentityFromPrivateKey = async () => {
  try {
    const ethPrivateKey = process.env.PRIVATE_KEY;
    if (!ethPrivateKey) {
      throw new Error("Private key not found in environment variables");
    }

    // Remove '0x' prefix if present and ensure it's a valid hex string
    const cleanPrivateKey = ethPrivateKey.replace("0x", "");

    // Ensure the private key is within the valid field range
    const MAX_FIELD = BigInt(
      "21888242871839275222246405745257275088548364400416034343698204186575808495617"
    );

    const privateKeyBigInt = BigInt("0x" + cleanPrivateKey);
    const fieldElement = privateKeyBigInt % MAX_FIELD;

    console.log(fieldElement, " ", cleanPrivateKey);
    // Use the field element for hashing
    const seedHex = poseidon.hash([fieldElement]).toString(16);
    const seed = Buffer.from(seedHex.padStart(64, "0"), "hex");

    // const seedHex = poseidon.hash([BigInt(`0x${ethPrivateKey}`)]).toString(16);
    // const seed = Buffer.from(seedHex.padStart(64, "0"), "hex");
    const dataStorage = {
      credential: new CredentialStorage(
        new InMemoryDataSource<W3CCredential>()
      ),
      identity: new IdentityStorage(
        new InMemoryDataSource<Identity>(),
        new InMemoryDataSource<Profile>()
      ),
      mt: new InMemoryMerkleTreeStorage(40),
      states: new EthStateStorage({
        ...defaultEthConnectionConfig,
        url: "https://rpc-amoy.polygon.technology",
        chainId: 80002,
        contractAddress: "0x134B1BE34911E39A8397ec6289782989729807a4",
      }),
    };

    const kms = new KMS();

    const memoryKeyStore = new InMemoryPrivateKeyStore();
    const bjjProvider = new BjjProvider(KmsKeyType.BabyJubJub, memoryKeyStore);
    kms.registerKeyProvider(KmsKeyType.BabyJubJub, bjjProvider);

    // 4. Setup credential wallet
    const statusRegistry = new CredentialStatusResolverRegistry();
    statusRegistry.register(
      CredentialStatusType.SparseMerkleTreeProof,
      new IssuerResolver()
    );
    statusRegistry.register(
      CredentialStatusType.Iden3ReverseSparseMerkleTreeProof,
      new RHSResolver(dataStorage.states)
    );
    const credentialWallet = new CredentialWallet(dataStorage, statusRegistry);

    // 5. Create identity wallet
    const identityWallet = new IdentityWallet(
      kms,
      dataStorage,
      credentialWallet
    );

    // 6. Create DID with seed
    const createIdentityOptions = {
      method: core.DidMethod.Iden3,
      blockchain: core.Blockchain.Polygon,
      networkId: core.NetworkId.Amoy,
      revocationOpts: {
        id: "https://rhs-staging.polygonid.me",
        type: CredentialStatusType.SparseMerkleTreeProof,
        nonce: 0,
      },
      seed,
    };

    const { did, credential } = await identityWallet.createIdentity(
      createIdentityOptions
    );
    console.log(JSON.stringify(credential));
    await registerOrGetAgent(did.string(), ethPrivateKey);
    return {
      did: did,
      credential,
      credentialWallet,
    };
  } catch (err) {
    console.log("error : ", err);
    throw new Error("error");
  }
};

const registerOrGetAgent = async (did: string, privateKey: string) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(
      "0xe6Aff42bBBAa8bBC4B43011fe7DBBbe0F7C4F40c",
      identityRegistryABI.abi,
      wallet
    );
    const publicKey = wallet.address;
    console.log("wallet key", publicKey, "did", did);

    // Check if DID exists
    let existingAgent;
    try {
      existingAgent = await contract.resolveByDID(did);
      console.log("existing agent response", existingAgent);
    } catch (error: any) {
      if (error.reason.includes("DIDNotRegistered")) {
        existingAgent = { domain: "" };
      } else {
        throw error;
      }
    }
    if (existingAgent.domain === "") {
      // DID doesn't exist, register new agent
      const domain = `agent-${Math.random().toString(36).substring(7)}`;

      const description = "Can analyse Resume";

      const tx = await contract.newAgent(domain, did, publicKey, description);
      await tx.wait();

      return {
        did,
        domain,
        publicKey,
        description,
      };
    } else {
      console.log("agent exist", existingAgent);
      // Return existing agent info
      return existingAgent;
    }
  } catch (error) {
    console.error("Error in registerOrGetAgent:", error);
    throw error;
  }
};

const createIdentityWithRegistry = async () => {
  const { did, credential, credentialWallet } =
    await createIdentityFromPrivateKey();
  const agentInfo = await registerOrGetAgent(
    did.string(),
    process.env.PRIVATE_KEY!
  );
  return { did, credential, credentialWallet, agentInfo };
};

export default createIdentityFromPrivateKey;
