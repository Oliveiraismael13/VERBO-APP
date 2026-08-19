# Verbo

O projeto está separado por plataforma para que a evolução da web não afete a experiência mobile.

- [`web/`](./web/): aplicação web estática, independente, iniciada por `web/index.html`.
- [`mobile/`](./mobile/): aplicação mobile em Vinext/React, com seu próprio `package.json`, telas, componentes e dados.

## Desenvolvimento

### Web

Abra `web/index.html` em um servidor estático. Não há dependências, compilação ou código da versão mobile nessa pasta.

### Mobile

```powershell
cd mobile
pnpm dev
```

As dependências instaladas no diretório raiz podem ser reutilizadas dpelo projeto mobile durante o desenvolvimento local.
