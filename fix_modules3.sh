for file in src/components/workspace/PeopleModuleView.tsx src/components/workspace/IntegrityModuleView.tsx src/components/workspace/TalentModuleView.tsx; do
  sed -i '/import { authAdapter }/d' $file
  sed -i 's/const roles = session?.membership?.roles || \[\];/const { roles } = useTenant();/' $file
done
