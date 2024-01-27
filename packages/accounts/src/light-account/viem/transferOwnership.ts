import type { SmartAccountSigner } from "@alchemy/aa-core";
import type {
  GetAccountParameter,
  SmartAccountClient,
} from "@alchemy/aa-core/viem";
import type { Chain, Hex, Transport } from "viem";
import type { LightAccount } from "./account";

export const transferOwnership: <
  TTransport extends Transport = Transport,
  TChain extends Chain | undefined = Chain | undefined,
  TOwner extends SmartAccountSigner = SmartAccountSigner,
  TAccount extends LightAccount<TOwner> | undefined =
    | LightAccount<TOwner>
    | undefined
>(
  client: SmartAccountClient<TTransport, TChain, TAccount>,
  args: {
    newOwner: TOwner;
    waitForTxn?: boolean;
  } & GetAccountParameter<TAccount>
) => Promise<Hex> = async (
  client,
  { newOwner, waitForTxn = false, account: account_ = client.account }
): Promise<Hex> => {
  if (!account_) {
    throw new Error("Account is not defined");
  }

  const account = account_ as LightAccount;

  const data = account.encodeTransferOwnership(await newOwner.getAddress());
  const result = await client.sendUserOperation({
    target: account.address,
    data,
    account,
  });

  if (waitForTxn) {
    return client.waitForUserOperationTransaction(result);
  }

  return result.hash;
};