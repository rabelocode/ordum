import React, { useEffect } from 'react';
import { useAccess } from './AccessContext';

type GuardProps = {
    children: React.ReactNode;
    fallbackUrl?: string;
};

const Redirect = ({ to }: { to: string }) => {
    useEffect(() => {
        if (window.location.hash !== to) {
            window.location.hash = to;
        }
    }, [to]);
    return null;
};

export const RequireAuth = ({ children, fallbackUrl = "#/login" }: GuardProps) => {
    const { session, isLoading } = useAccess();
    if (isLoading) return <div>Carregando sessão...</div>;
    return session ? <>{children}</> : <Redirect to={fallbackUrl} />;
};

export const RequireTenant = ({ children, fallbackUrl = "#/login" }: GuardProps) => {
    const { activeTenant, isLoading } = useAccess();
    if (isLoading) return <div>Carregando workspace...</div>;
    return activeTenant ? <>{children}</> : <Redirect to={fallbackUrl} />;
};

export const RequirePermission = ({ permission, children, fallbackUrl = "#/unauthorized" }: GuardProps & { permission: string }) => {
    const { hasPermission, isLoading } = useAccess();
    if (isLoading) return <div>Validando permissões...</div>;
    return hasPermission(permission) ? <>{children}</> : <Redirect to={fallbackUrl} />;
};

export const RequireSolution = ({ solution, children, fallbackUrl = "#/unauthorized" }: GuardProps & { solution: string }) => {
    const { hasSolution, isLoading } = useAccess();
    if (isLoading) return <div>Validando plano...</div>;
    return hasSolution(solution) ? <>{children}</> : <Redirect to={fallbackUrl} />;
};

export const RequirePlatformPermission = ({ permission, children, fallbackUrl = "#/unauthorized" }: GuardProps & { permission: string }) => {
    const { hasPlatformPermission, isLoading } = useAccess();
    if (isLoading) return <div>Validando plataforma...</div>;
    return hasPlatformPermission(permission) ? <>{children}</> : <Redirect to={fallbackUrl} />;
};
