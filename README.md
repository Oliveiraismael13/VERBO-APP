# Verbo

O projeto está separado por plataforma para que a evolução da web não afete a experiência mobile.

- [`web/`](./web/): aplicação web estática, independente, iniciada por `web/index.html`.
- [`mobile/`](./mobile/): aplicação mobile em Vinext/React, com seu próprio `package.json`, telas, componentes e dados.

## Desenvolvimento

### Web

Para testar a Web com dois cliques, abra o atalho **Verbo Web** criado na Área de Trabalho. Ele inicia o servidor local e abre a página funcional no navegador em `http://localhost:4173/`. O lançador também pode ser aberto diretamente em [`Abrir-Verbo-Web.vbs`](./Abrir-Verbo-Web.vbs).

Não abra `web/index.html` diretamente: a Bíblia e as interações precisam ser carregadas por esse servidor local. Se o Python não estiver instalado, o lançador usa o servidor PowerShell incluído em [`Servidor-Verbo-Web.ps1`](./Servidor-Verbo-Web.ps1). Não há dependências, compilação ou código da versão mobile na pasta `web/`.

### Login na publicação web

O login precisa apontar para o Worker que hospeda a API. Quando a pasta `web/`
for publicada separadamente, defina a URL pública do Worker em
[`web/js/auth-config.js`](./web/js/auth-config.js). Para preservar o cookie de
sessão, a opção recomendada é publicar a interface e a API no mesmo domínio
(ou encaminhar `/api/*` para o Worker por um proxy reverso).

### Mobile

```powershell
cd mobile
pnpm dev
```

As dependências instaladas no diretório raiz podem ser reutilizadas dpelo projeto mobile durante o desenvolvimento local.
