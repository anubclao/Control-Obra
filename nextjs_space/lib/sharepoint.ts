// SharePoint integration has been replaced with local file storage
// All functions now redirect to local storage system

import { saveFile } from "./local-storage";

interface SharePointConfig {
  accessToken: string;
  clientId: string;
}

// Leer configuración de SharePoint desde variables de entorno
// Currently disabled - use local storage instead
export function getSharePointConfig(): SharePointConfig {
  return {
    accessToken: process.env.SHAREPOINT_ACCESS_TOKEN ?? '',
    clientId: process.env.SHAREPOINT_CLIENT_ID ?? ''
  };
}

// Subir archivo a SharePoint (NOW USING LOCAL STORAGE)
export async function uploadToSharePoint(
  filePath: string,
  fileBuffer: Buffer,
  fileName: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // Convert SharePoint path to local storage path
    const localPath = convertSharePointPathToLocal(filePath);
    
    // Save to local storage
    const result = await saveFile(localPath, fileBuffer);
    
    if (result.success) {
      return {
        success: true,
        url: `/${localPath}`
      };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Error subiendo archivo a almacenamiento local:', error);
    return { success: false, error: String(error) };
  }
}

// Función helper para generar rutas de SharePoint (convertidas a local)
export function generateSharePointPath(type: 'contractor' | 'project' | 'workcut' | 'worklog' | 'budget', ...parts: string[]): string {
  const base = 'uploads/documents';
  
  switch (type) {
    case 'contractor':
      return `${base}/contractors/${parts?.join?.('/') ?? ''}`;
    
    case 'project':
      return `${base}/projects/${parts?.join?.('/') ?? ''}`;
    
    case 'workcut':
      return `${base}/projects/${parts?.[0] ?? ''}/workcuts/${parts?.[1] ?? ''}/${parts?.[2] ?? ''}/${parts?.[3] ?? ''}`;
    
    case 'worklog':
      return `${base}/projects/${parts?.[0] ?? ''}/worklogs/${parts?.[1] ?? ''}/${parts?.[2] ?? ''}`;
    
    case 'budget':
      return `${base}/projects/${parts?.[0] ?? ''}/budgets/${parts?.[1] ?? ''}/${parts?.[2] ?? ''}`;
    
    default:
      return `${base}/${parts?.join?.('/') ?? ''}`;
  }
}

// Helper function to convert SharePoint paths to local storage paths
function convertSharePointPathToLocal(sharePointPath: string): string {
  // Remove leading slashes and convert to local path
  const localPath = sharePointPath.toLowerCase()
    .replace(/^\/+/, '')
    .replace(/\s+/g, '_')
    .replace(/documentos_compartidos\//i, 'uploads/documents/');

  return localPath || 'uploads/documents/unnamed';
}
