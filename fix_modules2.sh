for file in src/components/workspace/PeopleModuleView.tsx src/components/workspace/IntegrityModuleView.tsx src/components/workspace/TalentModuleView.tsx; do
  sed -i 's/const session = {/const session = { user: { name: profile?.full_name || "Usuário", id: profile?.id || "u-1" }, membership: activeMembership, roles: roles.map(r => r.key) }; \/\//' $file
  sed -i 's/session\.user\.name/session.user.name/g' $file
done
