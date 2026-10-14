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
};
