#!/usr/bin/env -S deno run --allow-read=./ --allow-write=./  --allow-net --no-remote --import-map=vendor/import_map.json
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/deps.ts
import { assert, assertEquals, assertRejects, assertThrows } from "https://deno.land/std@0.141.0/testing/asserts.ts";
import * as base64 from "https://deno.land/std@0.141.0/encoding/base64.ts";
import * as flags from "https://deno.land/std@0.141.0/flags/mod.ts";
import * as colors from "https://deno.land/std@0.141.0/fmt/colors.ts";
import * as fs from "https://deno.land/std@0.141.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.141.0/path/mod.ts";
import * as streams from "https://deno.land/std@0.141.0/streams/mod.ts";
import { base58btc } from "https://esm.sh/multiformats@11.0.2/bases/base58?pin=v120";
import {} from "https://esm.sh/multiformats@11.0.2?pin=v120";
import { default as default2 } from "https://esm.sh/@multiformats/blake2@1.0.13?pin=v120";
import { CID } from "https://esm.sh/multiformats@11.0.2/cid?pin=v120";
import { miniexec } from "https://deno.land/x/miniexec@1.0.0/mod.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.14.47/mod.js";
import * as sqlite from "https://deno.land/x/sqlite@v3.7.1/mod.ts";
import {} from "https://deno.land/x/sqlite@v3.7.1/mod.ts";
var init_deps = __esm({
  "src/deps.ts"() {
  }
});

// src/database-fs.ts
var database_fs_exports = {};
__export(database_fs_exports, {
  clear: () => clear,
  count: () => count,
  dataFolder: () => dataFolder,
  initStorage: () => initStorage,
  iterKeys: () => iterKeys,
  readData: () => readData,
  writeData: () => writeData,
  writeDataOnce: () => writeDataOnce
});
async function initStorage(options = {}) {
  dataFolder = path.resolve(options.dirname);
  await Deno.mkdir(dataFolder, { mode: 488, recursive: true });
}
async function clear() {
  for await (const key of iterKeys()) {
    await Deno.remove(path.join(dataFolder, key));
  }
}
async function count() {
  let n = 0;
  for await (const _entry of Deno.readDir(dataFolder)) {
    n++;
  }
  return n;
}
async function* iterKeys() {
  for await (const entry of Deno.readDir(dataFolder)) {
    if (entry.isFile) {
      yield entry.name;
    }
  }
}
async function readData(key) {
  checkKey(key);
  return await Deno.readFile(path.join(dataFolder, key)).catch((_err) => void 0);
}
async function writeData(key, value) {
  if (typeof value === "string") {
    await Deno.writeTextFile(path.join(dataFolder, key), value);
  } else {
    await Deno.writeFile(path.join(dataFolder, key), value);
  }
}
async function writeDataOnce(key, value) {
  const options = { createNew: true };
  try {
    if (typeof value === "string") {
      await Deno.writeTextFile(path.join(dataFolder, key), value, options);
    } else {
      await Deno.writeFile(path.join(dataFolder, key), value, options);
    }
  } catch (err) {
    if (err.name !== "AlreadyExists")
      throw err;
  }
}
var dataFolder;
var init_database_fs = __esm({
  "src/database-fs.ts"() {
    "use strict";
    init_deps();
    init_utils();
    dataFolder = "";
  }
});

// src/database-sqlite.ts
var database_sqlite_exports = {};
__export(database_sqlite_exports, {
  count: () => count2,
  dataFolder: () => dataFolder2,
  initStorage: () => initStorage2,
  iterKeys: () => iterKeys2,
  readData: () => readData2,
  writeData: () => writeData2,
  writeDataOnce: () => writeDataOnce2
});
async function initStorage2(options = {}) {
  const { dirname, filename } = options;
  dataFolder2 = path.resolve(dirname);
  const filepath = path.join(dataFolder2, filename);
  if (db !== void 0) {
    if (filepath === dbPath) {
      return;
    }
    db.close(true);
  }
  db = new DB(filepath);
  db.execute("CREATE TABLE IF NOT EXISTS Data(key TEXT NOT NULL PRIMARY KEY, value TEXT NOT NULL)");
  dbPath = filepath;
  if (!options.internal) {
    console.log("Connected to the %s SQLite database.", filepath);
  }
  iterKeysStatement = db.prepareQuery("SELECT key FROM Data");
  readStatement = db.prepareQuery("SELECT value FROM Data WHERE key = ?");
  writeOnceStatement = db.prepareQuery("INSERT INTO Data(key, value) VALUES(?, ?) ON CONFLICT (key) DO NOTHING");
  writeStatement = db.prepareQuery("REPLACE INTO Data(key, value) VALUES(?, ?)");
}
function count2() {
  return db.query("SELECT COUNT(*) FROM Data")[0][0];
}
async function readData2(key) {
  const maybeRow = readStatement.first([key]);
  return maybeRow === void 0 ? void 0 : maybeRow[0] ?? new Uint8Array();
}
async function* iterKeys2() {
  for (const row of iterKeysStatement.iter()) {
    yield row[0];
  }
}
async function writeData2(key, value) {
  checkKey(key);
  writeStatement.execute([key, value]);
}
async function writeDataOnce2(key, value) {
  checkKey(key);
  writeOnceStatement.execute([key, value]);
}
var DB, db, dbPath, iterKeysStatement, readStatement, writeOnceStatement, writeStatement, dataFolder2;
var init_database_sqlite = __esm({
  "src/database-sqlite.ts"() {
    init_deps();
    init_utils();
    ({ DB } = sqlite);
    dataFolder2 = "";
  }
});

// src/utils.ts
function checkKey(key) {
  if (!isValidKey(key)) {
    throw new Error(`bad key: ${JSON.stringify(key)}`);
  }
}
async function createEntryFromFile(filepath) {
  const buffer = await Deno.readFile(filepath);
  const key = createCID(buffer);
  return [key, buffer];
}
function createCID(data, multicode = multicodes.RAW) {
  const uint8array = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = multihasher.digest(uint8array);
  return CID.create(1, multicode, digest).toString(multibase.encoder);
}
function exit(message) {
  console.error("[chel]", colors.red("Error:"), message);
  Deno.exit(1);
}
async function getBackend(src, { type, create } = { type: "", create: false }) {
  const fsOptions = { internal: true, dirname: src };
  const sqliteOptions = { internal: true, dirname: path.dirname(src), filename: path.basename(src) };
  if (!create && !await isDir(src) && !await isFile(src))
    throw new Error(`not found: "${src}"`);
  let from = type;
  if (!from) {
    if (await isDir(src))
      from = "fs";
    else if (await isFile(src))
      from = "sqlite";
    else
      throw new Error(`could not infer backend type. Not found: "${src}"`);
  }
  let initOptions;
  switch (from) {
    case "fs":
      initOptions = fsOptions;
      break;
    case "sqlite":
      initOptions = sqliteOptions;
      break;
    default:
      throw new Error(`unknown backend type: "${from}"`);
  }
  const backend2 = backends[from];
  try {
    await backend2.initStorage(initOptions);
  } catch (error) {
    throw new Error(`could not init '${from}' storage backend at "${src}": ${error.message}`);
  }
  return backend2;
}
function isArrayLength(arg) {
  return Number.isInteger(arg) && arg >= 0 && arg <= 2 ** 32 - 1;
}
async function isDir(path2) {
  try {
    return (await Deno.stat(path2)).isDirectory;
  } catch {
    return false;
  }
}
async function isFile(path2) {
  try {
    return (await Deno.stat(path2)).isFile;
  } catch {
    return false;
  }
}
function isNotHashKey(key) {
  return key.startsWith("head=") || key.startsWith("name=");
}
function isURL(arg) {
  return URL.canParse(arg) && Boolean(new URL(arg).host);
}
function isValidKey(key) {
  return !/[\x00-\x1f\x7f\t\\/]/.test(key);
}
async function readRemoteData(src, key) {
  const buffer = await fetch(`${src}/file/${key}`).then((r) => r.ok ? r.arrayBuffer() : Promise.reject(new Error(`failed network request to ${src}: ${r.status} - ${r.statusText}`)));
  return new Uint8Array(buffer);
}
async function revokeNet() {
  await Deno.permissions.revoke({ name: "net" });
}
var backends, multibase, multicodes, multihasher;
var init_utils = __esm({
  "src/utils.ts"() {
    "use strict";
    init_deps();
    init_database_fs();
    init_database_sqlite();
    backends = { fs: database_fs_exports, sqlite: database_sqlite_exports };
    multibase = base58btc;
    multicodes = { JSON: 512, RAW: 0 };
    multihasher = default2.blake2b.blake2b256;
  }
});

// src/commands.ts
var commands_exports = {};
__export(commands_exports, {
  deploy: () => deploy,
  eventsAfter: () => eventsAfter,
  get: () => get,
  hash: () => hash,
  help: () => help,
  manifest: () => manifest,
  migrate: () => migrate,
  upload: () => upload,
  version: () => version
});

// src/deploy.ts
init_deps();

// src/upload.ts
init_deps();
init_utils();
async function upload(args, internal = false) {
  const [urlOrDirOrSqliteFile, ...files] = args;
  if (files.length === 0)
    throw new Error(`missing files!`);
  const uploaded = [];
  const uploaderFn = await isDir(urlOrDirOrSqliteFile) ? uploadEntryToDir : urlOrDirOrSqliteFile.endsWith(".db") ? uploadEntryToSQLite : uploadEntryToURL;
  for (const filepath of files) {
    const entry = await createEntryFromFile(filepath);
    const destination = await uploaderFn(entry, urlOrDirOrSqliteFile);
    if (!internal) {
      console.log(colors.green("uploaded:"), destination);
    } else {
      console.log(colors.green(`${path.relative(".", filepath)}:`), destination);
    }
    uploaded.push([filepath, destination]);
  }
  return uploaded;
}
function uploadEntryToURL([cid, buffer], url) {
  const form = new FormData();
  form.append("hash", cid);
  form.append("data", new Blob([buffer]));
  return fetch(`${url}/file`, { method: "POST", body: form }).then(handleFetchResult("text")).then((r) => {
    if (r !== `/file/${cid}`) {
      throw new Error(`server returned bad URL: ${r}`);
    }
    return `${url}${r}`;
  });
}
async function uploadEntryToDir([cid, buffer], dir) {
  await revokeNet();
  const destination = path.join(dir, cid);
  await Deno.writeFile(destination, buffer);
  return destination;
}
async function uploadEntryToSQLite([cid, buffer], sqlitedb) {
  await revokeNet();
  const { initStorage: initStorage3, writeData: writeData3 } = await Promise.resolve().then(() => (init_database_sqlite(), database_sqlite_exports));
  initStorage3({ dirname: path.dirname(sqlitedb), filename: path.basename(sqlitedb) });
  writeData3(cid, buffer);
  return cid;
}
function handleFetchResult(type) {
  return function(r) {
    if (!r.ok)
      throw new Error(`${r.status}: ${r.statusText}`);
    return r[type]();
  };
}

// src/deploy.ts
async function deploy(args) {
  const [urlOrDirOrSqliteFile, ...manifests] = args;
  if (manifests.length === 0)
    throw new Error("missing url or manifests!");
  const toUpload = [];
  for (const manifestPath of manifests) {
    const json = JSON.parse(Deno.readTextFileSync(manifestPath));
    const body = JSON.parse(json.body);
    const dirname = path.dirname(manifestPath);
    toUpload.push(path.join(dirname, body.contract.file));
    if (body.contractSlim) {
      toUpload.push(path.join(dirname, body.contractSlim.file));
    }
    toUpload.push(manifestPath);
  }
  await upload([urlOrDirOrSqliteFile, ...toUpload], true);
}

// src/eventsAfter.ts
init_deps();
init_utils();
var backend;
var defaultLimit = 50;
var headPrefix = "head=";
async function eventsAfter(args) {
  const parsedArgs = flags.parse(args);
  const limit = Number(parsedArgs.limit ?? defaultLimit);
  if (!isArrayLength(limit))
    exit("argument --limit must be a valid array length");
  const [urlOrLocalPath, contractID, hash2] = parsedArgs._.map(String);
  const src = urlOrLocalPath;
  try {
    let messages;
    if (isURL(src)) {
      messages = await getRemoteMessagesSince(src, contractID, hash2, limit);
    } else {
      messages = await getMessagesSince(src, contractID, hash2, limit);
    }
    console.log(JSON.stringify(messages.map((s) => JSON.parse(s)), null, 2));
  } catch (error) {
    exit(error.message);
  }
}
async function getMessage(hash2) {
  const value = await readString(hash2);
  if (!value)
    throw new Error(`no entry for ${hash2}!`);
  return JSON.parse(value).message;
}
async function getMessagesSince(src, contractID, since, limit) {
  backend = await getBackend(src);
  const contractHEAD = await readString(`${headPrefix}${contractID}`);
  if (contractHEAD === void 0) {
    throw new Deno.errors.NotFound(`contract ${contractID} doesn't exist!`);
  }
  const entries = [];
  let currentHEAD = contractHEAD;
  while (true) {
    const entry = await getMessage(currentHEAD);
    if (!entry) {
      throw new Deno.errors.NotFound(`entry ${currentHEAD} no longer exists.`);
    }
    entries.push(entry);
    if (currentHEAD === since) {
      break;
    } else {
      currentHEAD = JSON.parse(entry).previousHEAD;
      if (currentHEAD === null) {
        throw new Deno.errors.NotFound(`entry ${since} was not found in contract ${contractID}.`);
      }
    }
  }
  return entries.reverse().slice(0, limit);
}
async function getRemoteMessagesSince(src, contractID, since, limit) {
  const response = await fetch(`${src}/eventsAfter/${contractID}/${since}`);
  if (!response.ok) {
    const bodyText = await response.text().catch((_) => "") || ``;
    throw new Error(`failed network request to ${src}: ${response.status} - ${response.statusText} - '${bodyText}'`);
  }
  const b64messages = (await response.json()).reverse();
  if (b64messages.length > limit) {
    b64messages.length = limit;
  }
  return b64messages.map((b64str) => JSON.parse(new TextDecoder().decode(base64.decode(b64str))).message);
}
async function readString(key) {
  const rv = await backend.readData(key);
  if (rv === void 0)
    return void 0;
  return typeof rv === "string" ? rv : new TextDecoder().decode(rv);
}

// src/get.ts
init_deps();
init_utils();
async function get(args) {
  const parsedArgs = flags.parse(args);
  const [urlOrLocalPath, key] = parsedArgs._.map(String);
  const src = urlOrLocalPath;
  try {
    const data = isURL(src) ? await readRemoteData(src, key) : await (await getBackend(src)).readData(key);
    if (data === void 0)
      exit(`no entry found for ${key}`);
    if (typeof data === "string") {
      console.log(data);
    } else {
      await streams.writeAll(Deno.stdout, data);
    }
  } catch (error) {
    exit(error.message);
  }
}

// src/hash.ts
init_utils();
async function hash(args, internal = false) {
  const [filename] = args;
  if (!filename) {
    console.error("please pass in a file");
    Deno.exit(1);
  }
  const [cid] = await createEntryFromFile(filename);
  if (!internal) {
    console.log(`CID(${filename}):`, cid);
  }
  return cid;
}

// src/help.ts
function help(args) {
  if (!args || args.length === 0) {
    console.log(`
      chel
      chel help [command]
      chel version
      chel keygen [--out <key.json>]
      chel manifest [-k|--key <pubkey1> [-k|--key <pubkey2> ...]] [--out=<manifest.json>] [-s|--slim <contract-slim.js>] [-v|--version <version>] <key.json> <contract-bundle.js>
      chel deploy <url-or-dir-or-sqlitedb> <contract-manifest.json> [<manifest2.json> [<manifest3.json> ...]]
      chel upload <url-or-dir-or-sqlitedb> <file1> [<file2> [<file3> ...]]
      chel latestState <url> <contractID>
      chel eventsAfter [--limit N] <url-or-dir-or-sqlitedb> <contractID> <hash>
      chel eventsBefore [--limit N] <url> <contractID> <hash>
      chel get <url-or-dir-or-sqlitedb> <hash>
      chel hash <file>
      chel migrate --from <backend> --to <backend> --out <dir-or-sqlitedb> <dir-or-sqlitedb>
    `);
  } else if (helpDict[args[0]]) {
    console.log(helpDict[args[0]]);
  } else {
    console.error(`Unknown command: ${args[0]}`);
  }
}
var helpDict = {
  help: `
    chel help [command]
  `,
  version: `
    chel version
  `,
  hash: `
    chel hash <file>

    Computes and logs the content identifier (CID) for the given file.
    File contents will be interpreted as raw binary data, unless the file extension is '.json'.
  `,
  manifest: `
    chel manifest [-k|--key <pubkey1> [-k|--key <pubkey2> ...]]
                  [--out=<manifest.json>]
                  [--slim <contract-slim.js>]
                  [-v|--version <version>]
                  <key.json> <contract-bundle.js>

    If unspecified, <version> is set to 'x'.
  `,
  migrate: `
    chel migrate --from (fs|sqlite) --to (fs|sqlite) --out <dir-or-sqlitedb> [<dir-or-sqlitedb>='.']

    Reads all key-value pairs from a given database and creates or updates another database accordingly.
    - The output database will be created if necessary.
    - The source database won't be modified nor deleted.
    - Invalid key-value pairs entries will be skipped.
    - Arguments --from and --to must be different.
    - The source and --out must resolve to distinct paths.
    - Requires read and write access to the source.
    - Requires read and write access to --out.
  `,
  upload: `
    chel upload <url-or-dir-or-sqlitedb> <file1> [<file2> [<file3> ...]]

    Requires read and write access to the destination.
  `,
  deploy: `
    chel deploy <url-or-dir> <contract-manifest.json> [<manifest2.json> [<manifest3.json> ...]]
  `,
  eventsAfter: `
    chel eventsAfter [--limit N=50] <url-or-localpath> <contractID> <hash>

    Displays a JSON array of the N first events that happened in a given contract, since a given entry identified by its hash.
    - Older events are displayed first.
    - The output is parseable with tools such as 'jq'.
    - If <hash> is the same as <contractID>, then the oldest events will be returned.
    - If <url-or-localpath> is a URL, then its /eventsAfter REST endpoint will be called.
  `,
  get: `
    chel get <url-or-dir-or-sqlitedb> <hash>
    
    Retrieves the entry associated with a given <hash> key, from a given database or server.
    When the first argument is a URL, this queries the GET <url>/file/<hash> route.

    - The output can be piped to a file, like this:
      chel get https://url.com mygreatlongkey > file.png
  `
};

// src/manifest.ts
init_deps();
init_utils();
async function manifest(args) {
  await revokeNet();
  const parsedArgs = flags.parse(args);
  const [_keyFile, contractFile] = parsedArgs._;
  const parsedFilepath = path.parse(contractFile);
  const { name: contractName, base: contractBasename, dir: contractDir } = parsedFilepath;
  const version2 = parsedArgs.version || parsedArgs.v || "x";
  const slim = parsedArgs.slim || parsedArgs.s;
  const outFilepath = path.join(contractDir, `${contractName}.${version2}.manifest.json`);
  const body = {
    version: version2,
    contract: {
      hash: await hash([contractFile], true),
      file: contractBasename
    },
    authors: [
      { cipher: "algo", key: "<pubkey from deploy-key.json>" },
      { cipher: "algo", key: "<pubkey from alex.json>" }
    ]
  };
  if (slim) {
    body.contractSlim = {
      file: path.basename(slim),
      hash: await hash([slim], true)
    };
  }
  const manifest2 = JSON.stringify({
    head: { manifestVersion: "1.0.0" },
    body: JSON.stringify(body),
    signature: {
      key: "<which of the 'authors' keys was used to sign 'body'>",
      signature: "<signature>"
    }
  });
  if (parsedArgs.out === "-") {
    console.log(manifest2);
  } else {
    const outFile = parsedArgs.out || outFilepath;
    Deno.writeTextFileSync(outFile, manifest2);
    console.log(colors.green("wrote:"), outFile);
  }
}

// src/migrate.ts
init_deps();
init_utils();
async function migrate(args) {
  await revokeNet();
  const parsedArgs = flags.parse(args);
  const { from, to, out } = parsedArgs;
  const src = path.resolve(String(parsedArgs._[0]) ?? ".");
  if (!from)
    exit("missing argument: --from");
  if (!to)
    exit("missing argument: --to");
  if (!out)
    exit("missing argument: --out");
  if (from === to)
    exit("arguments --from and --to must be different");
  let backendFrom;
  let backendTo;
  try {
    backendFrom = await getBackend(src, { type: from, create: false });
    backendTo = await getBackend(out, { type: to, create: true });
  } catch (error) {
    exit(error.message);
  }
  const numKeys = await backendFrom.count();
  let numVisitedKeys = 0;
  for await (const key of backendFrom.iterKeys()) {
    if (!isValidKey(key))
      continue;
    const value = await backendFrom.readData(key);
    if (value === void 0)
      continue;
    if (isNotHashKey(key)) {
      await backendTo.writeData(key, value);
    } else {
      await backendTo.writeDataOnce(key, value);
    }
    ++numVisitedKeys;
    if (numVisitedKeys % (numKeys / 10) < 1) {
      console.log(`[chel] Migrating... ${Math.round(numVisitedKeys / (numKeys / 10))}0% done`);
    }
  }
  numKeys && console.log(`[chel] ${colors.green("Migrated:")} ${numKeys} entries`);
}

// src/version.ts
function version() {
  console.log("2.0.1");
}

// src/main.ts
var [command, ...rest] = Deno.args;
if (!command) {
  help();
} else if (commands_exports[command]) {
  await commands_exports[command](rest);
} else {
  console.error(`Unknown command: ${command}`);
  Deno.exit(1);
}
Deno.exit(0);
