import { CheckCircle2, CircleAlert } from "lucide-react";

type ConfigurationCheck = {
  key: string;
  label: string;
  complete: boolean;
};

export function IntegrityConfigurationStatus({ status }: { status?: {
  operational: boolean;
  completed: number;
  total: number;
  items: ConfigurationCheck[];
} }) {
  if (!status) return null;
  return (
    <section className="mb-6 rounded-2xl border border-[#DDD8CF] bg-white p-5" aria-labelledby="integrity-configuration-status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="integrity-configuration-status" className="font-bold">Prontidão do canal</h2>
          <p className="text-sm text-[#626866]">{status.completed} de {status.total} requisitos concluídos.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.operational ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          {status.operational ? "Operacional" : "Configuração pendente"}
        </span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {status.items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 rounded-xl bg-[#F6F5F2] p-3 text-sm">
            {item.complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden /> : <CircleAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
