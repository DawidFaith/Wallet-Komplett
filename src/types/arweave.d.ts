/**
 * Minimal ambient type declaration for the `arweave` npm package.
 * Needed because arweave has no `exports` field in package.json,
 * which breaks moduleResolution: "bundler" type lookup.
 */
declare module 'arweave' {
  interface ArweaveConfig {
    host: string;
    port: number;
    protocol: string;
  }

  interface ArweaveTransaction {
    id: string;
    addTag(name: string, value: string): void;
  }

  interface ArweaveWallets {
    generate(): Promise<Record<string, string>>;
    jwkToAddress(jwk: Record<string, string>): Promise<string>;
  }

  interface ArweaveTransactions {
    sign(tx: ArweaveTransaction, jwk?: Record<string, string>): Promise<void>;
    post(tx: ArweaveTransaction): Promise<{ status: number; statusText: string; data: unknown }>;
  }

  class Arweave {
    static init(config: ArweaveConfig): Arweave;
    wallets: ArweaveWallets;
    transactions: ArweaveTransactions;
    createTransaction(
      attrs: { data: string | Uint8Array | ArrayBuffer },
      jwk?: Record<string, string>,
    ): Promise<ArweaveTransaction>;
  }

  export = Arweave;
}
