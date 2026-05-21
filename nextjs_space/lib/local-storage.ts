import { promises as fs } from "fs";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), "public", "uploads");

// Ensure storage directory exists
async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating storage directory:", error);
  }
}

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  const timestamp = Date.now();
  const uniqueName = `${timestamp}-${fileName}`;
  const subdir = isPublic ? "public" : "private";
  const cloud_storage_path = `uploads/${subdir}/${uniqueName}`;
  const uploadUrl = `/api/upload?path=${encodeURIComponent(cloud_storage_path)}`;

  return { uploadUrl, cloud_storage_path };
}

export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean = false
): Promise<string> {
  // En modo local los archivos se guardan bajo /public, por lo que
  // siempre se pueden resolver como ruta estática.
  return `/${cloud_storage_path}`;
}

export async function saveFile(
  cloud_storage_path: string,
  fileBuffer: Buffer
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureStorageDir();
    const fullPath = path.join(process.cwd(), "public", cloud_storage_path);
    const dir = path.dirname(fullPath);
    
    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });
    
    // Save file
    await fs.writeFile(fullPath, fileBuffer);
    
    return { success: true };
  } catch (error) {
    console.error("Error saving file:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

export async function deleteFile(cloud_storage_path: string): Promise<void> {
  try {
    const fullPath = path.join(process.cwd(), "public", cloud_storage_path);
    await fs.unlink(fullPath);
  } catch (error) {
    console.error("Error deleting file:", error);
    // Don't throw - file might already be deleted
  }
}

export async function readFile(cloud_storage_path: string): Promise<Buffer | null> {
  try {
    const fullPath = path.join(process.cwd(), "public", cloud_storage_path);
    return await fs.readFile(fullPath);
  } catch (error) {
    console.error("Error reading file:", error);
    return null;
  }
}
