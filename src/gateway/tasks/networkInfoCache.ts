import {NetworkInfoInterface} from "arweave/node/network";
import {BlockData} from "arweave/node/blocks";
import {GatewayContext} from "../init";
import {TaskRunner} from "./TaskRunner";
import {BLOCKS_INTERVAL_MS} from "./syncTransactions";

export let cachedNetworkInfo: NetworkInfoInterface | null = null;
export let cachedBlockInfo: BlockData | null = null;

export async function runNetworkInfoCacheTask(context: GatewayContext) {
  const {arweave, logger} = context;

  await TaskRunner
    .from("[Arweave network info]", async () => {
      logger.debug("Loading network info");
      cachedNetworkInfo = await arweave.network.getInfo();
      cachedBlockInfo = await arweave.blocks.get(cachedNetworkInfo.current);
      logger.debug("New network height", cachedNetworkInfo.height);
    }, context)
    .runSyncEvery(BLOCKS_INTERVAL_MS, true);
}
