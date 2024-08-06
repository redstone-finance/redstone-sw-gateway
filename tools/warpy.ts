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

  // let seasons: any;
  // try {
  //   seasons = (
  //     await fetch(
  //       `https://dre-warpy.warp.cc/contract?id=p5OI99-BaY4QbZts266T7EDwofZqs-wVuYJmMCS0SUU&query=$.seasons`
  //     ).then((res) => {
  //       return res.json();
  //     })
  //   ).result[0];
  // } catch (e) {
  //   throw new Error(`Could not load state from DRE node.`);
  // }

  // fs.writeFileSync('seasons.json', JSON.stringify(seasons));
  //   const boosts = JSON.parse(fs.readFileSync('boosts.json', 'utf-8'));
  const result =
    await dbSource.raw(`select members from interactions, jsonb_array_elements(interaction -> 'tags') tags, jsonb_array_elements((tags ->> 'value')::jsonb -> 'members') as members where contract_id = 'p5OI99-BaY4QbZts266T7EDwofZqs-wVuYJmMCS0SUU' and function = 'addPointsWithCap'
            and tags ->> 'name' = 'Input' and block_height = '1491618';`);
  fs.writeFileSync('addPoints.json', JSON.stringify(result.rows));

  const members = JSON.parse(fs.readFileSync('addPoints.json', 'utf-8'));
  console.log(members.length);
  const boosts = JSON.parse(fs.readFileSync('boosts.json', 'utf-8'));
  const seasons = JSON.parse(fs.readFileSync('seasons.json', 'utf-8'));
  let count = 0;
  let maxCount = {
    points: 0,
    boostsPoints: 0,
    address: null,
  };
  let maxPoints = {
    points: 0,
    boostsPoints: 0,
    address: null,
  };
  members.forEach((m: any) => {
    const roles = m.members.roles;
    let boostsPoints = m.members.points;
    boostsPoints *= countBoostsPoints(seasons, boosts, roles);

    count += boostsPoints;
    if (boostsPoints > maxCount.boostsPoints) {
      maxCount.points = m.members.points;
      maxCount.boostsPoints = boostsPoints;
      maxCount.address = m.members.id;
    }
    if (m.members.points > maxPoints.points) {
      maxPoints.points = m.members.points;
      maxPoints.boostsPoints = boostsPoints;
      maxPoints.address = m.members.id;
    }
  });
  console.log(count);
  console.log(maxCount);
  console.log(maxPoints);
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

connectToDb()
  .then(() => console.log('contract_tx column update completed.'))
  .catch((e) => console.error(e));
