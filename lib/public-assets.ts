// Only these existing, public branding files bypass session verification.
// Never use an extension test: application/API paths may contain file extensions.
const assets=new Set([
  "/icon.png","/apple-icon.png","/app-icon-192.png","/app-icon-512.png","/apple-touch-icon.png","/favicon-32x32.png",
  "/bmwt-logo.jpg","/heftrucks-friesland-logo.svg","/logo-heftrucks-frl.png","/manifest.webmanifest",
  "/werkplaats-preview/assets/planning.js","/werkplaats-preview/assets/planning.css"
]);
export function isPublicAssetPath(pathname:string){return assets.has(pathname);}
