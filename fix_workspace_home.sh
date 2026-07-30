sed -i '1i import { useTenant } from "../../core/auth/TenantProvider";' src/components/workspace/WorkspaceHome.tsx
sed -i 's/interface WorkspaceHomeProps {/interface WorkspaceHomeProps {/' src/components/workspace/WorkspaceHome.tsx
sed -i 's/  roles: string\[\];//' src/components/workspace/WorkspaceHome.tsx
