import Router from '@koa/router';
import { GatewayContext } from './init';
import { publish as appSyncPublish } from 'warp-contracts-pubsub';
import { InteractionMessage } from 'warp-contracts-subscription-plugin';

const contractsChannel = 'contracts';

export function sendNotification(
  ctx: Router.RouterContext | GatewayContext,
  contractTxId: string,
  contractData?: {
    initState: any;
    tags: {
      name: string;
      value: string;
    }[];
  },
  interaction?: InteractionMessage
) {
  const { logger } = ctx;

  if (ctx.localEnv) {
    logger.info('Skipping publish contract notification for local env');
    return;
  }
  try {
    if (contractData && interaction) {
      logger.error('Either interaction or contractData should be set, not both.');
    }

    const message: any = { contractTxId, test: false, source: 'warp-gw' };
    if (contractData) {
      message.initialState = contractData.initState;
      message.tags = contractData.tags;
    }
    if (interaction) {
      message.interaction = interaction;
    }

    const stringified = JSON.stringify(message);

    ctx.publisher.publish(contractsChannel, stringified);
    logger.info(`Published ${contractsChannel}`);
    ctx.publisher_v2.publish(contractsChannel, stringified);
    logger.info(`Published v2 ${contractsChannel}`);
  } catch (e) {
    logger.error('Error while publishing message', e);
  }
}

export function publishInteraction(
  ctx: Router.RouterContext | GatewayContext,
  contractTxId: string,
  interaction: any,
  sortKey: string,
  lastSortKey: string | null,
  functionName: string,
  source: string
) {
  const { logger, appSync } = ctx;

  if (!appSync) {
    logger.warn('App sync key not set');
    return;
  }

  const interactionToPublish = JSON.stringify({
    contractTxId,
    sortKey,
    lastSortKey,
    source,
    functionName,
    interaction: {
      ...interaction,
      sortKey,
      confirmationStatus: 'confirmed',
    },
  });

  publish(
    ctx,
    `interactions/${contractTxId}`,
    interactionToPublish,
    `Published interaction for contract ${contractTxId} @ ${sortKey}`
  );

  publish(ctx, 'interactions', interactionToPublish, `Published new interaction: ${interaction.id}`);
}

export function publishContract(
  ctx: Router.RouterContext | GatewayContext,
  contractTxId: string,
  creator: string,
  type: string,
  height: number,
  timestamp: number,
  source: string
) {
  const contractToPublish = JSON.stringify({
    contractTxId,
    creator,
    type,
    height,
    timestamp,
    source,
  });

  publish(ctx, 'contracts', contractToPublish, `Published contract: ${contractTxId}`);
}

function publish(
  ctx: Router.RouterContext | GatewayContext,
  channel: string,
  txToPublish: string,
  infoMessage: string
) {
  const { logger, appSync } = ctx;

  if (!appSync) {
    logger.warn('App sync key not set');
    return;
  }

  appSyncPublish(`${ctx.localEnv ? 'local/' : ''}${channel}`, txToPublish, appSync)
    .then((r) => {
      logger.info(infoMessage);
    })
    .catch((e) => {
      logger.error('Error while publishing transaction', e);
    });
}
