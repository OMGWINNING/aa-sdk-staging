import type { Address, Hash } from "viem";
import type { z } from "zod";
import type {
  UserOperationFeeOptionsFieldSchema,
  UserOperationFeeOptionsSchema,
} from "./provider/schema";
import type {
  BigNumberishRangeSchema,
  BigNumberishSchema,
  HexSchema,
  PercentageSchema,
} from "./utils";

export type Hex = z.input<typeof HexSchema>;
export type EmptyHex = `0x`;

// based on @account-abstraction/common
export type PromiseOrValue<T> = T | Promise<T>;
export type BytesLike = Uint8Array | Hex;
export type Percentage = z.input<typeof PercentageSchema>;

export type BigNumberish = z.input<typeof BigNumberishSchema>;
export type BigNumberishRange = z.input<typeof BigNumberishRangeSchema>;

export type UserOperationCallData =
  | {
      /* the target of the call */
      target: Address;
      /* the data passed to the target */
      data: Hex;
      /* the amount of native token to send to the target (default: 0) */
      value?: bigint;
    }
  | Hex;

export type BatchUserOperationCallData = Exclude<UserOperationCallData, Hex>[];

export type UserOperationFeeOptionsField = z.input<
  typeof UserOperationFeeOptionsFieldSchema
>;

export type UserOperationFeeOptions = z.input<
  typeof UserOperationFeeOptionsSchema
>;

export type UserOperationOverrides = Partial<{
  callGasLimit: UserOperationStruct["callGasLimit"] | Percentage;
  maxFeePerGas: UserOperationStruct["maxFeePerGas"] | Percentage;
  maxPriorityFeePerGas:
    | UserOperationStruct["maxPriorityFeePerGas"]
    | Percentage;
  preVerificationGas: UserOperationStruct["preVerificationGas"] | Percentage;
  verificationGasLimit:
    | UserOperationStruct["verificationGasLimit"]
    | Percentage;
  paymasterAndData: UserOperationStruct["paymasterAndData"];
}>;

// represents the request as it needs to be formatted for RPC requests
export interface UserOperationRequest {
  /* the origin of the request */
  sender: Address;
  /* nonce (as hex) of the transaction, returned from the entrypoint for this Address */
  nonce: Hex;
  /* the initCode for creating the sender if it does not exist yet, otherwise "0x" */
  initCode: Hex | EmptyHex;
  /* the callData passed to the target */
  callData: Hex;
  /* Gas value (as hex) used by inner account execution */
  callGasLimit: Hex;
  /* Actual gas (as hex) used by the validation of this UserOperation */
  verificationGasLimit: Hex;
  /* Gas overhead (as hex) of this UserOperation */
  preVerificationGas: Hex;
  /* Maximum fee per gas (similar to EIP-1559 max_fee_per_gas) (as hex)*/
  maxFeePerGas: Hex;
  /* Maximum priority fee per gas (similar to EIP-1559 max_priority_fee_per_gas) (as hex)*/
  maxPriorityFeePerGas: Hex;
  /* Address of paymaster sponsoring the transaction, followed by extra data to send to the paymaster ("0x" for self-sponsored transaction) */
  paymasterAndData: Hex | EmptyHex;
  /* Data passed into the account along with the nonce during the verification step */
  signature: Hex;
}

export interface UserOperationEstimateGasResponse {
  /* Gas overhead of this UserOperation */
  preVerificationGas: BigNumberish;
  /* Actual gas used by the validation of this UserOperation */
  verificationGasLimit: BigNumberish;
  /* Value used by inner account execution */
  callGasLimit: BigNumberish;
}

export interface UserOperationResponse {
  /* the User Operation */
  userOperation: UserOperationRequest;
  /* the address of the entry point contract that executed the user operation */
  entryPoint: Address;
  /* the block number the user operation was included in */
  blockNumber: BigNumberish | null;
  /* the hash of the block the user operation was included in */
  blockHash: Hash | null;
  /* the hash of the transaction that included the user operation */
  transactionHash: Hash | null;
}

export interface UserOperationReceipt {
  /* The request hash of the UserOperation. */
  userOpHash: Hash;
  /* The entry point address used for the UserOperation. */
  entryPoint: Address;
  /* The account initiating the UserOperation. */
  sender: Address;
  /* The nonce used in the UserOperation. */
  nonce: BigNumberish;
  /* The paymaster used for this UserOperation (or empty). */
  paymaster?: Address;
  /* The actual amount paid (by account or paymaster) for this UserOperation. */
  actualGasCost: BigNumberish;
  /* The total gas used by this UserOperation (including preVerification, creation, validation, and execution). */
  actualGasUsed: BigNumberish;
  /* Indicates whether the execution completed without reverting. */
  success: boolean;
  /* In case of revert, this is the revert reason. */
  reason?: string;
  /* The logs generated by this UserOperation (not including logs of other UserOperations in the same bundle). */
  logs: string[];
  /* The TransactionReceipt object for the entire bundle, not only for this UserOperation. */
  receipt: UserOperationReceiptObject;
}

export interface UserOperationReceiptObject {
  /* 32 Bytes - hash of the block where this log was in. null when its pending. null when its pending log */
  blockHash: Hash;
  /* The block number where this log was in. null when its pending. null when its pending log. */
  blockNumber: BigNumberish;
  /* The index of the transaction within the block. */
  transactionIndex: BigNumberish;
  /* 32 Bytes - hash of the transaction. null when its pending. */
  transactionHash: Hash;
  /* 20 Bytes - address of the sender */
  from: Address;
  /* 20 Bytes - address of the receiver. null when its a contract creation transaction */
  to: Address;
  /* The total amount of gas used when this transaction was executed in the block. */
  cumulativeGasUsed: BigNumberish;
  /* The amount of gas used by this specific transaction alone */
  gasUsed: BigNumberish;
  /* 20 Bytes - The contract address created, if the transaction was a contract creation, otherwise null */
  contractAddress: Address;
  logs: UserOperationReceiptLog[];
  /* 256 Bytes - Bloom filter for light clients to quickly retrieve related logs */
  logsBloom: Hex;
  /* 32 bytes of post-transaction stateroot. (pre Byzantium hard fork at block 4,370,000) */
  root: Hex;
  /* Either 1 (success) or 0 (failure). (post Byzantium hard fork at block 4,370,000) */
  status: number;
  /* The cumulative gas used in the block containing this UserOperation. */
  effectiveGasPrice: BigNumberish;
  /* The type of the recipt object */
  type: string;
}

export interface UserOperationReceiptLog {
  /* The hash of the block where the given transaction was included. */
  blockHash: Hash;
  /* The number of the block where the given transaction was included. */
  blockNumber: BigNumberish;
  /* The index of the transaction within the block. */
  transactionIndex: BigNumberish;
  /* 20 Bytes - address from which this log originated. */
  address: Address;
  /* Integer of the log index position in the block. null when its pending log. */
  logIndex: BigNumberish;
  /* Contains one or more 32 Bytes non-indexed arguments of the log. */
  data: Hex;
  /* true when the log was removed, due to a chain reorganization. false if its a valid log. */
  removed: boolean;
  /* Array of zero to four 32 Bytes DATA of indexed log arguments. */
  topics: string[];
  /* hash of the transaction */
  transactionHash: Hash;
}

// based on @account-abstraction/common
// this is used for building requests
export interface UserOperationStruct {
  /* the origin of the request */
  sender: string;
  /* nonce of the transaction, returned from the entrypoint for this Address */
  nonce: BigNumberish;
  /* the initCode for creating the sender if it does not exist yet, otherwise "0x" */
  initCode: BytesLike | "0x";
  /* the callData passed to the target */
  callData: BytesLike;
  /* Value used by inner account execution */
  callGasLimit?: BigNumberish;
  /* Actual gas used by the validation of this UserOperation */
  verificationGasLimit?: BigNumberish;
  /* Gas overhead of this UserOperation */
  preVerificationGas?: BigNumberish;
  /* Maximum fee per gas (similar to EIP-1559 max_fee_per_gas) */
  maxFeePerGas?: BigNumberish;
  /* Maximum priority fee per gas (similar to EIP-1559 max_priority_fee_per_gas) */
  maxPriorityFeePerGas?: BigNumberish;
  /* Address of paymaster sponsoring the transaction, followed by extra data to send to the paymaster ("0x" for self-sponsored transaction) */
  paymasterAndData: BytesLike | "0x";
  /* Data passed into the account along with the nonce during the verification step */
  signature: BytesLike;
}
