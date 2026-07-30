sed -i 's/window.location.hash = `#\/acesso\/${data.slug}`;/window.location.hash = `#\/acesso\/${(data as any).slug}`;/' src/pages/public/TenantDiscoveryPage.tsx
