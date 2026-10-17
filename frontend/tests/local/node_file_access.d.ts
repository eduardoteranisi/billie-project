// O @types/node fica de fora do repo de propósito: com ele instalado, um `import "node:fs"` passaria
// no typecheck do código do app, que precisa continuar rodando no navegador. Aqui ficam só as
// funções do Node que o test:local usa, visíveis apenas para o tsconfig desta pasta.
declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:url" {
  export function fileURLToPath(url: URL): string;
}
