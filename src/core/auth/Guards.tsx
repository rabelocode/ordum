import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccess } from './AccessContext';

export const RequireAuth = () => {
    const { session, isLoading } = useAccess();
    if (isLoading) return <div>Carregando sessão...</div>;
    return session ? <Outlet /> : <Navigate to="/#/auth/login" replace />;
};

export const RequireTenant = () => {
    const { activeTenant, isLoading } = useAccess();
    if (isLoading) return <div>Carregando workspace...</div>;
    return activeTenant ? <Outlet /> : <Navigate to="/#/auth/login" replace />;
};

export const RequirePermission = ({ permission }: { permission: string }) => {
    const { hasPermission, isLoading } = useAccess();
    if (isLoading) return <div>Validando permissões...</div>;
    return hasPermission(permission) ? <Outlet /> : <Navigate to="/#/unauthorized" replace />;
};

export const RequireSolution = ({ solution }: { solution: string }) => {
    const { hasSolution, isLoading } = useAccess();
    if (isLoading) return <div>Validando plano...</div>;
    return hasSolution(solution) ? <Outlet /> : <Navigate to="/#/unauthorized" replace />;
};

export const RequirePlatformPermission = ({ permission }: { permission: string }) => {
    const { hasPlatformPermission, isLoading } = useAccess();
    if (isLoading) return <div>Validando plataforma...</div>;
    return hasPlatformPermission(permission) ? <Outlet /> : <Navigate to="/#/unauthorized" replace />;
};
