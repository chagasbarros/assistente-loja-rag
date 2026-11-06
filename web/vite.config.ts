import { defineConfig } from "vite";

// Em desenvolvimento, o navegador fala só com o Vite (localhost:5173) e o Vite
// repassa as chamadas da API para localhost:3000. Como o navegador vê uma
// origem só, não há problema de CORS e a API não precisa mudar.
export default defineConfig({
  server: {
    proxy: {
      "/perguntar": "http://localhost:3000",
      "/saude": "http://localhost:3000",
    },
  },
});
