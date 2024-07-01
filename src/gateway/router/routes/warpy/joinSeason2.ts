import Router from '@koa/router';
import { Benchmark } from 'warp-contracts';

export async function joinSeason2(ctx: Router.RouterContext) {
  const { logger, dbSource } = ctx;

  const { contractId, userId } = ctx.query;

  const benchmark = Benchmark.measure();
  const result: any = await dbSource.raw(
    `select id, max(joined::int)::boolean as joined, max(timestamp) as timestamp from(
      with joined_table as (
      select interaction_id, interaction
      from interactions, 
      jsonb_array_elements(interaction -> 'tags') tags
      where contract_id = ${contractId} and function = 'addPoints'
      and tags ->> 'name' = 'Reward-For' and tags ->> 'value' = 'Join-Season-2'
      )
      select ${userId} as id, true as joined, null as timestamp
      from joined_table, jsonb_array_elements(interaction -> 'tags') as tags, jsonb_array_elements((tags ->> 'value')::jsonb -> 'members') as members
      where tags ->> 'name' = 'Input' 
      and members::jsonb ->> 'id' = ${userId}
      union ALL
      select ${userId} as id, null as joined, sync_timestamp as timestamp
      from interactions, 
      jsonb_array_elements(interaction -> 'tags') tags
      where contract_id = ${contractId} and function = 'registerUser'
      and tags ->> 'name' = 'Input' 
      and (tags ->> 'value')::jsonb ->> 'id' = ${userId}
      ) jt
      group by id;`
  );

  ctx.body = {
    date: result.rows[0]?.sync_timestamp,
  };

  logger.debug(`User's registration date loaded in ${benchmark.elapsed()}`);
}
