sed -i 's/const activeModules = /const { permissions, hasPermission, roles } = useTenant();\n  const roleKeys = roles.map((r: any) => r.key);\n  const activeModules = /' src/components/workspace/WorkspaceHome.tsx
sed -i 's/roles\.includes/roleKeys.includes/g' src/components/workspace/WorkspaceHome.tsx
sed -i 's/roles\.some/roleKeys.some/g' src/components/workspace/WorkspaceHome.tsx
sed -i 's/TENANT_OWNER/TENANT_ADMIN/g' src/components/workspace/WorkspaceHome.tsx
