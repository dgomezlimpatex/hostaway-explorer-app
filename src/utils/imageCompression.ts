/**
 * Utilidad para detección de MIME type por extensión de archivo.
 * Crítico para Android antiguo donde file.type puede estar vacío.
 */
const MIME_MAP: Record<string, string> = {
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'jpe': 'image/jpeg',
  'jfif': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  'avif': 'image/avif',
  'heic': 'image/heic',
  'heif': 'image/heif',
  'heics': 'image/heic',
  'tiff': 'image/tiff',
  'tif': 'image/tiff',
  'dng': 'image/x-adobe-dng',
  'mp4': 'video/mp4',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  'mkv': 'video/x-matroska',
  'webm': 'video/webm',
  'wmv': 'video/x-ms-wmv',
  'm4v': 'video/x-m4v',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
};

export const getMimeType = (file: File): string => {
  // Si el navegador ya reporta un tipo válido, usarlo
  if (file.type && file.type.includes('/')) {
    return file.type;
  }

  // Detectar por extensión del archivo
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && MIME_MAP[ext]) {
    console.log(`🔍 MIME detectado por extensión .${ext}:`, MIME_MAP[ext]);
    return MIME_MAP[ext];
  }

  // Fallback seguro
  console.warn('⚠️ No se pudo detectar MIME type para:', file.name, '- usando application/octet-stream');
  return 'application/octet-stream';
};

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

// Old phones short on memory may never call onload/toBlob. Keep the original instead of blocking.
const COMPRESSION_TIMEOUT_MS = 20_000;

export const compressImage = async (
  file: File, 
  options: CompressionOptions = {}
): Promise<File> => {
  return new Promise((resolveResult, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined = undefined;
    const resolve = (result: File) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveResult(result);
    };
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 0.8,
      maxSizeKB = 1024
    } = options;

    // Si el archivo ya es pequeño, no lo comprimimos
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    const mimeType = getMimeType(file);

    // No intentar comprimir videos
    if (mimeType.startsWith('video/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let objectUrl: string | null = null;

    if (!ctx) {
      reject(new Error('No se pudo crear el contexto del canvas'));
      return;
    }

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      // Release the decoded bitmap memory right away on low-memory phones.
      canvas.width = 0;
      canvas.height = 0;
      img.removeAttribute('src');
    };

    img.onload = () => {
      try {
        // Calcular nuevas dimensiones manteniendo aspecto
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;

        // Dibujar y comprimir
        ctx.drawImage(img, 0, 0, width, height);
        
        // CRITICAL: Siempre usar image/jpeg para máxima compatibilidad
        canvas.toBlob(
          (blob) => {
            cleanup();

            if (!blob) {
              console.warn('⚠️ canvas.toBlob devolvió null, usando archivo original');
              resolve(file);
              return;
            }

            // Generar nombre con extensión .jpg
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const compressedFile = new File([blob], `${baseName}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        cleanup();
        console.warn('⚠️ Error durante compresión canvas, usando archivo original:', err);
        resolve(file); // Fallback al original en vez de rechazar
      }
    };

    img.onerror = () => {
      cleanup();
      console.warn('⚠️ No se pudo cargar imagen para compresión, usando archivo original');
      resolve(file); // Fallback al original en vez de rechazar
    };

    timer = setTimeout(() => {
      console.warn('⚠️ La compresión no responde, usando archivo original');
      cleanup();
      resolve(file);
    }, COMPRESSION_TIMEOUT_MS);
    objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
};

export const shouldCompressImage = (file: File): boolean => {
  const maxSizeKB = 1024; // 1MB
  const mimeType = getMimeType(file);
  return mimeType.startsWith('image/') && file.size > maxSizeKB * 1024;
};
