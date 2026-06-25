/**
 * Registro del lenguaje Wollok en Monaco + temas con paleta semántica.
 * Cosmético: la ejecución/tests/consola los maneja wollok-ts.
 *
 * Distingue: keywords, nombre de objeto/clase (type), parámetros, literales
 * (números/booleanos/strings), comentarios. Keywords y parámetros con más contraste.
 */
let registered = false;

const KEYWORDS = [
  "package", "import", "program", "object", "class", "mixin", "inherits",
  "method", "override", "native", "var", "const", "property", "self", "super",
  "new", "return", "if", "else", "test", "describe", "assert", "throw", "try",
  "catch", "then", "on", "fixture", "constructor", "and", "or", "not",
];

const LITERALS = ["true", "false", "null"];

export function registerWollokLanguage(monaco: any) {
  if (registered) return;
  registered = true;

  monaco.languages.register({ id: "wollok" });

  monaco.languages.setLanguageConfiguration("wollok", {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: '"', close: '"' },
    ],
  });

  monaco.languages.setMonarchTokensProvider("wollok", {
    keywords: KEYWORDS,
    literals: LITERALS,
    operators: [
      "=", "+", "-", "*", "/", "%", ">", "<", ">=", "<=", "==", "!=",
      "&&", "||", "!", "+=", "-=", "*=", "/=", "..",
    ],
    symbols: /[=><!~?:&|+\-*/^%]+/,
    tokenizer: {
      root: [
        // nombre de objeto/clase/mixin → type
        [/\b(object|class|mixin)\b/, { token: "keyword", next: "@typeName" }],
        // method <nombre>( <params> )
        [/\bmethod\b/, { token: "keyword", next: "@methodDecl" }],
        [
          /[a-zA-Z_]\w*/,
          {
            cases: {
              "@keywords": "keyword",
              "@literals": "constant",
              "@default": "identifier",
            },
          },
        ],
        { include: "@whitespace" },
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
        [/\d+(\.\d+)?/, "number"],
        [/[{}()[\]]/, "@brackets"],
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
      ],
      typeName: [
        { include: "@whitespace" },
        [/[a-zA-Z_]\w*/, { token: "type", next: "@pop" }],
        [/./, { token: "@rematch", next: "@pop" }],
      ],
      methodDecl: [
        { include: "@whitespace" },
        [/[a-zA-Z_]\w*/, "type.identifier"],
        [/\(/, { token: "@brackets", next: "@params" }],
        [/./, { token: "@rematch", next: "@pop" }],
      ],
      params: [
        { include: "@whitespace" },
        [/[a-zA-Z_]\w*/, "variable.parameter"],
        [/,/, "delimiter"],
        [/\)/, { token: "@brackets", next: "@pop" }],
        [/./, { token: "@rematch", next: "@pop" }],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ""],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
      ],
      comment: [
        [/[^/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[/*]/, "comment"],
      ],
      string: [
        [/[^"\\]+/, "string"],
        [/\\./, "string.escape"],
        [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
      ],
    },
  });

  // Temas con paleta coherente (keywords y parámetros con más contraste).
  monaco.editor.defineTheme("wollok-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "C586C0", fontStyle: "bold" },
      { token: "type", foreground: "4EC9B0" },
      { token: "type.identifier", foreground: "DCDCAA" },
      { token: "variable.parameter", foreground: "FFB454", fontStyle: "bold" },
      { token: "string", foreground: "CE9178" },
      { token: "number", foreground: "B5CEA8" },
      { token: "constant", foreground: "569CD6" },
      { token: "comment", foreground: "6A9955", fontStyle: "italic" },
    ],
    colors: {},
  });

  monaco.editor.defineTheme("wollok-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "AF00DB", fontStyle: "bold" },
      { token: "type", foreground: "267F99" },
      { token: "type.identifier", foreground: "795E26" },
      { token: "variable.parameter", foreground: "B05A00", fontStyle: "bold" },
      { token: "string", foreground: "A31515" },
      { token: "number", foreground: "098658" },
      { token: "constant", foreground: "0000FF" },
      { token: "comment", foreground: "008000", fontStyle: "italic" },
    ],
    colors: {},
  });
}
