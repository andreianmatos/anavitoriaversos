# Configurar `/admin` no site (passo a passo)

O upload no site usa **Login GitHub** + um **servidor OAuth** pequeno (grátis). Faz-se **uma vez**.

Site: `https://andreianmatos.github.io/anavitoriaversos`  
Admin: `https://andreianmatos.github.io/anavitoriaversos/admin/`

---

## Parte A — Servidor OAuth no Render (~10 min)

1. Entra em [render.com](https://render.com) e cria conta (podes ligar ao GitHub).

2. **New → Web Service**.

3. Liga o repositório público  
   `https://github.com/vencax/netlify-cms-github-oauth-provider`  
   (ou faz fork para a tua conta e liga o fork).

4. Configura o serviço:
   - **Name:** por exemplo `avv-oauth` (anota o URL final: `https://avv-oauth.onrender.com`)
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`

5. Em **Environment** adiciona (valores reais só depois do passo B):
   - `NODE_ENV` = `production`
   - `OAUTH_CLIENT_ID` = *(Client ID do passo B)*
   - `OAUTH_CLIENT_SECRET` = *(Client secret do passo B)*
   - `ORIGINS` = `andreianmatos.github.io` *(sem `https://`, sem espaços — só este domínio; **não** uses `localhost:*`, o servidor OAuth rebenta)*
   - `REDIRECT_URL` = `https://TEU-SERVICO.onrender.com/callback`  
     (substitui `TEU-SERVICO` pelo nome que escolheste)
   - `SCOPES` = `repo` *(obrigatório para Publicar/Remover no repo)*

6. Clica **Create Web Service** e espera o deploy ficar **Live**.

---

## Parte B — GitHub OAuth App (~5 min)

1. GitHub (a tua conta) → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.

2. Preenche:
   - **Application name:** `AVV Arquivo Admin` (ou outro)
   - **Homepage URL:** `https://andreianmatos.github.io/anavitoriaversos`
   - **Authorization callback URL:**  
     `https://TEU-SERVICO.onrender.com/callback`  
     (o mesmo URL do `REDIRECT_URL` acima)

3. **Register application**.

4. Copia o **Client ID**.

5. **Generate a new client secret** → copia o **Client secret** (só aparece uma vez).

6. Volta ao Render → **Environment** → cola `OAUTH_CLIENT_ID` e `OAUTH_CLIENT_SECRET` → **Save** (o Render faz redeploy).

---

## Parte C — `admin/config.js` no repositório

Edita `admin/config.js`:

```js
githubClientId: "Ov23liXXXXXXXX",
oauthBaseUrl: "https://avv-oauth.onrender.com",
```

- `githubClientId` = Client ID da Parte B  
- `oauthBaseUrl` = URL do Render **sem** barra no fim  

Commit + push para `main`. Espera 1–2 min o GitHub Pages atualizar.

---

## Parte D — Quem pode publicar

Repositório `andreianmatos/anavitoriaversos` → **Settings** → **Collaborators** → convida a conta da artista com permissão **Write**.

Sem Write no repo, o login funciona mas o **Publicar** falha.

---

## Parte E — Usar

1. Abre `https://andreianmatos.github.io/anavitoriaversos/admin/`
2. Clica **Login GitHub** e autoriza.
3. Imagem + título + texto → **Publicar**.
4. Miniaturas: workflow automático ao mudar `imagens/arquivo/`.

---

## Problemas comuns

| Sintoma | Solução |
|--------|---------|
| Mensagem “Falta configurar login…” | `githubClientId` ou `oauthBaseUrl` vazios → Parte C |
| Login abre e fecha com erro | Callback URL no GitHub ≠ `.../callback` no Render |
| Ficas em `avv-oauth.onrender.com/callback?...` página em branco | **Normal na janela pequena.** Volta ao separador **Admin** — deve dizer “Login feito”. Se não, fecha a janela OAuth e clica Login outra vez (com pop-ups permitidos). |
| Admin não muda depois do GitHub | Pop-ups bloqueados, ou `ORIGINS` no Render não é só `andreianmatos.github.io` (sem `https://`) |
| Publicar: sem permissão | Collaborator **Write** no repo |
| Render “sleep” | Primeiro login depois de horas pode demorar ~30 s (plano grátis) |
