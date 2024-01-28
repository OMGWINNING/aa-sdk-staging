import { createRundler } from "@alch/rundler-js";
import { createPublicClient, custom, http, type Address } from "viem";
import { sepolia, type Chain } from "viem/chains";
import { describe, it } from "vitest";
import { createPublicErc4337FromClient } from "../../client/publicErc4337Client.js";
import { createSmartAccountClient } from "../../client/smartAccountClient.js";
import { LocalAccountSigner } from "../../signer/local-account.js";
import { type SmartAccountSigner } from "../../signer/types.js";
import type { BatchUserOperationCallData } from "../../types.js";
import { getDefaultSimpleAccountFactoryAddress } from "../../utils/index.js";
import { createSimpleSmartAccount } from "../simple.js";

describe("Account Simple Tests", async () => {
  const chain = sepolia;
  const dummyMnemonic =
    "test test test test test test test test test test test test";
  const owner: SmartAccountSigner =
    LocalAccountSigner.mnemonicToAccountSigner(dummyMnemonic);
  const rundler = createRundler({
    anvilOptions: {
      forkUrl: "https://cloudflare-eth.com",
      forkChainId: chain.id,
      forkBlockNumber: 5173732n,
      chainId: chain.id,
      noMining: true,
      startTimeout: 20_000,
    },
    rundlerOptions: {
      chain_id: chain.id,
    },
  });
  beforeAll(async () => {
    await rundler.start();
    // TODO: remove this, just testing to see if anvil startup cost
    // is a one time thing
  }, 60000);

  afterEach(async (context) => {
    context.onTestFailed(async () => {
      // If a test fails, you can fetch and print the logs of your anvil instance.
      const logs = rundler.anvil.logs;
      // Only print the 20 most recent log messages.
      console.log(...logs.slice(-20));
    });
  });

  afterAll(async () => {
    await rundler.stop();
  });

  const publicClient = createPublicErc4337FromClient(
    createPublicClient({
      chain,
      transport: (opts) => {
        const bundlerRpc = http(`http://${rundler.host}:${rundler.port}`)(opts);
        const publicRpc = http(
          `http://${rundler.anvil.host}:${rundler.anvil.port}`
        )(opts);

        return custom({
          request: async (args) => {
            const bundlerMethods = new Set([
              "eth_sendUserOperation",
              "eth_estimateUserOperationGas",
              "eth_getUserOperationReceipt",
              "eth_getUserOperationByHash",
              "eth_supportedEntryPoints",
            ]);

            if (bundlerMethods.has(args.method)) {
              return bundlerRpc.request(args);
            } else {
              return publicRpc.request(args);
            }
          },
        })(opts);
      },
    })
  );

  it("should correctly sign the message", async () => {
    const provider = await givenConnectedProvider({ owner, chain });
    expect(
      await provider.account.signMessage({
        message: {
          raw: "0xa70d0af2ebb03a44dcd0714a8724f622e3ab876d0aa312f0ee04823285d6fb1b",
        },
      })
    ).toBe(
      "0x33b1b0d34ba3252cd8abac8147dc08a6e14a6319462456a34468dd5713e38dda3a43988460011af94b30fa3efefcf9d0da7d7522e06b7bd8bff3b65be4aee5b31c"
    );
  });

  it("should correctly encode batch transaction data", async () => {
    const provider = await givenConnectedProvider({ owner, chain });
    const data = [
      {
        target: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        data: "0xdeadbeef",
      },
      {
        target: "0x8ba1f109551bd432803012645ac136ddd64dba72",
        data: "0xcafebabe",
      },
    ] satisfies BatchUserOperationCallData;

    expect(
      await provider.account.encodeBatchExecute(data)
    ).toMatchInlineSnapshot(
      '"0x18dfb3c7000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000002000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef0000000000000000000000008ba1f109551bd432803012645ac136ddd64dba720000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000004deadbeef000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004cafebabe00000000000000000000000000000000000000000000000000000000"'
    );
  });

  it("should correctly do base runtime validation when entrypoint are invalid", async () => {
    await expect(
      createSimpleSmartAccount({
        entryPointAddress: 1 as unknown as Address,
        chain,
        owner,
        factoryAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        rpcClient: "ALCHEMY_RPC_URL",
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      "[
        {
          \\"code\\": \\"invalid_type\\",
          \\"expected\\": \\"string\\",
          \\"received\\": \\"number\\",
          \\"path\\": [
            \\"entryPointAddress\\"
          ],
          \\"message\\": \\"Expected string, received number\\"
        }
      ]"
    `);
  });

  it("should correctly do base runtime validation when multiple inputs are invalid", async () => {
    await expect(
      createSimpleSmartAccount({
        entryPointAddress: 1 as unknown as Address,
        chain: "0x1" as unknown as Chain,
        owner,
        factoryAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        rpcClient: "ALCHEMY_RPC_URL",
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      "[
        {
          \\"code\\": \\"invalid_type\\",
          \\"expected\\": \\"string\\",
          \\"received\\": \\"number\\",
          \\"path\\": [
            \\"entryPointAddress\\"
          ],
          \\"message\\": \\"Expected string, received number\\"
        },
        {
          \\"code\\": \\"custom\\",
          \\"fatal\\": true,
          \\"path\\": [
            \\"chain\\"
          ],
          \\"message\\": \\"Invalid input\\"
        }
      ]"
    `);
  });

  it("should correctly use the account init code override", async () => {
    const account = await createSimpleSmartAccount({
      chain: sepolia,
      owner: owner,
      factoryAddress: getDefaultSimpleAccountFactoryAddress(sepolia),
      rpcClient: publicClient,
      // override the account address here so we don't have to resolve the address from the entrypoint
      accountAddress: "0x1234567890123456789012345678901234567890",
      initCode: "0xdeadbeef",
    });

    vi.spyOn(publicClient, "getBytecode").mockImplementation(() => {
      return Promise.resolve("0x" as Address);
    });

    const initCode = await account.getInitCode();
    expect(initCode).toMatchInlineSnapshot('"0xdeadbeef"');
  });

  const givenConnectedProvider = async ({
    owner,
    chain,
  }: {
    owner: SmartAccountSigner;
    chain: Chain;
  }) =>
    createSmartAccountClient({
      transport: http(`${chain.rpcUrls.alchemy.http[0]}/${"test"}`),
      chain: chain,
      account: await createSimpleSmartAccount({
        chain,
        owner,
        factoryAddress: getDefaultSimpleAccountFactoryAddress(chain),
        rpcClient: publicClient,
      }),
    });
});
