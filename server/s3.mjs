// A tiny S3 client: GET and PUT one object, signed with SigV4, no SDK.
//
// Credentials follow the parts of the AWS default chain that apply here:
// static env keys (AWS_ACCESS_KEY_ID...) first, then the ECS/Fargate
// container credentials endpoint the task role is served from. Zero npm
// dependencies keeps the image to node + our files (see docs/dockerfile.md).

import crypto from 'node:crypto';

const hmac = (key, s) => crypto.createHmac('sha256', key).update(s).digest();
export const sha256hex = s => crypto.createHash('sha256').update(s).digest('hex');

// S3 URI-encodes each path segment but keeps the slashes.
const encodePath = p => p.split('/').map(s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())).join('/');

// Signs a request. `headers` must include host, x-amz-date and
// x-amz-content-sha256; every header passed is signed. Returns the
// Authorization header value.
export function signV4({ method, path, query = '', headers, region, creds, service = 's3' }) {
  const amzDate = headers['x-amz-date'];
  const date = amzDate.slice(0, 8);
  const names = Object.keys(headers).map(h => h.toLowerCase()).sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim().replace(/\s+/g, ' ')]));
  const canonical = [
    method, encodePath(path), query,
    names.map(n => `${n}:${lower[n]}\n`).join(''),
    names.join(';'),
    lower['x-amz-content-sha256'],
  ].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const kSigning = hmac(hmac(hmac(hmac('AWS4' + creds.secretAccessKey, date), region), service), 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(toSign).digest('hex');
  return `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
}

let cached = null;
async function credentials(env = process.env) {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    return { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY, sessionToken: env.AWS_SESSION_TOKEN };
  }
  if (cached && cached.expires - Date.now() > 5 * 60_000) return cached;
  let url, auth;
  if (env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) url = 'http://169.254.170.2' + env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  else if (env.AWS_CONTAINER_CREDENTIALS_FULL_URI) {
    url = env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
    auth = env.AWS_CONTAINER_AUTHORIZATION_TOKEN;
    if (!auth && env.AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE) {
      const { readFile } = await import('node:fs/promises');
      auth = (await readFile(env.AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE, 'utf8')).trim();
    }
  } else throw new Error('no AWS credentials (no env keys, no container credentials endpoint)');
  const res = await fetch(url, { headers: auth ? { Authorization: auth } : {}, signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`container credentials: HTTP ${res.status}`);
  const j = await res.json();
  cached = { accessKeyId: j.AccessKeyId, secretAccessKey: j.SecretAccessKey, sessionToken: j.Token, expires: Date.parse(j.Expiration) || Date.now() + 15 * 60_000 };
  return cached;
}

export class S3 {
  constructor(bucket, region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1') {
    this.bucket = bucket; this.region = region;
    this.host = `${bucket}.s3.${region}.amazonaws.com`;
  }

  async request(method, key, body = '') {
    const creds = await credentials();
    const path = '/' + key;
    const headers = {
      host: this.host,
      'x-amz-date': new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''),
      'x-amz-content-sha256': sha256hex(body),
    };
    if (creds.sessionToken) headers['x-amz-security-token'] = creds.sessionToken;
    if (method === 'PUT') headers['content-type'] = 'application/json';
    headers.authorization = signV4({ method, path, headers, region: this.region, creds });
    const { host, ...send } = headers; // fetch sets Host itself
    return fetch(`https://${this.host}${encodePath(path)}`, { method, headers: send, body: method === 'PUT' ? body : undefined, signal: AbortSignal.timeout(8000) });
  }

  // The object's text, or null if there is no such key.
  async get(key) {
    const res = await this.request('GET', key);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`s3 get ${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return res.text();
  }

  async put(key, text) {
    const res = await this.request('PUT', key, text);
    if (!res.ok) throw new Error(`s3 put ${key}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
