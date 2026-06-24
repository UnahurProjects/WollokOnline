/**
 * Ejecución de Wollok en el CLIENTE (navegador), con wollok-ts.
 *
 * - Correr tests (.wtest) → pass/fail con mensaje.
 * - Consola/REPL → evaluar expresiones contra los objetos del alumno
 *   (crear objetos, mandar mensajes, modificar atributos).
 *
 * Sin parte gráfica (nada de wollok-run-client). wollok-ts se importa de forma
 * dinámica para no pesar en la carga inicial.
 */

export interface WollokFile {
  path: string;
  content: string;
}

export interface TestResult {
  name: string;
  fqn: string;
  passed: boolean;
  error?: string;
}

export interface RunTestsResult {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
  buildError?: string;
}

// wollok-ts es CommonJS; con webpack el namespace puede venir en .default.
async function loadWollok(): Promise<any> {
  const mod: any = await import("wollok-ts");
  return mod?.buildEnvironment ? mod : (mod.default ?? mod);
}

function toFileContents(files: WollokFile[]) {
  return files
    .filter((f) => /\.(wlk|wtest)$/i.test(f.path))
    .map((f) => ({ name: f.path, content: f.content }));
}

/** FQN de paquete de cada archivo .wlk (para importarlos en el REPL). */
function wlkPackages(files: WollokFile[]): string[] {
  return files
    .filter((f) => /\.wlk$/i.test(f.path))
    .map((f) => f.path.replace(/\.wlk$/i, "").replace(/\//g, "."));
}

function cleanError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message).split("\n")[0];
  }
  return String(e);
}

function buildErrors(env: any): string[] {
  const out: string[] = [];
  for (const node of env.descendants) {
    const problems = node.problems ?? [];
    for (const p of problems) {
      if (p.level === "error") {
        const where = node.sourceFileName ? ` (${node.sourceFileName})` : "";
        out.push(`${p.code}${where}`);
      }
    }
  }
  return out;
}

/** Corre todos los tests del workspace. */
export async function runTests(files: WollokFile[]): Promise<RunTestsResult> {
  const wollok = await loadWollok();
  let env: any;
  try {
    env = wollok.buildEnvironment(toFileContents(files));
  } catch (e) {
    return { total: 0, passed: 0, failed: 0, results: [], buildError: cleanError(e) };
  }

  const errors = buildErrors(env);
  if (errors.length) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      results: [],
      buildError: `Errores de compilación:\n${[...new Set(errors)].join("\n")}`,
    };
  }

  const tests = env.descendants.filter((n: any) => n.kind === "Test");
  const results: TestResult[] = [];
  for (const t of tests) {
    const interpreter = wollok.interpret(env, wollok.WRENatives);
    try {
      interpreter.fork().run(t.fullyQualifiedName);
      results.push({ name: t.name, fqn: t.fullyQualifiedName, passed: true });
    } catch (e) {
      results.push({
        name: t.name,
        fqn: t.fullyQualifiedName,
        passed: false,
        error: cleanError(e),
      });
    }
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}

/** Consola/REPL con estado persistente entre líneas. */
export class WollokRepl {
  private wollok: any;
  private interpreter: any;

  static async create(files: WollokFile[]): Promise<WollokRepl> {
    const repl = new WollokRepl();
    await repl.rebuild(files);
    return repl;
  }

  /** Reconstruye el entorno con el código actual e importa los objetos del alumno. */
  async rebuild(files: WollokFile[]): Promise<void> {
    this.wollok = await loadWollok();
    const env = this.wollok.buildEnvironment(toFileContents(files));
    this.interpreter = this.wollok.interpret(env, this.wollok.WRENatives);
    for (const pkg of wlkPackages(files)) {
      try {
        this.wollok.interprete(this.interpreter, `import ${pkg}.*`, undefined, true);
      } catch {
        // import opcional: si un paquete no resuelve, lo ignoramos.
      }
    }
  }

  /** Evalúa una línea. Devuelve la salida textual y si hubo error. */
  evaluate(line: string): { output: string; errored: boolean } {
    const r = this.wollok.interprete(this.interpreter, line, undefined, true);
    if (r.errored) {
      const detail = r.error?.message ? `\n${cleanError(r.error)}` : "";
      return { output: `${r.result}${detail}`, errored: true };
    }
    return { output: r.result ?? "", errored: false };
  }
}
