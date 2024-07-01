import Router from '@koa/router';
import { Benchmark } from 'warp-contracts';

export async function registrationDate(ctx: Router.RouterContext) {
  const { logger, dbSource } = ctx;

  const { contractId, userId } = ctx.query;

  const bindings: any[] = [];
  bindings.push(contractId);
  bindings.push(userId);

  const benchmark = Benchmark.measure();
  const result: any = await dbSource.raw(
    `select sync_timestamp
        from interactions, 
        jsonb_array_elements(interaction -> 'tags') tags
        where contract_id = ? and function = 'registerUser' 
        and tags ->> 'name' = 'Input'
        and (tags ->> 'value')::jsonb ->> 'id' = ?;`,
    bindings
  );

  ctx.body = result.rows[0]?.sync_timestamp;

  logger.debug(`User's registration date loaded in ${benchmark.elapsed()}`);
}
