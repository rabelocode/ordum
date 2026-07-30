for file in src/components/workspace/PeopleModuleView.tsx src/components/workspace/IntegrityModuleView.tsx src/components/workspace/TalentModuleView.tsx; do
  sed -i 's/const session = {.*//g' $file
  sed -i 's/const { roles } = useTenant();/const tenantCtx = useTenant();\n  const roleKeys = tenantCtx.roles.map((r: any) => r.key);/' $file
  sed -i 's/const roleKeys = roles.map((r: any) => r.key);//g' $file
  sed -i 's/session\.user\.name/tenantCtx.profile?.full_name || "Usuário"/g' $file
  sed -i 's/session\.user\.id/tenantCtx.profile?.id || "u-1"/g' $file
done
