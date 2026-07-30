sed -i 's/import { fileURLToPath } from '"'"'url'"'"';//' server.ts
sed -i 's/const __filename = fileURLToPath(import.meta.url);//' server.ts
sed -i 's/const __dirname = path.dirname(__filename);//' server.ts
