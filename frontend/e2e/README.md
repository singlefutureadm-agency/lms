# Testes E2E (Playwright)

Pressupõem o backend rodando em `:8080` contra o Postgres do
`backend/docker-compose.yml`, e sobem o frontend (`ng serve`) sozinhos — ver
`playwright.config.ts`. Rodam em série (`workers: 1`): os cenários de admin
escrevem no banco compartilhado, então paralelizar geraria interferência entre
eles.

## Admin de teste (`E2E_ADMIN_PASSWORD`)

Os testes autenticados usam um usuário ADMIN **dedicado aos testes**
(`e2e.admin@lms.local` por padrão), diferente de qualquer conta pessoal usada
em desenvolvimento manual. Ele é criado e promovido automaticamente na
primeira execução, por `autenticarAdminE2E()` em [`apoio.ts`](./apoio.ts):

1. Tenta logar com `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`.
2. Se falhar (401), registra o usuário via `POST /api/auth/register`.
3. Promove para ADMIN com uma query SQL direta no banco de teste — o
   `PATCH /api/usuarios/{id}/role` exige um ADMIN já autenticado (ver
   `SecurityConfig`), e não há caminho via API para o primeiro admin de teste
   se auto-promover. Como o Postgres do docker-compose já fica exposto em
   `localhost:5433` para o backend local, uma conexão direta via `pg` foi a
   alternativa que exigiu menos infraestrutura nova (sem endpoint de teste
   isolado, sem profile Spring adicional).
4. Loga de novo, agora já como ADMIN.

É idempotente: rodar os testes de novo, em outra máquina ou no CI, encontra o
usuário já pronto no passo 1 e não duplica nada.

**Antes de rodar os testes**, defina `E2E_ADMIN_PASSWORD` no ambiente. Sem
isso, cai num fallback só para desenvolvimento local (ver `apoio.ts`) — nunca
use esse fallback em CI ou em qualquer ambiente compartilhado.

```bash
cp frontend/e2e/.env.e2e.example frontend/e2e/.env.e2e
# edite frontend/e2e/.env.e2e e preencha E2E_ADMIN_PASSWORD
npm run e2e
```

`apoio.ts` carrega `.env.e2e` automaticamente se ele existir (variáveis já
definidas no shell/CI sempre têm prioridade). Alternativa sem o arquivo:

```bash
E2E_ADMIN_PASSWORD=troque-por-uma-senha-forte npm run e2e
```

## Conexão com o banco de teste

A promoção do admin (passo 3 acima) reaproveita `DB_USERNAME`/`DB_PASSWORD` de
`backend/.env` — o mesmo Postgres que o backend local já usa. Não é preciso
configurar nada além disso na maioria dos casos. Para apontar para um banco
diferente, defina em `.env.e2e`:

- `E2E_DB_HOST` (default `localhost`)
- `E2E_DB_PORT` (default `5433`)
- `E2E_DB_NAME` (default `lmsdb`)

## Não confundir com o `DevAdminSeeder`

O backend também cria, só sob o profile `dev`, um admin de **conveniência
para teste manual** (`DevAdminSeeder`, ver
`backend/src/main/java/br/com/lms/domain/usuario/DevAdminSeeder.java`). São
dois mecanismos propositalmente separados:

|                     | Admin E2E (`autenticarAdminE2E`)         | `DevAdminSeeder`                    |
|---------------------|-------------------------------------------|--------------------------------------|
| Para quê            | Testes automatizados (Playwright)          | Login manual em dev                  |
| Onde vive           | `frontend/e2e/apoio.ts`                    | Backend, `@Profile("dev")`           |
| Quando roda          | Sob demanda, no início dos testes          | No boot da aplicação                 |
| E-mail              | `e2e.admin@lms.local` (configurável)       | `miguel@lms.com` (configurável)      |

Os testes E2E nunca dependem do `DevAdminSeeder` nem do e-mail pessoal.
