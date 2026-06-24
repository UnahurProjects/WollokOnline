"use client";

import { formatStampShort } from "@/lib/format";

/**
 * Diálogo de recuperación. No revela que existe una copia local: solo ofrece
 * "lo último que escribiste" vs "lo último que commiteaste".
 */
export function RecoveryDialog({
  localSavedAt,
  remoteCommitAt,
  onRecover,
  onUseRemote,
}: {
  localSavedAt: string;
  remoteCommitAt: string | null;
  onRecover: () => void;
  onUseRemote: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
      <div className="card w-full max-w-md rounded-lg p-6">
        <h2 className="text-lg font-semibold">¿Qué versión querés abrir?</h2>
        <p className="mt-2 text-sm opacity-70">
          ¿Querés recuperar lo último que escribiste, o lo último que commiteaste?
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <dt className="opacity-50">Lo último que escribiste</dt>
          <dd>{formatStampShort(localSavedAt)}</dd>
          <dt className="opacity-50">Lo último que commiteaste</dt>
          <dd>{formatStampShort(remoteCommitAt)}</dd>
        </dl>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={onRecover}
            className="btn-primary rounded-md px-4 py-2.5 text-sm font-semibold"
          >
            Lo último que escribí
          </button>
          <button
            onClick={onUseRemote}
            className="bd hoverable rounded-md border px-4 py-2.5 text-sm"
          >
            Lo último que commiteé
          </button>
        </div>
      </div>
    </div>
  );
}
