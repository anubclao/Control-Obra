// Local file storage implementation (previously AWS S3)
// Switched to local storage for easier development and no external dependencies

import {
  generatePresignedUploadUrl as generateLocalPresignedUploadUrl,
  getFileUrl as getLocalFileUrl,
  deleteFile as deleteLocalFile,
  saveFile as saveLocalFile,
  readFile as readLocalFile,
} from "./local-storage";

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloud_storage_path: string }> {
  return generateLocalPresignedUploadUrl(fileName, contentType, isPublic);
}

export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean = false
): Promise<string> {
  return getLocalFileUrl(cloud_storage_path, isPublic);
}

export async function deleteFile(cloud_storage_path: string): Promise<void> {
  return deleteLocalFile(cloud_storage_path);
}

export async function saveFile(
  cloud_storage_path: string,
  fileBuffer: Buffer
): Promise<{ success: boolean; error?: string }> {
  return saveLocalFile(cloud_storage_path, fileBuffer);
}

export async function readFile(
  cloud_storage_path: string
): Promise<Buffer | null> {
  return readLocalFile(cloud_storage_path);
}
