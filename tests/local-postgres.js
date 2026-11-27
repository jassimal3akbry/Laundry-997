// Admin access to the disposable PostgreSQL databases used by the browser tests.
const { spawnSync } = require("node:child_process");

const port = Number(process.env.L997_TEST_PGPORT || 5432);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("L997_TEST_PGPORT must be a valid local PostgreSQL port");
}

function pgAdmin(command, db, args = [], input) {
  if (!/^l997_(?:e2e|wabot)_\d+$/.test(db)) {
    throw new Error("Refusing to administer a database outside the browser test suite");
  }
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("PG")) delete env[key];
  }
  const useSystemPostgres = process.getuid?.() === 0 && !process.env.L997_TEST_PGPORT;
  const connection = ["-U", "postgres", "-p", String(port)];
  if (!useSystemPostgres) connection.push("-h", "127.0.0.1");
  const database = command === "psql" ? ["-d", db] : [db];
  const params = [...connection, ...args, ...database];
  const result = useSystemPostgres
    ? spawnSync("runuser", ["-u", "postgres", "--", command, ...params], { env, input, encoding: "utf8" })
    : spawnSync(command, params, { env, input, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return { stdout: result.stdout, stderr: result.stderr };
}

function psql(db, args, input) {
  return pgAdmin("psql", db, ["-X", "-v", "ON_ERROR_STOP=1", ...args], input);
}

module.exports = { pgAdmin, psql, port };
