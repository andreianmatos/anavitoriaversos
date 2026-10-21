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
   * «Página específica» no admin: nova peça no arquivo (images.json na raiz),
   * ficheiro em imagens/arquivo/<baseDir>/ e miniatura em <baseDir>/thumbs/.
   * Não altera o HTML das páginas. Mapa: imagens/arquivo/README.md
   */
  customPages: [
    { id: "de-quem-vens", label: "De quem vens?", baseDir: "de-quem-vens", href: "umbigo.html" },
    {
      id: "quem-veio-primeiro",
      label: "Quem veio primeiro",
      baseDir: "quem-veio-primeiro",
      href: "quem-veio-primeiro.html",
    },
    {
      id: "leva-me-de-volta",
      label: "Leva-me de volta",
      baseDir: "leva-me-de-volta",
      href: "leva-me-de-volta.html",
    },
    {
      id: "reinventar-a-roda",
      label: "Reinventar a roda",
      baseDir: "reinventar-a-roda",
      href: "reinventar-a-roda.html",
    },
  ],
};
