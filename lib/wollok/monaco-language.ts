/**
 * Registro del lenguaje Wollok en Monaco (resaltado de sintaxis).
 * Es solo cosmético: la ejecución/tests/consola los maneja wollok-ts.
 */
let registered = false;

const KEYWORDS = [
  "package",
  "import",
  "program",
  "object",
  "class",
  "mixin",
  "inherits",
  "method",
  "override",
  "native",
  "var",
  "const",
  "property",
  "self",
  "super",
  "new",
  "return",
  "if",
  "else",
  "test",
  "describe",
  "assert",
  "throw",
  "try",
  "catch",
  "then",
  "on",
  "fixture",
  "constructor",
  "and",
  "or",
  "not",
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
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
        [/\d+(\.\d+)?/, "number"],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/[{}()[\]]/, "@brackets"],
        [/@symbols/, { cases: { "@operators": "operator", "@default": "" } }],
        [/[ \t\r\n]+/, ""],
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
}
