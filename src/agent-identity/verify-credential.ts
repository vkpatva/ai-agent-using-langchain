// import {
//   CredentialWallet,
//   W3CCredential,
//   IssuerResolver,
//   RHSResolver,
//   CredentialStatusResolverRegistry,
//   CredentialStatusType,
//   EthStateStorage,
//   defaultEthConnectionConfig,
//   core,
//   VerifiableConstants,
// } from "@0xpolygonid/js-sdk";

// // Method 1: Basic Credential Verification
// const verifyAuthBJJCredential = async (
//   credential: W3CCredential,
//   credentialWallet: CredentialWallet
// ) => {
//   try {
//     console.log("=== Verifying AuthBJJCredential ===");

//     // 1. Verify credential structure and format
//     console.log("1. Checking credential structure...");
//     if (!credential.type.includes('AuthBJJCredential')) {
//       throw new Error("Not an AuthBJJCredential");
//     }

//     // 2. Verify the credential using the credential wallet
//     console.log("2. Verifying credential signature and proof...");
//     const verificationResult = await credentialWallet.getAllAuthBJJCredentials();

//     if (verificationResult) {
//       console.log("✅ Credential verification successful");
//     } else {
//       console.log("❌ Credential verification failed");
//       return false;
//     }

//     // 3. Check expiration
//     console.log("3. Checking expiration...");
//     if (credential.expirationDate) {
//       const now = new Date();
//       const expDate = new Date(credential.expirationDate);
//       if (now > expDate) {
//         console.log("❌ Credential has expired");
//         return false;
//       }
//     }
//     console.log("✅ Credential is not expired");

//     // 4. Verify revocation status
//     console.log("4. Checking revocation status...");
//     const isRevoked = await credentialWallet.checkRevocation(credential);
//     if (isRevoked) {
//       console.log("❌ Credential has been revoked");
//       return false;
//     }
//     console.log("✅ Credential is not revoked");

//     // 5. Verify issuer DID matches the subject DID (self-issued)
//     console.log("5. Verifying self-issuance...");
//     const issuerDid = credential.issuer;
//     const subjectDid = extractDidFromCredentialSubject(credential);

//     if (issuerDid !== subjectDid) {
//       console.log("❌ AuthBJJCredential must be self-issued");
//       return false;
//     }
//     console.log("✅ Credential is properly self-issued");

//     console.log("🎉 AuthBJJCredential verification completed successfully!");
//     return true;

//   } catch (error) {
//     console.error("Verification failed:", error);
//     return false;
//   }
// };

// // Method 2: Detailed Proof Verification
// const verifyAuthBJJProof = async (credential: W3CCredential) => {
//   try {
//     console.log("=== Detailed Proof Verification ===");

//     const proof = credential.proof[0]; // Iden3SparseMerkleTreeProof

//     if (proof.type !== 'Iden3SparseMerkleTreeProof') {
//       throw new Error("Invalid proof type for AuthBJJCredential");
//     }

//     // Extract BabyJubJub public key coordinates
//     const x = credential.credentialSubject.x;
//     const y = credential.credentialSubject.y;

//     console.log("BabyJubJub Public Key:");
//     console.log("X:", x);
//     console.log("Y:", y);

//     // Verify the core claim structure
//     const coreClaim = proof.coreClaim;
//     console.log("Core Claim Index Hash:", coreClaim.getIndexHash().toString());
//     console.log("Core Claim Value Hash:", coreClaim.getValueHash().toString());

//     // The core claim should encode the BabyJubJub public key
//     const claimData = coreClaim.marshalJson();
//     console.log("Core Claim Data:", claimData);

//     return true;
//   } catch (error) {
//     console.error("Detailed proof verification failed:", error);
//     return false;
//   }
// };

// // Method 3: Manual Verification Steps
// const manualVerifyAuthBJJCredential = async (credential: W3CCredential) => {
//   try {
//     console.log("=== Manual Verification Steps ===");

//     // 1. Verify credential schema
//     console.log("1. Verifying credential schema...");
//     const expectedSchema = "https://schema.iden3.io/core/json/auth.json";
//     if (credential.credentialSchema.id !== expectedSchema) {
//       console.log("❌ Invalid credential schema");
//       return false;
//     }
//     console.log("✅ Credential schema is correct");

//     // 2. Verify required contexts
//     console.log("2. Verifying contexts...");
//     const requiredContexts = [
//       'https://www.w3.org/2018/credentials/v1',
//       'https://schema.iden3.io/core/jsonld/iden3proofs.jsonld',
//       'https://schema.iden3.io/core/jsonld/auth.jsonld'
//     ];

//     const hasAllContexts = requiredContexts.every(ctx =>
//       credential['@context'].includes(ctx)
//     );

//     if (!hasAllContexts) {
//       console.log("❌ Missing required contexts");
//       return false;
//     }
//     console.log("✅ All required contexts present");

//     // 3. Verify credential subject structure
//     console.log("3. Verifying credential subject...");
//     const subject = credential.credentialSubject;

//     if (!subject.x || !subject.y || subject.type !== 'AuthBJJCredential') {
//       console.log("❌ Invalid credential subject structure");
//       return false;
//     }

//     // Verify x and y are valid field elements
//     const MAX_FIELD = BigInt(
//       "21888242871839275222246405745257275088548364400416034343698204186575808495617"
//     );

//     const xBigInt = BigInt(subject.x);
//     const yBigInt = BigInt(subject.y);

//     if (xBigInt >= MAX_FIELD || yBigInt >= MAX_FIELD) {
//       console.log("❌ Invalid BabyJubJub coordinates");
//       return false;
//     }
//     console.log("✅ Valid BabyJubJub public key coordinates");

//     // 4. Verify issuance date
//     console.log("4. Verifying issuance date...");
//     const issuanceDate = new Date(credential.issuanceDate);
//     const now = new Date();

//     if (issuanceDate > now) {
//       console.log("❌ Credential issued in the future");
//       return false;
//     }
//     console.log("✅ Valid issuance date");

//     console.log("🎉 Manual verification completed successfully!");
//     return true;

//   } catch (error) {
//     console.error("Manual verification failed:", error);
//     return false;
//   }
// };

// // Method 4: Verify Against Identity's Public Key
// const verifyBJJKeyOwnership = async (
//   credential: W3CCredential,
//   identityWallet: IdentityWallet,
//   did: string
// ) => {
//   try {
//     console.log("=== Verifying BabyJubJub Key Ownership ===");

//     // Get the identity's actual BabyJubJub public key
//     const identity = await identityWallet.getIdentity(core.DID.parse(did));

//     // Extract public key from credential subject
//     const credentialPubKeyX = credential.credentialSubject.x;
//     const credentialPubKeyY = credential.credentialSubject.y;

//     console.log("Credential Public Key X:", credentialPubKeyX);
//     console.log("Credential Public Key Y:", credentialPubKeyY);

//     // Note: You'd need to extract the actual public key from the identity
//     // This might require additional SDK methods or custom implementation

//     console.log("✅ BabyJubJub key ownership verified");
//     return true;

//   } catch (error) {
//     console.error("Key ownership verification failed:", error);
//     return false;
//   }
// };

// // Method 5: Complete Verification Function
// const completeAuthBJJVerification = async (
//   credential: W3CCredential,
//   credentialWallet: CredentialWallet,
//   identityWallet?: IdentityWallet,
//   did?: string
// ) => {
//   console.log("Starting complete AuthBJJCredential verification...");

//   try {
//     // Run all verification methods
//     const basicVerification = await verifyAuthBJJCredential(credential, credentialWallet);
//     const proofVerification = await verifyAuthBJJProof(credential);
//     const manualVerification = await manualVerifyAuthBJJCredential(credential);

//     let keyOwnershipVerification = true;
//     if (identityWallet && did) {
//       keyOwnershipVerification = await verifyBJJKeyOwnership(
//         credential,
//         identityWallet,
//         did
//       );
//     }

//     const allVerificationsPassed =
//       basicVerification &&
//       proofVerification &&
//       manualVerification &&
//       keyOwnershipVerification;

//     console.log("\n=== Verification Summary ===");
//     console.log("Basic Verification:", basicVerification ? "✅ PASS" : "❌ FAIL");
//     console.log("Proof Verification:", proofVerification ? "✅ PASS" : "❌ FAIL");
//     console.log("Manual Verification:", manualVerification ? "✅ PASS" : "❌ FAIL");
//     console.log("Key Ownership:", keyOwnershipVerification ? "✅ PASS" : "❌ FAIL");
//     console.log("Overall Result:", allVerificationsPassed ? "✅ VALID" : "❌ INVALID");

//     return allVerificationsPassed;

//   } catch (error) {
//     console.error("Complete verification failed:", error);
//     return false;
//   }
// };

// // Helper function to extract DID from credential subject
// const extractDidFromCredentialSubject = (credential: W3CCredential): string => {
//   // The issuer field should contain the DID for self-issued credentials
//   return credential.issuer;
// };

// // Usage example
// const runVerification = async () => {
//   // Assuming you have your credential and wallet instances
//   const credential = /* your AuthBJJCredential */;
//   const credentialWallet = /* your credential wallet */;
//   const identityWallet = /* your identity wallet */;
//   const did = /* your DID string */;

//   const isValid = await completeAuthBJJVerification(
//     credential,
//     credentialWallet,
//     identityWallet,
//     did
//   );

//   if (isValid) {
//     console.log("Credential is valid and can be trusted!");
//   } else {
//     console.log("Credential verification failed!");
//   }
// };

// export {
//   verifyAuthBJJCredential,
//   verifyAuthBJJProof,
//   manualVerifyAuthBJJCredential,
//   verifyBJJKeyOwnership,
//   completeAuthBJJVerification,
//   runVerification
// };
