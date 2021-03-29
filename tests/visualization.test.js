import {
  neo4j_system_driver,
  createDatabase,
  cleanDatabase,
  runCypherOnDatabase,
  cleanAllDatabases,
  filterConsoleDatabasesFromResult,
  removeDatabasesOlderThan,
} from "../src";
import {
  advanceBy as advanceDateBy,
  clear as clearDateMock,
} from "jest-date-mock";

let session;

beforeAll(async (done) => {
  session = neo4j_system_driver.session({ database: "system" });
  done();
});

test('cypher returns created nodes and relationships', async () => {
  const database = await createDatabase();
  const result = await runCypherOnDatabase(`
    CREATE
      (Episode1:Movie {name: 'Episode I: The Phantom Menace'}),
      (r2_d2:Droid {name: 'R2-D2'}),
      (yoda:Person {name: 'YODA'}),
      (r2_d2)-[:SPEAKS_WITH]->(yoda),
      (yoda)-[:APPEARS_IN]->(Episode1);
  `, database, "3.5");
  expect(result.visualization).toStrictEqual({
    nodes: [
      { name: 'Episode I: The Phantom Menace', id: 0, labels: ['Movie'] },
      { name: 'R2-D2', id: 1, labels: ['Droid'] },
      { name: 'YODA', id: 2, labels: ['Person'] }
    ],
    links: [
      {
        type: 'SPEAKS_WITH',
        id: 0,
        start: 1,
        end: 2,
        source: 1,
        target: 2
      },
      {
        type: 'APPEARS_IN',
        id: 1,
        start: 2,
        end: 0,
        source: 2,
        target: 0
      }
    ]
  });
  expect(result.json).toStrictEqual([]);
  expect(result.stats.nodesCreated).toBe(3);
  expect(result.stats.relationshipsCreated).toBe(2);
  expect(result.stats.propertiesSet).toBe(3);
  expect(result.stats.labelsAdded).toBe(3);
  expect(result.stats.rows).toBe(0);
  expect(result.stats.containsUpdates).toBe(true);
  await cleanDatabase(database);
});

test("returns data", async () => {
  const database = await createDatabase();
  await runCypherOnDatabase(
    `
    CREATE
      (Episode1:Movie {name: 'Episode I: The Phantom Menace'}),
      (r2_d2:Droid {name: 'R2-D2'}),
      (yoda:Person {name: 'YODA'}),
      (r2_d2)-[:SPEAKS_WITH]->(yoda),
      (yoda)-[:APPEARS_IN]->(Episode1);
  `,
    database,
    "3.5"
  );
  const result = await runCypherOnDatabase(
    `MATCH (n)-[r]->(m) RETURN n, r, m;`,
    database,
    "3.5"
  );

  expect(result.columns).toStrictEqual(["n", "r", "m"]);
  expect(result.json).toStrictEqual([
    {
      n: { name: "YODA", _id: 2, _labels: ["Person"] },
      r: { _id: 1, _start: 2, _end: 0, _type: "APPEARS_IN" },
      m: { name: "Episode I: The Phantom Menace", _id: 0, _labels: ["Movie"] },
    },
    {
      n: { name: "R2-D2", _id: 1, _labels: ["Droid"] },
      r: { _id: 0, _start: 1, _end: 2, _type: "SPEAKS_WITH" },
      m: { name: "YODA", _id: 2, _labels: ["Person"] },
    },
  ]);
  expect(result.stats.rows).toBe(2);
  expect(result.stats.containsUpdates).toBe(false);
  await cleanDatabase(database);
});

test("returns path", async () => {
  const database = await createDatabase();
  await runCypherOnDatabase(
    `
    CREATE
      (Episode1:Movie {name: 'Episode I: The Phantom Menace'}),
      (r2_d2:Droid {name: 'R2-D2'}),
      (yoda:Person {name: 'YODA'}),
      (r2_d2)-[:SPEAKS_WITH]->(yoda),
      (yoda)-[:APPEARS_IN]->(Episode1);
  `,
    database,
    "3.5"
  );
  const result = await runCypherOnDatabase(
    `MATCH path=(r2d2:Droid {name: 'R2-D2'})-[:SPEAKS_WITH]-(other)-[:APPEARS_IN]-(movie) RETURN path;`,
    database,
    "3.5"
  );

  expect(result.visualization).toStrictEqual({"nodes":[{"id":0,"labels":["Movie"],"name":"Episode I: The Phantom Menace","selected":"path"},{"id":1,"labels":["Droid"],"name":"R2-D2","selected":"path"},{"id":2,"labels":["Person"],"name":"YODA","selected":"path"}],"links":[{"end":2,"id":0,"selected":"path","source":1,"start":1,"target":2,"type":"SPEAKS_WITH"},{"end":0,"id":1,"selected":"path","source":2,"start":2,"target":0,"type":"APPEARS_IN"}]});

  expect(result.json).toStrictEqual([{"path":[{"_id":1,"_labels":["Droid"],"name":"R2-D2"},{"_end":2,"_id":0,"_start":1,"_type":"SPEAKS_WITH"},{"_id":2,"_labels":["Person"],"name":"YODA"},{"_end":0,"_id":1,"_start":2,"_type":"APPEARS_IN"},{"_id":0,"_labels":["Movie"],"name":"Episode I: The Phantom Menace"}]}]);

  expect(result.stats.rows).toBe(1);
  expect(result.stats.containsUpdates).toBe(false);
  await cleanDatabase(database);
});

afterAll(async (done) => {
  await session.close();
  await neo4j_system_driver.close();
  done();
});