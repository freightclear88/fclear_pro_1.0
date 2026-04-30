import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";

const localUploadDir = path.join(process.cwd(), "uploads");

let gcsBucket: ReturnType<Storage["bucket"]> | null = null;

if (process.env.GOOGLE_CLOUD_BUCKET) {
  const gcs = new Storage();
  gcsBucket = gcs.bucket(process.env.GOOGLE_CLOUD_BUCKET);
}

export class StorageService {
  async uploadFile(buffer: Buffer, destination: string, mimetype: string): Promise<string> {
    if (gcsBucket) {
      const file = gcsBucket.file(destination);
      await file.save(buffer, { contentType: mimetype, resumable: false });
      return destination;
    }
    // Local fallback
    if (!fs.existsSync(localUploadDir)) {
      fs.mkdirSync(localUploadDir, { recursive: true });
    }
    const safeName = destination.replace(/\//g, "_");
    const localPath = path.join(localUploadDir, safeName);
    fs.writeFileSync(localPath, buffer);
    return localPath;
  }

  getFileUrl(filePath: string): string {
    if (gcsBucket) {
      return `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET}/${filePath}`;
    }
    return `/uploads/${path.basename(filePath)}`;
  }
}

export const storageService = new StorageService();

export function uploadFile(buffer: Buffer, destination: string, mimetype: string): Promise<string> {
  return storageService.uploadFile(buffer, destination, mimetype);
}

export function getFileUrl(filePath: string): string {
  return storageService.getFileUrl(filePath);
}
