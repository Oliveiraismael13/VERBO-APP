# Verbo

O projeto está separado por plataforma para que a evolução da web não afete a experiência mobile.

- [`web/`](./web/): aplicação web estática, independente, iniciada por `web/index.html`.
- [`mobile/`](./mobile/): aplicação mobile em Vinext/React, com seu próprio `package.json`, telas, componentes e dados.

## Desenvolvimento

### Web

Para testar a Web com dois cliques, abra [`Abrir-Verbo-Web.cmd`](./Abrir-Verbo-Web.cmd). Ele inicia o servidor local e abre a página funcional no navegador em `http://localhost:4173/`.

Não abra `web/index.html` diretamente: a Bíblia e as interações precisam ser carregadas por esse servidor local. Não há dependências, compilação ou código da versão mobile na pasta `web/`.

### Mobile

```powershell
cd mobile
pnpm dev
```

As dependências instaladas no diretório raiz podem ser reutilizadas dpelo projeto mobile durante o desenvolvimento local.
