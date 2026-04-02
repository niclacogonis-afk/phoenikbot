/**
 * Dynamic handlers must not load `.d.ts` files: `foo.d.ts` ends with `.ts` and would be imported by mistake.
 */
export function isHandlerSourceFile(fileName: string): boolean {
  if (fileName.endsWith('.d.ts')) return false;
  return fileName.endsWith('.js') || fileName.endsWith('.ts');
}
