# Verbo Mobile

Esta pasta contém exclusivamente a aplicação para smartphones.

- `app/`: rotas, estilos globais e API do app mobile;
- `components/`: componentes visuais reutilizáveis;
- `screens/`: telas que podem ser extraídas dos componentes conforme o app evoluir;
- `services/`: integrações e serviços exclusivos do mobile;
- `public/`: recursos estáticos exigidos pelo runtime, incluindo os textos bíblicos;
- `assets/`: novos ícones, imagens e fontes exclusivos do mobile.

Execute `pnpm dev` a partir desta pasta para desenvolver somente a versão mobile.

## Login com Google

Crie um cliente OAuth 2.0 do tipo aplicação web no Google Cloud e configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no ambiente local e nos secrets do GitHub. Adicione como URI de redirecionamento autorizado:

`http://localhost:3000/api/auth/google/callback`

No ambiente publicado, adicione a mesma rota usando o domínio do Worker.
