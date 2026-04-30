import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "uploads");

// Ensure local upload directory exists
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

class StorageService {
  private gcsEnabled: boolean;
  private bucket: any;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.GOOGLE_CLOUD_BUCKET || "";
    this.gcsEnabled = !!this.bucketName;

    if (this.gcsEnabled) {
      const gcs = new Storage();
      this.bucket = gcs.bucket(this.bucketName);
      console.log(`[fileStorage] GCS enabled — bucket: ${this.bucketName}`);
    } else {
      console.log("[fileStorage] GCS not configured — using local disk storage");
    }
  }

  /**
   * Upload a file to GCS (if configured) or move it to the local uploads directory.
   * @param localPath   Temporary path where multer saved the file
   * @param destination Logical destination path (e.g. "documents/abc123.pdf")
   * @param keepLocal   When true, do NOT delete the local temp file after GCS upload
   *                    (needed when downstream code still needs to read the local file, e.g. AI extraction)
   * @returns Stored path/URL to persist in the database
   */
  async uploadFile(localPath: string, destination: string, keepLocal = false): Promise<string> {
    if (this.gcsEnabled) {
      await this.bucket.upload(localPath, {
        destination,
        metadata: { cacheControl: "no-cache" },
      });
      if (!keepLocal && fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      return `gs://${this.bucketName}/${destination}`;
    }

    // Local fallback: move from temp location to final uploads path
    const finalPath = path.join(LOCAL_UPLOAD_DIR, destination);
    const finalDir = path.dirname(finalPath);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    if (keepLocal) {
      // Copy rather than move so downstream code can still read from localPath
      fs.copyFileSync(localPath, finalPath);
    } else {
      fs.renameSync(localPath, finalPath);
    }
    return finalPath;
  }

  /**
   * Return a URL or path suitable for serving/linking to a stored file.
   * For GCS paths (gs://...) returns a signed public URL.
   * For local paths returns the path as-is (served via static or download route).
   */
  async getFileUrl(storedPath: string): Promise<string> {
    if (storedPath.startsWith("gs://")) {
      const objectPath = storedPath.replace(`gs://${this.bucketName}/`, "");
      const [url] = await this.bucket.file(objectPath).getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1-hour signed URL
      });
      return url;
    }
    // Local path — return as-is; the caller decides how to serve it
    return storedPath;
  }

  /**
   * Check whether GCS is configured and active.
   */
  isGcsEnabled(): boolean {
    return this.gcsEnabled;
  }
}

export const storageService = new StorageService();
