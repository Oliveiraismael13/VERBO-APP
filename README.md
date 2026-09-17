# VERBO

[![Status: em desenvolvimento](https://img.shields.io/badge/status-em%20desenvolvimento-6d4aa8)](https://verbo-preview.marcioismael12.workers.dev)
[![Licença MIT](https://img.shields.io/badge/licença-MIT-f2b84b)](./LICENSE)

> Uma jornada bíblica gamificada para tornar a leitura e o estudo das Escrituras mais próximos, constantes e significativos.

O **VERBO** é um projeto independente, voluntário e sem fins lucrativos. Ele usa tecnologia e elementos de jogos para aproximar especialmente o público jovem da leitura, da reflexão e do conhecimento bíblico, sem substituir a profundidade das Escrituras por uma simples pontuação.

**[Acesse a versão publicada](https://verbo-preview.marcioismael12.workers.dev)**

## Propósito

A Bíblia pode parecer extensa ou difícil de começar quando não há uma trilha clara. O VERBO propõe uma experiência de leitura guiada: a pessoa escolhe um ponto de partida, avança capítulo a capítulo, registra o que aprendeu e acompanha sua constância ao longo do tempo.

A proposta é usar recursos digitais como incentivo para criar o hábito de ler, estudar e compartilhar a Palavra com mais interesse e continuidade.

## Como a gamificação contribui

Gamificação é o uso de elementos comuns aos jogos em atividades que não são jogos. No VERBO, ela aparece como uma camada de motivação sobre a leitura bíblica:

- **Missões e trilhas** mostram um próximo passo claro na jornada.
- **XP, níveis e conquistas** celebram o avanço e a dedicação.
- **Sequência de leitura** incentiva a constância, um capítulo de cada vez.
- **Pergaminhos, recompensas e missões secundárias** estimulam a descoberta e o estudo atento.
- **Jornadas em dupla e comunidade** permitem caminhar e compartilhar reflexões com amigos.

Esses elementos não medem fé nem substituem o estudo. Eles organizam a experiência e ajudam a transformar a intenção de ler em uma prática mais presente no dia a dia.

## Funcionalidades

### Disponíveis

| Área | Recursos |
| --- | --- |
| Jornada | Campanha bíblica, missões principais e secundárias, capítulos desbloqueados progressivamente, XP, níveis, moedas, conquistas e sequência de leitura. |
| Leitura e estudo | Leitura por livro, capítulo e versículo; favoritos, destaques, anotações e estudos pessoais. |
| Conteúdo bíblico | Três traduções, cânones de 66 e 73 livros e acesso offline aos textos públicos baixados. |
| Descoberta | Câmera com OCR para reconhecer trechos bíblicos, busca por referências e pergaminhos de estudo encontrados durante a jornada. |
| Comunidade | Perfis, amizades, feed de reflexões e testemunhos, reações, comentários, notificações e controles de privacidade. |
| Caminhada conjunta | Missão cooperativa para avançar capítulo a capítulo com outra pessoa. |
| Acesso | Cadastro por e-mail e senha, login com Google quando configurado e instalação como aplicativo web no celular. |

### Em evolução

- Melhorias contínuas de acessibilidade, leitura e navegação mobile.
- Expansão da busca por conteúdo bíblico e dos recursos de estudo.
- Novas formas de acompanhar metas e progresso pessoal.
- Evolução das interações seguras da comunidade e das jornadas cooperativas.
- Ampliação responsável de traduções e conteúdos, respeitando licenças e direitos de uso.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Interface mobile | React, Vinext e Vite |
| Aplicação web | HTML, CSS e JavaScript sem dependências de compilação |
| Backend e publicação | Cloudflare Workers e Wrangler |
| Dados | Cloudflare D1 e Drizzle ORM |
| Reconhecimento de texto | Tesseract.js com dados para português |
| Qualidade | TypeScript, ESLint e testes nativos do Node.js |
| Experiência instalável | Web App Manifest e Service Worker |

## Estrutura do projeto

```text
VERBO-APP/
├── mobile/                    # Aplicação principal para smartphones
│   ├── app/                   # Rotas, telas e APIs
│   ├── components/            # Componentes reutilizáveis
│   ├── db/ e drizzle/         # Modelo de dados e migrations do D1
│   ├── lib/                   # Regras de jornada, Bíblia, social e autenticação
│   ├── public/                # Bíblia, ícones, personagens e recursos instaláveis
│   ├── scripts/               # Preparação de OCR e textos bíblicos
│   └── tests/                 # Verificações automatizadas
├── web/                       # Versão Web estática e independente
├── .github/workflows/         # Automação de validação e publicação
├── LICENSE                    # Licença MIT
└── README.md
```

## Como executar localmente

### Pré-requisitos

- [Node.js](https://nodejs.org/) 22.13 ou superior
- [pnpm](https://pnpm.io/) 10 ou superior
- Uma conta Cloudflare apenas para recursos que dependem de Workers e D1

### Aplicação mobile

```powershell
cd mobile
pnpm install --frozen-lockfile
pnpm dev
```

O comando prepara os recursos de OCR e o índice dos textos bíblicos antes de iniciar o servidor de desenvolvimento. Depois, abra o endereço mostrado no terminal, de preferência usando a visualização de celular do navegador.

Para validar o projeto:

```powershell
cd mobile
pnpm check
```

Para gerar uma versão de produção local:

```powershell
cd mobile
pnpm build
pnpm start
```

### Configuração opcional do login com Google

O cadastro por e-mail e senha funciona sem essa configuração. Para habilitar o login Google, crie um cliente OAuth 2.0 do tipo aplicação web e defina as variáveis abaixo no ambiente local:

```powershell
$env:GOOGLE_CLIENT_ID = "seu-client-id"
$env:GOOGLE_CLIENT_SECRET = "seu-client-secret"
```

Adicione `http://localhost:3000/api/auth/google/callback` como URI de redirecionamento autorizado durante o desenvolvimento. Na publicação, use a mesma rota no domínio do Worker.

### Banco de dados e publicação

O app mobile usa um banco Cloudflare D1. Para conectar uma base própria, informe o ID do banco e, se necessário, o nome do Worker:

```powershell
$env:CLOUDFLARE_D1_DATABASE_ID = "seu-id-do-d1"
$env:CLOUDFLARE_WORKER_NAME = "nome-do-worker"
```

Com o Wrangler autenticado, a publicação é feita por:

```powershell
cd mobile
pnpm deploy
```

> Antes de aplicar migrations históricas em um banco D1 já utilizado, leia as [orientações de baseline](./mobile/drizzle/README.md). Elas existem para evitar conflitos com tabelas ou colunas previamente criadas.

### Versão Web estática

A pasta [`web/`](./web/) é independente da aplicação mobile. No Windows, use o atalho **Verbo Web** criado na Área de Trabalho ou execute [`Abrir-Verbo-Web.vbs`](./Abrir-Verbo-Web.vbs). Ele inicia um servidor local e abre `http://localhost:4173/`.

Não abra `web/index.html` diretamente: os textos bíblicos e as interações precisam do servidor local.

## Roadmap

- [x] Leitura bíblica gamificada com campanha, XP e sequência diária
- [x] Anotações, favoritos, estudos pessoais e recursos offline
- [x] Comunidade com perfis, amizades, publicações e controles de privacidade
- [x] Missões secundárias, descobertas e jornada cooperativa
- [ ] Busca textual mais ampla entre versículos e conteúdos de estudo
- [ ] Mais recursos de acessibilidade e personalização da leitura
- [ ] Evolução dos desafios, metas e experiências de comunidade
- [ ] Ampliação de conteúdos e traduções conforme a disponibilidade e as licenças permitirem

## Contribua

Contribuições são bem-vindas. Você pode ajudar com desenvolvimento, interface, acessibilidade, testes, revisão de documentação, conteúdo técnico ou sugestões de experiência.

1. Crie um fork do repositório.
2. Crie uma branch para sua contribuição.
3. Faça mudanças pequenas e objetivas, mantendo o estilo do projeto.
4. Execute `pnpm check` dentro de `mobile/` quando a alteração afetar a aplicação mobile.
5. Abra um Pull Request explicando o problema resolvido e como a mudança foi validada.

Ao contribuir, respeite o propósito do projeto: incentivar uma experiência bíblica acolhedora, acessível e segura para a comunidade.

## Projeto independente e sem fins lucrativos

O VERBO é desenvolvido de forma voluntária e independente, sem fins lucrativos. Seu objetivo é oferecer uma ferramenta tecnológica que incentive a leitura, o conhecimento bíblico e o interesse pelas Escrituras.

O projeto não busca transformar a fé em competição. A gamificação existe para encorajar a constância, a descoberta e a participação, preservando o valor pessoal e comunitário do estudo bíblico.

## Licença

Este projeto está licenciado sob a [Licença MIT](./LICENSE). Você pode usar, estudar, modificar e distribuir o código conforme os termos dessa licença.

---

Feito com propósito para quem deseja caminhar mais perto da Palavra. ❤️
