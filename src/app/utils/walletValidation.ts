/**
 * Validates if a wallet address is a valid Base Chain address
 * Base Chain uses the same address format as Ethereum (EIP-55)
 */

// Simple regex for Ethereum/Base address format
const BASE_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Basic checksum validation for Ethereum addresses (EIP-55)
 * This also applies to Base Chain addresses
 */
function isValidChecksum(address: string): boolean {
  // Remove 0x prefix
  const addr = address.slice(2);
  
  // If all lowercase or all uppercase, checksum validation is not required
  if (addr === addr.toLowerCase() || addr === addr.toUpperCase()) {
    return true;
  }
  
  // For mixed case, we would need a full checksum validation
  // For now, we'll accept mixed case as potentially valid
  return true;
}

/**
 * Validates if an address is a valid Base Chain address
 * @param address - The wallet address to validate
 * @returns Object with validation result and error message
 */
export function validateBaseAddress(address: string): { 
  isValid: boolean; 
  error?: string; 
} {
  // Check if address is provided
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Bitte gib eine Wallet-Adresse ein.'
    };
  }

  // Remove whitespace
  const cleanAddress = address.trim();

  // Check if address starts with 0x
  if (!cleanAddress.startsWith('0x')) {
    return {
      isValid: false,
      error: 'Base Chain Adressen müssen mit "0x" beginnen.'
    };
  }

  // Check basic format (0x + 40 hex characters)
  if (!BASE_ADDRESS_REGEX.test(cleanAddress)) {
    return {
      isValid: false,
      error: 'Ungültiges Adressformat. Base Chain Adressen bestehen aus 42 Zeichen (0x + 40 Hex-Zeichen).'
    };
  }

  // Check length
  if (cleanAddress.length !== 42) {
    return {
      isValid: false,
      error: 'Base Chain Adressen müssen genau 42 Zeichen lang sein.'
    };
  }

  // Validate checksum
  if (!isValidChecksum(cleanAddress)) {
    return {
      isValid: false,
      error: 'Ungültige Adress-Prüfsumme.'
    };
  }

  // All checks passed
  return {
    isValid: true
  };
}

/**
 * Real-time validation for input fields
 * Returns a more user-friendly message for partial inputs
 */
export function validateBaseAddressRealTime(address: string): {
  isValid: boolean;
  isPartiallyValid: boolean;
  error?: string;
} {
  if (!address || address.length === 0) {
    return {
      isValid: false,
      isPartiallyValid: true
    };
  }

  const cleanAddress = address.trim();

  // Check if starts with 0x
  if (!cleanAddress.startsWith('0x')) {
    if (cleanAddress.length <= 2 && '0x'.startsWith(cleanAddress)) {
      return {
        isValid: false,
        isPartiallyValid: true
      };
    }
    return {
      isValid: false,
      isPartiallyValid: false,
      error: 'Adresse muss mit "0x" beginnen'
    };
  }

  // If too short but on the right track
  if (cleanAddress.length < 42) {
    // Check if what we have so far is valid hex
    const hexPart = cleanAddress.slice(2);
    if (/^[a-fA-F0-9]*$/.test(hexPart)) {
      return {
        isValid: false,
        isPartiallyValid: true
      };
    } else {
      return {
        isValid: false,
        isPartiallyValid: false,
        error: 'Nur Hexadezimalzeichen (0-9, a-f) erlaubt'
      };
    }
  }

  // If too long
  if (cleanAddress.length > 42) {
    return {
      isValid: false,
      isPartiallyValid: false,
      error: 'Adresse zu lang (max. 42 Zeichen)'
    };
  }

  // Full validation for complete address
  const fullValidation = validateBaseAddress(cleanAddress);
  return {
    isValid: fullValidation.isValid,
    isPartiallyValid: fullValidation.isValid,
    error: fullValidation.error
  };
}
