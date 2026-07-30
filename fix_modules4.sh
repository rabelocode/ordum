for file in src/components/workspace/PeopleModuleView.tsx src/components/workspace/IntegrityModuleView.tsx src/components/workspace/TalentModuleView.tsx; do
  sed -i 's/const isAdmin = roles.includes/const roleKeys = roles.map((r: any) => r.key);\n  const isAdmin = roleKeys.includes/' $file
  sed -i 's/|| roles.includes/|| roleKeys.includes/g' $file
done
