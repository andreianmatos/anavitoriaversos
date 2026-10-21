# Adicionar obra ao arquivo (forma simples, sem Render)

O site **não precisa** do `/admin` para funcionar. Esta é a forma mais fácil se nunca configuraste OAuth.

## Tu (no PC, com Cursor ou GitHub Desktop)

1. Guarda a imagem em **`imagens/arquivo/`** (ex.: `minha-obra.png`).
2. Abre **`images.json`** e acrescenta um objeto na lista `items`:

```json
{
  "file": "minha-obra.png",
  "title": "TÍTULO DA OBRA",
  "text": [
    "Primeiro parágrafo.",
    "Segundo parágrafo."
  ]
}
```

3. **Commit + push** para `main`.
4. Em 1–2 minutos o site atualiza; as miniaturas geram-se sozinhas (workflow no GitHub).

A artista pode mandar-te imagem + título + texto por mensagem; tu fazes estes passos.

---

## Só no browser (GitHub.com)

Se tiveres o repositório aberto no GitHub:

1. **Add file → Upload files** dentro de `imagens/arquivo/`.
2. Clica em **`images.json` → Edit** (ícone lápis), adiciona a entrada como acima.
3. **Commit changes**.

---

## `/admin` no site público

Só funciona depois do login GitHub + servidor OAuth (ver `SETUP.md`). Podes ignorar até quiseres configurar com calma.

### Obras com página própria

No admin, escolhe **«Foto na página da obra»** e a obra na lista (nomes em `admin/config.js`):

| Lista no admin | Pasta (`baseDir`) | URL no site |
|----------------|-------------------|-------------|
| De quem vens? | `de-quem-vens` | `/DeQuemVens` |
| Quem veio primeiro | `quem-veio-primeiro` | `/QuemVeioPrimeiro` |
| Leva-me de volta | `leva-me-de-volta` | `/LevaMeDeVolta` |
| Reinventar a roda | `reinventar-a-roda` | `/ReInventarARoda` |

As imagens vão para `imagens/arquivo/<baseDir>/consequencias/` e o manifest `imagens/arquivo/<baseDir>/images.json`. Detalhes em `imagens/arquivo/README.md`.

Para ligar uma peça do arquivo à página, acrescenta **`"href": "quem-veio-primeiro.html"`** (ou o fragmento correspondente) na entrada em `images.json` na raiz.
