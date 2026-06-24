# Wollok Exam Online

Plataforma web para tomar **parciales de Wollok** en un entorno controlado (UNAHUR).
El docente prepara un examen, toma asistencia y lo inicia con la lista de alumnos
presentes; cada alumno programa Wollok en un editor web (sin poder copiar ni pegar),
ejecuta sus tests y una consola, y la app **commitea automáticamente** a un repo privado
por alumno cada X minutos. La entrega oficial es siempre el **último commit en GitHub**.

> La meta no es impedir el uso de IA al 100%, sino **aumentar el costo de copiar y dejar
> evidencia del proceso** para análisis posterior (Fase 2).

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind** — desplegado en **Vercel**.
- **Auth.js (NextAuth)** con una **OAuth App** de GitHub (solo login/identidad).
- **GitHub App** (octokit, server-side) para operar repos: crear desde template,
  leer, commitear, archivar.
- **Monaco Editor** (anti-copia) + **`wollok-ts`** para correr tests y la consola/REPL
  **en el navegador** (sin parte gráfica).
- **IndexedDB** como resguardo local interno (recuperación ante fallos).

## Principios de arquitectura

- **GitHub = única fuente de verdad. No hay base de datos.**
  - "Habilitado para rendir" = existe el repo `{examen}-{usuario}` en la org.
  - Examen abierto = repo activo; **cerrado = repo archivado** (solo lectura).
- **El browser nunca** recibe tokens de GitHub: todo el I/O pasa por **Route Handlers**
  (`app/api/**`) que usan la GitHub App.
- El alumno **no es colaborador** del repo; solo trabaja a través de la app.
- La **ejecución de Wollok corre en el cliente** (no depende del servidor).
- Detalle en [`docs/architecture.md`](docs/architecture.md).

## Setup

Requiere configurar en GitHub: una **OAuth App** (login), una **GitHub App** (operar
repos) y un **repo template**. Guía completa paso a paso en
[`docs/setup.md`](docs/setup.md) (separa lo que configura el **operador** de lo que hace
cada **docente**).

### Local (rápido)

```bash
cp .env.example .env.local   # completar credenciales (ver docs/setup.md)
# dejar el .pem de la GitHub App en .secrets/github-app.pem
npm install
npm run dev                  # http://localhost:3000 (o 3001 si 3000 está ocupado)
```

> Para desarrollo sin tocar GitHub: `GITHUB_INTEGRATION_MODE=mock` (todo en memoria).

### Deploy en Vercel

Ver [`docs/setup.md`](docs/setup.md) → sección **C. Deploy en Vercel** (env vars y
callback del dominio). La GitHub App / OAuth App / template se reusan; el `.pem` va como
**contenido** en `GITHUB_APP_PRIVATE_KEY`.

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests (Vitest) |

## Estado

**Fase 1 funcional:** login, iniciar/cerrar examen, editor anti-copia, ejecución de tests
y consola, autosave + commits a GitHub, recuperación local, dashboard con último commit + IP.

**Fase 2 (no implementada, a diseñar):** archivo de actividad (`.exam/activity.ndjson`),
análisis de riesgo, bloqueo por IP. Seguimiento en el tracker del workspace
(`projects/wollokOnline/ISSUES`), prefijo `WOLL`.
