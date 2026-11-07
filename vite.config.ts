import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({plugins:[react(),VitePWA({registerType:"autoUpdate",manifest:{name:"FERMIA",short_name:"FERMIA",description:"次世代農業を、ひとつのプラットフォームに。",theme_color:"#173d2b",background_color:"#f4f6f1",display:"standalone",start_url:"/",icons:[]}})]});