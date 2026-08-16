import React from 'react';
import { Check, Eye } from 'lucide-react';
import { navigationPreview, permissionGroups } from '../../pages/admin/adminAccessPresentation';

export function AccessPreview({ permissions, detailed = false }: { permissions: string[]; detailed?: boolean }) {
  const navigation = navigationPreview(permissions);
  const groups = permissionGroups(permissions);
  return <div className="space-y-4">
    <div>
      <div className="flex items-center gap-2 text-sm font-black text-[#202322]"><Eye className="h-4 w-4 text-[#B66E45]"/>Esta pessoa verá</div>
      {navigation.length === 0 ? <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Esta função não possui áreas de trabalho disponíveis.</p> : <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {navigation.map(group => <section key={group.id} className="rounded-xl bg-[#F6F5F2] p-3">
          <h4 className="text-sm font-black">{group.label}</h4>
          <ul className="mt-2 space-y-1.5">{group.children.map(child => <li key={child.id} className="flex items-center gap-2 text-xs text-[#4F5553]"><Check className="h-3.5 w-3.5 text-emerald-600"/>{child.label}</li>)}</ul>
        </section>)}
      </div>}
    </div>
    {detailed ? <div>
      <h4 className="text-sm font-black text-[#202322]">Ações permitidas</h4>
      <div className="mt-3 space-y-3">{groups.map(group => <section key={group.label}><h5 className="text-xs font-bold uppercase tracking-wide text-[#777D7A]">{group.label}</h5><ul className="mt-1 grid gap-1 sm:grid-cols-2">{group.items.map(item => <li key={item.key} className="flex items-start gap-2 text-sm text-[#4F5553]"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"/>{item.label}</li>)}</ul></section>)}</div>
    </div> : null}
  </div>;
}
