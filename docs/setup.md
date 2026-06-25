# Setup — Wollok Exam Online

Hay dos planos de configuración, no los mezcles:

- **A. Plataforma** — lo hace el **operador** (vos). Se configura una vez y se
  replica en cada server donde corra la app.
- **B. Por profesor** — lo hace cada **docente** en GitHub / en la plataforma,
  cuando quiere. NO toca credenciales ni el servidor.

GitHub es la única fuente de verdad del examen (no hay base de datos).

> **Dos organizaciones distintas:**
> - **Código / desarrollo:** `UnahurProjects/WollokOnline` (lo que se deploya en Vercel).
> - **Exámenes:** `ExamUnahurP` (org de prueba, `GITHUB_DEFAULT_ORG`) — ahí está instalada
>   la GitHub App y los repos template; ahí se generan los repos por alumno.

---

## Conceptos clave (para no olvidarnos)

**¿Dónde está el `.env.local`?** Es un archivo que se crea a mano en la raíz del
proyecto (`repos/github/WollokOnline/.env.local`), está **gitignored** (no se sube).
La plantilla versionada es `.env.example`. En **Vercel** no hay archivo: las mismas
variables se cargan en *Settings → Environment Variables*.

**¿Qué es `AUTH_SECRET`?** Una clave secreta **de la app** que usa Auth.js para
firmar/encriptar la cookie de sesión (que nadie falsifique un login). No se obtiene
de GitHub: es un valor **aleatorio** que generás vos con `openssl rand -base64 32`.
En cada server (local y Vercel) ponés uno.

**Dos apps de GitHub, SEPARADAS (a propósito):**
- **GitHub App** (App ID + Installation ID + `.pem`) → **privada**, solo server-side,
  para **operar repos** (crear desde template, leer, commitear, archivar). Actúa como bot.
- **OAuth App** (Client ID + Client secret) → para el **login** (identidad del usuario).
  Es una app **distinta** de la GitHub App. Cualquier usuario de GitHub puede autorizarla
  (en cambio, una GitHub App privada solo deja loguear a su dueño → por eso NO se usa para
  login).

**¿Por qué necesito OAuth si ya estoy logueado en GitHub en el navegador?** Porque
el navegador **aísla los sitios**: que estés logueado en github.com no le dice a
*nuestra* app quién sos. El login con GitHub hace un "apretón de manos": la app te
manda a GitHub, GitHub **reutiliza tu sesión** (no te pide user/pass de nuevo) y le
devuelve a la app tu identidad verificada. Para ese handshake, GitHub tiene que
reconocer a *nuestra* app → por eso el Client ID/secret.

**El `.pem` en Vercel:** no se sube el archivo; se pega su **contenido** en la env
`GITHUB_APP_PRIVATE_KEY`. En local usamos el archivo (`.secrets/github-app.pem`) por
comodidad.

---

## A. Plataforma (operador)

### A.1 — UNA SOLA VEZ, en GitHub (sirve para cualquier server)

Esto se crea una vez y lo reutilizan tanto tu compu como Vercel.

1. **GitHub App** (operar repos): en la Org → Settings → Developer settings →
   GitHub Apps → New.
   - Webhook: desactivado.
   - Permisos de repositorio: **Administration** = R/W, **Contents** = R/W.
   - Create → anotá el **App ID** → generá una **Private key** (.pem) y guardala.
2. **OAuth App separada para el login**: Desde el perfil del Propietario ir a GitHub → Settings → Developer settings →
   **OAuth Apps** → New OAuth App (conviene crearla en la org).
   - Application name: ej. "Wollok Exam Login".
   - Homepage URL: la URL del server (ej. `http://localhost:3001`).
   - **Authorization callback URL**: `http://localhost:3001/api/auth/callback/github`
     (agregás la de Vercel al desplegar).
   - Register → copiá el **Client ID** → **Generate a new client secret** → copialo.
   - Esos dos valores van en `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
3. **Instalá la GitHub App** (la del punto 1) en la organización → de la URL sacás el
   **Installation ID**.
4. La **GitHub App queda PRIVADA** (solo opera repos). El login lo maneja la OAuth App
   del punto 2, que cualquier usuario puede autorizar.

> Resultado A.1 (valores que vas a reusar siempre):
> App ID, Client ID, Client secret, Installation ID, el archivo .pem, y el nombre
> de la organización.

### A.2 — POR CADA SERVER (ahora tu compu; después, de nuevo, en Vercel)

Mismos valores de A.1, cargados en el entorno de ese server + el callback de su dominio.

**a) Callback URL de login** — en la GitHub App → **General** → sección
**"Identifying and authorizing users"**, campo de texto **"Callback URL"**:
- Tu compu: `http://localhost:3000/api/auth/callback/github`
- Vercel: `https://TU-APP.vercel.app/api/auth/callback/github`
- (se pueden tener las dos a la vez con "Add callback URL")

En esa misma sección, **dejá DESTILDADOS** los dos checkboxes:
- ❌ "Request user authorization (OAuth) during installation"
- ❌ "Enable Device Flow"

Después **Save changes**. La URL debe coincidir exacta (sin barra final de más),
si no GitHub devuelve "redirect_uri mismatch".

**b) Variables de entorno**

| Variable | Qué es | Local (tu compu) | Vercel |
|---|---|---|---|
| `AUTH_SECRET` | secreto para firmar la sesión (valor random) | `openssl rand -base64 32` | otra var (otro random) |
| `AUTH_GITHUB_ID` | Client ID (login) | `.env.local` | Env Var |
| `AUTH_GITHUB_SECRET` | Client secret (login) | `.env.local` | Env Var |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | URL del server | `http://localhost:3000` | tu dominio Vercel |
| `TEACHERS` | usuarios docentes (coma) | `.env.local` | Env Var |
| `GITHUB_INTEGRATION_MODE` | `app` | `.env.local` | Env Var |
| `GITHUB_APP_ID` | App ID | `.env.local` | Env Var |
| `GITHUB_APP_INSTALLATION_ID` | Installation ID | `.env.local` | Env Var |
| `GITHUB_DEFAULT_ORG` | organización destino | `.env.local` | Env Var |
| clave privada | el `.pem` | archivo en `.secrets/github-app.pem` + `GITHUB_APP_PRIVATE_KEY_PATH` | pegar contenido en `GITHUB_APP_PRIVATE_KEY` |

- **Local:** copiá `.env.example` a `.env.local`, completá, y dejá el `.pem` en
  `.secrets/github-app.pem`.
- **Vercel:** las mismas variables en Settings → Environment Variables. La clave
  privada va como **contenido** en `GITHUB_APP_PRIVATE_KEY` (no se sube el archivo).

> La GitHub App, sus permisos, el Client secret y el .pem se crean **una vez** (A.1).
> En Vercel **no** recreás la App: solo cargás las env y agregás el callback (A.2).

---

## B. Por profesor (sin tocar el servidor)

### B.1 — Preparar el examen (en GitHub, cuando quiera)

Cada docente arma su **repo template** en la organización:
- Privado, con los `.wlk`/`.wtest` base.
- Enunciado opcional (ej. `statement/statement.png`).
- Settings del repo → marcar **Template repository** ✅.

> El intervalo y la duración se eligen al iniciar el examen (no van en el template);
> quedan en `_control/{examen}.json`.

### B.2 — Tomar el examen (en la plataforma)

1. Login (su usuario debe estar en `TEACHERS`).
2. **Iniciar examen**: nombre + repo template + intervalo + duración + pegar los usuarios
   de GitHub presentes → se genera un repo privado por alumno.
3. Monitorear el **dashboard** (último commit + IP por alumno).
4. **Cerrar** el examen → los repos quedan archivados (solo lectura).

El docente nunca configura credenciales ni variables de entorno.

---

## C. Deploy en Vercel (operador)

La GitHub App, la OAuth App y el template ya creados (sección A) se REUSAN. En Vercel
solo: subir el código, cargar las env y agregar el callback del dominio.

1. **Subir el código a GitHub** (si no está):
   ```
   git add .
   git commit -m "Wollok Exam Online"
   git push origin main
   ```
   (El `.gitignore` excluye `.env.local`, `.secrets/` y `*.pem` → no se suben secretos.)
2. **Vercel → New Project → Import** el repo `UnahurProjects/WollokOnline`.
   Framework: Next.js (autodetectado). Root Directory: la raíz del repo.
3. **Environment Variables** (Settings → Environment Variables): las mismas del
   `.env.local`, con dos diferencias:
   - `GITHUB_APP_PRIVATE_KEY` = **contenido** del `.pem` (pegado). NO usar
     `GITHUB_APP_PRIVATE_KEY_PATH`.
   - `AUTH_URL` y `NEXT_PUBLIC_APP_URL` = la URL de Vercel (ej. `https://wollok-exam.vercel.app`).
   - `AUTH_SECRET` = un random nuevo (`openssl rand -base64 32`).
   - Resto igual: `AUTH_GITHUB_ID/SECRET` (OAuth App), `TEACHERS`,
     `GITHUB_INTEGRATION_MODE=app`, `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`,
     `GITHUB_DEFAULT_ORG`.
4. **Deploy.** Anotá el dominio que te asigna Vercel.
5. **Callback de login**: en la **OAuth App** → Add callback URL
   `https://TU-DOMINIO.vercel.app/api/auth/callback/github`. Si recién ahí supiste el
   dominio, ajustá `AUTH_URL`/`NEXT_PUBLIC_APP_URL` y volvé a deployar.

> Caveat (plan Hobby): las funciones serverless tienen ~10s de límite. Iniciar un
> examen crea los repos de a uno; con muchos alumnos puede tardar. Si da timeout,
> conviene plan Pro o iniciar en tandas más chicas.

## Probar (local)

```
npm install
npm run dev   # http://localhost:3000
```
Login como docente → iniciar examen → login como alumno → editar / tests / consola
/ commit / entregar → verificar en GitHub que se crearon los repos `{examen}-{usuario}`.

> Con `GITHUB_INTEGRATION_MODE=mock` todo corre en memoria (sin tocar GitHub),
> útil para desarrollo sin credenciales.

### Troubleshooting

- **"Cannot GET /api/auth/callback/github" tras autorizar:** la app corre en un
  puerto distinto al del callback/`AUTH_URL`. Si el 3000 está ocupado, Next usa 3001
  y GitHub redirige al puerto equivocado. Solución: que `AUTH_URL` y
  `NEXT_PUBLIC_APP_URL` usen el mismo puerto que la app, agregar ese callback en la
  GitHub App, y fijar el puerto con `npm run dev -- -p 3001`. Reiniciar el server
  tras cambiar `.env.local`.
- **`redirect_uri mismatch`:** el callback registrado no coincide exacto con la URL
  real (puerto o barra final). Igualalos.
- **Homepage URL** de la GitHub App: es solo informativa (no afecta el login). Conviene
  igualarla al dominio/puerto en uso por prolijidad, pero no es obligatoria.
- **404 en `github.com/login/oauth/authorize` al loguear con OTRA cuenta (alumno):**
  estabas usando el Client ID de una **GitHub App privada** para el login (solo deja
  autorizar al dueño). **Solución adoptada:** usar una **OAuth App separada** para el
  login (cualquier usuario la puede autorizar) y dejar la GitHub App privada para operar
  repos. Ver A.1 punto 2.
