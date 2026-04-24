import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { ObjectStoragePort, PutObjectParams } from './ports/object-storage.port';

@Injectable()
export class LocalObjectStorageService implements ObjectStoragePort {
  private readonly logger = new Logger(LocalObjectStorageService.name);

  /** Files live under <cwd>/uploads/... (same layout as previous S3 keys). */
  async putObject(params: PutObjectParams): Promise<{ key: string; bucket: string }> {
    if (params.key.includes('..') || !params.key.startsWith('uploads/')) {
      throw new Error('Invalid object key');
    }
    const abs = join(process.cwd(), params.key);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, params.body);
    this.logger.debug(`Wrote ${params.key}`);
    return { key: params.key, bucket: 'local' };
  }

  async getSignedGetUrl(key: string): Promise<string | null> {
    if (key.includes('..') || !key.startsWith('uploads/')) return null;
    return `/${key}`;
  }
}
