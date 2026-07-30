sed -i '/startServer();/d' server.ts
sed -i '/app.get("\/api\/admin\/consultants"/,/});/d' server.ts
sed -i '/\/\/ Vite middleware for development/i \
  app.get("/api/admin/consultants", requireAdmin, async (req, res) => {\
    try {\
      const { data: profiles, error } = await supabaseAdmin.from("profiles").select("*").limit(50);\
      if (error) throw error;\
      const consultants = profiles.map(p => ({\
        name: p.full_name || "Consultor",\
        email: "consultor@ordum.com.br",\
        role: "Consultor Ordum",\
        status: p.status || "Ativo",\
        avatar: (p.full_name || "CO").substring(0, 2).toUpperCase()\
      }));\
      res.json(consultants);\
    } catch (e: any) {\
      res.status(500).json({ error: e.message });\
    }\
  });\
' server.ts
echo "startServer();" >> server.ts
