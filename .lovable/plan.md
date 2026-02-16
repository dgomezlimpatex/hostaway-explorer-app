
# Plan: Arreglo completo de subida de fotos en moviles Android

## Problema identificado

Despues de analizar todo el flujo de subida de fotos, he encontrado **4 problemas criticos** que causan fallos silenciosos en moviles Android antiguos:

### 1. Compresion de imagenes falla silenciosamente con formatos no estandar
La funcion `compressImage` usa `canvas.toBlob(blob, file.type, quality)`. En Android antiguo:
- Si `file.type` esta vacio (muy comun en Android viejo), el canvas produce un PNG enorme o falla
- Si `file.type` es `image/heic` u otro formato no soportado por canvas, `toBlob` devuelve `null` y la compresion falla
- Aunque hay un try/catch, la funcion `img.onerror` llama a `reject()` pero la URL creada con `createObjectURL` nunca se libera (fuga de memoria)

### 2. Supabase Storage recibe archivos sin Content-Type
En `taskMediaStorage.ts`, el archivo se sube directamente sin especificar `contentType`. Cuando Android no reporta el MIME type del archivo, Supabase puede rechazar la subida o almacenarla incorrectamente.

### 3. Toast doble y confusion de errores
Tanto `useMediaUpload.ts` como `useTaskReports.ts` (la mutation `uploadMediaMutation`) muestran toasts de exito/error. Esto produce mensajes duplicados que pueden confundir, y en algunos casos el toast de exito de la mutation aparece aunque el flujo completo haya fallado.

### 4. El `reportId` puede no estar listo
Cuando el usuario inicia la tarea y rapidamente intenta subir fotos, el `reportId` puede aun no estar disponible. Aunque se anade un toast de error, en moviles Android antiguos los toasts pueden no ser visibles o el usuario puede no entenderlos.

---

## Solucion propuesta

### Archivo 1: `src/utils/imageCompression.ts`
- Anadir funcion `getMimeType(file)` que detecta el tipo MIME por extension cuando `file.type` esta vacio
- Usar siempre `image/jpeg` como formato de salida del canvas (maxima compatibilidad)
- Limpiar la URL de `createObjectURL` en todos los casos (onload y onerror)
- En `shouldCompressImage`, usar la deteccion de MIME mejorada para no omitir archivos sin tipo

### Archivo 2: `src/services/storage/taskMediaStorage.ts`
- Anadir deteccion de MIME type por extension del archivo
- Pasar `contentType` explicito a `supabase.storage.upload()` para garantizar que Supabase acepte el archivo
- Renombrar archivos HEIC/HEIF a `.jpg` si se han comprimido

### Archivo 3: `src/components/modals/task-report/hooks/useMediaUpload.ts`
- Eliminar los toasts de exito duplicados (dejar solo los del hook, quitar los de la mutation)
- Anadir mecanismo de espera del `reportId`: si no existe, esperar hasta 3 segundos con reintentos antes de fallar
- Mejorar el log de errores para diagnostico remoto

### Archivo 4: `src/hooks/useTaskReports.ts`
- Eliminar el toast de exito/error en `uploadMediaMutation` (ya se maneja en `useMediaUpload`)
- Solo mantener la invalidacion de cache

### Archivo 5: `src/components/modals/task-report/components/MediaUploadButtons.tsx`
- Simplificar al maximo los inputs de archivo para maxima compatibilidad Android
- Anadir atributo `aria-label` para accesibilidad

---

## Detalles tecnicos

### Deteccion de MIME por extension (nuevo utility)
```text
Mapa de extensiones comunes:
.jpg/.jpeg -> image/jpeg
.png -> image/png
.heic/.heif -> image/heic
.webp -> image/webp
.mp4 -> video/mp4
.mov -> video/quicktime
(etc.)
```

### Compresion segura
```text
Antes:  canvas.toBlob(callback, file.type, quality)
         -> falla si file.type es vacio o no soportado

Despues: canvas.toBlob(callback, 'image/jpeg', quality)
         -> siempre produce JPEG (compatible con todos los navegadores)
         -> solo se intenta si el navegador puede decodificar la imagen
```

### Upload con Content-Type explicito
```text
Antes:  supabase.storage.upload(path, file)
Despues: supabase.storage.upload(path, file, { contentType: detectedMimeType })
```

### Espera del reportId
```text
Si reportId no existe al intentar subir:
1. Esperar 1 segundo y verificar de nuevo (3 intentos)
2. Si sigue sin existir, mostrar mensaje claro al usuario
3. Deshabilitar botones de subida visualmente cuando no hay reportId
```

## Resultado esperado
Cualquier operaria con cualquier movil Android (antiguo o nuevo) podra:
1. Abrir la galeria o camara sin problemas
2. Seleccionar una o varias fotos
3. Ver que se suben correctamente con feedback visual claro
4. No recibir errores silenciosos ni mensajes confusos
