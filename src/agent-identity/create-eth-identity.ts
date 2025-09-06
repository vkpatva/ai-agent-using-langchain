import { Wallet } from "ethers";
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
const dataStorage = {
  credential: new CredentialStorage(new InMemoryDataSource()),
  identity: new IdentityStorage(
    new InMemoryDataSource(),
    new InMemoryDataSource()
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
const secpProvider = new Sec256k1Provider(KmsKeyType.Secp256k1, memoryKeyStore);
kms.registerKeyProvider(KmsKeyType.Secp256k1, secpProvider);

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

async function createEthDID(privateKey: string) {
  try {
    const ethWallet = new Wallet(
      privateKey,
      dataStorage.states.getRpcProvider()
    );

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

    return { did: did.string(), address: ethWallet.address };
  } catch (error) {
    console.error("Error creating Ethereum-controlled DID:", error);
    throw error;
  }
}

// Example usage with multiple revocation strategies
(async () => {
  try {
    console.log("Creating Ethereum-controlled DID...");

    try {
      console.log(process.env.PRIVATE_KEY);
      const { did, address } = await createEthDID(
        `0x${process.env.PRIVATE_KEY}` as string
      );
      console.log("✅ Ethereum-controlled DID (SMT):", did);
      console.log("✅ Ethereum address:", address);
    } catch (smtError: any) {
      console.log("SMT approach failed, trying RHS...");
      console.error("SMT Error:", smtError.message);
    }
  } catch (error: any) {
    console.error("❌ Failed to create DID:", error.message);
  }
})();
