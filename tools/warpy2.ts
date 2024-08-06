import { DatabaseSource } from '../src/db/databaseSource';
import fs from 'fs';

async function connectToDb() {
  require('dotenv').config({
    path: '.secrets/prod.env',
  });

  const dbSource = new DatabaseSource([
    {
      client: 'pg',
      url: process.env.DB_URL_GCP as string,
      ssl: {
        rejectUnauthorized: false,
        ca: fs.readFileSync('.secrets/prod-ca.pem'),
        cert: fs.readFileSync('.secrets/prod-cert.pem'),
        key: fs.readFileSync('.secrets/prod-key.pem'),
      },
      primaryDb: true,
    },
  ]);

  // let users: any;
  // try {
  //   users = (
  //     await fetch(
  //       `https://dre-warpy.warp.cc/contract?id=p5OI99-BaY4QbZts266T7EDwofZqs-wVuYJmMCS0SUU&query=$.users`
  //     ).then((res) => {
  //       return res.json();
  //     })
  //   ).result[0];
  // } catch (e) {
  //   throw new Error(`Could not load state from DRE node.`);
  // }

  // fs.writeFileSync('users.json', JSON.stringify(users));
  //   const boosts = JSON.parse(fs.readFileSync('boosts.json', 'utf-8'));
  const result = await dbSource.raw(
    `select from_address, sum(assets) from warpy_syncer_assets where protocol = 'venus' group by from_address order by sum desc;`
  );
  // const result = await dbSource.raw(`select * from warpy_syncer_transactions where protocol = 'venus';`);
  // const result = JSON.parse(fs.readFileSync('addressToEth.json', 'utf-8'));
  // fs.writeFileSync('addressToEth.csv', convertToCSV(result));
  const users = JSON.parse(fs.readFileSync('users.json', 'utf-8'));
  const users2 = Object.values(users).map((u: any) => u.toLowerCase());
  const test = result.rows.filter((r: any) => Object.values(users2).includes(r.from_address.toLowerCase()));
  fs.writeFileSync('addressToEth.csv', convertToCSV(test));

  // console.log(test.length);
  // fs.writeFileSync('addressToEth.json', JSON.stringify(test));

  // const reduced = test.reduce((a: any, b: any) => a + b.sum, 0);
  // console.log(reduced);
  process.exit(0);
}

export const countBoostsPoints = (seasons: any, boosts: any, roles: string[]) => {
  let points = 1;
  let boostsValue = 0;
  //   boosts.forEach((boost) => {
  //     boostsValue += state.boosts[boost];
  //   });
  //   const seasons = state.seasons;
  const currentTimestamp = Number(Math.floor(Date.now() / 1000));

  Object.keys(seasons).forEach((s) => {
    if (currentTimestamp >= seasons[s].from && currentTimestamp <= seasons[s].to) {
      if (seasons[s].role) {
        if (roles.includes(seasons[s].role as string)) {
          const boost = seasons[s].boost;
          const boostsPoints = boosts[boost];
          boostsValue += boostsPoints;
        }
      } else {
        const boost = seasons[s].boost;
        const boostsPoints = boosts[boost];
        boostsValue += boostsPoints;
      }
    }
  });
  points = boostsValue > 0 ? points * boostsValue : points;
  return points;
};

function convertToCSV(arr: any) {
  const array = [Object.keys(arr[0])].concat(arr);

  return array
    .map((it) => {
      return Object.values(it).toString();
    })
    .join('\n');
}

connectToDb()
  .then(() => console.log('contract_tx column update completed.'))
  .catch((e) => console.error(e));
