import bs58 from "bs58";

/**
 * Decode Ethereum public key from did:iden3 DID
 * @param didFull - Full DID string, e.g. "did:iden3:polygon:amoy:x6x5sor7zpyT5mmpg4fADaR47NADVbohtww4ppWZF"
 * @returns Ethereum public key (hex) or null if not Ethereum-controlled
 */
function getEthereumPublicKeyFromDID(didFull: string): string | null {
  try {
    // Extract Base58 part
    const parts = didFull.split(":");
    if (parts.length < 5) throw new Error("Invalid DID format");
    const base58Id = parts[4];

    // Decode Base58 to bytes
    const decodedBytes = bs58.decode(base58Id);

    if (decodedBytes.length !== 31) {
      throw new Error("Unexpected decoded length, must be 31 bytes");
    }

    // Split fields according to spec
    const idType = decodedBytes.slice(0, 2); // 2 bytes
    const zeroPadding = decodedBytes.slice(2, 9); // 7 bytes
    const ethBytes = decodedBytes.slice(9, 29); // 20 bytes
    const checksum = decodedBytes.slice(29, 31); // 2 bytes

    // Check if it's Ethereum-controlled DID (zero padding)
    const isEthereumControlled = zeroPadding.every((b) => b === 0);

    if (!isEthereumControlled) {
      console.warn(
        "This DID is NOT Ethereum-controlled, genesis state is non-zero"
      );
      return null;
    }

    // Convert ETH address bytes to hex string
    const ethAddress = "0x" + Buffer.from(ethBytes).toString("hex");
    return ethAddress;
  } catch (err) {
    console.error("Error decoding DID:", err);
    return null;
  }
}

// Example usage
const did = "did:iden3:polygon:amoy:x6x5sor7zpyEpUYYf3M5Um2RCHvEwTw2y5qZRuNik";
const ethPublicKey = getEthereumPublicKeyFromDID(did);
console.log("Ethereum public key:", ethPublicKey);
