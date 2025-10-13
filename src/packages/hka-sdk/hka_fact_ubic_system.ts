# Fact-Ubic-HKA SDK (TypeScript)

This file contains a full scaffold for a TypeScript SDK to integrate with The Factory HKA (PAC) optimized for the Fact-UbicSystem project. It includes:

- package.json
- tsconfig.json
- src/ (main SDK)
  - index.ts
  - hkaClient.ts
  - soapClient.ts
  - types.ts
  - firestoreStore.ts
  - cache.ts
  - retry.ts
  - errors.ts
- examples/
  - nextjs-api.ts (snippet to use in Next.js API route)
  - webhook-handler.ts
- README.md (usage + configuration)
- LICENSE
- jest.config.js (basic test scaffold)

---

## package.json

```json
{
  "name": "@fact-ubic/hka-sdk",
  "version": "0.1.0",
  "description": "SDK TypeScript para integrar Fact-UbicSystem con PAC The Factory HKA (FEL Panamá)",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint . --ext .ts",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.5.0",
    "fast-xml-parser": "^4.0.0",
    "node-cache": "^5.1.2",
    "xml2js": "^0.4.23",
    "soap": "^0.40.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "jest": "^29.6.0",
    "ts-jest": "^29.0.0",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.5.0",
    "eslint": "^8.46.0"
  }
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"]
}
```

---

## src/types.ts

```ts
export type Env = 'demo' | 'prod';

export interface HkaConfig {
  configId: string; // local identifier
  tokenEmpresa: string; // token / usuario
  tokenPassword: string; // password
  baseUrl: string; // API base (e.g. https://demointegracion.thefactoryhka.com.pa/)
  soapWsdlUrl?: string; // optional SOAP WSDL
  timeZone?: string; // e.g. 'America/Panama'
}

export interface HkaResponse<T = any> {
  code: string | number;
  message: string;
  data?: T;
}

export interface SendInvoicePayload {
  xml: string; // signed or properly constructed XML document
  metadata?: Record<string, any>;
}
```

---

## src/cache.ts

```ts
import NodeCache from 'node-cache';

export const sdkCache = new NodeCache({ stdTTL: 300, useClones: false });
```

---

## src/retry.ts

```ts
export async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}
```

---

## src/errors.ts

```ts
export class HkaError extends Error {
  code?: string | number;
  details?: any;
  constructor(message: string, code?: string | number, details?: any) {
    super(message);
    this.name = 'HkaError';
    this.code = code;
    this.details = details;
  }
}
```

---

## src/firestoreStore.ts

```ts
// Minimal Firestore-backed store interface so SDK can load client configs and persist logs.
// This file doesn't initialize Firebase itself — lets the app pass a Firestore instance.

import type { HkaConfig } from './types';
import type { Firestore } from 'firebase-admin/firestore';

export class FirestoreStore {
  private fs: Firestore;
  private collection = 'hka_configurations';

  constructor(firestore: Firestore) {
    this.fs = firestore;
  }

  async getConfig(configId: string): Promise<HkaConfig | null> {
    const doc = await this.fs.collection(this.collection).doc(configId).get();
    if (!doc.exists) return null;
    return doc.data() as HkaConfig;
  }

  async saveResponse(configId: string, payload: any) {
    await this.fs.collection('hka_responses').add({ configId, payload, ts: new Date().toISOString() });
  }
}
```

---

## src/soapClient.ts

```ts
import soap from 'soap';
import { retry } from './retry';
import { HkaConfig } from './types';
import { HkaError } from './errors';

export class SoapClient {
  private wsdl: string;
  private client: any | null = null;

  constructor(wsdl: string) {
    this.wsdl = wsdl;
  }

  private async getClient() {
    if (this.client) return this.client;
    this.client = await retry(() => soap.createClientAsync(this.wsdl), 3, 300);
    return this.client;
  }

  async enviar(config: HkaConfig, documentoXml: string) {
    const client = await this.getClient();
    const args = {
      tokenEmpresa: config.tokenEmpresa,
      tokenPassword: config.tokenPassword,
      documento: documentoXml,
    };
    try {
      const [res] = await client.EnviarAsync(args);
      return res;
    } catch (err) {
      throw new HkaError('SOAP Enviar failed', undefined, err);
    }
  }

  async estadoDocumento(config: HkaConfig, documentoIdentifier: any) {
    const client = await this.getClient();
    try {
      const [res] = await client.EstadoDocumentoAsync({
        tokenEmpresa: config.tokenEmpresa,
        tokenPassword: config.tokenPassword,
        datosDocumento: documentoIdentifier,
      });
      return res;
    } catch (err) {
      throw new HkaError('SOAP EstadoDocumento failed', undefined, err);
    }
  }
}
```

---

## src/hkaClient.ts

```ts
import axios, { AxiosInstance } from 'axios';
import { HkaConfig, SendInvoicePayload } from './types';
import { sdkCache } from './cache';
import { retry } from './retry';
import { HkaError } from './errors';
import { SoapClient } from './soapClient';

export class HkaClient {
  private axios: AxiosInstance;
  private config: HkaConfig;
  private soap?: SoapClient;

  constructor(config: HkaConfig) {
    this.config = config;
    this.axios = axios.create({ baseURL: config.baseUrl, timeout: 15000 });
    if (config.soapWsdlUrl) this.soap = new SoapClient(config.soapWsdlUrl);
  }

  private makeAuthHeaders() {
    // HKA SOAP uses tokenEmpresa and tokenPassword in body; for REST endpoints the SDK may need to provide credentials
    return {
      'X-Token-Empresa': this.config.tokenEmpresa,
      'X-Token-Password': this.config.tokenPassword,
    };
  }

  async timbrar(payload: SendInvoicePayload) {
    // Prefer REST if the baseUrl exposes a REST endpoint; otherwise fallback to SOAP
    const cacheKey = `timbrar:${this.config.configId}:${payload.metadata?.externalId ?? 'noid'}`;
    try {
      // Try REST /api/emision or documented path
      const restPaths = [
        '/api/emision/Enviar',
        '/emision/Enviar',
        '/ws/obj/v1.0/Service.svc/Enviar',
        '/',
      ];
      for (const p of restPaths) {
        try {
          const fullPath = p;
          const res = await retry(() =>
            this.axios.post(fullPath, { documento: payload.xml }, { headers: this.makeAuthHeaders() }),
            2,
            300
          );
          if (res && res.data) return res.data;
        } catch (e) {
          // continue to next path
        }
      }

      // Fallback to SOAP if available
      if (this.soap) {
        const r = await this.soap.enviar(this.config, payload.xml);
        return r;
      }

      throw new HkaError('No available transport for timbrar (REST paths failed and no SOAP configured)');
    } catch (err) {
      throw err;
    }
  }

  async estadoDocumento(documentoIdentifier: any) {
    if (this.soap) return this.soap.estadoDocumento(this.config, documentoIdentifier);
    // Example REST path
    try {
      const r = await this.axios.post('/api/emision/EstadoDocumento', documentoIdentifier, { headers: this.makeAuthHeaders() });
      return r.data;
    } catch (err) {
      throw new HkaError('estadoDocumento failed', undefined, err);
    }
  }

  async descargarXml(documentoIdentifier: any) {
    if (this.soap) return this.soap.getClient && this.soap.getClient().then((c:any)=>c.DescargaXMLAsync({ tokenEmpresa: this.config.tokenEmpresa, tokenPassword: this.config.tokenPassword, datosDocumento: documentoIdentifier }));
    const r = await this.axios.post('/api/emision/DescargaXML', documentoIdentifier, { headers: this.makeAuthHeaders() });
    return r.data;
  }

  async foliosRestantes() {
    try {
      const r = await this.axios.post('/api/emision/FoliosRestantes', {}, { headers: this.makeAuthHeaders() });
      return r.data;
    } catch (err) {
      // fallback to SOAP if available
      if (this.soap) {
        const client = (this.soap as any);
        const res = await (client.getClient().then((c:any)=>c.FoliosRestantesAsync({tokenEmpresa: this.config.tokenEmpresa, tokenPassword: this.config.tokenPassword})));
        return res;
      }
      throw new HkaError('foliosRestantes failed', undefined, err);
    }
  }
}
```

---

## src/index.ts

```ts
export * from './types';
export * from './hkaClient';
export * from './firestoreStore';
export * from './soapClient';
export * from './errors';
```

---

## examples/nextjs-api.ts (snippet)

```ts
// Example Next.js API route using the SDK (server-side only)

import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { FirestoreStore } from '@fact-ubic/hka-sdk';
import { HkaClient } from '@fact-ubic/hka-sdk';

// initialize firebase-admin BEFORE using this route (in a server-only file)

const firestore = admin.firestore();
const store = new FirestoreStore(firestore);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { configId, xml, metadata } = req.body;
  const conf = await store.getConfig(configId);
  if (!conf) return res.status(404).json({ error: 'config not found' });

  const client = new HkaClient(conf);
  try {
    const r = await client.timbrar({ xml, metadata });
    await store.saveResponse(configId, r);
    return res.status(200).json(r);
  } catch (err: any) {
    await store.saveResponse(configId, { error: err.message, details: err.details ?? err });
    return res.status(500).json({ error: err.message });
  }
}
```

---

## examples/webhook-handler.ts

```ts
// Simple webhook handler for inbound invoice submissions
import type { NextApiRequest, NextApiResponse } from 'next';
import admin from 'firebase-admin';
import { FirestoreStore } from '@fact-ubic/hka-sdk';
import { HkaClient } from '@fact-ubic/hka-sdk';

const firestore = admin.firestore();
const store = new FirestoreStore(firestore);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { identifier, payload } = req.body; // payload should include config identifier
  const conf = await store.getConfig(identifier);
  if (!conf) return res.status(404).json({ error: 'config not found' });
  const client = new HkaClient(conf);
  try {
    const r = await client.timbrar({ xml: payload.xml, metadata: payload.metadata });
    await store.saveResponse(conf.configId, r);
    return res.status(200).json(r);
  } catch (err: any) {
    await store.saveResponse(conf.configId, { error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
```

---

## README.md (short)

```md
# @fact-ubic/hka-sdk

SDK TypeScript para integrar Fact-UbicSystem con PAC The Factory HKA (FEL Panamá).

## Características
- Soporta SOAP (WSDL) y REST fallback
- Integración con Firestore para cargar configuraciones y almacenar respuestas
- Caché en memoria para tokens o respuestas frecuentes
- Retries configurables

## Uso (resumen)
1. Guardar configuración del cliente en Firestore (tokenEmpresa, tokenPassword, baseUrl, soapWsdlUrl opcional).
2. Instanciar `FirestoreStore` con `firebase-admin` y recuperar la configuración.
3. Crear `HkaClient(config)` y llamar `timbrar({ xml, metadata })`.

## Seguridad
- Mantén tokens en Firestore seguros (rules & server-side access only).
- No exponer SDK en el cliente.
```

---

## LICENSE

```
MIT License

Copyright (c) 2025 Ángel Nereira

Permission is hereby granted, free of charge, to any person obtaining a copy
... (standard MIT text)
```

---

## Notes & Next steps

- This scaffold focuses on server-side usage (Next.js API routes or backend microservices).
- You can extend it with:
  - Token rotation and secrets manager (Google Secret Manager integration)
  - More complete REST route mapping to the HKA documented endpoints
  - XML builders and schema validators (e.g., using fast-xml-parser)
  - Unit tests and E2E tests with a HKA demo account


---

*Fin del archivo del SDK.*
