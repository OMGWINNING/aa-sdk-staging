import type { Anvil } from "@viem/anvil";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

export type Rundler = {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  anvil: Anvil;
  readonly port: number;
  readonly host: string;
};

const __filename = fileURLToPath(import.meta.url);
const fileParts = __filename.split(path.sep);
fileParts.pop();
fileParts.pop();

export const RundlerOptionsSchema = z.object({
  rpc: z
    .object({
      port: z.number().default(3000),
      host: z.string().default("0.0.0.0"),
    })
    .default({}),
  entry_points: z
    .array(z.string())
    .default(["0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"]),
  chain_id: z.number().default(1337),
  max_verification_gas: z.number().default(10000000),
  node_http: z.string().default("http://localhost:8545"),
  builder: z
    .object({
      private_key: z
        .string()
        .default(
          "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
        ),
    })
    .default({}),
});

export const RundlerCreationOptionsSchema = z
  .object({
    binaryPath: z.string().default(fileParts.join(path.sep) + "/rundler"),
  })
  .and(RundlerOptionsSchema);

export type RundlerCreationOptions = z.input<
  typeof RundlerCreationOptionsSchema
>;

export type RundlerOptions = z.input<typeof RundlerOptionsSchema>;
