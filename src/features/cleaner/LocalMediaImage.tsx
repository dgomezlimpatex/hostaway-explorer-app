import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LOCAL_PHOTO_PREFIX, readLocal, type CleanerPhoto } from './offlineStore';

export function LocalMediaImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const { user } = useAuth();
  const [resolved, setResolved] = useState<string | undefined>(src.startsWith(LOCAL_PHOTO_PREFIX) ? undefined : src);
  useEffect(() => {
    const photoId = src.startsWith(LOCAL_PHOTO_PREFIX) ? src.slice(LOCAL_PHOTO_PREFIX.length) : src.match(/\/([\da-f-]{36})\.[a-z0-9]+(?:\?.*)?$/i)?.[1];
    if (!photoId) { setResolved(src); return; }
    let cancelled = false;
    let url: string | undefined;
    setResolved(src.startsWith(LOCAL_PHOTO_PREFIX) ? undefined : src);
    void readLocal<CleanerPhoto>('photos', `${user?.id}:${photoId}`).then(photo => {
      if (!photo || cancelled || (!src.startsWith(LOCAL_PHOTO_PREFIX) && photo.serverUrl !== src)) return;
      url = URL.createObjectURL(photo.file);
      setResolved(url);
    }).catch(() => undefined);
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [src, user?.id]);
  return resolved ? <img src={resolved} alt={alt} className={className} loading="lazy" decoding="async" />
    : <span className="flex h-full items-center justify-center p-1 text-center text-[10px]">Preparando foto…</span>;
}

// Non-component utility used by the shared media grid.
// eslint-disable-next-line react-refresh/only-export-components
export async function openLocalMedia(src: string, ownerId: string) {
  if (!src.startsWith(LOCAL_PHOTO_PREFIX) && navigator.onLine) { window.open(src, '_blank', 'noopener'); return; }
  const photoId = src.startsWith(LOCAL_PHOTO_PREFIX) ? src.slice(LOCAL_PHOTO_PREFIX.length) : src.match(/\/([\da-f-]{36})\.[a-z0-9]+(?:\?.*)?$/i)?.[1];
  if (!photoId) return;
  const photo = await readLocal<CleanerPhoto>('photos', `${ownerId}:${photoId}`);
  if (!photo) return;
  const url = URL.createObjectURL(photo.file);
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', 'Foto o vídeo de la limpieza');
  const media = document.createElement(photo.mimeType.startsWith('video/') ? 'video' : 'img');
  media.src = url;
  if (media instanceof HTMLVideoElement) media.controls = true;
  media.style.cssText = 'max-width:85vw;max-height:80dvh;object-fit:contain';
  const close = document.createElement('button');
  close.textContent = 'Cerrar';
  close.style.cssText = 'display:block;min-height:44px;margin-top:8px';
  close.onclick = () => dialog.close();
  dialog.append(media, close);
  document.body.append(dialog);
  dialog.onclose = () => { URL.revokeObjectURL(url); dialog.remove(); };
  dialog.showModal();
}
