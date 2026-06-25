# Arquitectura — Wollok Exam Online

## Principios

1. **GitHub = única fuente de verdad. No hay base de datos.** La entrega oficial de un
   alumno es siempre su último commit en su repo privado.
2. **El browser nunca toca GitHub directamente.** No recibe tokens de GitHub. Todo el I/O
   pasa por **Route Handlers** (`app/api/**`) que usan la **GitHub App** server-side.
3. **El alumno no es colaborador** de su repo: solo trabaja a través de la app.
4. **La ejecución de Wollok corre en el cliente** (no depende del servidor).
5. **El sistema nunca afirma "hizo trampa"/"usó IA".** Para Fase 2 se usará terminología
   neutral ("riesgo alto", "requiere revisión", "patrón atípico").

## Componentes

```
Browser (alumno/docente)
  │  OAuth (Auth.js)         ── login / identidad
  │  fetch /api/**           ── único canal de datos
  │  Monaco + wollok-ts      ── editar y ejecutar (tests/consola) en el cliente
  │  IndexedDB               ── resguardo local interno
  ▼
Next.js Route Handlers (server)
  │  GitHubService (octokit, GitHub App): generar repo desde template, leer,
  │     commitear, archivar, listar, leer imagen de enunciado
  ▼
GitHub  ── única fuente de verdad (org de exámenes)
```

## Autenticación y roles

- **OAuth App** de GitHub vía **Auth.js (NextAuth)** → login/identidad (`github_username`).
- **Docentes** definidos por configuración (`lib/config/teachers.ts`, env `TEACHERS`).
- **GitHub App** (separada, privada) → operar repos server-side.

## Estado del examen (derivado de GitHub, sin DB)

- "Habilitado para rendir" = existe el repo `{examen}-{usuario}` en la org.
- Examen **abierto** = repo activo. Examen **cerrado** = repo **archivado** (solo lectura).

## Flujo

1. **Preparar (docente, día previo):** repo **template** privado (marcado como *Template
   repository*) con `.wlk`/`.wtest` y el enunciado (imagen).
2. **Iniciar (docente, un paso):** pega los usernames presentes → la GitHub App **genera**
   `{examen}-{usuario}` por alumno (desde el template) e inicializa el control del examen
   (intervalo + hora de fin) en `_control/{examen}.json`. No se escribe nada dentro del
   repo del alumno.
3. **Rendir (alumno):** login → ingresa el nombre del examen → la app carga su repo en
   Monaco; ejecuta tests/consola en el navegador; autosave local + commits a GitHub.
4. **Cerrar (docente):** la GitHub App **archiva** los repos `{examen}-*`. El alumno detecta
   el cierre y se bloquea (editor read-only, sin commitear/entregar).

## Endpoints

- Docente: `POST /api/exams/start`, `POST /api/exams/extend`, `POST /api/exams/close`,
  `GET /api/exams/status?name=`.
- Alumno: `GET /api/workspace?exam=`, `POST /api/commit`, `POST /api/submit`,
  `GET /api/statement?exam=` (imagen del enunciado).
- Validan contra GitHub: usuario autenticado + repo existe + (para escribir) no archivado.

## Commits

- El cliente manda el contenido; **el servidor commitea** vía GitHub App (Git Data API,
  multi-archivo). Whitelist: solo `.wlk`/`.wtest` **existentes** (no se crean/borran archivos).
- Mensajes: `Auto-save examen YYYY-MM-DD HH:mm · ip X` y `Entrega final examen … · ip X`.
- La **IP** de origen se incluye en el mensaje del commit (control visual en el dashboard).
- Sincronización: auto-commit por intervalo + botón manual + entrega final.

## Persistencia local (IndexedDB)

Interno e invisible: resguardo ante fallos. No es fuente de verdad. Al reabrir, si lo local
difiere de lo último commiteado, se ofrece recuperar "lo que escribiste" vs "lo que
commiteaste". La entrega oficial siempre es el último commit en GitHub.

## Editor + enunciado

- Monaco: editar solo `.wlk`/`.wtest`; **bloqueo total** de copiar/cortar/pegar
  (atajos + eventos DOM + clic central de Linux), menú contextual y drag&drop.
- Enunciado: imagen servida por `/api/statement` en un panel lateral con zoom y ancho
  ajustable (no texto seleccionable).

## Ejecución Wollok

En el cliente con `wollok-ts` (sin parte gráfica). Detalle en
[`wollok-integration.md`](wollok-integration.md).

## Fase 2 (no implementada)

- Archivo de actividad (`.exam/activity.ndjson`) + import + análisis de riesgo.
- Bloqueo por IP (hoy solo visual en el dashboard).
