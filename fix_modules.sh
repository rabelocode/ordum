for file in src/components/workspace/PeopleModuleView.tsx src/components/workspace/IntegrityModuleView.tsx src/components/workspace/TalentModuleView.tsx; do
  sed -i 's/import { authAdapter } from ".\/..\/core\/auth\/LocalAuthAdapter";//' $file
  sed -i 's/const session = authAdapter.getSession();//' $file
  sed -i '1i import { useTenant } from "../../core/auth/TenantProvider";' $file
  sed -i 's/const { tenant } = useWorkspace();/const { tenant } = useWorkspace();\n  const { activeMembership, roles, profile } = useTenant();\n  const session = { user: { name: profile?.full_name || "Usuário" }, membership: activeMembership, roles };/' $file
done
