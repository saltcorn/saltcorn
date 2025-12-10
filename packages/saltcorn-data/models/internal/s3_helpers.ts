import db from "../../db";
const getStateInstance = () => {
  const { getState } = require("../../db/state");
  return getState();
};
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const path = require("path");
const posixPath = path.posix;

type S3Settings = {
  bucket?: string;
  endpoint?: string;
  region?: string;
  secure: boolean;
  accessKey?: string;
  accessSecret?: string;
};

type NormalizedS3Settings = S3Settings & {
  bucketInEndpointHost?: boolean;
};

type MetadataInput = {
  min_role_read?: number;
  user_id?: number;
  mime_super?: string;
  mime_sub?: string;
  filename?: string;
};

type MetadataOutput = MetadataInput;

export type S3ListResult = {
  key: string;
  relativePath: string;
  size: number;
  lastModified?: Date;
};

export type S3HeadResult = S3ListResult & {
  metadata: MetadataOutput;
  contentType?: string;
};

const META_KEYS = {
  min_role_read: "sc-min-role",
  user_id: "sc-user-id",
  mime_super: "sc-mime-super",
  mime_sub: "sc-mime-sub",
  filename: "sc-filename",
};

let cachedClient: S3 | null = null;
let cachedClientKey: string | null = null;

const normaliseEndpoint = (endpoint?: string, secure: boolean = true) => {
  if (!endpoint) return undefined;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${secure ? "https" : "http"}://${endpoint}`;
};

const normaliseEndpointAndBucket = (
  rawSettings: S3Settings
): NormalizedS3Settings => {
  const secure = rawSettings.secure;
  const endpoint = normaliseEndpoint(rawSettings.endpoint, secure);
  let bucket = rawSettings.bucket?.trim();
  let bucketInEndpointHost = false;

  if (!endpoint) return { ...rawSettings, endpoint, bucket };

  try {
    const url = new URL(endpoint);
    const pathParts = url.pathname.split("/").filter((p: string) => p.length);

    if (
      bucket &&
      url.hostname.toLowerCase().startsWith(`${bucket.toLowerCase()}.`)
    )
      bucketInEndpointHost = true;

    const bucketFromPath = !bucket && pathParts.length ? pathParts[0] : undefined;
    bucket = bucket || bucketFromPath;

    let endpointHost = url.hostname;
    if (
      bucket &&
      endpointHost.toLowerCase().startsWith(`${bucket.toLowerCase()}.`)
    ) {
      bucketInEndpointHost = true;
      endpointHost = endpointHost.slice(bucket.length + 1);
    }

    let cleanedPath = "/";
    if (
      bucket &&
      pathParts[0] &&
      pathParts[0].toLowerCase() === bucket.toLowerCase()
    ) {
      const remainder = pathParts.slice(1).join("/");
      cleanedPath = remainder ? `/${remainder}` : "/";
    } else if (pathParts.length) cleanedPath = `/${pathParts.join("/")}`;

    const portSegment = url.port ? `:${url.port}` : "";
    const normalizedEndpoint =
      `${url.protocol}//${endpointHost}${portSegment}${cleanedPath}`.replace(
        /\/+$/,
        ""
      );

    return {
      ...rawSettings,
      endpoint: normalizedEndpoint,
      bucket,
      bucketInEndpointHost,
    };
  } catch (e) {
    return { ...rawSettings, endpoint, bucket };
  }
};

const stripUrlPrefix = (input?: string): string => {
  if (!input) return "";
  const trimmed = input.trim();
  const normalizedScheme = trimmed.replace(/^(https?):\/(?!\/)/i, "$1://");
  try {
    const parsed = new URL(normalizedScheme);
    return parsed.pathname || "";
  } catch (e) {
    return trimmed.replace(/^https?:\/+[^/]+/i, "");
  }
};

const cleanSegment = (segment?: string): string => {
  if (!segment) return "";
  const stripped = stripUrlPrefix(segment);
  const replaced = stripped.replace(/\\/g, "/");
  const parts = replaced.split("/").filter((part: string) => part.length);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
};

const ensureTrailingSlash = (input?: string): string => {
  if (!input) return "";
  return input.endsWith("/") ? input : `${input}/`;
};

const getS3Settings = (): NormalizedS3Settings => {
  const state = getStateInstance();
  const raw: S3Settings = {
    bucket: state?.getConfig("storage_s3_bucket"),
    endpoint: state?.getConfig("storage_s3_endpoint"),
    region: state?.getConfig("storage_s3_region") || "us-east-1",
    secure: !!state?.getConfig("storage_s3_secure", true),
    accessKey: state?.getConfig("storage_s3_access_key"),
    accessSecret: state?.getConfig("storage_s3_access_secret"),
  };
  return normaliseEndpointAndBucket(raw);
};

export const isS3Enabled = (): boolean =>
  !!getStateInstance()?.getConfig("storage_s3_enabled");

const getTenantRoot = (): string => cleanSegment(db.getTenantSchema());

const cleanRelativePath = (relPath?: string): string => {
  if (!relPath) return "";
  const pathOnly = stripUrlPrefix(relPath);
  if (!pathOnly || pathOnly === "/" || pathOnly === ".") return "";
  return cleanSegment(pathOnly);
};

export const relativeKeyToPath = (key: string): string => {
  const root = getTenantRoot();
  if (!root) return key;
  if (key === root) return "";
  if (key.startsWith(`${root}/`)) return key.slice(root.length + 1);
  return key;
};

export const buildKeyFromRelative = (relPath?: string): string => {
  const root = getTenantRoot();
  const cleanedRel = cleanRelativePath(relPath);
  if (root && cleanedRel) return `${root}/${cleanedRel}`;
  if (root && !cleanedRel) return root;
  return cleanedRel;
};

const folderPrefix = (folder?: string): string => {
  const key = buildKeyFromRelative(cleanRelativePath(folder));
  if (!key) return "";
  return ensureTrailingSlash(key);
};

const requireBucket = (): string => {
  const { bucket } = getS3Settings();
  if (!bucket) throw new Error("S3 bucket is not configured");
  return bucket;
};

export const getResolvedBucket = (): string | undefined => {
  const { bucket } = getS3Settings();
  return bucket;
};

const clientCacheKey = (settings: S3Settings) =>
  JSON.stringify({
    endpoint: settings.endpoint,
    region: settings.region,
    accessKey: settings.accessKey,
    accessSecret: settings.accessSecret,
  });

export const getS3Client = (): S3 => {
  const settings = getS3Settings();
  const cacheKey = clientCacheKey(settings);
  if (!cachedClient || cachedClientKey !== cacheKey) {
    const cfg: any = {
      region: settings.region,
      forcePathStyle: true,
    };
    if (settings.endpoint) cfg.endpoint = settings.endpoint;
    if (settings.accessKey && settings.accessSecret) {
      cfg.credentials = {
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.accessSecret,
      };
    }
    cachedClient = new S3(cfg);
    cachedClientKey = cacheKey;
  }
  return cachedClient as S3;
};

const encodeMetadata = (meta: MetadataInput): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, storageKey] of Object.entries(META_KEYS)) {
    const value = (meta as any)[key];
    if (typeof value === "undefined" || value === null) continue;
    result[storageKey] = `${value}`;
  }
  return result;
};

const decodeMetadata = (meta?: Record<string, string>): MetadataOutput => {
  if (!meta) return {};
  const lowered: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta)) {
    lowered[key.toLowerCase()] = value;
  }
  const out: MetadataOutput = {};
  if (lowered[META_KEYS.min_role_read])
    out.min_role_read = +lowered[META_KEYS.min_role_read];
  if (lowered[META_KEYS.user_id]) out.user_id = +lowered[META_KEYS.user_id];
  if (lowered[META_KEYS.mime_super])
    out.mime_super = lowered[META_KEYS.mime_super];
  if (lowered[META_KEYS.mime_sub]) out.mime_sub = lowered[META_KEYS.mime_sub];
  if (lowered[META_KEYS.filename]) out.filename = lowered[META_KEYS.filename];
  return out;
};

const streamToBuffer = async (body: any): Promise<Buffer> => {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === "function") {
    const arr = await body.transformToByteArray();
    return Buffer.from(arr);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

export const listS3Folder = async (
  folder?: string,
  opts: { recursive?: boolean } = {}
): Promise<{ files: S3ListResult[]; directories: string[] }> => {
  const bucket = requireBucket();
  const client = getS3Client();
  const recursive = !!opts.recursive;
  const folderRel = cleanRelativePath(folder || "");
  const prefix = folderPrefix(folder || "");
  const folderRelWithSlash = folderRel ? `${folderRel}/` : "";
  const files: S3ListResult[] = [];
  const directorySet = new Set<string>();
  let ContinuationToken: string | undefined;

  const captureDirectory = (dirPath?: string) => {
    const cleaned = cleanRelativePath(dirPath || "");
    if (!cleaned) return;
    directorySet.add(cleaned);
  };

  const relativeWithinFolder = (relPath: string): string => {
    if (!folderRel) return relPath;
    if (relPath === folderRel) return "";
    if (relPath.startsWith(folderRelWithSlash))
      return relPath.slice(folderRelWithSlash.length);
    return relPath;
  };

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        Delimiter: recursive ? undefined : "/",
        ContinuationToken,
      })
    );
    const contents = resp.Contents || [];
    for (const obj of contents) {
      if (!obj.Key) continue;
      const isDirPlaceholder = obj.Key.endsWith("/");
      const keyWithoutSlash = isDirPlaceholder
        ? obj.Key.replace(/\/+$/, "")
        : obj.Key;
      if (!keyWithoutSlash) continue;
      const relativePath = relativeKeyToPath(keyWithoutSlash);
      if (isDirPlaceholder) {
        const withinFolder = relativeWithinFolder(relativePath);
        if (!withinFolder) continue;
        const immediateChild = withinFolder.split("/")[0];
        const dirPath = folderRel
          ? `${folderRel}/${immediateChild}`
          : immediateChild;
        captureDirectory(dirPath);
        continue;
      }
      files.push({
        key: obj.Key,
        relativePath,
        size: obj.Size || 0,
        lastModified: obj.LastModified,
      });
      const withinFolder = relativeWithinFolder(relativePath);
      if (withinFolder.includes("/")) {
        const immediateChild = withinFolder.split("/")[0];
        const dirPath = folderRel
          ? `${folderRel}/${immediateChild}`
          : immediateChild;
        captureDirectory(dirPath);
      }
    }
    if (!recursive) {
      for (const cp of resp.CommonPrefixes || []) {
        if (!cp.Prefix) continue;
        const rel = relativeKeyToPath(cp.Prefix.replace(/\/$/, ""));
        captureDirectory(rel);
      }
    }
    ContinuationToken = resp.IsTruncated
      ? resp.NextContinuationToken
      : undefined;
  } while (ContinuationToken);

  const directories = Array.from(directorySet).sort();
  return { files, directories };
};

export const headObject = async (
  relPath: string
): Promise<S3HeadResult | null> => {
  const bucket = requireBucket();
  const client = getS3Client();
  const Key = buildKeyFromRelative(relPath);
  try {
    const resp = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key,
      })
    );
    return {
      key: Key,
      relativePath: relativeKeyToPath(Key),
      size: resp.ContentLength || 0,
      lastModified: resp.LastModified,
      metadata: decodeMetadata(resp.Metadata),
      contentType: resp.ContentType,
    };
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404) return null;
    throw e;
  }
};

const copyWithinBucket = async (
  sourceKey: string,
  targetKey: string,
  metadata?: MetadataInput,
  contentType?: string
) => {
  const bucket = requireBucket();
  const client = getS3Client();
  const params: any = {
    Bucket: bucket,
    CopySource: encodeURI(`${bucket}/${sourceKey}`),
    Key: targetKey,
  };
  if (metadata) {
    params.MetadataDirective = "REPLACE";
    params.Metadata = encodeMetadata(metadata);
    if (contentType) params.ContentType = contentType;
  }
  await client.send(new CopyObjectCommand(params));
};

export const setObjectMetadata = async (
  relPath: string,
  metadata: MetadataInput
) => {
  const Key = buildKeyFromRelative(relPath);
  const existing = await headObject(relPath);
  await copyWithinBucket(Key, Key, metadata, existing?.contentType);
};

export const copyObject = async (
  fromRelPath: string,
  toRelPath: string,
  opts: { metadata?: MetadataInput } = {}
) => {
  const sourceKey = buildKeyFromRelative(fromRelPath);
  const targetKey = buildKeyFromRelative(toRelPath);
  let metadata = opts.metadata;
  let contentType: string | undefined;
  if (opts.metadata) {
    const head = await headObject(fromRelPath);
    contentType = head?.contentType;
  }
  await copyWithinBucket(sourceKey, targetKey, metadata, contentType);
};

export const deleteObject = async (relPath: string) => {
  const bucket = requireBucket();
  const client = getS3Client();
  const Key = buildKeyFromRelative(relPath);
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key }));
};

export const uploadBuffer = async (
  relPath: string,
  buffer: Buffer,
  mimetype: string,
  metadata: MetadataInput
) => {
  const bucket = requireBucket();
  const client = getS3Client();
  const Key = buildKeyFromRelative(relPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key,
      Body: buffer,
      ContentType: mimetype,
      Metadata: encodeMetadata(metadata),
    })
  );
};

export const downloadBuffer = async (relPath: string): Promise<Buffer> => {
  const bucket = requireBucket();
  const client = getS3Client();
  const Key = buildKeyFromRelative(relPath);
  const resp = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key,
    })
  );
  return await streamToBuffer(resp.Body);
};

export const getSignedFileUrl = async (
  relPath: string,
  opts: { download?: boolean; filename?: string; expiresIn?: number } = {}
): Promise<string> => {
  const bucket = requireBucket();
  const client = getS3Client();
  const Key = buildKeyFromRelative(relPath);
  const params: any = {
    Bucket: bucket,
    Key,
  };
  if (opts.download) {
    const filename = opts.filename || posixPath.basename(relPath);
    params.ResponseContentDisposition = `attachment; filename="${filename}"`;
  }
  const command = new GetObjectCommand(params);
  return await getSignedUrl(client, command, {
    expiresIn: opts.expiresIn || 300,
  });
};

export const getPublicFileUrl = (
  relPath: string,
  opts: { download?: boolean; filename?: string } = {}
): string => {
  const settings = getS3Settings();
  const Key = buildKeyFromRelative(relPath);
  const endpoint = settings.endpoint || "";
  const bucket = requireBucket();
  const baseUrl = endpoint
    ? `${endpoint.replace(/\/$/, "")}/${bucket}`
    : `https://${bucket}.s3.${settings.region}.amazonaws.com`;
  const url = `${baseUrl}/${encodeURI(Key)}`;
  if (!opts.download) return url;
  const filename = opts.filename || posixPath.basename(relPath);
  const cd = `attachment; filename="${encodeURIComponent(filename)}"`;
  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}response-content-disposition=${cd}`;
};

export const getServeUrl = async (
  relPath: string,
  opts: { download?: boolean; filename?: string } = {}
): Promise<string> => {
  try {
    return await getSignedFileUrl(relPath, opts);
  } catch (e) {
    return getPublicFileUrl(relPath, opts);
  }
};

export const publicUrlToRelativePath = (url?: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const settings = getS3Settings();
  const bucket = settings.bucket;
  if (!bucket) return null;
  const bases: string[] = [];
  const endpointBase = settings.endpoint?.replace(/\/$/, "");
  if (endpointBase) {
    bases.push(`${endpointBase}/${bucket}/`);
    try {
      const parsed = new URL(endpointBase);
      const pathPrefix = parsed.pathname.replace(/\/+$/, "");
      const suffix = pathPrefix ? `${pathPrefix}/` : "/";
      bases.push(`${parsed.protocol}//${bucket}.${parsed.host}${suffix}`);
    } catch (e) {
      const host = endpointBase.replace(/^https?:\/\//i, "");
      bases.push(`https://${bucket}.${host}/`);
    }
  }
  const region = settings.region || "us-east-1";
  bases.push(`https://${bucket}.s3.${region}.amazonaws.com/`);
  bases.push(`https://${bucket}.s3.amazonaws.com/`);
  for (const base of bases) {
    if (trimmed.startsWith(base)) {
      const remainder = trimmed.slice(base.length);
      const withoutQuery = remainder.split("?")[0];
      try {
        const decoded = decodeURI(withoutQuery);
        return cleanRelativePath(decoded);
      } catch (e) {
        return cleanRelativePath(withoutQuery);
      }
    }
  }
  return null;
};
