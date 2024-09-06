import Router from '@koa/router';
import Arweave from 'arweave';
import { SMART_WEAVE_TAGS, WARP_TAGS } from 'warp-contracts';
import { BUNDLR_NODE1_URL } from '../../../../constants';
import { WarpDeployment } from './deployContractRoute';
import rawBody from 'raw-body';
import { DataItem } from 'arbundles';
import { getTestnetTag } from './deployBundledRoute';
import { bundleAndUpload, determineOwner, getDataItemWithoutData, verifyDeployTags } from './deployContractRoute_v2';
import { ContractSourceInsert } from '../../../../db/insertInterfaces';
import { GatewayError } from '../../../errorHandlerMiddleware';

export async function deploySourceRoute_v2(ctx: Router.RouterContext) {
  const { logger, arweave, dbSource } = ctx;

  let dataItem;

  const rawDataItem: Buffer = await rawBody(ctx.req);
  dataItem = new DataItem(rawDataItem);
  logger.debug('New deploy source transaction', dataItem.id);

  const isValid = await dataItem.isValid();
  if (!isValid) {
    throw new GatewayError('Source data item binary is not valid.', 400);
  }

  const areSrcTagsValid = await verifyDeployTags(dataItem);
  if (!areSrcTagsValid) {
    throw new GatewayError('Contract source tags are not valid.', 400);
  }

  try {
    let srcId, srcContentType, src, srcBinary, srcWasmLang, bundlrSrcTxId, srcOwner, srcTestnet, srcBundlrResponse;
    srcId = dataItem.id;
    srcOwner = await determineOwner(dataItem, arweave);

    srcTestnet = getTestnetTag(dataItem.tags);
    srcContentType = dataItem.tags.find((t) => t.name == 'Content-Type')!.value;
    srcWasmLang = dataItem.tags.find((t) => t.name == WARP_TAGS.WASM_LANG)?.value;
    if (srcContentType == 'application/javascript') {
      src = Arweave.utils.bufferToString(dataItem.rawData);
    } else {
      srcBinary = dataItem.rawData;
    }
    const bundlrResponse = await bundleAndUpload({ contract: null, src: dataItem }, ctx);

    bundlrSrcTxId = bundlrResponse?.id;
    srcBundlrResponse = bundlrResponse;
    logger.debug('Contract source successfully uploaded to Bundlr.', {
      id: srcId,
      bundled_tx_id: bundlrSrcTxId,
    });
    let contracts_src_insert: ContractSourceInsert = {
      src_tx_id: srcId,
      owner: srcOwner,
      src: src || null,
      src_content_type: srcContentType,
      src_binary: srcBinary || null,
      src_wasm_lang: srcWasmLang || null,
      bundler_src_tx_id: bundlrSrcTxId,
      bundler_src_node: BUNDLR_NODE1_URL,
      bundler_response: JSON.stringify(srcBundlrResponse),
      src_tx: dataItem.toJSON(),
      testnet: srcTestnet,
      deployment_type: WarpDeployment.Direct,
    };
    await dbSource.insertContractSource(contracts_src_insert);

    logger.info('Contract source successfully bundled and inserted.', {
      srcTxId: srcId,
      bundlrSrcTxId,
    });

    ctx.body = {
      srcTxId: srcId,
      bundlrSrcTxId,
    };
  } catch (e) {
    throw new GatewayError(`Error while inserting bundled transaction: ${e}.`, 500, {
      dataItemId: dataItem?.id,
      contractTx: getDataItemWithoutData(dataItem),
    });
  }
}
