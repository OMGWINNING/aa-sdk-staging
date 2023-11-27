import { concatHex, type Address, type Hash, type Transport } from "viem";
import { z } from "zod";
import type { SupportedTransports } from "../../client/types";
import type { ISmartAccountProvider } from "../../provider/types";
import type { SmartAccountSigner } from "../../signer/types";
import type { BatchUserOperationCallData } from "../../types";
import { BaseSmartContractAccount } from "../base.js";
import type {
  BaseSmartAccountParams,
  ISmartContractAccount,
  SignTypedDataParams,
} from "../types";

export type Executor = (
  account: ISmartContractAccount
) => Pick<ISmartContractAccount, "encodeBatchExecute" | "encodeExecute">;

export type AccountSigner = (
  account: ISmartContractAccount
) => Pick<
  ISmartContractAccount,
  | "signMessage"
  | "signTypedData"
  | "signUserOperationHash"
  | "getDummySignature"
  | "getOwner"
>;

export type Factory = (account: ISmartContractAccount) => {
  factoryAddress: Address;
  encodeFactoryCallData: () => Promise<Hash>;
};

export type Decorators<
  R,
  TTransport extends SupportedTransports = Transport
> = (
  account: ISmartContractAccount
) => (provider: ISmartAccountProvider<TTransport>) => R;

export interface ICustomSmartContractAccount<
  D = {},
  TTransport extends SupportedTransports = Transport
> extends ISmartContractAccount<TTransport> {
  providerDecorators: ReturnType<Decorators<D>>;
  extend: <R>(extendFn: (self: this) => R) => this & R;
}

const zCompleteBuilder = z.object({
  executor: z.custom<Executor>(),
  signer: z.custom<AccountSigner>(),
  factory: z.custom<Factory>(),
});

export class SmartAccountBuilder<D = {}> {
  executor?: Executor;
  signer?: AccountSigner;
  factory?: Factory;
  decorators: Decorators<D> = () => () => ({} as D);

  withExecutor(executor: Executor): this & { executor: Executor } {
    return Object.assign(this, { executor });
  }

  withSigner(signer: AccountSigner): this & { signer: AccountSigner } {
    return Object.assign(this, { signer });
  }

  withFactory(factory: Factory): this & { factory: Factory } {
    return Object.assign(this, { factory });
  }

  withDecorators<R>(
    decorators: Decorators<R>
  ): SmartAccountBuilder<R> & Omit<this, "decorators"> {
    return Object.assign(this, {
      decorators,
    }) as unknown as SmartAccountBuilder<R> & Omit<this, "decorators">;
  }

  build<TTransport extends SupportedTransports = Transport>(
    // TODO: we no longer need the owner param here because it is a part of the Signer in the builder
    params: BaseSmartAccountParams
  ): ICustomSmartContractAccount<D, TTransport> {
    const builder = this;
    const { signer, executor, factory } = zCompleteBuilder.parse(builder);
    const decorators = builder.decorators;

    return new (class CustomSmartContractAccount extends BaseSmartContractAccount<TTransport> {
      providerDecorators = decorators(this);

      getDummySignature = (): `0x${string}` => {
        return signer(this).getDummySignature();
      };

      encodeExecute = (
        target: string,
        value: bigint,
        data: string
      ): Promise<`0x${string}`> => {
        return executor(this).encodeExecute(target, value, data);
      };

      encodeBatchExecute = (
        txs: BatchUserOperationCallData
      ): Promise<`0x${string}`> => {
        return executor(this).encodeBatchExecute(txs);
      };

      signMessage = (msg: string | Uint8Array): Promise<`0x${string}`> => {
        return signer(this).signMessage(msg);
      };

      signTypedData = (params: SignTypedDataParams): Promise<`0x${string}`> => {
        return signer(this).signTypedData(params);
      };

      signUserOperationHash = (
        uoHash: `0x${string}`
      ): Promise<`0x${string}`> => {
        return signer(this).signUserOperationHash(uoHash);
      };

      getOwner = (): SmartAccountSigner | undefined => {
        return signer(this).getOwner();
      };

      protected getAccountInitCode = async (): Promise<`0x${string}`> => {
        const { encodeFactoryCallData, factoryAddress } = factory(this);

        return concatHex([factoryAddress, await encodeFactoryCallData()]);
      };

      extend = <R>(fn: (self: this) => R): this & R => {
        const extended = fn(this) as any;
        // this should make it so extensions can't overwrite the base methods
        for (const key in this) {
          delete extended[key];
        }

        return Object.assign(this, extended);
      };
    })(params);
  }
}
