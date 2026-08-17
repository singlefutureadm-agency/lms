# CLAUDE.md — contexto operacional do projeto

Guia para agentes trabalhando neste repositório. Prioriza **o que não é
dedutível lendo o código**: decisões tomadas, armadilhas conhecidas e as
convenções que o projeto espera que sejam mantidas.

---

## 1. O que é

**LMS** — plataforma de gestão de cursos educacionais, full-stack, concebida
como **produto white-label**: a mesma instalação atende clientes diferentes, e
cada um configura identidade visual (nome, logotipo, paleta, tipografia) pela
tela de Aparência, sem rebuild e sem tocar em código.

Cobre o ciclo completo: catálogo por área/categoria/tipo → matrícula → conteúdo
pedagógico (módulos, aulas, vídeos) → progresso → nota → presença, com
administração por três perfis (ADMIN / PROFESSOR / ALUNO).

**Regra de ouro do produto:** nada específico de um cliente pode ser codificado.
Se algo muda de cliente para cliente, é dado — configuração no servidor ou
registro no banco. Isso já custou um refactor grande; ver §7.

---

## 2. Stack e portas

| Camada | Tecnologia | Porta |
|---|---|---|
| Frontend | Angular 22 **zoneless**, Tailwind 4, Angular Material 22 (M3) | 4200 |
| Backend | Spring Boot 4.1, Java 25 LTS | 8080 |
| Banco | PostgreSQL 18 (Docker Compose) | 5433 |

Extras: Chart.js 4.5 (dashboard), GSAP 3.15 (animações), jjwt 0.13 (JWT),
Flyway 12.4 (V1–V24), Caffeine (cache), Testcontainers, Vitest, Playwright.

---

## 3. Comandos

```bash
# Banco
cd backend && docker compose up -d          # exige backend/.env (copiar de .env.example)

# Backend
cd backend && ./mvnw spring-boot:run        # profile dev por padrão
cd backend && ./mvnw verify                 # 94 testes de integração (Testcontainers)
cd backend && ./mvnw -Dtest=NomeIT test     # um teste só

# Frontend
cd frontend && npx ng serve                 # :4200
cd frontend && npm test                     # 73 specs (Vitest) — use `npm test`, NÃO `npx vitest`
cd frontend && npx ng build --configuration development   # type-check completo
cd frontend && npm run e2e                  # 30 cenários (Playwright); exige backend no ar
```

**`npx vitest run` falha** com "describe is not defined" — a configuração do
Vitest vem do builder do Angular (`ng test`), não de um `vitest.config.ts`.

---

## 4. Arquitetura

### Backend — pacote por domínio

`br.com.lms.domain.<dominio>` com Entity + Repository + Service + Controller
juntos. Domínios: `area`, `conteudo`, `curso`, `marca`, `matricula`,
`notificacao`, `presenca`, `professor`, `regiao`, `upload`, `usuario`.

Fora de `domain`: `config` (Security, Cache, Upload, OpenAPI), `security` (JWT),
`exception` (handler RFC 7807), `dto/DTOs.java`.

**DTOs são centralizados em `dto/DTOs.java`** como records aninhados, com
`from(Entity)` estático. Não crie arquivo de DTO por domínio — quebra o padrão.

### Frontend

```
core/       guards (auth/admin/professor), interceptors (jwt, error), services
features/   uma pasta por tela; formulários de edição em subpasta própria
shared/     componentes reutilizáveis (LogoMarca, ImageUpload, VideoUpload, …)
accessibility/  widget WCAG standalone
```

Componentes **standalone** com `imports: [...]`. Sem NgModules.

---

## 5. Decisões que precisam ser respeitadas

### 5.1 Zoneless
`provideZonelessChangeDetection()`. O zone.js **saiu do projeto**.

- Estado que a view lê **precisa ser signal**. Mutar campo simples dentro de
  callback de HTTP não notifica o Angular.
- Inicialização que depende do DOM renderizado usa `afterNextRender`, não
  `setTimeout`. Os gráficos do dashboard já quebraram por isso.
- `ChangeDetectionStrategy.Eager` aparece em vários componentes — é herança da
  migração. Componentes novos podem usar `OnPush` com signals.

### 5.2 Autenticação
O JWT carrega **apenas `sub=email`**. A cada request o backend recarrega o
usuário do banco, incluindo a role atual. Isso é deliberado: trocar a role de
alguém tem efeito imediato, sem revogar token.

Consequência: **o lookup de usuário do `UserDetailsServiceImpl` não é
cacheado**, e não deve ser.

### 5.3 Erros — RFC 7807
Toda a API responde `application/problem+json`. O `GlobalExceptionHandler` cobre
os controllers; o `authenticationEntryPoint` do `SecurityConfig` cobre as falhas
que acontecem dentro da cadeia de filtros, antes dos controllers.

**Bug conhecido, não corrigido:** negação por papel devolve **401 em vez de
403** em toda a API (verificado em `/api/usuarios`, `/api/cursos`,
`/api/professores`, `/api/marca`). O acesso é corretamente negado; só o código
está errado. Corrigir muda o contrato de erro da API inteira — decisão pendente
do dono do projeto.

### 5.4 Paginação
`spring.data.web.pageable.serialization-mode=VIA_DTO`: `Page` serializa como
`PagedModel` — metadados em `page`, não na raiz. O tipo `Page<T>` do frontend
(`curso.service.ts`) reflete isso. Teto de `size` = 100.

### 5.5 Cache (Caffeine)
Caches: `areas`, `tipos`, `regioes`, `marca`. TTL 10 min + `@CacheEvict`
explícito nas escritas. Ao alterar dado cacheado, **invalide** — há testes de
integração que provam a invalidação.

### 5.6 Uploads
`UploadService` valida tipo/tamanho; `StorageBackend`/`LocalStorageBackend`
grava. URLs gravadas são **absolutas** (`app.upload.base-url` + caminho) — não
prefixe host no frontend. Se precisar tolerar registros antigos relativos, use a
guarda `/^https?:\/\//i.test(url)`.

Ordem obrigatória ao trocar arquivo: **grava o novo → persiste → só então apaga
o antigo.** O inverso já deixou entidade apontando para arquivo inexistente.

**SVG não é aceito** em nenhum upload de imagem. É documento capaz de carregar
script, e os uploads são servidos como estáticos — seria XSS armazenado.

### 5.7 Migrations
Nunca edite migration já aplicada: o Flyway faz checksum do arquivo e a
validação falha em toda instalação existente. Corrija com uma migration nova.
`V24` existe exatamente por isso.

---

## 6. Sistema de aparência (o coração do white-label)

Duas metades, um único GET.

| | Onde vive | Quem altera | Serviço |
|---|---|---|---|
| Nome, assinatura, logotipos | `configuracao_marca` (linha única, `CHECK id = 1`) | ADMIN | `MarcaService` |
| Paleta (14 tokens) + tipografia, por modo | `configuracao_marca.tema` (jsonb, nulo = padrão de fábrica) | ADMIN | `TemaService` |
| **Modo** claro/escuro/sistema | `localStorage` do usuário | cada usuário | `TemaService` |

O modo é a exceção deliberada: é conforto de leitura, não identidade da empresa.

**Endpoints** (`/api/marca`): `GET` **público** — a tela de login exibe a marca
antes de existir sessão. `PUT /api/marca` (identidade), `PUT|DELETE
/api/marca/tema`, `POST|DELETE /api/marca/logo/{PRINCIPAL|INVERSO}` — todos ADMIN.

**Frontend:** `MarcaService` faz o GET e repassa o tema ao `TemaService`, que
aplica escrevendo custom properties `--tema-*` inline no `<html>`. O Tailwind
consome esses tokens no `@theme`, então a aplicação inteira repinta sem rebuild.
O `localStorage` guarda um **cache de primeira pintura** — nunca é a verdade.

**Edição é rascunho.** Cores mudam ao vivo na tela mas só valem para os outros
usuários após "Publicar". Identidade tem rascunho + "Salvar". Isso é intencional:
permite experimentar uma paleta inteira sem que todo mundo veja cada passo.

**Validação de cor no servidor não é cosmética:** os valores viram custom
properties CSS no cliente, então `PaletaDTO` exige `^#[0-9A-Fa-f]{6}$` em todos
os 14 tokens. Sem isso, um ADMIN poderia injetar declarações CSS.

### Tokens e contraste

Tokens semânticos: `marca`, `marca-escura`, `marca-profunda`, `marca-suave`,
`destaque`, `fundo`, `superficie`, `superficie-2`, `texto`, `texto-suave`,
`borda`, `sucesso`, `erro`, `aviso`. Usados como `bg-marca`, `text-texto` etc.

**Nunca combine dois tokens de marca** (`bg-marca-suave` + `text-marca-escura`):
num cliente cuja paleta escura tem os dois tons escuros, o resultado é
ilegível — foi exatamente o bug dos selos. Use o design system:

```html
<span class="lms-badge lms-badge-marca">Área</span>
```

`.lms-badge` usa a cor de destaque só como tinta de fundo (14%) e borda (40%);
o texto usa `--tema-texto`, cuja legibilidade sobre `--tema-superficie` a própria
tela de Aparência valida. Variantes: `-marca`, `-destaque`, `-sucesso`, `-erro`,
`-aviso`, `-neutro`.

**Também não use cores fixas do Tailwind** (`bg-purple-100`, `text-blue-200`):
não acompanham o tema. Foram todas removidas.

Outras classes do design system em `tailwind.css`: `.lms-field`, `.lms-label`,
`.lms-input`, `.lms-select`, `.lms-textarea`, `.lms-error`, `.lms-hint`,
`.lms-form-grid`.

---

## 7. Padrão de edição no admin

Todo "Editar" leva a **página dedicada**, nunca a formulário embutido na
listagem. Rotas: `/admin/<recurso>/novo` e `/admin/<recurso>/:id/editar`
(unidade fica sob a região: `/admin/regioes/:regiaoId/unidades/:id/editar`).

A página carrega o registro pelo id via API — é endereçável, então não pode
depender de objeto passado pela listagem. Layout esperado: imagem grande (16:9
via `<app-image-upload shape="hero">`), painel de informações do registro e
link "Ver no site" em aba nova.

Listagens ficam só com listar / filtrar / paginar / excluir.

---

## 8. Testes

### Backend — `IntegrationTestBase`
Testcontainers com Postgres 18 real (H2 não serve: o projeto usa recursos
específicos do Postgres). Container singleton em bloco estático, compartilhado
entre subclasses; cada teste em transação revertida.

Helpers prontos: `criarUsuario`, `tokenPara`, `criarCurso`, `criarModulo`,
`criarCursoComAula`, `matricular`, `marcarProgresso`, `registrarPresenca`,
`contarQueries`.

⚠️ **Senha mínima é 8 caracteres** no `/api/auth/register` — testes com "123456"
falham na validação. (O `DevAdminSeeder` cria o admin direto no repositório, por
isso escapa dessa regra.)

### Frontend
Vitest + `criarMock<T>(['metodo'])` de `src/testing/mock.ts` (substituto do
`jasmine.createSpyObj`). Componente com `routerLink` no template precisa de
`provideRouter([])` nos providers do TestBed.

### E2E — Playwright
Rodam em série (escrevem no banco compartilhado). A fixture `apoio.ts` cria e
promove um admin de teste dedicado; senha em `E2E_ADMIN_PASSWORD`
(`frontend/e2e/.env.e2e`).

⚠️ **Teste instável conhecido:** `aparencia.spec.ts` → "a prévia mostra o hover
com a cor configurada" falha esporadicamente na execução em sequência e passa
consistentemente isolado (`npx playwright test e2e/aparencia.spec.ts
--repeat-each=2`). Não é regressão.

---

## 9. Armadilhas específicas deste repositório

- **`tailwind.css` precisa ser `.css` puro**, não `.scss`: o Sass resolve o
  `@import` antes do PostCSS e o plugin do Tailwind perde a referência.
- **`@import "tailwindcss" important`** não é decorativo — é o que faz as
  utilities vencerem o Angular Material (MDC). Sem isso o layout quebra.
- **`@source "./app/**/*.{html,ts}"`** existe porque classes `.lms-*` aplicadas
  por binding `[class]` no TypeScript não são detectadas só pelos templates.
- **Formulário aninhado**: o form de aula fica dentro do form do curso. HTML não
  permite, mas o Angular compila o template por conta própria e funciona — e é o
  que impede o Enter de submeter o formulário externo. Não "conserte" trocando
  por `<div>`.
- **`slug` de unidade é derivado do nome** e muda ao renomear. É o identificador
  da rota pública `/api/unidades/{slug}`.
- Marcar com `translate="no"` termos que o tradutor automático do navegador
  destrói (ex.: "Slug" vira "Lesma", "Módulos" some).
- O ambiente Windows do dono do projeto tem containers de outros projetos
  disputando as portas 5433 e 8080.

---

## 10. Convenções

- **Idioma**: código, comentários, documentação e commits em **português**.
  Assunto de commit sem acentos (padrão do histórico).
- **Commits**: conventional commits (`feat(escopo):`, `fix:`, `test:`), corpo
  explicando **o porquê** e o resultado dos testes.
- **Comentários**: explicam decisão e alternativa descartada, não o óbvio. É o
  padrão dominante do repositório — mantenha-o.
- **Nomes**: domínio em português (`Curso`, `Matricula`, `Unidade`,
  `ConfiguracaoMarca`); termos técnicos em inglês quando é o idioma da API.
