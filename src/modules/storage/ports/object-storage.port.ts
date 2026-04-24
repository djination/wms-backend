export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface PutObjectParams {
  key: string;
  body: Buffer;
  contentType?: string;
}

export interface ObjectStoragePort {
  putObject(params: PutObjectParams): Promise<{ key: string; bucket: string }>;
  getSignedGetUrl(key: string, expiresSeconds?: number): Promise<string | null>;
}
