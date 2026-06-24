/** Formatea una fecha ISO como "dd/mm/yy hh:mm" (o "—" si es nula). */
export function formatStampShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(
    2,
  )} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
