import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  OBJECT_STORAGE,
  ObjectStoragePort,
} from '../storage/ports/object-storage.port';

@Injectable()
export class UploadService {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort) {}

  async saveUserFile(userId: string, file: Express.Multer.File) {
    const ext = extname(file.originalname || '') || '';
    const key = `uploads/${userId}/${randomUUID()}${ext}`;
    await this.storage.putObject({
      key,
      body: file.buffer,
      contentType: file.mimetype,
    });
    const url = await this.storage.getSignedGetUrl(key, 3600);
    return { key, url };
  }
}
