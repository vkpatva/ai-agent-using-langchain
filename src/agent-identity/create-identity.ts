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

    // Use the field element for hashing
    const seedHex = poseidon.hash([fieldElement]).toString(16);
    const seed = Buffer.from(seedHex.padStart(64, "0"), "hex");

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

export default createIdentityFromPrivateKey;
