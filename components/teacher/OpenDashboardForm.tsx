"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Abre el dashboard de un examen existente por su nombre. */
export function OpenDashboardForm() {
  const router = useRouter();
  const [name, setName] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const slug = name.trim();
    if (slug) router.push(`/teacher/exam/${encodeURIComponent(slug)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="nombre del examen"
        className="flex-1 rounded-md border bd bg-black/20 px-3 py-2 text-sm outline-none focus:border-current"
      />
      <button className="rounded-md border bd px-3 py-2 text-sm transition hoverable">
        Ver dashboard
      </button>
    </form>
  );
}
