# Migrations D1

As migrations SQL em `drizzle/` são a fonte de verdade para instalações novas.

O D1 publicado do Verbo começou a ser usado antes de todas as migrations serem rastreadas pelo Wrangler e ainda contém criação e evolução de schema nas rotas. Por isso, não execute a sequência histórica automaticamente contra o banco remoto sem antes fazer um backup e registrar um baseline no `d1_migrations` desse banco: algumas tabelas e colunas já existem e os `CREATE`/`ALTER` históricos poderiam falhar.

Depois do baseline, configure o binding `DB` com `migrations_dir = "drizzle"` e aplique somente migrations novas com `wrangler d1 migrations apply DB --remote`. A migration `0021_auth_security.sql` acompanha a limitação de tentativas de autenticação; a aplicação também cria a tabela de forma compatível para não interromper o D1 já publicado antes desse baseline.
