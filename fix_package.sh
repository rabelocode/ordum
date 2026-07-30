sed -i 's/"dev": "vite --port=3000 --host=0.0.0.0",/"dev": "tsx server.ts",/' package.json
sed -i 's/"build": "vite build",/"build": "vite build \&\& esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist\/server.cjs",/' package.json
sed -i 's/"clean": "rm -rf dist server.js",/"clean": "rm -rf dist server.js",\n    "start": "node dist\/server.cjs",/' package.json
