# Publicación del previsor UI/UX — 22 de septiembre de 2026

Publicación expresamente autorizada por el usuario: «Súbelo a producción». Ejecutada desde la copia reconciliada `hostaway-previsor-codex-20260921`, conservando las protecciones del checkout Windows retirado y los despliegues automáticos desactivados.

## Fuente conservada

- Antes de publicar, ambos dominios resolvían `dpl_2obWJESyXrh7UMLmp1Lok7di1SGV`, URL `gestionlimpatex-4aui8dp4q-limpatex.vercel.app`.
- Los metadatos de Vercel identificaron su fuente como `3c4ae3077a6b2419ac868fea51558cb1c5b45abb`. Git verificó que es antecesora de la entrega: no apareció ninguna publicación posterior que reconciliar.
- Commit publicado: `28d6e67052ba5db4409a514fe9315246143878eb`.
- Rama respaldada en GitHub antes del despliegue: `codex/previsor-ui-ux-20260922`. `origin/main` sigue en `c1c538d8`; no se ha sustituido la fuente actual por esa versión anterior.
- Despliegue nuevo: `dpl_CLVWmV8aCwvSK698DKT6gTs8QoeD`.
- URL inmutable: `https://gestionlimpatex-qz6o1g70e-limpatex.vercel.app`.
- Esta documentación se guarda después de publicar; no cambia el código del commit desplegado.

## Verificaciones

1. Diferencia vacía respecto de la producción anterior en `src/services`, `src/hooks`, `supabase`, `src/App.tsx`, `src/integrations/supabase` y `vercel.json`. Asignaciones y notificaciones de WhatsApp/correo no se modifican. No se han desplegado funciones ni migraciones, ni enviado mensajes de prueba.
2. Compilación remota de Vercel correcta, estado `READY` y SHA de origen coincidente con el commit probado. Comprobación raíz de TypeScript repetida con éxito; los límites y errores previos del chequeo completo siguen documentados en `RESULTADOS_UI_UX.md`.
3. Se usó `deploy --prod --skip-domain` y después `promote`. Esta versión del CLI asignó el dominio secundario al finalizar el build incluso con `--skip-domain`; se comprobó su contenido antes de promover el dominio principal.
4. Tras promover, la consulta de cada dominio a la API de Vercel resuelve el mismo despliegue nuevo. Verificación HTTP a las 07:02 UTC: las siete rutas en ambos dominios sirven la entrada nueva; HTML, JavaScript del módulo, worker y CSS tienen hashes idénticos entre dominios. La versión de reglas es `staffing-2026-09-22.1`.
5. Los dominios públicos son `https://gestionlimpatex.vercel.app` y `https://gestionlimpatex-limpatex.vercel.app`. La URL inmutable requiere autenticación de Vercel, protección que no se ha cambiado.
6. En el navegador integrado, abrir el previsor lleva al formulario de acceso. Edge no respondió a la conexión. No se declara realizada la revisión autenticada con registros reales. Las comprobaciones HTTP de rutas verifican entrega de la aplicación, no el renderizado de las siete pantallas con sesión.

Evidencia: [publicacion-ui-ux-verificacion.json](publicacion-ui-ux-verificacion.json). Las pruebas funcionales y visuales locales y las limitaciones constan en [RESULTADOS_UI_UX.md](RESULTADOS_UI_UX.md).

## Reversión

Conservar el despliegue anterior. Si se detecta una regresión relevante, restaurarlo con:

```powershell
vercel rollback gestionlimpatex-4aui8dp4q-limpatex.vercel.app --scope limpatex --yes
```

Inspeccionar ambos dominios después. Si cualquiera conserva el destino nuevo, corregir expresamente sus alias:

```powershell
vercel alias set gestionlimpatex-4aui8dp4q-limpatex.vercel.app gestionlimpatex.vercel.app --scope limpatex
vercel alias set gestionlimpatex-4aui8dp4q-limpatex.vercel.app gestionlimpatex-limpatex.vercel.app --scope limpatex
```

Verificar que ambos resuelven `dpl_2obWJESyXrh7UMLmp1Lok7di1SGV` y sirven los recursos anteriores. No hay cambios de datos ni funciones que revertir.
