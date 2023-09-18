import Router from '@koa/router';
import {Benchmark} from 'warp-contracts';
import {isTxIdValid} from '../../../../utils';
import {GatewayError} from "../../../errorHandlerMiddleware";

export async function contractWithSourceRoute(ctx: Router.RouterContext) {
  const {logger, dbSource} = ctx;

  const {txId, srcTxId} = ctx.query;

  if (!isTxIdValid(txId as string)) {
    throw new GatewayError('Incorrect contract transaction id.', 403);
  }

  if (srcTxId && !isTxIdValid(srcTxId as string)) {
    throw new GatewayError('Incorrect contract source transaction id.', 403);
  }

  const bindings: any[] = [];
  srcTxId && bindings.push(srcTxId);
  bindings.push(txId);

  const benchmark = Benchmark.measure();
  const result: any = await dbSource.raw(
    `
        SELECT c.contract_id                                                                       as "txId",
               c.bundler_contract_tx_id                                                            as "bundlerTxId",
               c.src_tx_id                                                                         as "originalSrcTxId", 
               s.src_tx_id                                                                         as "srcTxId",
               (case when s.src_content_type = 'application/javascript' then s.src else null end)  as src,
               (case when s.src_content_type = 'application/wasm' then s.src_binary else null end) as "srcBinary",
               c.init_state                                                                        as "initState",
               c.owner                                                                             as "owner",
               c.pst_ticker                                                                        as "pstTicker",
               c.pst_name                                                                          as "pstName",
               s.src_wasm_lang                                                                     as "srcWasmLang",
               c.contract_tx                                                                       as "contractTx",
               s.src_tx                                                                            as "srcTx",
               c.testnet                                                                           as "testnet",
               c.manifest                                                                          as "manifest"
        FROM contracts c
            ${srcTxId ? 'JOIN contracts_src s on ? = s.src_tx_id' : 'JOIN contracts_src s on c.src_tx_id = s.src_tx_id'}
        WHERE contract_id = ?;
    `,
    bindings
  );

  if (result?.rows[0].src == null && result?.rows[0].srcBinary == null) {
    throw new GatewayError('Contract not properly indexed.');
  } else {
    ctx.body = result?.rows[0];
    logger.debug('Contract data loaded in', benchmark.elapsed());
  }

}
