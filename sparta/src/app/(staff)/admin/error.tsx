"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg text-center">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Erro no módulo de administração</h2>
        <p className="text-sm text-red-600 mb-4">
          {error.message || "Ocorreu um erro inesperado."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4">Código: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
