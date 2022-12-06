import Router from '@koa/router';
import { Benchmark } from 'warp-contracts';

const MAX_INTERACTIONS_PER_PAGE = 5000;

export async function interactionsSortKeyRoute(ctx: Router.RouterContext) {
  const { gatewayDb, logger } = ctx;

  const { contractId, confirmationStatus, page, limit, from, to, totalCount, source, minimize } = ctx.query;

  const parsedPage = page ? parseInt(page as string) : 1;

  const parsedLimit = limit
    ? Math.min(parseInt(limit as string), MAX_INTERACTIONS_PER_PAGE)
    : MAX_INTERACTIONS_PER_PAGE;
  const offset = parsedPage ? (parsedPage - 1) * parsedLimit : 0;

  const parsedConfirmationStatus = confirmationStatus
    ? confirmationStatus == 'not_corrupted'
      ? ['confirmed', 'not_processed']
      : [confirmationStatus]
    : undefined;

  // 'should minimize' means that we're making a call from the SDK
  // this affects:
  // 1. the amount of returned data (we're trying to minimize amount of data in this case)
  // 2. sorting order (SDK requires ASC order, SonAR requires DESC order)
  const shouldMinimize = minimize === 'true';

  const bindings: any[] = [];
  bindings.push(contractId);
  bindings.push(contractId);
  // cannot use IN with bindings https://github.com/knex/knex/issues/791
  // parsedConfirmationStatus && bindings.push(parsedConfirmationStatus)
  from && bindings.push(from as string);
  to && bindings.push(to as string);
  source && bindings.push(source as string);
  parsedPage && bindings.push(parsedLimit);
  parsedPage && bindings.push(offset);

  try {
    const query = `
          SELECT interaction, 
                 confirmation_status, 
                 sort_key
                 ${shouldMinimize ? '' : ',confirming_peer, confirmations, bundler_tx_id '}
                 ${shouldMinimize ? '' : ',count(*) OVER () AS total'}
          FROM interactions 
            WHERE (contract_id = ? OR interact_write @> ARRAY[?]) 
          ${
            parsedConfirmationStatus
              ? ` AND confirmation_status IN (${parsedConfirmationStatus.map((status) => `'${status}'`).join(', ')})`
              : ''
          } 
          ${from ? ' AND sort_key > ?' : ''} 
          ${to ? ' AND sort_key <= ?' : ''} 
          ${source ? `AND source = ?` : ''} 
          ORDER BY sort_key ${shouldMinimize ? 'ASC' : 'DESC'} ${parsedPage ? ' LIMIT ? OFFSET ?' : ''};
      `;

    const result: any = await gatewayDb.raw(query, bindings);

    const totalInteractions: any =
      totalCount == 'true' &&
      (await gatewayDb.raw(
        `
          SELECT count(case when confirmation_status = 'corrupted' then 1 else null end)     AS corrupted,
                 count(case when confirmation_status = 'confirmed' then 1 else null end)     AS confirmed,
                 count(case when confirmation_status = 'not_processed' then 1 else null end) AS not_processed,
                 count(case when confirmation_status = 'forked' then 1 else null end)        AS forked
          FROM interactions
          WHERE contract_id = ?;
      `,
        contractId
      ));

    const total = result?.rows?.length > 0 ? parseInt(result?.rows[0].total) : 0;

    const benchmark = Benchmark.measure();
    const mappedInteractions = shouldMinimize
      ? result?.rows?.map((r: any) => ({
          ...r.interaction,
          sortKey: r.sort_key,
          confirmationStatus: r.confirmation_status,
        }))
      : result?.rows?.map((r: any) => ({
          status: r.confirmation_status,
          confirming_peers: r.confirming_peer,
          confirmations: r.confirmations,
          interaction: {
            ...r.interaction,
            bundlerTxId: r.bundler_tx_id,
            sortKey: r.sort_key,
          },
        }));

    ctx.body = {
      paging: {
        total,
        limit: parsedLimit,
        items: result?.rows.length,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit),
      },
      ...(totalInteractions && {
        total: {
          confirmed: totalInteractions?.rows[0].confirmed,
          corrupted: totalInteractions?.rows[0].corrupted,
          not_processed: totalInteractions?.rows[0].not_processed,
          forked: totalInteractions?.rows[0].forked,
        },
      }),
      // TODO: this mapping here is kinda dumb.

      interactions: mappedInteractions,
    };

    logger.info('Mapping interactions: ', benchmark.elapsed());
  } catch (e: any) {
    ctx.logger.error(e);
    ctx.status = 500;
    ctx.body = { message: e };
  }
}
