import {
  SimpleSmartContractAccount,
  SmartAccountProvider,
  type SignTypedDataParams,
  type SmartAccountSigner,
} from "@alchemy/aa-core";
import {
  concatHex,
  decodeFunctionResult,
  encodeFunctionData,
  fromHex,
  trim,
  type Address,
  type FallbackTransport,
  type Hash,
  type Hex,
  type Transport,
} from "viem";
import type { IMSCA } from "../msca/builder.js";
import { createMultiOwnerMSCA } from "../msca/multi-owner-account.js";
import { getDefaultMSCAFactoryAddress } from "../msca/utils.js";
import { LightAccountAbi } from "./abis/LightAccountAbi.js";
import { LightAccountFactoryAbi } from "./abis/LightAccountFactoryAbi.js";

export class LightSmartContractAccount<
  TTransport extends Transport | FallbackTransport = Transport
> extends SimpleSmartContractAccount<TTransport> {
  static readonly implementationAddress =
    "0x5467b1947f47d0646704eb801e075e72aeae8113";
  static readonly storageSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  override async signTypedData(params: SignTypedDataParams): Promise<Hash> {
    return this.owner.signTypedData(params);
  }

  /**
   * Returns the on-chain EOA owner address of the account.
   *
   * @returns {Address} the on-chain EOA owner of the account
   */
  async getOwnerAddress(): Promise<Address> {
    const callResult = await this.rpcProvider.call({
      to: await this.getAddress(),
      data: encodeFunctionData({
        abi: LightAccountAbi,
        functionName: "owner",
      }),
    });

    if (callResult.data == null) {
      throw new Error("could not get on-chain owner");
    }

    const decodedCallResult = decodeFunctionResult({
      abi: LightAccountAbi,
      functionName: "owner",
      data: callResult.data,
    });

    if (decodedCallResult !== (await this.owner.getAddress())) {
      throw new Error("on-chain owner does not match account owner");
    }

    return decodedCallResult;
  }

  /**
   * Upgrades the account implementation from Light Account to a Modular Account.
   * Optionally waits for the transaction to be mined.
   *
   * @param provider - the provider to use to send the transaction
   * @param accountImplAddress - the address of the smart account implementation to
   * upgrade to
   * @param initializationData - the initialization data address to use when upgrading to the new
   * smart account
   * @param waitForTxn - whether or not to wait for the transaction to be mined
   * @returns {
   *  provider: SmartAccountProvider<TTransport> & { account: MSCA };
   *  hash: Hash;
   * } - the upgraded provider and corresponding userOperation hash,
   * or transaction hash if `waitForTxn` is true
   */
  static async upgrade<
    TTransport extends Transport | FallbackTransport = Transport
  >(
    provider: SmartAccountProvider<TTransport> & {
      account: LightSmartContractAccount<TTransport>;
    },
    accountImplAddress: Address,
    initializationData: Hex,
    waitForTxn: boolean = false
  ): Promise<{
    provider: SmartAccountProvider<TTransport> & {
      account: IMSCA;
    };
    hash: Hash;
  }> {
    const accountAddress = await provider.getAddress();

    const storage = await provider.rpcClient.getStorageAt({
      address: accountAddress,
      slot: LightSmartContractAccount.storageSlot,
    });

    if (storage == null) {
      throw new Error("could not get storage");
    }

    // only upgrade undeployed accounts (storage 0) or deployed light accounts, error otherwise
    if (
      fromHex(storage, "number") !== 0 &&
      trim(storage) !== LightSmartContractAccount.implementationAddress
    ) {
      throw new Error(
        "could not determine if smart account implementation is light account"
      );
    }

    const encodeUpgradeData = encodeFunctionData({
      abi: LightAccountAbi,
      functionName: "upgradeToAndCall",
      args: [accountImplAddress, initializationData],
    });

    const result = await provider.sendUserOperation({
      target: accountAddress,
      data: encodeUpgradeData,
    });

    let hash = result.hash;
    if (waitForTxn) {
      hash = await provider.waitForUserOperationTransaction(result.hash);
    }

    const owner = provider.account.getOwner();
    if (owner == null) {
      throw new Error("could not get owner");
    }

    return {
      provider: provider.connect((rpcClient) =>
        createMultiOwnerMSCA({
          rpcClient,
          factoryAddress: getDefaultMSCAFactoryAddress(provider.chain),
          owner,
          index: 0n,
          chain: provider.chain,
          accountAddress,
        })
      ),
      hash,
    };
  }

  /**
   * Encodes the transferOwnership function call using Light Account ABI.
   *
   * @param newOwner - the new owner of the account
   * @returns {Hex} the encoded function call
   */
  static encodeTransferOwnership(newOwner: Address): Hex {
    return encodeFunctionData({
      abi: LightAccountAbi,
      functionName: "transferOwnership",
      args: [newOwner],
    });
  }

  /**
   * Transfers ownership of the account to the newOwner on-chain and also updates the owner of the account.
   * Optionally waits for the transaction to be mined.
   *
   * @param provider - the provider to use to send the transaction
   * @param newOwner - the new owner of the account
   * @param waitForTxn - whether or not to wait for the transaction to be mined
   * @returns {Hash} the userOperation hash, or transaction hash if `waitForTxn` is true
   */
  static async transferOwnership<
    TTransport extends Transport | FallbackTransport = Transport
  >(
    provider: SmartAccountProvider<TTransport> & {
      account: LightSmartContractAccount<TTransport>;
    },
    newOwner: SmartAccountSigner,
    waitForTxn: boolean = false
  ): Promise<Hash> {
    const data = this.encodeTransferOwnership(await newOwner.getAddress());
    const result = await provider.sendUserOperation({
      target: await provider.getAddress(),
      data,
    });

    provider.account.owner = newOwner;

    if (waitForTxn) {
      return provider.waitForUserOperationTransaction(result.hash);
    }

    return result.hash;
  }

  protected override async getAccountInitCode(): Promise<`0x${string}`> {
    return concatHex([
      this.factoryAddress,
      encodeFunctionData({
        abi: LightAccountFactoryAbi,
        functionName: "createAccount",
        // light account does not support sub-accounts
        args: [await this.owner.getAddress(), 0n],
      }),
    ]);
  }
}
