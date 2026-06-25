# Arquitectura — Wollok Exam Online

> **Nota sobre la ejecución de Wollok:** en esta implementación la compilación y
> ejecución de tests/consola corre **en el navegador con `wollok-ts`** (no hay una
> "Workspace API" server-side). Si en el futuro se mueve a un servidor, se agrega como
> contenedor y se actualizan los diagramas.

## Dueño de cada dato

| Dato | Dueño / fuente de verdad | Dónde vive |
|---|---|---|
| Identidad del usuario (username, email, id) | **GitHub OAuth App** | GitHub |
| Código del alumno (`.wlk`/`.wtest`) + **entrega oficial** | **Repo `{examen}-{usuario}`** | GitHub (org `ExamUnahurP`) |
| Estado del examen (intervalo, `endsAt`, `closed`) | **`_control/{examen}.json`** | GitHub (org `ExamUnahurP`) |
| Template del examen | **Repo template** | GitHub (org `ExamUnahurP`) |
| Copia local / recuperación | Navegador (IndexedDB) | Cliente — **no** es fuente de verdad |
| Ejecución de tests/consola | Navegador (`wollok-ts`) | Cliente — efímero, sin servidor |

---

## Flujo de datos (qué le pide el cliente y a quién)

Colores: 🔵 **Login** · 🟢 **Cargar examen** · 🟠 **Commit** · ⚪ **Ejecutar (sin servidor)**.

```mermaid
flowchart LR
  subgraph Cliente["App cliente (navegador)"]
    UI["Next.js UI + Monaco + IndexedDB + wollok-ts"]
  end

  subgraph Servidor["Route Handlers (Next.js en Vercel)"]
    RH["/api/*"]
  end

  subgraph GitHub["GitHub — org ExamUnahurP"]
    OAUTH["OAuth App (identidad)"]
    REPO["Repo alumno {examen}-{usuario}<br/>(.wlk/.wtest, commits)"]
    CTRL["_control/{examen}.json<br/>(intervalo, endsAt, closed)"]
  end

  UI -- "1 · Login (código OAuth)" --> RH
  RH -- "OAuth 2.0" --> OAUTH
  OAUTH -- "username, email, id" --> RH
  RH -- "sesión (cookie)" --> UI

  UI -- "2 · GET /api/workspace?exam" --> RH
  RH -- "REST: leer .wlk/.wtest + último commit" --> REPO
  RH -- "REST: leer estado" --> CTRL
  RH -- "files, endsAt, closed, intervalo, lastCommit" --> UI

  UI -- "3 · POST /api/commit {exam, files}" --> RH
  RH -- "REST: commitear (+ IP en el mensaje)" --> REPO
  RH -- "REST: leer estado (closed / endsAt)" --> CTRL
  RH -- "sha, committedAt, endsAt" --> UI

  UI -. "Correr tests / consola: wollok-ts en el navegador (sin servidor)" .-> UI

  linkStyle 0,1,2,3 stroke:#2563eb,stroke-width:2px
  linkStyle 4,5,6,7 stroke:#16a34a,stroke-width:2px
  linkStyle 8,9,10,11 stroke:#ea580c,stroke-width:2px
  linkStyle 12 stroke:#6b7280,stroke-width:2px
```

Notas:
- El **navegador nunca** habla directo con GitHub (salvo el redirect de login OAuth, que es
  inherente al login). Repos y estado siempre pasan por los Route Handlers (GitHub App).
- **Ejecutar tests/consola no genera ninguna llamada al servidor** (corre en el navegador).
- IndexedDB se usa en el cliente para resguardo/recuperación; no aparece como llamada externa.

---

## Endpoints (Route Handlers de Next.js)

Todos viven bajo `app/api/**`. El navegador **solo** habla con estos (nunca con GitHub directo).

| Endpoint | Método | Lo usa | Para qué | GitHub que toca |
|---|---|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Alumno y docente | Login con GitHub (Auth.js) | OAuth App |
| `/api/workspace?exam=` | GET | Alumno | Cargar el examen (archivos + estado) | Repo del alumno + `_control` |
| `/api/commit` | POST | Alumno | Auto/Manual commit del trabajo | Repo del alumno (+ `_control`) |
| `/api/submit` | POST | Alumno | Entrega final | Repo del alumno (+ `_control`) |
| `/api/statement?exam=` | GET | Alumno | Imagen del enunciado | Repo del alumno |
| `/api/export-auth` | POST | Alumno (con código docente) | Validar código para exportar `.zip` | — (solo valida `EXPORT_CODE`) |
| `/api/exams/start` | POST | Docente | Iniciar examen: generar repos por alumno | Template → repos + `_control` |
| `/api/exams/status?name=` | GET | Docente | Dashboard (último commit + IP + actividad) | Repos `{examen}-*` (GraphQL) + `_control` |
| `/api/exams/close` | POST | Docente | Cierre duro (nadie commitea más) | `_control` |
| `/api/exams/extend` | POST | Docente | Sumar minutos a la hora de fin | `_control` |

> **Notas:**
> - **`/api/exams/state` NO existe.** En el modelo **sin polling**, el cliente recibe
>   `endsAt` al cargar (`/api/workspace`) y en cada respuesta de `/api/commit`. No se sondea.
> - **Hora de fin:** se fija al iniciar (`durationMinutes` → `endsAt` en `_control`, o sin
>   límite si es 0) y se ajusta con `/api/exams/extend`. El cierre manual inmediato es
>   `/api/exams/close`. (Reemplazó al viejo `/api/exams/countdown`, ya eliminado.)
> - **Config del examen:** vive solo en `_control/{examen}.json` (intervalo + `endsAt` +
>   `closed`). No se escribe nada dentro del repo del alumno.

## Flujo del docente

```mermaid
flowchart LR
  subgraph Docente["App docente (navegador)"]
    D["Next.js UI"]
  end
  subgraph Servidor["Route Handlers (Vercel)"]
    R["/api/exams/*"]
  end
  subgraph GitHub["GitHub — ExamUnahurP"]
    TPL["Repo template"]
    REPOS["Repos {examen}-*"]
    CTRL["_control/{examen}.json"]
  end

  D -- "POST /api/exams/start {nombre, template, intervalo, duración, usernames}" --> R
  R -- "REST: generate-from-template" --> TPL
  R -- "REST: crear repo por alumno" --> REPOS
  R -- "REST: escribir estado inicial" --> CTRL

  D -- "GET /api/exams/status?name" --> R
  R -- "GraphQL: último commit de todos" --> REPOS
  R -- "REST: leer estado" --> CTRL
  R -- "filas (alumno, commit, IP, actividad) + estado" --> D

  D -- "POST /api/exams/close (cierre duro)" --> R
  R -- "REST: marcar closed" --> CTRL

  linkStyle 0,1,2,3 stroke:#16a34a,stroke-width:2px
  linkStyle 4,5,6,7 stroke:#2563eb,stroke-width:2px
  linkStyle 8,9 stroke:#dc2626,stroke-width:2px
```

---

## C4 — Diagrama de Contexto

```mermaid
C4Context
  title Wollok Exam Online — Contexto

  Person(alumno, "Alumno", "Programa Wollok, corre tests y commitea su parcial")
  Person(docente, "Docente", "Inicia, monitorea, extiende y finaliza exámenes")

  System(weo, "Wollok Exam Online", "App web (Next.js en Vercel) para tomar parciales de Wollok en un entorno controlado")

  System_Ext(ghoauth, "GitHub OAuth App", "Login / identidad del usuario")
  System_Ext(ghapp, "GitHub App + Org ExamUnahurP", "Repos de examen (template, por alumno) y estado de control")

  Rel(alumno, weo, "Programa, ejecuta, commitea", "HTTPS")
  Rel(docente, weo, "Gestiona exámenes y monitorea", "HTTPS")
  Rel(weo, ghoauth, "Autentica usuarios", "OAuth 2.0")
  Rel(weo, ghapp, "Crea/lee/commitea repos y consulta estado", "GitHub API REST + GraphQL")
```

---

## C4 — Diagrama de Contenedores

```mermaid
C4Container
  title Wollok Exam Online — Contenedores

  Person(alumno, "Alumno")
  Person(docente, "Docente")

  System_Boundary(weo, "Wollok Exam Online") {
    Container(spa, "App cliente", "Next.js (navegador): Monaco, IndexedDB, Auth.js, wollok-ts", "UI, edición anti-copia, ejecución Wollok en el navegador, resguardo local")
    Container(api, "Route Handlers", "Next.js (Vercel)", "Login, permisos, crear repos, leer/commitear, estado del examen, imagen de enunciado")
  }

  System_Ext(ghoauth, "GitHub OAuth App", "Login / identidad")
  System_Ext(ghapp, "GitHub App + Org ExamUnahurP", "Repos (template, {examen}-{usuario}, _control)")

  Rel(alumno, spa, "Usa", "HTTPS")
  Rel(docente, spa, "Usa", "HTTPS")
  Rel(spa, api, "workspace, commit, submit, estado, statement, acciones docente", "HTTPS / JSON")
  Rel(spa, ghoauth, "Redirección de autorización (reusa la sesión del navegador)", "OAuth 2.0")
  Rel(api, ghoauth, "Intercambio de código por token + datos del usuario", "OAuth 2.0")
  Rel(api, ghapp, "Generar/leer/commitear/archivar y consultar commits", "GitHub API REST + GraphQL")

  UpdateRelStyle(spa, api, $offsetY="-10")
```

### Responsabilidades

- **App cliente (navegador):** UI; editor Monaco con bloqueo de copiar/pegar; ejecución de
  tests y consola con `wollok-ts` (sin servidor); IndexedDB para recuperación local; inicio
  del login con Auth.js. **Nunca** accede a GitHub (repos) ni guarda la verdad.
- **Route Handlers (Next.js / Vercel):** único intermediario hacia afuera. Login, validación
  de permisos, crear repos desde template, leer/commitear archivos, capturar la IP en el
  commit, estado del examen (intervalo/endsAt/closed), servir la imagen del enunciado.
- **GitHub OAuth App:** identidad del usuario (login).
- **GitHub App + Org ExamUnahurP:** repos de examen (template + por alumno) y `_control`;
  fuente de verdad de la entrega y del estado.

### Restricciones

- El navegador nunca accede directo a GitHub (repos) — solo vía Route Handlers (la única
  excepción es el redirect de login OAuth).
- GitHub es la **fuente oficial de la entrega**; IndexedDB es solo recuperación local.
- El docente usa la **misma app** que el alumno (cambia el rol según `TEACHERS`).
```
