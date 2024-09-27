import Router from '@koa/router';
import {stringify} from 'JSONStream';

export async function interactionsStreamRoute(ctx: Router.RouterContext) {
  const {logger, dbSource} = ctx;

  const {contractId, confirmationStatus, from, to} = ctx.query;

  logger.debug('Interactions stream route', {
    contractId,
    confirmationStatus,
    from,
    to,
  });

  const parsedConfirmationStatus = confirmationStatus
    ? confirmationStatus == 'not_corrupted'
      ? ['confirmed', 'not_processed']
      : [confirmationStatus]
    : [];

  const bindings: any[] = [];
  bindings.push(contractId);
  for (let cs of parsedConfirmationStatus) {
    bindings.push(cs)
  }
  from && bindings.push(from as string);
  to && bindings.push(to as string);

  const result: any = dbSource
    .raw(
      `
          SELECT interaction
          FROM interactions
          WHERE contract_id = ? ${
                  parsedConfirmationStatus.length
                          ? ` AND confirmation_status IN (${parsedConfirmationStatus.map((_) => `?`).join(', ')})`
                          : ''
          } ${from ? ' AND block_height >= ?' : ''} ${to ? ' AND block_height <= ?' : ''}
          ORDER BY sort_key ASC;
      `,
      bindings
    )
    .stream() // note: https://www.npmjs.com/package/pg-query-stream is required for stream to work
    .pipe(stringify());

  ctx.set('Content-Type', 'application/json; charset=utf-8');
  ctx.set('Transfer-Encoding', 'chunked');

  ctx.body = result;
}
