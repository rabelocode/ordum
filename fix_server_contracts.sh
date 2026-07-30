sed -i '/startServer();/d' server.ts
sed -i '/app.get("\/api\/admin\/contracts"/,/});/d' server.ts
sed -i '/\/\/ Vite middleware for development/i \
  app.get("/api/admin/contracts", requireAdmin, async (req, res) => {\
    res.json([]);\
  });\
' server.ts
echo "startServer();" >> server.ts
