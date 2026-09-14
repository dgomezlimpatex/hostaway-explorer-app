# Traspaso a Hermes — 14 de septiembre de 2026

## Decisión y versión de referencia

GitHub `main` es la fuente central. El trabajo nuevo y las publicaciones se hacen desde Hermes, en el otro ordenador. La copia original de Windows queda archivada.

- Repositorio: https://github.com/dgomezlimpatex/hostaway-explorer-app
- Despliegue conservado: `dpl_AnvaJq91u2jQRmPtXXc6yXE3GUjR`.
- URL del despliegue: https://gestionlimpatex-8oz5y46tu-limpatex.vercel.app
- Dominios: https://gestionlimpatex.vercel.app y https://gestionlimpatex-limpatex.vercel.app.
- Vercel: equipo `limpatex`, proyecto `gestion_limpatex`, ID `prj_ArBhKZEr9xPqgcIoyioylFc9BMk7`.
- Supabase existente: `qyipyygojlfhdghnraus`. Se conserva este proyecto y sus datos.

La producción se publicó con cambios sin commit (`gitDirty=1`). Su antiguo SHA `3fb713f7d8684fcdb1ff3f502b9338f7fa1a3329` NO representa por sí solo la versión publicada. El código se recuperó directamente de Vercel, verificando sus 1.645 archivos por SHA-1. Una instalación independiente con `npm ci` pasó `npm run build` y `npx tsc --noEmit --pretty false`. Los 251 archivos generados de `dist` coincidieron byte a byte con los conservados en el despliegue.

Se han cambiado únicamente instrucciones y configuración del traspaso sobre esa fuente: este documento, AGENTS.md, las reglas de exclusión de Git, los inventarios y `git.deploymentEnabled: false` en `vercel.json`. Las subidas a GitHub no deben publicar automáticamente; la publicación manual desde Hermes sigue siendo posible. Documentación: https://vercel.com/docs/project-configuration/git-configuration.

## Primer paso en Hermes

1. Detener las tareas que puedan modificar o publicar la copia antigua de Hermes. Guardar esa carpeta como archivo, sin borrar sus cambios.
2. Autenticarse en GitHub con acceso a este repositorio.
3. Clonar en una carpeta NUEVA y vacía. No copiar archivos de la versión antigua encima.

```sh
git clone --branch main https://github.com/dgomezlimpatex/hostaway-explorer-app.git hostaway-central
cd hostaway-central
git status --short --branch
```

4. Usar Node.js 22, leer AGENTS.md y ejecutar:

```sh
npm ci
npm run build
npx tsc --noEmit --pretty false
npm run dev
```

La validación del traspaso compiló sin copiar el `.env` del ordenador antiguo. No importar credenciales o archivos de configuración viejos indiscriminadamente. Si se necesita acceso administrativo, iniciar sesión en GitHub, Vercel y Supabase desde Hermes con la cuenta autorizada. No guardar tokens, claves `service_role` ni contraseñas en Git.

5. Vincular Vercel al proyecto existente `gestion_limpatex`, del equipo `limpatex`, cuando se vaya a publicar. No crear otro proyecto ni otra base de datos. Abrir la aplicación y comprobar las pantallas habituales antes del primer cambio.

## Flujo diario

Antes de empezar un cambio, actualizar `main` con `git pull --ff-only` y crear una rama de trabajo. Guardar y subir los commits de esa rama; integrar el cambio revisado en `main`. Si Git informa de divergencias o conflictos, resolverlos antes de continuar: no usar `push --force`, copiar carpetas encima ni desplegar una copia desactualizada.

Antes de publicar, el código debe estar guardado en Git y corresponder al `main` remoto actual. Ejecutar build y comprobación de tipos; revisar el despliegue que atiende el dominio principal y conservar sus cambios si alguien ha publicado por otro camino. Publicar expresamente desde Hermes y comprobar que AMBOS dominios apuntan al despliegue previsto, corrigiendo cualquier alias desactualizado. Las pruebas de compilación no sustituyen una prueba de las pantallas afectadas.

## Supabase: conservar la producción existente

La carpeta `supabase/functions` recuperada de Vercel no garantiza representar las funciones desplegadas por separado. Se han guardado los 50 paquetes de funciones reales, con sus versiones, archivos y configuración `verify_jwt`, en `supabase/production-snapshot/*.json`. Cada paquete conserva su propia versión de archivos compartidos: no mezclarlos automáticamente.

`supabase-funciones-desplegadas.json` contiene el inventario y `supabase-migraciones-aplicadas.json` las 32 entradas del historial remoto consultado. Este inventario NO es una copia de la base de datos ni un volcado de su esquema o de sus datos. Las migraciones incluidas en la fuente web y el historial remoto no coinciden por completo.

Durante la instalación en Hermes no ejecutar `supabase db push`, reinicios ni despliegues masivos de funciones. Conectarse al proyecto actual. Para cambiar una función en el futuro, partir de su paquete desplegado y reconciliar sus dependencias antes de editar; para cambios de esquema, inspeccionar primero el esquema y el historial reales. La instantánea se tomó el 14 de septiembre: comprobar versiones antes de reutilizarla.

## Respaldo en el ordenador anterior

Carpeta privada: `C:\Users\danig\Downloads\traspaso-hermes-20260914`.

- `respaldo-local`: copias de las 14 carpetas de trabajo, incluyendo cambios sin commit y configuración local. Se excluyeron `node_modules` y enlaces de directorio; las dependencias se pueden reinstalar.
- `historial-completo.bundle`: historial y referencias de Git verificados.
- `manifiesto-respaldo-sha256.json`: verificación de 23.434 archivos de trabajo. Los metadatos mutables de `.git` se copiaron, pero no se incluyen en este manifiesto; el historial se verificó mediante el bundle.
- `produccion-exacta`: los archivos originales del despliegue, sin modificar.
- `manifiesto-produccion.json`: hashes de los archivos publicados.
- `supabase-produccion`: paquetes recuperados de las funciones desplegadas.

El respaldo privado puede contener `.env`, configuración y material operativo. No subir esa carpeta ni el bundle de historial antiguo al repositorio. Para continuar en Hermes basta el clon limpio de `main`; no necesita importar el respaldo completo.

La preparación en el ordenador anterior no instala ni verifica Hermes de forma remota. El traspaso queda operativo cuando Hermes haya completado los pasos de instalación y las tareas antiguas de ambos equipos hayan dejado de publicar.
