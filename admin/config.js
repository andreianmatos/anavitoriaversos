/** Public OAuth client id only. Secret stays on your OAuth server. */
window.AVV_ADMIN_CONFIG = {
  repo: "andreianmatos/anavitoriaversos",
  branch: "main",
  manifestPath: "images.json",
  archivePath: "imagens/arquivo",
  /** GitHub OAuth App client id (Developer settings → OAuth Apps). */
  githubClientId: "Ov23lixcY9c88cE4Fer4",
  oauthBaseUrl: "https://avv-oauth.onrender.com",
  /** Pedidos à API GitHub via Render (evita 403/HTML no browser). Requer render-gh-proxy.cjs no serviço OAuth. */
  useGithubProxy: true,
  /**
   * Fotos extra nas páginas de obra (só imagem — não entram no arquivo com texto).
   * Ficheiros: imagens/arquivo/<baseDir>/consequencias/
   * Manifest: imagens/arquivo/<baseDir>/images.json (campo file: "consequencias/…")
   * Mapa completo: imagens/arquivo/README.md
   */
  customPages: [
    { id: "de-quem-vens", label: "De quem vens?", baseDir: "de-quem-vens" },
    { id: "quem-veio-primeiro", label: "Quem veio primeiro", baseDir: "quem-veio-primeiro" },
    { id: "leva-me-de-volta", label: "Leva-me de volta", baseDir: "leva-me-de-volta" },
    { id: "reinventar-a-roda", label: "Reinventar a roda", baseDir: "reinventar-a-roda" },
  ],
};
