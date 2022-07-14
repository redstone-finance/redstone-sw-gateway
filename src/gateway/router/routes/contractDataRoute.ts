import Router from '@koa/router';
import Arweave from 'arweave';
import { ArweaveWrapper, Benchmark, RedStoneLogger } from 'redstone-smartweave';
import { callbackToPromise, isTxIdValid } from '../../../utils';
import { gunzip } from 'zlib';
import Transaction from 'arweave/node/lib/transaction';
import { BUNDLR_NODE2_URL } from '../../../constants';

export async function contractDataRoute(ctx: Router.RouterContext) {
  const { logger, gatewayDb, arweave, arweaveWrapper } = ctx;

  const { id } = ctx.params;

  if (!isTxIdValid(id as string)) {
    logger.error('Incorrect contract transaction id.');
    ctx.status = 500;
    ctx.body = { message: 'Incorrect contract transaction id.' };
    return;
  }

  try {
    const benchmark = Benchmark.measure();
    logger.debug('ContractDataRoute id: ', id);

    const result: any = await gatewayDb.raw(
      `
          SELECT bundler_contract_tx_id as "bundlerContractTxId"
          FROM contracts 
          WHERE contract_id = ?;
      `,
      [id]
    );

    if (result?.rows[0] == null || result?.rows[0].bundlerContractTxId == null) {
      ctx.status = 500;
      ctx.body = { message: 'Contract not indexed as bundled.' };
    } else {
      const { data, contentType } = await getContractData(
        arweave,
        logger,
        result?.rows[0].bundlerContractTxId,
        arweaveWrapper
      );
      ctx.body = data;
      ctx.set('Content-Type', contentType);
      logger.debug('Contract data loaded in', benchmark.elapsed());
    }
  } catch (e: any) {
    logger.error(e);
    ctx.status = 500;
    ctx.body = { message: e };
  }
}

async function getContractData(arweave: Arweave, logger: RedStoneLogger, id: string, arweaveWrapper: ArweaveWrapper) {
  let data: ArrayBuffer | Buffer;
  try {
    data = await arweaveWrapper.txData(id);
  } catch (e) {
    data = await fetch(`${BUNDLR_NODE2_URL}/tx/${id}/data`)
      .then((res) => {
        return res.arrayBuffer();
      })
      .then((data) => {
        return data;
      });
  }

  // decompress and decode contract transction data
  const gunzipPromisified = callbackToPromise(gunzip);
  const unzippedData = await gunzipPromisified(data);
  const strData = arweave.utils.bufferToString(unzippedData);
  const tx = new Transaction({ ...JSON.parse(strData) });
  const txData = Buffer.from(tx.data);

  // get contract transaction content type from its tag
  const contentType = getContentType(tx);
  logger.debug(`Content type for id: ${id}: `, contentType);

  return { data: txData, contentType };
}

function getContentType(tx: Transaction) {
  const tagContentType = tx
    .get('tags')
    // @ts-ignore
    .find((tag: BaseObject) => tag.get('name', { decode: true, string: true }) == 'Content-Type');

  return tagContentType.get('value', { decode: true, string: true });
}
