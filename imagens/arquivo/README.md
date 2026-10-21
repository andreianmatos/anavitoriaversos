# Arquivo de imagens

Recursos gerais do site: `imagens/inicio/` (home), `imagens/sobre/` (painel Sobre).

Cada **obra com página** tem pasta em `imagens/arquivo/<slug>/`, onde `<slug>` é o nome do fragmento HTML (kebab-case), alinhado com a URL do site.

## Estrutura por obra

```
imagens/arquivo/<slug>/
  …ficheiros do arquivo…
  thumbs/
  consequencias/          ← fotos extra na página (admin)
  consequencias/thumbs/
  images.json
```

| Obra | Pasta (`baseDir`) | URL | Fragmento HTML |
|------|-------------------|-----|----------------|
| De quem vens? | `de-quem-vens` | `/DeQuemVens` | `umbigo.html` (PNG do layout na raiz da pasta; instalação em `consequencias/`) |
| Quem veio primeiro | `quem-veio-primeiro` | `/QuemVeioPrimeiro` | `quem-veio-primeiro.html` |
| Leva-me de volta | `leva-me-de-volta` | `/LevaMeDeVolta` | `leva-me-de-volta.html` |
| Reinventar a roda | `reinventar-a-roda` | `/ReInventarARoda` | `reinventar-a-roda.html` |

Entradas em **`images.json` (raiz)**: `"file": "<slug>/nome.ext"` e opcional `"href": "<fragmento>.html"`.

## Miniaturas (sem duplicar)

| Onde está o original | Onde vai a miniatura |
|----------------------|----------------------|
| `imagens/arquivo/foto.jpg` | `imagens/arquivo/thumbs/foto.jpg` |
| `imagens/arquivo/<slug>/obra.png` | `imagens/arquivo/<slug>/thumbs/obra.png` |
| `imagens/arquivo/<slug>/consequencias/x.jpg` | `imagens/arquivo/<slug>/consequencias/thumbs/x.jpg` |

O script `scripts/generate-thumbs.sh` e o admin seguem esta regra. **Não** guardes a mesma miniatura em `arquivo/thumbs/` e outra vez na pasta da obra.

## Só arquivo (sem página)

Ficheiros soltos na raiz de `imagens/arquivo/` (ex. `natureza mae.png`) — ver `thumbs/README.md`.
