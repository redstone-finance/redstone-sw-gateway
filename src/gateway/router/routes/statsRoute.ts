import Router from "@koa/router";
import {Benchmark} from "redstone-smartweave";

export async function statsRoute(ctx: Router.RouterContext) {
  const {logger, gatewayDb} = ctx;

  const {phrase} = ctx.params;

  if (phrase?.length < 3) {
    ctx.body = [];
    return;
  }

  try {
    const benchmark = Benchmark.measure();
    const result: any = await gatewayDb.raw(
      `
          SELECT count(*)                      as total_interactions,
                 count(DISTINCT (contract_id)) as total_contracts
          FROM interactions
          WHERE contract_id != '';
      `
    );
    ctx.body = result?.rows[0];
    logger.debug("Stats loaded in", benchmark.elapsed());
  } catch (e: any) {
    ctx.logger.error(e);
    ctx.status = 500;
    ctx.body = {message: e};
  }
}
