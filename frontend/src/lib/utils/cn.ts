/** Une clases condicionalmente (sin dependencias externas). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
