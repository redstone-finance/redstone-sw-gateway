import { DatabaseSource } from '../src/db/databaseSource';
import { Benchmark } from 'warp-contracts';

async function updateContractTxTags() {
  require('dotenv').config({
    path: '.secrets/local.env',
  });

  const dbSource = new DatabaseSource([{ client: 'pg', url: process.env.DB_URL as string, primaryDb: true }]);

  let rowsUpdated = 0;

  const benchmark = Benchmark.measure();

  while (true) {
    const result = await dbSource.raw(`SELECT contract_id
  FROM contracts
  WHERE contract_tx->'id' is not null limit 1000;`);

    if (result.rows.length == 0) {
      break;
    }

    for (let i = 0; i < 1; i++) {
      let values = ``;
      result.rows.forEach((r: any, i: number) => {
        i == result.rows.length - 1 ? (values += `'${r.contract_id}'`) : (values += `'${r.contract_id}', `);
      });

      await dbSource.raw(
        `UPDATE contracts
        SET contract_tx = contract_tx -'id' -'data' -'owner' -'format' -'reward' -'target' -'last_tx'
        -'quantity' -'data_root' -'data_size' -'data_tree' -'signature'
        WHERE contract_id IN (${values});`
      );
    }
    rowsUpdated += result.rows.length;
    console.log(`Updating contract_tx column. ${rowsUpdated} rows updated.`);
  }

  console.log(`Updating contract_tx column done. ${rowsUpdated} updated in ${benchmark.elapsed()}.`);
  process.exit(0);
}

updateContractTxTags()
  .then(() => console.log('contract_tx column update completed.'))
  .catch((e) => console.error(e));
