#!/usr/bin/env node
/**
 * IMDb → MongoDB  (Course Subset: Movies + Ratings)
 * ===================================================
 * Downloads IMDb datasets and imports a curated subset into MongoDB:
 *   - Movies only (titleType = movie) from title.basics
 *   - Ratings joined in from title.ratings
 *   - ~650K documents, each enriched with its rating
 *
 * Final document shape:
 * {
 *   _id:              "tt0111161",
 *   primaryTitle:     "The Shawshank Redemption",
 *   originalTitle:    "The Shawshank Redemption",
 *   startYear:        1994,
 *   endYear:          null,
 *   runtimeMinutes:   142,
 *   genres:           ["Drama"],
 *   isAdult:          false,
 *   rating: {
 *     averageRating:  9.3,
 *     numVotes:       2800000
 *   }
 * }
 *
 * Requirements:
 *   npm install mongodb cli-progress
 *
 * Usage:
 *   node imdb_meteo_to_mongodb.js
 *   node imdb_meteo_to_mongodb.js --uri "mongodb+srv://..." --db imdb
 *   node imdb_meteo_to_mongodb.js --no-download   # reuse already-downloaded files
 *   node imdb_meteo_to_mongodb.js --help
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");
const readline = require("readline");
const { MongoClient } = require("mongodb");
const { SingleBar, Presets } = require("cli-progress");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const IMDB_BASE_URL = "https://datasets.imdbws.com/";
const NULL_VALUE = "\\N";
const BATCH_SIZE = 5_000;

const FILES = {
  basics: "title.basics.tsv.gz",
  ratings: "title.ratings.tsv.gz",
};

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };
const toFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const nullify = (v) => (v === NULL_VALUE ? null : v);

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function download(filename, destDir, force = false) {
  const dest = path.join(destDir, filename);
  if (fs.existsSync(dest) && !force) {
    console.log(`  ✓ ${filename} already exists — skipping download.`);
    return Promise.resolve(dest);
  }

  return new Promise((resolve, reject) => {
    const bar = new SingleBar(
      { format: `  ↓ ${filename} [{bar}] {percentage}% | {value}/{total} MB`, clearOnComplete: true },
      Presets.shades_classic
    );

    const makeRequest = (url) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302)
          return makeRequest(res.headers.location);
        if (res.statusCode !== 200)
          return reject(new Error(`HTTP ${res.statusCode}`));

        const totalMB = Math.round(parseInt(res.headers["content-length"] || "0", 10) / 1024 / 1024);
        bar.start(totalMB || 100, 0);
        let downloaded = 0;

        const out = fs.createWriteStream(dest);
        res.on("data", (chunk) => { downloaded += chunk.length; bar.update(Math.round(downloaded / 1024 / 1024)); });
        res.pipe(out);
        out.on("finish", () => { bar.stop(); resolve(dest); });
        out.on("error", reject);
        res.on("error", reject);
      }).on("error", reject);
    };

    makeRequest(IMDB_BASE_URL + filename);
  });
}

// ---------------------------------------------------------------------------
// Streaming TSV reader
// ---------------------------------------------------------------------------

async function* readTsv(gzPath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(gzPath).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });

  let headers = null;
  for await (const line of rl) {
    if (!headers) { headers = line.split("\t"); continue; }
    const values = line.split("\t");
    const row = {};
    for (let i = 0; i < headers.length; i++) row[headers[i]] = values[i];
    yield row;
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Load all ratings into a Map (small file, fits in memory ~40 MB)
// ---------------------------------------------------------------------------

async function loadRatings(gzPath) {
  console.log("\n📊 Loading ratings into memory …");
  const map = new Map();
  for await (const row of readTsv(gzPath)) {
    map.set(row.tconst, {
      averageRating: toFloat(row.averageRating),
      numVotes: toInt(row.numVotes),
    });
  }
  console.log(`   Loaded ${map.size.toLocaleString()} ratings ✓`);
  return map;
}

// ---------------------------------------------------------------------------
// Step 2 — Stream movies, join ratings, bulk-upsert into MongoDB
// ---------------------------------------------------------------------------

async function importMovies(collection, basicsPath, ratingsMap, upsert) {
  console.log("\n🎬 Importing movies …");

  let total = 0, skipped = 0, errors = 0;
  let batch = [];
  const t0 = Date.now();

  const flush = async (b) => {
    if (!b.length) return;
    try {
      if (upsert) {
        const ops = b.map((doc) => ({
          updateOne: { filter: { _id: doc._id }, update: { $set: doc }, upsert: true },
        }));
        const r = await collection.bulkWrite(ops, { ordered: false });
        total += r.upsertedCount + r.modifiedCount;
      } else {
        const r = await collection.insertMany(b, { ordered: false });
        total += r.insertedCount;
      }
    } catch (e) {
      const errs = e.result?.getWriteErrorCount?.() ?? b.length;
      errors += errs;
      total += b.length - errs;
    }
  };

  for await (const row of readTsv(basicsPath)) {
    // Filter: movies only
    if (row.titleType !== "movie") { skipped++; continue; }

    const tconst = row.tconst;
    const doc = {
      _id:            tconst,
      primaryTitle:   nullify(row.primaryTitle),
      originalTitle:  nullify(row.originalTitle),
      startYear:      toInt(row.startYear),
      endYear:        toInt(row.endYear),
      runtimeMinutes: toInt(row.runtimeMinutes),
      genres:         row.genres === NULL_VALUE ? [] : row.genres.split(","),
      isAdult:        row.isAdult === "1",
    };

    // Join rating if available
    const rating = ratingsMap.get(tconst);
    if (rating) doc.rating = rating;

    batch.push(doc);
    if (batch.length >= BATCH_SIZE) { await flush(batch); batch = []; }
  }

  await flush(batch);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`   ✔ ${total.toLocaleString()} movies imported in ${elapsed}s`);
  console.log(`   ↷ ${skipped.toLocaleString()} non-movie titles skipped`);
  if (errors) console.log(`   ⚠ ${errors.toLocaleString()} errors/duplicates skipped`);
}

// ---------------------------------------------------------------------------
// Step 3 — Create indexes optimised for the course exercises
// ---------------------------------------------------------------------------

async function createIndexes(collection) {
  console.log("\n📑 Creating indexes …");

  const indexes = [
    // Full-text search on title
    { key: { primaryTitle: "text", originalTitle: "text" }, options: { default_language: "none", weights: { primaryTitle: 10, originalTitle: 5 }, name: "text_title" } },
    // Filtering & sorting
    { key: { startYear: 1 },          options: { name: "idx_year" } },
    { key: { genres: 1 },             options: { name: "idx_genres" } },
    { key: { "rating.averageRating": -1 }, options: { name: "idx_rating" } },
    { key: { "rating.numVotes": -1 },  options: { name: "idx_votes" } },
    { key: { runtimeMinutes: 1 },     options: { name: "idx_runtime" } },
    // Compound — common aggregation patterns
    { key: { startYear: 1, "rating.averageRating": -1 }, options: { name: "idx_year_rating" } },
    { key: { genres: 1, "rating.averageRating": -1 },    options: { name: "idx_genre_rating" } },
    // Sparse index — only movies that have a rating
    { key: { "rating.averageRating": 1 }, options: { sparse: true, name: "idx_rated_movies" } },
  ];

  for (const { key, options = {} } of indexes) {
    try {
      await collection.createIndex(key, { background: true, ...options });
      const label = options.name ?? JSON.stringify(key);
      console.log(`  ✓ ${label}`);
    } catch (e) {
      console.warn(`  ⚠ Index skipped (${e.message})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    uri: "mongodb://localhost:27017/",
    db: "imdb",
    collection: "movies",
    dataDir: "./imdb_data",
    noDownload: false,
    forceDownload: false,
    upsert: true,
    noIndexes: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--uri":            opts.uri = args[++i]; break;
      case "--db":             opts.db = args[++i]; break;
      case "--collection":     opts.collection = args[++i]; break;
      case "--data-dir":       opts.dataDir = args[++i]; break;
      case "--no-download":    opts.noDownload = true; break;
      case "--force-download": opts.forceDownload = true; break;
      case "--no-upsert":      opts.upsert = false; break;
      case "--no-indexes":     opts.noIndexes = true; break;
      case "--help": case "-h":
        console.log(`
Usage: node ${path.basename(__filename)} [options]

Options:
  --uri <uri>         MongoDB URI          (default: mongodb://localhost:27017/)
  --db <name>         Database name        (default: imdb)
  --collection <name> Collection name      (default: movies)
  --data-dir <path>   Download directory   (default: ./imdb_data)
  --no-download       Skip download step
  --force-download    Re-download even if files exist
  --no-upsert         Insert only (faster first run, fails on re-run)
  --no-indexes        Skip index creation
`);
        process.exit(0);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  fs.mkdirSync(opts.dataDir, { recursive: true });

  console.log("🎬 IMDb → MongoDB  (Movies + Ratings subset)");
  console.log("─".repeat(50));

  // Connect
  console.log(`\n🔌 Connecting to MongoDB at ${opts.uri} …`);
  const client = new MongoClient(opts.uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("   Connected ✓");
  } catch (e) {
    console.error(`   ✗ Could not connect: ${e.message}`);
    process.exit(1);
  }

  const db = client.db(opts.db);
  const collection = db.collection(opts.collection);

  // Download
  if (!opts.noDownload) {
    console.log("\n📥 Downloading IMDb datasets …");
    for (const filename of Object.values(FILES)) {
      try {
        await download(filename, opts.dataDir, opts.forceDownload);
      } catch (e) {
        console.error(`  ✗ Failed to download ${filename}: ${e.message}`);
        process.exit(1);
      }
    }
  }

  // Verify files exist
  for (const filename of Object.values(FILES)) {
    const p = path.join(opts.dataDir, filename);
    if (!fs.existsSync(p)) {
      console.error(`  ✗ File not found: ${p}. Run without --no-download first.`);
      process.exit(1);
    }
  }

  // Load ratings → Map
  const ratingsMap = await loadRatings(path.join(opts.dataDir, FILES.ratings));

  // Stream movies + join ratings → MongoDB
  await importMovies(
    collection,
    path.join(opts.dataDir, FILES.basics),
    ratingsMap,
    opts.upsert
  );

  // Indexes
  if (!opts.noIndexes) await createIndexes(collection);

  // Summary
  const count = await collection.countDocuments();
  const rated = await collection.countDocuments({ rating: { $exists: true } });
  console.log("\n✅ Done!");
  console.log(`   Database   : ${opts.db}`);
  console.log(`   Collection : ${opts.collection}`);
  console.log(`   Total docs : ${count.toLocaleString()}`);
  console.log(`   With rating: ${rated.toLocaleString()} (${Math.round(rated / count * 100)}%)`);

  await client.close();
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
