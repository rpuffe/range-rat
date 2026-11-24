// Crew saves. S3 when STORAGE_BUCKET is set, in memory otherwise (local runs
// and preflight, which must boot and pass /healthz with no AWS at all).

import { S3 } from './s3.mjs';

const key = code => `saves/${code}.json`;

export class MemoryStore {
  constructor() { this.m = new Map(); this.kind = 'memory'; }
  async load(code) { const s = this.m.get(code); return s ? JSON.parse(s) : null; }
  async save(code, obj) { this.m.set(code, JSON.stringify(obj)); }
}

export class S3Store {
  constructor(bucket) { this.s3 = new S3(bucket); this.kind = `s3 bucket ${bucket}`; }
  async load(code) { const t = await this.s3.get(key(code)); return t ? JSON.parse(t) : null; }
  async save(code, obj) { await this.s3.put(key(code), JSON.stringify(obj)); }
}

export const newStore = bucket => bucket ? new S3Store(bucket) : new MemoryStore();
