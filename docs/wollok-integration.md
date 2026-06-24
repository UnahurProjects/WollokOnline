# Integración con Wollok

## Ejecución en el cliente (con `wollok-ts`)

La ejecución de código y tests corre **en el navegador del alumno** con
[`wollok-ts`](https://github.com/uqbar-project/wollok-ts) (el intérprete oficial de Wollok
en TypeScript). No hay servicio externo ni ejecución en el servidor: el server solo trae el
parcial y lo pushea a GitHub.

**No se usa la parte gráfica** de Wollok (`wollok-run-client`: el visor de objetos / juegos).
Solo consola/REPL y tests.

Implementación: `lib/wollok/runner.ts`.

### Correr tests

```ts
const result = await runTests(files); // { total, passed, failed, results, buildError? }
```
- Construye el environment con `buildEnvironment(files)`.
- Busca los `Test` (`env.descendants` con `kind === "Test"`).
- Corre cada uno con `interpret(env, WRENatives)` + `interpreter.fork().run(fqn)`.
- Mapea a `{ name, fqn, passed, error }` (pass/fail con el mensaje de la aserción).

### Consola / REPL

```ts
const repl = await WollokRepl.create(files);
repl.evaluate("pepita.energia()"); // { output, errored }
```
- Mantiene un `Interpreter` con estado entre líneas (`interprete(...)`).
- Al iniciar, importa automáticamente los paquetes `.wlk` del alumno (`import pkg.*`) para
  que sus objetos estén en scope.
- `Reiniciar` reconstruye el environment con el código actual.

### Notas de bundling

`wollok-ts` es CommonJS y hace `require('console')` (módulo de Node). En el bundle del
navegador se redirige al `console` global mediante un shim
(`lib/shims/console.cjs`, alias en `next.config.mjs`). Se importa de forma dinámica para no
pesar en la carga inicial.

## Estructura de archivos del alumno

- Código y tests editables: `.wlk` / `.wtest` (vienen del repo template; árbol fijo).
- Enunciado: una **imagen** en el repo (ej. `readme.png` / `statement/statement.png`), servida
  por `/api/statement` y mostrada en el panel lateral (no como texto seleccionable).
- `.exam/config.json`: configuración del examen (ej. `autoCommitIntervalMinutes`).

## Fase 2 (no implementado)

- Archivo de actividad `.exam/activity.ndjson` (registro del proceso) e import + análisis de
  riesgo. Diseño aún sin definir.

Referencias oficiales: https://www.wollok.org/ ·
https://github.com/uqbar-project/wollok-ts · https://github.com/uqbar-project/wollok-ts-cli
