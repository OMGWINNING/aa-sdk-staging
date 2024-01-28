import { createAnvil, type CreateAnvilOptions } from "@viem/anvil";
import type { ExecaChildProcess } from "execa";
import { Writable } from "node:stream";
import {
  RundlerCreationOptionsSchema,
  type Rundler,
  type RundlerCreationOptions,
} from "./types.js";

export function createRundler(opts?: {
  rundlerOptions?: RundlerCreationOptions;
  anvilOptions?: CreateAnvilOptions;
}): Rundler {
  const {
    rpc: { host, port },
    binaryPath,
    ...rundlerOptions
  } = RundlerCreationOptionsSchema.parse(opts?.rundlerOptions ?? {});

  const anvil = createAnvil(opts?.anvilOptions);
  let controller: AbortController | undefined;
  let rundler: ExecaChildProcess | undefined;

  const stdout = new Writable({
    write(chunk, _, callback) {
      // TODO: send this somewhere else
      console.log(chunk.toString());
      callback();
    },
  });

  const stderr = new Writable({
    write(chunk, _, callback) {
      // TODO: send this somewhere else
      console.error(chunk.toString());
      callback();
    },
  });

  const start = async () => {
    await anvil.start();

    const { execa } = await import("execa");
    controller = new AbortController();
    rundler = execa(
      binaryPath,
      [
        "node",
        "--entry_points",
        rundlerOptions.entry_points.join(","),
        "--chain_id",
        rundlerOptions.chain_id.toString(),
        "--node_http",
        `http://${anvil.host}:${anvil.port}`,
        "--max_verification_gas",
        rundlerOptions.max_verification_gas.toString(),
        "--builder.private_key",
        rundlerOptions.builder.private_key,
      ],
      { cleanup: true, signal: controller.signal }
    );

    rundler.pipeStdout!(stdout);
    rundler.pipeStderr!(stderr);
  };

  const stop = async () => {
    try {
      if (controller !== undefined && !controller?.signal.aborted) {
        controller.abort();
      }

      await rundler;
    } catch {}
    await anvil.stop();
    controller = undefined;
  };

  anvil.on("exit", stop);
  anvil.on("closed", stop);

  return {
    start,
    stop,
    anvil,
    host,
    port,
  };
}
