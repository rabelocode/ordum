sed -i 's/import { leadService, Lead } from ".\/..\/core\/tenant\/LocalLeadService";//' src/pages/admin/CompaniesPage.tsx
sed -i 's/const \[leads, setLeads\] = useState<Lead\[\]>(\[\]);//' src/pages/admin/CompaniesPage.tsx
sed -i '/setLeads(leadService.listLeads());/d' src/pages/admin/CompaniesPage.tsx
sed -i '/{leads.length > 0 && (/d' src/pages/admin/CompaniesPage.tsx
sed -i '/<div className="bg-white rounded-2xl border border\[#DDD8CF\]\/60 shadow-sm overflow-hidden mb-8">/,/<\/div>/d' src/pages/admin/CompaniesPage.tsx
