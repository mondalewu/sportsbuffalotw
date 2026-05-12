/**
 * Cloudflare R2 Storage Service
 * 取代本地磁碟，將檔案上傳到 Cloudflare R2（S3 相容 API）
 * 環境變數：
 *   R2_ACCOUNT_ID    - Cloudflare Account ID
 *   R2_ACCESS_KEY_ID - R2 Access Key ID
 *   R2_SECRET_ACCESS_KEY - R2 Secret Access Key
 *   R2_BUCKET_NAME   - R2 Bucket 名稱
 *   R2_PUBLIC_URL    - R2 公開 URL（e.g. https://pub-xxx.r2.dev）
 */

import https from 'https';
import http from 'http';
import crypto from 'crypto';
import path from 'path';

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || '';
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const BUCKET     = process.env.R2_BUCKET_NAME || 'sports-buffalo';
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

// R2 endpoint（S3 compatible）
const R2_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// ── AWS SigV4 簽名工具 ────────────────────────────────────────────────────────

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function sha256Hex(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate    = hmacSha256(`AWS4${secretKey}`, date);
  const kRegion  = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

/**
 * 上傳 Buffer 到 R2
 * @param fileBuffer 檔案內容
 * @param key        R2 物件 key（路徑），e.g. "articles/abc.jpg"
 * @param contentType MIME type
 * @returns 公開可存取的 URL
 */
export async function uploadToR2(
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) {
    throw new Error('R2 環境變數未設定（R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY）');
  }

  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const dateTime = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'; // YYYYMMDDTHHmmssZ

  const region  = 'auto';
  const service = 's3';
  const host    = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const url     = `${R2_ENDPOINT}/${BUCKET}/${key}`;
  const method  = 'PUT';

  const payloadHash = sha256Hex(fileBuffer);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${dateTime}\n`;

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    `/${BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(SECRET_KEY, date, region, service);
  const signature  = hmacSha256(signingKey, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  // 發送 PUT 請求
  await new Promise<void>((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length,
        'x-amz-date': dateTime,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorization,
      },
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve();
        } else {
          reject(new Error(`R2 上傳失敗 HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });

  // 回傳公開 URL
  return `${PUBLIC_URL}/${key}`;
}

/**
 * 刪除 R2 上的物件
 * @param key R2 物件 key
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY) return;

  const now      = new Date();
  const date     = now.toISOString().slice(0, 10).replace(/-/g, '');
  const dateTime = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';

  const region  = 'auto';
  const service = 's3';
  const host    = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const method  = 'DELETE';

  const payloadHash = sha256Hex('');

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${dateTime}\n`;

  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest = [
    method,
    `/${BUCKET}/${key}`,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateTime,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(SECRET_KEY, date, region, service);
  const signature  = hmacSha256(signingKey, stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`;

  await new Promise<void>((resolve, reject) => {
    const url    = `${R2_ENDPOINT}/${BUCKET}/${key}`;
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method,
      headers: {
        'x-amz-date': dateTime,
        'x-amz-content-sha256': payloadHash,
        'Authorization': authorization,
      },
    };

    const req = https.request(reqOptions, (res) => {
      res.resume();
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * 從 R2 URL 中提取 key
 * e.g. "https://pub-xxx.r2.dev/articles/abc.jpg" → "articles/abc.jpg"
 */
export function extractR2Key(url: string): string | null {
  if (!PUBLIC_URL || !url.startsWith(PUBLIC_URL)) return null;
  return url.slice(PUBLIC_URL.length + 1); // 去掉前綴和 /
}

/**
 * 生成唯一的 R2 物件 key
 */
export function generateR2Key(folder: string, originalName: string): string {
  const ext  = path.extname(originalName).toLowerCase();
  const rand = Math.random().toString(36).slice(2);
  return `${folder}/${Date.now()}-${rand}${ext}`;
}
