"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** El alumno ingresa el nombre del examen para entrar (no hay lista en DB). */
export function StudentExamEntry() {
  const router = useRouter();
  const [name, setName] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slug = name.trim();
    if (slug) router.push(`/student/${encodeURIComponent(slug)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="text-xs uppercase tracking-wide opacity-60">
        Nombre del examen
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="parcial2-com1"
        className="w-full rounded-md border bd bg-black/20 px-3 py-2 text-sm outline-none focus:border-current"
      />
      <button className="self-start rounded-md btn-primary px-4 py-2 text-sm font-semibold transition hover:opacity-90">
        Entrar al examen
      </button>
    </form>
  );
}
