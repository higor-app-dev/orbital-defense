import { defineConfig } from "vite";

export default defineConfig({
    base: "/orbital-defense/",
    server: {
        port: 3001,
    },
    build: {
        sourcemap: true,
    },
});
