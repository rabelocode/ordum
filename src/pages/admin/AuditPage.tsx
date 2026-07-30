import React, { useState, useEffect } from 'react';
import { useAuth } from '../../core/auth/AuthProvider';
import { Search, FileText } from 'lucide-react';

export function AuditPage() {
  const { session } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAudit() {
      if (!session) return;
      try {
        const response = await fetch('/api/admin/audit', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLogs(data);
        }
      } catch (e) {
        console.error("Error loading audit:", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadAudit();
  }, [session]);

  const severityColor = (sev: string) => {
    switch (sev) {
      case 'info': return 'bg-blue-100 text-blue-700';
      case 'warning': return 'bg-orange-100 text-orange-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#202322] tracking-tight">Auditoria</h1>
          <p className="text-[#626866] mt-1">Histórico de ações e eventos da plataforma.</p>
        </div>
      </div>

      <div className="bg-white border border-[#DDD8CF]/40 rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Carregando logs de auditoria...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum evento encontrado no seu escopo.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#DDD8CF]/40 bg-[#F6F5F2]/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="p-4 pl-6">Data/Hora</th>
                  <th className="p-4">Ação</th>
                  <th className="p-4">Usuário (Ator)</th>
                  <th className="p-4">Entidade</th>
                  <th className="p-4">Severidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDD8CF]/40">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="text-sm font-medium text-[#202322]">{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-[#626866]">{new Date(log.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-bold text-[#202322]">{log.action}</span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-[#202322]">{log.actor_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-gray-700">{log.entity_type}</div>
                      <div className="text-xs text-gray-500 font-mono">{log.entity_id?.substring(0,8)}...</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium uppercase tracking-wider ${severityColor(log.severity)}`}>
                        {log.severity || 'info'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
