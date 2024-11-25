import Router from '@koa/router';
import { Benchmark } from 'warp-contracts';

export async function joinSeason3(ctx: Router.RouterContext) {
  const { logger, dbSource } = ctx;

  const { contractId, userId, walletAddress } = ctx.query;

  const benchmark = Benchmark.measure();
  const result: any = await dbSource.raw(
    `with joined_table as (
      select interaction_id, interaction
      from interactions,
      jsonb_array_elements(interaction -> 'tags') tags
      where contract_id = ? and function = 'addPoints'
      and tags ->> 'name' = 'Reward-For' and tags ->> 'value' = 'Join-Season-3'
      ),
      joined_table_res as (
          select true as joined
          from joined_table 
          cross join jsonb_array_elements(interaction -> 'tags') as tags
          cross join jsonb_array_elements((tags ->> 'value')::jsonb -> 'members') as members
          where tags ->> 'name' = 'Input'
          and members::jsonb ->> 'id' = ?
      ),
      registration_table as (
          select sync_timestamp as timestamp 
          from interactions 
          cross join jsonb_array_elements(interaction -> 'tags') tags 
          cross join jsonb_array_elements((tags ->> 'value')::jsonb -> 'members') as members 
          where contract_id = ? 
          and function in ('addPoints', 'addPointsForAddress', 'addPointsWithCap') 
          and tags ->> 'name' = 'Input' 
          and (members ->> 'id' = ? or members ->> 'id' = ?) 
          and sync_timestamp between 1719871200000 and 1732575600000 limit 1
      )
    select * from registration_table left join joined_table_res on true;`,
    [contractId, userId, contractId, userId, walletAddress]
  );

  const joinSeason3Result = result.rows[0];
  ctx.body = {
    id: userId,
    joined: joinSeason3Result?.joined,
    timestamp: joinSeason3Result?.timestamp,
  };

  logger.debug(`User's registration date loaded in ${benchmark.elapsed()}`);
}
