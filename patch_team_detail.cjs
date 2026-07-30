const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/TeamDetailPage.tsx', 'utf8');

if (!code.includes('AddTeamMemberModal')) {
  code = code.replace("import { ArrowLeft, Users, Settings, Plus, X, Trash2, Save, Loader2 } from 'lucide-react';", 
    "import { ArrowLeft, Users, Settings, Plus, X, Trash2, Save, Loader2 } from 'lucide-react';\nimport { AddTeamMemberModal } from '../../components/admin/AddTeamMemberModal';");
  
  code = code.replace('const [isLoading, setIsLoading] = useState(true);', 
    'const [isLoading, setIsLoading] = useState(true);\n  const [isAddModalOpen, setIsAddModalOpen] = useState(false);');
    
  code = code.replace('<button className="flex items-center gap-2 px-4 py-2 bg-[#121413] text-white rounded-xl font-medium hover:bg-[#202322] transition-colors shadow-sm text-sm">',
    '<button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#121413] text-white rounded-xl font-medium hover:bg-[#202322] transition-colors shadow-sm text-sm">');
    
  code = code.replace('</div>\n      </div>\n    </div>\n  );\n}',
    '</div>\n      </div>\n      <AddTeamMemberModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); loadTeam(); }} teamId={teamId} />\n    </div>\n  );\n}');
    
  fs.writeFileSync('src/pages/admin/TeamDetailPage.tsx', code);
  console.log("Patched TeamDetailPage.tsx");
}
