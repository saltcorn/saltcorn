/**
 * Helpers for the S3 integration tests (tests/s3_storage.test.js).
 *
 * These tests run against MinIO in a container, so the S3 code paths are
 * exercised for real: objects are written and read over the S3 API, presigned
 * URLs are fetched, and backups are uploaded and expired. Assertions are made
 * with a plain AWS SDK client rather than through Saltcorn's own helpers, so a
 * bug in those helpers cannot make a test pass.
 *
 * The suite is skipped unless SALTCORN_TEST_S3_ENDPOINT is set, so the normal
 * test runs (which have no object store) are unaffected. whale-ci sets it in
 * the `s3_tests` job; to run locally:
 *
 *   docker run -d --name sc-minio -p 9000:9000 \
 *     -e MINIO_ROOT_USER=saltcorn -e MINIO_ROOT_PASSWORD=scsecretkey \
 *     minio/minio:RELEASE.2025-04-22T22-12-26Z server /data
 *   SALTCORN_TEST_S3_ENDPOINT=localhost:9000 npx saltcorn run-tests server \
 *     -f tests/s3_storage.test.js
 *
 * NOTE: the endpoint hostname must not contain an underscore. MinIO answers
 * 400 to a Host header containing one, so the whale-ci service step is named
 * with hyphens (`s3-tests-minio`) rather than the underscores used elsewhere.
 *
 * @category server
 * @module tests/s3help
 */
import {
  S3,
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import db from "@saltcorn/data/db";
import { getState } from "@saltcorn/data/db/state";

const envOr = (key, dflt) => process.env[key] || dflt;

/** host:port of the S3 server. Unset means: no object store, skip the suite. */
const s3Endpoint = () => process.env.SALTCORN_TEST_S3_ENDPOINT;

/** Whether an object store was configured for this run. */
const s3TestsEnabled = () => !!s3Endpoint();

const accessKey = () => envOr("SALTCORN_TEST_S3_ACCESS_KEY", "saltcorn");
const accessSecret = () => envOr("SALTCORN_TEST_S3_SECRET", "scsecretkey");
const region = () => envOr("SALTCORN_TEST_S3_REGION", "us-east-1");

/** Bucket holding uploaded files when S3 file storage is enabled. */
const filesBucket = () => envOr("SALTCORN_TEST_S3_FILES_BUCKET", "sc-files");

/** Bucket the auto backup writes to. */
const backupBucket = () =>
  envOr("SALTCORN_TEST_S3_BACKUP_BUCKET", "sc-backups");

/** The endpoint as a URL. The test server is plain http. */
const endpointUrl = () => `http://${s3Endpoint()}`;

let client;
/**
 * A plain SDK client, independent of Saltcorn's cached one, used to assert on
 * what actually landed in the bucket.
 * @returns {object}
 */
const rawClient = () => {
  if (!client)
    client = new S3({
      region: region(),
      forcePathStyle: true,
      endpoint: endpointUrl(),
      credentials: {
        accessKeyId: accessKey(),
        secretAccessKey: accessSecret(),
      },
    });
  return client;
};

/**
 * The key Saltcorn writes a file to: object keys are prefixed with the tenant
 * schema, which under `node --test` is the per-process schema.
 * @param {string} relPath
 * @returns {string}
 */
const tenantKey = (relPath) =>
  `${db.getTenantSchema()}/${relPath.replace(/^\/+/, "")}`;

/**
 * Create the test buckets, waiting for the server to accept connections. The
 * container is announced in its log before it serves requests, and the tests
 * are the first thing to touch it.
 * @returns {Promise<void>}
 */
const ensureBuckets = async () => {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      for (const Bucket of [filesBucket(), backupBucket()]) {
        try {
          const res = await rawClient().send(
            new CreateBucketCommand({ Bucket })
          );
        } catch (e) {
          // already there from an earlier run - that is fine
          if (
            e.name !== "BucketAlreadyOwnedByYou" &&
            e.name !== "BucketAlreadyExists"
          )
            throw e;
        }
      }
      return;
    } catch (e) {
      lastError = e;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `Could not create buckets at ${endpointUrl()}: ${lastError?.message || lastError}`
  );
};

/**
 * Every key in a bucket, optionally restricted to a prefix.
 * @param {string} bucket
 * @param {string} [prefix]
 * @returns {Promise<string[]>}
 */
const listKeys = async (bucket, prefix) => {
  const keys = [];
  let ContinuationToken;
  do {
    const res = await rawClient().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken,
      })
    );
    for (const obj of res.Contents || []) keys.push(obj.Key);
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return keys;
};

/**
 * Remove every object in a bucket, so each test starts from a known state.
 * @param {string} bucket
 * @returns {Promise<void>}
 */
const emptyBucket = async (bucket) => {
  const keys = await listKeys(bucket);
  if (!keys.length) return;
  await rawClient().send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    })
  );
};

/**
 * @param {string} bucket
 * @param {string} key
 * @returns {Promise<object|null>} the HeadObject response, or null if absent
 */
const headKey = async (bucket, key) => {
  try {
    return await rawClient().send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404)
      return null;
    throw e;
  }
};

/**
 * @param {string} bucket
 * @param {string} key
 * @returns {Promise<Buffer>}
 */
const getKey = async (bucket, key) => {
  const res = await rawClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

/**
 * @param {string} bucket
 * @param {string} key
 * @param {string|Buffer} body
 * @returns {Promise<void>}
 */
const putKey = async (bucket, key, body) => {
  await rawClient().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: Buffer.from(body) })
  );
};

/**
 * Point Saltcorn's file storage at the containerised object store.
 * @param {boolean} [enabled] - value for storage_s3_enabled, default true
 * @returns {Promise<void>}
 */
const configureS3Storage = async (enabled = true) => {
  const state = getState();
  await state.setConfig("storage_s3_bucket", filesBucket());
  await state.setConfig("storage_s3_endpoint", s3Endpoint());
  await state.setConfig("storage_s3_region", region());
  await state.setConfig("storage_s3_secure", false);
  await state.setConfig("storage_s3_access_key", accessKey());
  await state.setConfig("storage_s3_access_secret", accessSecret());
  await state.setConfig("storage_s3_enabled", enabled);
};

/**
 * Point the auto backup at the containerised object store. Independent of
 * file storage: a site can back up to S3 while keeping files on local disk.
 * @param {object} [opts]
 * @param {string} [opts.prefix] - backup_s3_path_prefix
 * @param {number} [opts.expireDays] - auto_backup_expire_days
 * @returns {Promise<void>}
 */
const configureS3Backup = async (opts = {}) => {
  const state = getState();
  await state.setConfig("auto_backup_destination", "S3");
  await state.setConfig("backup_s3_bucket", backupBucket());
  await state.setConfig("backup_s3_endpoint", s3Endpoint());
  await state.setConfig("backup_s3_region", region());
  await state.setConfig("backup_s3_secure", false);
  await state.setConfig("backup_s3_access_key", accessKey());
  await state.setConfig("backup_s3_access_secret", accessSecret());
  await state.setConfig("backup_s3_path_prefix", opts.prefix || "");
  await state.setConfig("auto_backup_expire_days", opts.expireDays ?? 0);
};

export {
  s3TestsEnabled,
  s3Endpoint,
  endpointUrl,
  accessKey,
  accessSecret,
  region,
  filesBucket,
  backupBucket,
  rawClient,
  tenantKey,
  ensureBuckets,
  listKeys,
  emptyBucket,
  headKey,
  getKey,
  putKey,
  configureS3Storage,
  configureS3Backup,
};
