import bs58 from "bs58";
import crc from "crc";

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

// Example usage
const ethAddr = "0xc3C1E99B2aee35e1E7D3eBF810976aa6d595ea54";
const did = generatePrivadoDID(ethAddr, "polygon", "amoy");
console.log("Generated DID:", did);
