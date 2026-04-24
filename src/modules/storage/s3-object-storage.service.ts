import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ObjectStoragePort, PutObjectParams } from './ports/object-storage.port';

@Injectable()
export class S3ObjectStorageService implements ObjectStoragePort {
  private readonly logger = new Logger(S3ObjectStorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(private readonly config: ConfigService) {
    const region = this.config.get<string>('AWS_REGION');
    const bucket = this.config.get<string>('AWS_S3_BUCKET');
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    this.bucket = bucket;

    if (!region || !bucket) {
      this.logger.warn('S3 disabled: AWS_REGION or AWS_S3_BUCKET not set');
      this.client = null;
      return;
    }

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: !!endpoint,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  get enabled(): boolean {
    return this.client !== null && !!this.bucket;
  }

  async putObject(params: PutObjectParams): Promise<{ key: string; bucket: string }> {
    if (!this.client || !this.bucket) {
      throw new Error('S3 is not configured');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
    return { key: params.key, bucket: this.bucket };
  }

  async getSignedGetUrl(key: string, expiresSeconds = 3600): Promise<string | null> {
    if (!this.client || !this.bucket) return null;
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresSeconds });
  }
}
