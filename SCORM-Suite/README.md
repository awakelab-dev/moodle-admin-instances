# SCORM Suite

Une o **SCORM Lab** (analisador) e o **SCORM Converter** em um único app Node.js + TypeScript.
Na página inicial você escolhe qual ferramenta usar.

## Como rodar

```
npm install
npm start
```

Acesse **http://localhost:3000**

| Endereço | Ferramenta |
|---|---|
| `/` | Página inicial (seletor) |
| `/analyzer/` | SCORM Lab — análise, compressão de imagens, player SCORM, CSV |
| `/converter/` | SCORM Converter — vídeo ou .zip → pacote SCORM 1.2 |

## Scripts

| Comando | O que faz |
|---|---|
| `npm start` | Inicia o servidor |
| `npm run dev` | Inicia com hot-reload |
| `npm run build` | Compila para `dist/` |
| `npm run serve` | Roda a versão compilada |

Porta diferente (PowerShell): `$env:PORT=3001; npm start`

## Estrutura

```
SCORM-Suite/
├── src/
│   ├── server.ts              # Servidor único (página inicial + as duas ferramentas)
│   ├── analyzer/
│   │   ├── routes.ts          # APIs do SCORM Lab (/api/*, /preview/*)
│   │   └── analyzer.ts        # Lógica de análise dos ZIPs
│   └── converter/
│       ├── routes.ts          # API do conversor (POST /convert)
│       └── scorm/             # generator, manifest, htmlExtractor, videoWrapper
├── public/
│   ├── index.html             # Página inicial
│   ├── analyzer/index.html    # Interface do SCORM Lab
│   └── converter/index.html   # Interface do Converter
├── uploads/                   # Temporário (analyzer/ e converter/)
└── outputs/                   # Temporário do conversor
```

Desenvolvido por **Awakelab** · 2026
