import Router from '@koa/router';
import { Benchmark } from 'warp-contracts';

export async function joinSeason2(ctx: Router.RouterContext) {
  const { logger, dbSource } = ctx;

  const { contractId, userId } = ctx.query;

  const benchmark = Benchmark.measure();
  const result: any = await dbSource.raw(
    `with joined_table as (
      select interaction_id, interaction
      from interactions,
           jsonb_array_elements(interaction -> 'tags') tags
      where contract_id = '${contractId}' and function = 'addPoints'
        and tags ->> 'name' = 'Reward-For' and tags ->> 'value' = 'Join-Season-2'
      ),
      joined_table_res as (
          select true as joined
          from joined_table, jsonb_array_elements(interaction -> 'tags') as tags, jsonb_array_elements((tags ->> 'value')::jsonb -> 'members') as members
          where tags ->> 'name' = 'Input'
          and members::jsonb ->> 'id' = '${userId}'
      ),
      registration_table as (
          select '${userId}' as id, sync_timestamp as timestamp
          from interactions,
               jsonb_array_elements(interaction -> 'tags') tags
          where contract_id = '${contractId}' and function = 'registerUser'
            and tags ->> 'name' = 'Input'
            and (tags ->> 'value')::jsonb ->> 'id' = '${userId}'
      )
    select * from registration_table left join joined_table_res on true;`
  );

  const { id, joined, timestamp } = result.rows[0];
  ctx.body = {
    id,
    joined,
    timestamp,
  };

  logger.debug(`User's registration date loaded in ${benchmark.elapsed()}`);
}
