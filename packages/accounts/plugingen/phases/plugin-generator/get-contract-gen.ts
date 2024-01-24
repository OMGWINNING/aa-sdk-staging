import dedent from "dedent";
import type { Phase } from "../../types";

export const GetContractGenPhase: Phase = async (input) => {
  const { content, contract, addImport } = input;

  addImport("viem", { name: "getContract", isType: false });
  addImport("viem", { name: "GetContractReturnType", isType: true });
  addImport("viem", { name: "Address", isType: true });
  addImport("viem", { name: "PublicClient", isType: true });
  addImport("viem", { name: "Transport", isType: true });
  addImport("viem", { name: "Chain", isType: true });
  content.push(dedent`
  getContract: <P extends PublicClient<Transport, Chain>>(
    provider: P,
    address?: Address
  ): GetContractReturnType<typeof ${contract.name}Abi, P, undefined, Address> =>
    getContract({
      address: address || addresses[provider.chain.id],
      abi: ${contract.name}Abi,
      publicClient: provider,
    })
  `);

  return input;
};
