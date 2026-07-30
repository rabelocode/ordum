const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/PlaceholderAdminPage.tsx', 'utf8');

const replacement = `
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          {path === 'engenharia' ? 'Integração de Repositório Não Configurada' : path === 'deployments' ? 'Integração de Deployment Não Configurada' : 'Em Construção'}
        </h2>
        <p className="text-gray-500 max-w-md">
          {path === 'engenharia' 
            ? 'A área de engenharia requer integração com o repositório Git para exibir branches, commits e documentação técnica.'
            : path === 'deployments'
            ? 'Não há integrações de CI/CD conectadas no momento para exibir histórico de deploys.'
            : 'Este módulo está sendo arquitetado de acordo com os requisitos de negócio estabelecidos.'}
        </p>
`;

code = code.replace(
  /<div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">[\s\S]*?<\/p>/m,
  replacement
);

fs.writeFileSync('src/pages/admin/PlaceholderAdminPage.tsx', code);
console.log("Patched PlaceholderAdminPage");
