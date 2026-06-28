// Mobile mock for "@aws-sdk/client-s3". S3 storage is server-only; the bundled
// @saltcorn/data imports the package as a whole and only dereferences it lazily.
export class S3Client {
  constructor(_config?: any) {}
  send(_command?: any): Promise<any> {
    throw new Error("@aws-sdk/client-s3 may not be used in a mobile enviroment");
  }
}
export class PutObjectCommand {
  constructor(_input?: any) {}
}
export class GetObjectCommand {
  constructor(_input?: any) {}
}
export class DeleteObjectCommand {
  constructor(_input?: any) {}
}
