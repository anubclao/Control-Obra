import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

interface HttpErrorMessageOptions {
  unauthorizedMessage?: string
  serverErrorMessage?: string
}

export async function getHttpErrorMessage(
  response: Response,
  fallbackMessage: string,
  options?: HttpErrorMessageOptions
): Promise<string> {
  const payload = await response.json().catch(() => null)
  const apiMessage = payload?.error as string | undefined

  if (response.status === 401) {
    return (
      options?.unauthorizedMessage ||
      'Tu sesion expiro o no tienes permisos. Recarga la pagina e inicia sesion nuevamente.'
    )
  }

  if (response.status >= 500) {
    return options?.serverErrorMessage || 'Error del servidor. Intenta nuevamente en unos segundos.'
  }

  return apiMessage || fallbackMessage
}

interface RequestErrorMessageOptions {
  networkMessage?: string
}

export function getRequestErrorMessage(
  error: unknown,
  fallbackMessage: string,
  options?: RequestErrorMessageOptions
): string {
  const defaultNetworkMessage =
    options?.networkMessage ||
    'Error de red. Verifica tu conexion e intenta de nuevo.'

  if (!(error instanceof Error)) {
    return fallbackMessage
  }

  const errorText = error.message?.toLowerCase() || ''
  const isNetworkError =
    errorText.includes('failed to fetch') ||
    errorText.includes('networkerror') ||
    errorText.includes('network request failed') ||
    errorText.includes('load failed')

  if (isNetworkError) {
    return defaultNetworkMessage
  }

  return error.message || fallbackMessage
}