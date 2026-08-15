# LMS Lite — Documento de Contexto do Projeto

> Documento de referência técnica consolidado, feito para ser usado como **contexto** em outras conversas/projetos. Descreve tecnologias, arquitetura e funcionalidades do estado atual do repositório (branch `master`, working tree limpo em 2026-08-07).

---

## 1. Visão geral

**LMS Lite** é um sistema de gestão de cursos educacionais (Learning Management System), projeto full-stack de portfólio inspirado em dados reais do Senac SP (64 unidades reais usadas como seed). Cobre o ciclo completo: catálogo de cursos, matrícula, conteúdo pedagógico, avaliação, presença e administração multi-perfil (admin/professor/aluno).

**Estrutura do repositório** — monorepo simples (duas pastas irmãs, sem workspace unificado / sem Nx-Turborepo-Lerna):

```
lms/
├── README.md, DOCUMENTACAO.md, ROADMAP.md, AUDITORIA.md   # docs originais do projeto
├── CONTEXTO_PROJETO.md                                     # este arquivo
├── backend/     # API Java 25 LTS + Spring Boot 4.1
└── frontend/    # SPA Angular 22 standalone (zoneless)
```

Backend e frontend rodam e buildam de forma totalmente independente (CI/CD via GitHub Actions valida build+test a cada push/PR; sem Docker orquestrando a app em si — só o Postgres é containerizado).

---

## 2. Backend — `backend/`

### 2.1 Stack

| Item | Valor |
|---|---|
| Linguagem | Java 25 LTS (Temurin 25.0.4) |
| Framework | Spring Boot **4.1.0** (Spring Framework 7.0, Security 7.1, Hibernate 7.4, Flyway 12.4, Jackson 3) |
| Persistência | Spring Data JPA / Hibernate (`ddl-auto=validate` — schema só via Flyway) |
| Banco | PostgreSQL 18 (Docker, porta host 5433) |
| Migrations | Flyway 12.4 (`spring-boot-starter-flyway` + `flyway-database-postgresql`), V1→V17 |
| Segurança | Spring Security 7 (stateless) + JWT (`jjwt` 0.13.0 com `jjwt-gson`, HMAC-SHA512) |
| Validação | Bean Validation (`spring-boot-starter-validation`) |
| Outros | Lombok |
| Build | Maven (`./mvnw`) |
| Testes | **52 testes de integração** (`@SpringBootTest` + MockMvc + Testcontainers 2.0.5/Postgres real + Flyway) cobrindo Auth, Matrícula, Presença, Curso, contagem de queries e contrato de erro, além do context-load. Rodam no **failsafe** (`*IT.java`, fase `integration-test`); o surefire ficou só para unitários, então `mvnw test` não exige Docker |

### 2.2 Arquitetura de pacotes

Organização **por domínio** (não por camada técnica), 3 camadas: Controller → Service → Repository. Os Services ficam dentro do próprio pacote de domínio (`domain/curso/CursoService.java`), preservando a convenção de agrupar por domínio em vez de por camada:

```
br.com.lms/
├── LmsApplication.java
├── config/          SecurityConfig, UploadConfig
├── domain/
│   ├── area/        Area, Categoria, Tipo + AreaService
│   ├── conteudo/    ConteudoAula + ConteudoAulaService
│   ├── curso/       Curso, Modulo, Aula + CursoService
│   ├── matricula/   Matricula, ProgressoAula + MatriculaService
│   ├── presenca/    PresencaAula + PresencaService
│   ├── professor/   ProfessorCurso (PK composta @EmbeddedId) + ProfessorService
│   ├── regiao/      Regiao, Unidade + RegiaoService, UnidadeService
│   ├── upload/      UploadService (armazenamento), ImagemUploadService (orquestração)
│   └── usuario/     Usuario + UsuarioService, AutenticacaoService
│   (cada pacote de domínio contém Entity + Controller + Service + Repository)
├── dto/DTOs.java    # todos os DTOs (Java records) em um único arquivo
├── exception/       GlobalExceptionHandler (@RestControllerAdvice), ResourceNotFoundException
└── security/        JwtAuthFilter, JwtTokenProvider, UserDetailsServiceImpl
```

### 2.3 Modelo de dados

Tabelas principais e relacionamentos:

- `usuarios` (id, nome, email UNIQUE, senha_hash, role, unidade_id FK, avatar_url) — role: `ADMIN` / `PROFESSOR` / `ALUNO`
- `cursos` (titulo, descricao, nivel, ativo=soft-delete, unidade_id FK, imagem_url)
- `modulos` (titulo, ordem, curso_id FK) → `aulas` (titulo, url_video, duracao_min, ordem, modulo_id FK)
- `conteudos_aula` (tipo: VIDEO/PDF/TEXTO/LINK, titulo, conteudo, ordem, aula_id FK)
- `matriculas` (usuario_id, curso_id, status, nota, aprovado, nota_lancada_em/por) — UNIQUE(usuario_id, curso_id)
- `progresso_aulas` (matricula_id, aula_id, concluida) — UNIQUE(matricula_id, aula_id)
- `presencas_aula` (matricula_id, aula_id, presente, data_aula) — UNIQUE(matricula_id, aula_id, data_aula)
- `regioes` → `unidades` (nome, slug UNIQUE, endereco, regiao_id FK, imagem_url) — seed real: 4 regiões, 64 unidades Senac SP
- `areas` → `categorias` (N:1 area) ; `tipos` (independente) — cursos N:N com categorias e tipos
- `professor_cursos` (PK composta professor_id+curso_id)

Relação hierárquica de conteúdo: `Curso 1:N Modulo 1:N Aula 1:N (ConteudoAula, ProgressoAula, PresencaAula)`.

Migrations relevantes: V11 faz seed de áreas/categorias/tipos; V12 faz seed de regiões/unidades/cursos reais; V13/V14 tratam slugs; V15 adiciona campos de imagem; V16 vincula curso a área; V17 cria os índices de FK. Próxima migration livre: **V18**.

### 2.4 Autenticação e autorização

- JWT stateless, token carrega **apenas o email** (`sub`) — nenhuma role/claim. A cada request, `JwtAuthFilter` recarrega o `Usuario` do banco via `UserDetailsServiceImpl`, então mudanças de role têm efeito imediato sem precisar revogar tokens.
- `BCryptPasswordEncoder`, `DaoAuthenticationProvider` (construído já com o `UserDetailsService` — exigência do Security 7), `AuthenticationManager` via `ProviderManager`, `@EnableMethodSecurity`, CSRF desabilitado.
- CORS liberado para `localhost:4200`/`4300` (dev do frontend).
- Regras de autorização por rota (`SecurityConfig`):
  - **Público**: `/api/auth/**`, GET `/uploads/**`, GET `/api/cursos`, `/api/unidades/**`, `/api/areas/**`, `/api/tipos/**`, `/api/regioes`
  - **Somente ADMIN**: escrita em cursos, usuários, regiões/unidades, vínculo professor↔curso
  - **ADMIN + PROFESSOR**: conteúdo de aulas, presença, lançamento de nota, matrículas por curso
  - **Público também**: , , , 
  - **Público também**: `/actuator/health`, `/actuator/info`, `/swagger-ui.html`, `/v3/api-docs/**`
  - **Autenticado**: demais rotas

### 2.5 Principais módulos de API (REST)

| Controller | Rota base | Função |
|---|---|---|
| AuthController | `/api/auth` | login, register (role ALUNO) |
| CursoController | `/api/cursos` | CRUD, soft delete, filtros (nível/unidade/área/categoria/tipo), **cria/edita módulos junto com o curso** |
| AreaController | `/api/areas`, `/api/tipos` | árvore área→categoria, cursos por categoria/tipo |
| UnidadeController | `/api/unidades` | detalhe por slug, cursos por unidade+área/tipo |
| RegiaoController | `/api/regioes` | CRUD regiões + unidades aninhadas |
| MatriculaController | `/api/matriculas` | matricular, progresso por aula, lançar nota (aprovação automática ≥ 6,0) |
| UsuarioController | `/api/usuarios` | CRUD (admin), perfil `me`, troca de role |
| ProfessorController | `/api/professores` | vínculo professor↔curso, "meus-cursos" |
| ConteudoAulaController | `/api/aulas/{id}/conteudos` | CRUD conteúdo (vídeo/PDF/texto/link) |
| PresencaController | `/api/presenca` | registrar/atualizar presença (upsert), resumo percentual |
| UploadController | `/api/upload` | avatar, capa de curso, foto de unidade (JPEG/PNG/WebP, máx 5MB) |

### 2.6 Configuração e infraestrutura local

- `application.properties`: Postgres em `jdbc:postgresql://localhost:5433/lmsdb`, Hikari `max-lifetime=1800000` (fix recente para falha de boot do Flyway por conexão obsoleta), `jwt.expiration-ms=86400000` (24h), uploads salvos em `${user.home}/lms-uploads/`.
- Credenciais de banco e JWT secret saíram do código-fonte: profiles `application-dev.properties` (fallback local via env var) e `application-prod.properties` (exige env var, sem fallback), documentados em `backend/.env.example`. Os valores originalmente hardcoded — expostos no histórico do git desde o commit inicial — já foram rotacionados; o secret antigo não é mais válido.
- `docker-compose.yml` (só backend) sobe apenas o Postgres 18 — app roda local via `./mvnw spring-boot:run`. A senha do banco também é lida de variável de ambiente (`.env`), sem hardcode.
- CI/CD via GitHub Actions: `backend-ci.yml` e `frontend-ci.yml` validam build+test a cada push/PR na `master` (sem deploy automático).

---

## 3. Frontend — `frontend/`

### 3.1 Stack

| Item | Valor |
|---|---|
| Framework | Angular **22** (standalone, zoneless, control flow `@if`/`@for`) |
| UI Kit | Angular Material 22.1.1 + CDK, tema **M3** (ícones, spinner, snackbar, tooltip, tabs, expansion, paginator) |
| Estilos | Tailwind CSS **4.3.3** com **tokens semânticos de tema** (`src/tema.css`), modo claro/escuro configurável + design system `.lms-*` |
| Estado | **Angular Signals** nativos (sem NgRx/Redux) |
| Gráficos | Chart.js 4.5.1 |
| Animações | GSAP 3.15.0 |
| Acessibilidade | Widget próprio WCAG 2.1 AA/AAA + `VlibrasWidgetComponent` local (script oficial do gov.br) |
| HTTP | `HttpClient` + interceptors funcionais |
| Build | Angular CLI 22 · TypeScript 6.0 |
| Testes | **Vitest 4.1** (builder `@angular/build:unit-test`, jsdom) — 48 specs em 10 arquivos, incluindo auditoria estática de tokens · **Playwright** — 29 cenários end-to-end |

### 3.2 Estrutura (`src/app/`)

```
app.config.ts        # providers globais, HttpClient + interceptors
app.routes.ts         # rotas lazy via loadComponent()
accessibility/         # widget de acessibilidade (feature isolada, injetada no root)
core/
  guards/auth.guard.ts        # authGuard, adminGuard, professorGuard
  interceptors/jwt.interceptor.ts, error.interceptor.ts (+ tipo ProblemDetail e mensagemDeErro)
  services/auth.service.ts, curso.service.ts, upload.service.ts, tema.service.ts
features/
  admin/{cursos, dashboard, professores, regioes, usuarios}
  aparencia/            # configuração de cores e tipografia por modo
  areas/, cursos/detalhe-curso, dashboard/ (aluno)
  home/, login/, sobre/
  matriculas/minhas-matriculas
  professor/meus-cursos
  unidades/{detalhe-unidade, cursos-unidade-area, cursos-unidade-tipo}
shared/
  curso-card/, image-upload/, navbar/, public-nav/, vlibras/
testing/
  mock.ts             # criarMock<T>() e Mocked<T> — substitui jasmine.createSpyObj
```
Fora de `app/`: `src/tailwind.css` (entrada do Tailwind 4 + `@theme` + design system `.lms-*`) e `src/styles.scss` (variáveis CSS globais, posicionamento do VLibras, estilos de acessibilidade).

Roteamento 100% lazy-loaded; rotas estáticas declaradas antes das dinâmicas para evitar colisão.

Três guards funcionais: `authGuard` (só exige sessão) em `/dashboard` e `/matriculas`; **`adminGuard`** nas 5 rotas `/admin/*`; **`professorGuard`** em `/professor/cursos` (ADMIN também passa). Quem está autenticado mas não tem a role vai para `/dashboard`, não para o login. Antes, todas usavam apenas `authGuard` — um ALUNO autenticado renderizava a UI de admin, e só as chamadas de API é que voltavam 403.

### 3.3 Gerenciamento de estado e serviços

- `AuthService`: `signal<AuthResponse|null>` sincronizado com `localStorage` (`lms_token`, `lms_user`); `isAdmin()`/`isProfessor()` são leituras síncronas do signal.
- `CursoService`: client HTTP central concentrando praticamente todos os endpoints (cursos, áreas, tipos, matrículas, usuários, regiões, unidades, professores, conteúdos, presença, notas).
- `UploadService`: uploads multipart (avatar, curso, unidade).
- Interceptors funcionais: `jwtInterceptor` (injeta `Authorization: Bearer`), `errorInterceptor` (logout automático em 401). O `error.interceptor.ts` também exporta o tipo **`ProblemDetail`** e o helper **`mensagemDeErro()`**, que lê `detail` — ou o mapa `errors` nas falhas de validação — com fallback para erro de rede. Os componentes usam esse helper em vez de acessar `error.error?.message`.

### 3.4 Design system `lms-*`

Conjunto de classes utilitárias (Tailwind `@apply`, em **`src/tailwind.css`**) que **substitui os form fields do Angular Material** em 5 telas (login/registro, admin-cursos, admin-regioes, admin-professores, professor-cursos):

- `.lms-field`, `.lms-label` (com `.required`), `.lms-input`, `.lms-select` (seta custom via SVG), `.lms-textarea`, `.lms-error`, `.lms-hint`, `.lms-form-grid` (`.cols-2/3/4`)
- Angular Material cobre ícones, spinner, snackbar, tooltip, tabs, expansion panel, paginator e progress bar. `MatButtonModule` e `MatTableModule` foram removidos: estavam importados e nunca usados em nenhum template.
- A base comum era um placeholder Sass (`%lms-control-base`) com `@apply`, consumido por `@extend` — dependia de o Sass rodar antes do Tailwind. No v4 virou uma lista de seletores em CSS puro.
- Paleta customizada declarada em `@theme` (Tailwind 4): `senac` (azul, base `#0054A6`), `primary` (indigo), `surface`, sombras `card`/`card-hover`. Na prática só `surface` e as sombras são usadas nos templates — `senac-*` e `primary-*` já eram config morta no v3 e seguem declaradas a custo zero (o v4 só emite o que é referenciado). As variáveis CSS globais (`--color-primary`, `--color-accent`) continuam em `styles.scss`.

### 3.5 Principais telas

- **Público**: Home, Sobre, Login/Registro, catálogo por Área→Categoria e por Tipo, detalhe de curso, unidades por região, detalhe de unidade (por slug).
- **Aluno**: Dashboard, "Minhas Matrículas" com progresso percentual.
- **Professor**: cursos vinculados — módulos/aulas/conteúdo, lançamento de presença e nota.
- **Admin**:
  - Dashboard com KPIs animados (GSAP) + 3 gráficos Chart.js
  - CRUD de cursos com upload de capa e **gestão de módulos inline (FormArray)** — adicionar/remover/reordenar módulos ao criar/editar curso; painel "Alunos & Notas" expansível por curso
  - CRUD de usuários (edição inline, troca de role)
  - CRUD de regiões/unidades aninhadas
  - Vínculo professor↔curso

### 3.6 Módulo de Acessibilidade (diferencial do projeto)

Widget global standalone (WCAG 2.1 AA/AAA), persistido em `localStorage`: 5 níveis de fonte, fonte para dislexia, espaçamento de linha/letra, alto contraste, contraste invertido, escala de cinza, sépia, simulação de daltonismo (SVG `feColorMatrix`), cursor grande, lupa de navegação, links destacados, máscara/guia de leitura, integração VLibras (Libras) via `VlibrasWidgetComponent` próprio, que carrega o script oficial do gov.br em `afterNextRender` — o pacote `angular-vlibras` foi removido por travar no peer `@angular/core ^21`.

---

## 4. Funcionalidades de negócio (resumo)

1. Autenticação/autorização multi-perfil (JWT, 3 roles)
2. Catálogo de cursos por Área→Categoria e por Tipo, com filtro por unidade/região e nível
3. Conteúdo pedagógico hierárquico: Curso → Módulo → Aula → Conteúdo (vídeo/PDF/texto/link)
4. Gestão de módulos direto no painel admin de cursos (FormArray dinâmico)
5. Matrícula de alunos com progresso por aula concluída
6. Avaliação: lançamento de nota, aprovação automática (≥ 6,0), auditoria de quem/quando lançou
7. Controle de presença por aula/data
8. Gestão de regiões e unidades (seed real de 64 unidades Senac SP)
9. Gestão de vínculo professor↔curso
10. Gestão de usuários e roles
11. Upload de imagens (avatar, capa de curso, foto de unidade)
12. Dashboard administrativo com KPIs e gráficos
13. Acessibilidade digital completa (WCAG 2.1 AA/AAA + Libras)
14. Documentação interativa da API (OpenAPI/Swagger) e health check (Actuator)

---

## 5. Débitos técnicos e pontos de atenção conhecidos

- Arquivo de crash dump da JVM (`hs_err_pid*.log`) presente na raiz — candidato a limpeza.
- **Não existe endpoint para criar/editar/excluir `Aula`** (só `Modulo` é gerenciável via `PUT /api/cursos`, e `ConteudoAula`/presença/nota via seus próprios controllers). A tabela `aulas` nunca é populada por nenhum fluxo da aplicação (nem seed, nem API) — hoje só existiria uma linha ali se alguém inserisse via SQL direto. `MatriculaService.marcarAula` e `PresencaService` referenciam `aulaId` sem validar que a aula existe, então também dependem desse gap indiretamente.

**Resolvidos na migração de 2026-08-09** (ver §6):

- ~~Sem Service layer — lógica de negócio nos Controllers~~ → 11 Services criados, controllers viraram borda HTTP.
- ~~Escritas multi-etapa não atômicas~~ → `@Transactional` nas escritas; `CursoService.criar/atualizar` grava curso + categorias + tipos numa transação só.
- ~~Dois handlers `/uploads/**` para diretórios diferentes~~ → `WebConfig` removido; sobrou o `UploadConfig` (`app.upload.dir`).
- ~~`POST /api/usuarios/{id}/foto` gravava num terceiro diretório e antes de checar se o usuário existia~~ → delega ao `UploadService`; usuário resolvido primeiro.
- ~~Upload apagava a imagem antiga antes de gravar a nova~~ → ordem invertida.
- ~~`PATCH /api/usuarios/{id}/role` devolvia 200 com role inválida~~ → `RoleUpdateRequest` validado (400).
- ~~`POST /api/professores/{id}/cursos` lançava NPE sem `cursoId`~~ → `VincularCursoRequest` com `@NotNull`.

**Resolvido em 2026-08-10:**

- ~~Estratégia de atualização de módulos no `PUT /api/cursos` era "replace all" (limpa e recria), não merge incremental~~ → `CursoService.mergeModulos`: módulo com `id` existente é atualizado no lugar (preservando aulas e progresso/presença já registrados nelas); sem `id` é criado; o que sai do payload é removido, a menos que alguma de suas aulas já tenha progresso/presença associados — nesse caso a edição é rejeitada com 409 em vez de apagar histórico do aluno. Investigação de FK: `aulas.modulo_id`/`modulos.curso_id` têm `ON DELETE CASCADE`, mas `progresso_aulas.aula_id`/`presencas_aula.aula_id` **não têm** — então o replace-all antigo não apagava progresso silenciosamente, ele falhava com 409 (violação de integridade) sempre que havia progresso registrado. Na prática isso nunca disparou em produção porque não existe fluxo que crie linhas em `aulas` (ver item acima).

---

## 6. Migração Spring Boot 3.5 → 4.1 / Java 17 → 25 (2026-08-09)

Breaking changes efetivamente encontrados, com a correção aplicada. Os três últimos **não constam das release notes** — só apareceram compilando/rodando.

| # | Breaking change | Correção |
|---|---|---|
| 1 | `spring-boot-starter-web` renomeado | → `spring-boot-starter-webmvc` |
| 2 | Security 7 removeu o construtor sem-args de `DaoAuthenticationProvider` e o `setUserDetailsService` | `new DaoAuthenticationProvider(userDetailsService)` |
| 3 | Security 7: `AuthenticationConfiguration` deprecated-for-removal | bean `AuthenticationManager` via `new ProviderManager(provider)` |
| 4 | `AbstractHttpConfigurer::disable` deprecated | `CsrfConfigurer::disable` |
| 5 | Jackson 2 → Jackson 3 | `com.fasterxml.jackson.databind.ObjectMapper` → `tools.jackson.databind.ObjectMapper` |
| 6 | Hibernate 7 desencoraja dialeto fixo | removido `spring.jpa.properties.hibernate.dialect` |
| 7 | **Auto-configuração dividida em módulos por tecnologia**: declarar `org.flywaydb:flyway-core` cru não liga mais o Flyway — o schema não migrava e o `ddl-auto=validate` falhava com `missing table [areas]` | trocar por `spring-boot-starter-flyway` (traz `spring-boot-flyway`) |
| 8 | **Test slices divididas por tecnologia**: `AutoConfigureMockMvc` saiu de `org.springframework.boot.test.autoconfigure.web.servlet` | → `org.springframework.boot.webmvc.test.autoconfigure`, via `spring-boot-starter-webmvc-test` |
| 9 | **Testcontainers 2.x** renomeou os artefatos (`postgresql` → `testcontainers-postgresql`) e os pacotes (`org.testcontainers.postgresql`), removeu o self-type genérico (`PostgreSQLContainer<?>`) e o construtor com `String` crua | `new PostgreSQLContainer(DockerImageName.parse(...))` |

### 6.1 Performance — medições reais

`CursoQueryCountIT` mede com o `Statistics` do Hibernate e trava o resultado como regressão no CI.

| Endpoint | Antes | Depois |
|---|---|---|
| `GET /api/cursos?size=10` (10 cursos) | **36** statements JDBC | **4** |

As 4 restantes: count da paginação, select principal com joins de unidade/área, batch das categorias, batch dos tipos. Teto travado em 8 no teste.

O que mudou:

- `Curso.unidade/area/categorias/tipos`, `Area.categorias` e `Categoria.area`: EAGER → **LAZY**
- `@EntityGraph(unidade, area)` nas 8 queries de listagem (to-one vira JOIN, sem quebrar paginação). As coleções ficam fora do grafo de propósito — fetch join de coleção com `Pageable` força paginação em memória
- `hibernate.default_batch_fetch_size=50` resolve as coleções em selects com `IN (...)`
- `Curso.categorias/tipos`: `List` → **`Set`** (`@ManyToMany` sobre `List` é bag e faz DELETE-ALL + re-INSERT da tabela de junção)
- **`spring.jpa.open-in-view=false`** — possível porque o mapeamento para DTO acontece dentro dos `@Transactional` dos Services
- **`V17__add_indices_fk.sql`**: 15 índices. O Postgres não indexa FK automaticamente e o schema tinha *um* `CREATE INDEX` em 16 migrations. Inclui índice parcial `cursos(criado_em DESC) WHERE ativo = true`
- `UnidadeService.buscarPorSlug` não usa mais `Pageable.unpaged()` (carregava todos os cursos da unidade para extrair áreas/tipos em memória) → dois `SELECT DISTINCT`
- `spring.data.web.pageable.max-page-size=100`

Adotados como passos separados da atualização de versão:

- **Virtual threads** (`spring.threads.virtual.enabled=true`) — API I/O-bound, a concorrência deixa de ser limitada pela pool de threads; em consequência a pool do Hikari passou a ser dimensionada explicitamente
- **Cache Caffeine** só em dados de referência (áreas, tipos, regiões/unidades), com `@CacheEvict` nas escritas. **O lookup do `UserDetailsServiceImpl` não é cacheado de propósito**: é ele que faz troca de role valer na hora, sem revogar token

### 6.2 Contrato de erro (RFC 7807) — **quebra de contrato**

A API tinha **4 formatos de erro** diferentes: o record `ErrorResponse`, um `Map<String,String>` na validação, um JSON escrito à mão no `authenticationEntryPoint` e um `{"error": ...}` no upload. Agora todos convergem para `application/problem+json`:

```json
{ "type": "https://lms.local/erros/recurso-nao-encontrado",
  "title": "Recurso não encontrado", "status": 404,
  "detail": "Curso não encontrado(a) com id: 999999",
  "instance": "/api/cursos/999999", "timestamp": "..." }
```

Erros de validação trazem os campos na extensão `errors`. O `GlobalExceptionHandler` estende `ResponseEntityExceptionHandler` — sem isso, o handler embutido do `spring.mvc.problemdetails.enabled` tem precedência e a resposta de validação sai sem `type`/`errors`.

**Paginação também mudou de shape** (`serialization-mode=VIA_DTO`): de `PageImpl` cru para `{content, page:{size, number, totalElements, totalPages}}`. Afeta 4 endpoints. O `errorInterceptor` e os consumos paginados do frontend são ajustados na etapa B3.

Outros itens: Actuator (`/actuator/health`, `/actuator/info` públicos; demais autenticados), **OpenAPI em `/swagger-ui.html`** (39 paths documentados), `@Slf4j` nos services e no handler (o projeto não tinha um único Logger — erro 500 era invisível), `@Size`/`@DecimalMin`/`@DecimalMax` cobrindo as lacunas de validação, e `@Data` das entidades trocado por `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` sobre o id.

**Correção de portabilidade:** `.gitattributes` passou a fixar `*.sql` em `eol=lf`. Com `core.autocrlf=true`, os `.sql` ficavam CRLF no Windows e LF no runner Linux do CI — o mesmo repositório produzia checksums de Flyway diferentes por ambiente, e o boot falhava com `Migration checksum mismatch`.

Nota sobre dependências: `jjwt-jackson` foi trocado por **`jjwt-gson`** porque o `jjwt-jackson` 0.13 ainda depende do Jackson 2, o que reintroduziria essa árvore só para serializar claims. O Jackson 2 ainda entra transitivamente pelo `springdoc` (swagger-core), mas isso é upstream.

Escolha de versão do Java: o Temurin 26 já existe, mas é *feature release* não-LTS. O alvo é o **25 LTS**.

---

## 7. Migração do frontend — Angular 18 → 22 (2026-08-09)

Cadeia percorrida um major por vez (18→19→20→21→22), com build e testes verdes em cada degrau.

### 7.1 Efeito no bundle de produção

| Etapa | Initial total | Transferido |
|---|---|---|
| Angular 18 (ponto de partida) | 767.47 kB | 176.47 kB |
| Angular 22 (ainda com zone.js) | 543.12 kB | 104.81 kB |
| Angular 22 + zoneless | 361.95 kB | 57.71 kB |
| + tema M3 e imports mortos removidos | **265.08 kB** | **51.02 kB** |

**−65% no bundle e −71% no transferido.**

### 7.2 O que mudou

- **Zoneless**: `provideZonelessChangeDetection()`, `zone.js` fora dos polyfills e das dependências, `provideAnimationsAsync()`. Ganho concreto: o widget de acessibilidade registra handlers de `mousemove` (lupa, máscara, guia de leitura) — com zone.js cada movimento do mouse disparava um ciclo de verificação da aplicação inteira.
- **`admin-dashboard`** dependia de `effect()` → `setTimeout(50)` → `@ViewChild.nativeElement` para criar os 3 gráficos, e de `setTimeout(300)` antes de consultar `.top-curso-bar` para o GSAP. Eram apostas no timing de render do zone.js; trocado por `afterNextRender`.
- **Control flow**: 251 usos de `*ngIf`/`*ngFor` em 31 arquivos viraram `@if`/`@for`. A schematic converte `trackBy` para `track f(i, item)`, o que **não compila** — no `@for`, `track` é expressão de identidade. As 33 ocorrências foram reescritas (`track x.id`, `track $index`).
- **`standalone: true`** removido de 26 componentes (padrão desde o v19).
- **Material M3**: `indigo-pink` (M2) → `azure-blue` (M3). As 4 regras `::ng-deep` do login alcançavam classes internas do MDC e quebraram; reescritas com tokens `--mat-tab-header-*`. `MatButtonModule` (5 arquivos) e `MatTableModule` (2) removidos — importados e nunca usados.
- **`angular-vlibras` substituído** por `VlibrasWidgetComponent` local: o pacote travava no peer `^21` e estava sem manutenção.
- **`@angular/platform-browser-dynamic` removido** — não era usado e parou de publicar no 20.0.7.
- **Guards por role** (`adminGuard`, `professorGuard`): `AuthService` já expunha `isAdmin()`/`isProfessor()`, mas nenhuma rota usava — um ALUNO autenticado renderizava a UI de `/admin/*`.
- **Acompanhamento do contrato do backend**: `Page<T>` refeito para o shape `PagedModel`; `errorInterceptor` com o tipo `ProblemDetail` e o helper `mensagemDeErro()`.
- Vazamentos pré-existentes corrigidos: `MutationObserver` sem `disconnect()` e `router.events` sem `takeUntilDestroyed()`.
- **Karma/Jasmine → Vitest**: builder `@angular/build:unit-test`, 7 devDependencies removidas. Como o Vitest roda em jsdom, o CI não precisa mais de um Chrome instalado. O `jasmine.createSpyObj` não tem equivalente e virou o helper `criarMock<T>()` em `src/testing/mock.ts`; `.and.returnValue` → `.mockReturnValue`, `toBeTrue()/toBeFalse()` → `toBe(true/false)`, `jasmine.clock()` → `vi.useFakeTimers()`.

### 7.3 Tailwind 3 → 4

Migrado. O ponto que custou caro: **o builder esbuild do Angular lê `.postcssrc.json`, não `postcss.config.js`.**

Com `postcss.config.js`, o Tailwind 4 falhava de forma silenciosa e enganosa: o `@import "tailwindcss"` era parcialmente processado (o `@apply` das classes `.lms-*` expandia normalmente, dando a impressão de que estava tudo certo), mas a varredura de conteúdo não encontrava nenhum template. O CSS caía de 75 KB para 32 KB **sem nenhuma utility usada no HTML** — a aplicação renderizaria praticamente sem estilo, e o build passava sem um único warning.

O Tailwind 3 funcionava por um caminho diferente: o Angular tem detecção embutida do `tailwind.config.js`, então nunca dependeu do `postcss.config.js`. Ao remover o config do v3, esse caminho sumiu e nada mais fazia a varredura.

Outras mudanças do v4:

- `@tailwind base/components/utilities` → `@import "tailwindcss" important;`. O `important` **não é decorativo**: era o `important: true` do config v3 e é o que faz as utilities ganharem dos estilos MDC do Material.
- `tailwind.config.js` → `@theme` em CSS. `autoprefixer` removido (embutido no v4).
- A entrada do Tailwind precisa ser **`.css` puro** (`src/tailwind.css`), não `.scss`: o Sass resolve o `@import` antes do PostCSS e o plugin perde a referência do diretório.
- O `%lms-control-base` era um placeholder Sass contendo `@apply`, consumido por `@extend` — dependia de o Sass rodar antes do Tailwind. Virou lista de seletores em CSS puro.
- 147 utilities renomeadas. As que importam por semântica: `outline-none` → `outline-hidden` (no v4 `outline-none` virou `outline-style:none`, que remove o anel de foco) e a escala de sombra deslocou (`shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`).
- As cores `senac-*` e `primary-*` do tema têm **zero uso nos templates** — já eram config morta no v3. Mantidas no `@theme` (custo zero: o v4 só emite o que é usado).

Custo em bytes: o CSS foi de 75 KB para 85 KB e o bundle de 265.08 kB para 275.62 kB — o v4 traz um preflight e uma camada de tema maiores.

---

## 8. Sistema de temas e página de Aparência (2026-08-09)

`/aparencia` (qualquer usuário autenticado) permite configurar **cores e tipografia separadamente para o modo claro e o escuro**, com prévia ao vivo. O botão de alternância fica na barra superior.

### 8.1 Como funciona

Uma única cadeia, do controle até o pixel:

```
página de Aparência  ->  TemaService  ->  custom properties inline no <html>
                                              |
                          src/tema.css  <-----+  (valores padrão de cada modo)
                                              |
                       @theme do Tailwind <---+  ->  utilities bg-superficie, text-texto...
```

- **`src/tema.css`** — valores padrão de claro e escuro, separados por `data-tema` no `<html>`. Não é media query: o usuário precisa poder escolher explicitamente; o modo "sistema" é resolvido no TypeScript, que grava o `data-tema` correspondente.
- **`TemaService`** — estado em signals, aplica escrevendo custom properties inline no `<html>` (o que vence o CSS estático por especificidade) e persiste em `localStorage`.
- **`@theme` do Tailwind** — os tokens (`--color-superficie`, `--color-texto`…) apontam para as custom properties. É isso que faz `bg-superficie` ser branco no claro e quase-preto no escuro **sem** variante `dark:` em cada elemento, e permite repintar tudo sem rebuild.

### 8.2 A migração que tornou isso possível

O estilo estava cravado no código: **289 cores hex** (só `#0054A6` aparecia 147 vezes), **257 classes arbitrárias** `bg-[#...]` e centenas de `bg-white` / `text-gray-900` / `border-gray-100`. Nada disso reagiria a uma troca de tema.

**869 substituições em 34 arquivos** converteram isso para tokens semânticos:

| Antes | Depois |
|---|---|
| `bg-white` (119) | `bg-superficie` |
| `text-[#0054A6]` (83) | `text-marca` |
| `text-gray-400/500/600` (145) | `text-texto-suave` |
| `border-gray-100/200` (82) | `border-borda` |
| `text-gray-900` / `text-slate-900` (75) | `text-texto` |
| `bg-[#F7941E]` (25) | `bg-destaque` |

Restaram **127 fundos em paletas fixas** (`bg-purple-50`, `bg-blue-50`…), usados como "chips" no padrão fundo claro + texto escuro do mesmo matiz — legível no claro, uma mancha branca no escuro. Em vez de decidir 127 casos um a um, uma regra genérica em `tema.css` converte qualquer matiz: no escuro o fundo vira `color-mix()` do mesmo matiz com a superfície, e o texto sobe para o tom 300. Só é possível porque o Tailwind 4 expõe a paleta inteira como custom properties.

### 8.3 Cobertura completa: hovers, gráficos e auditoria

A primeira versão tokenizou cores em repouso, mas deixou de fora os **estados
interativos** — o hover é o mais fácil de esquecer numa migração de tema e o
mais visível quando erra, porque só aparece na interação. Uma segunda passagem
converteu **312 ocorrências** em 30 arquivos:

| Antes | Depois |
|---|---|
| `hover:bg-indigo-700` (12) | `hover:bg-marca-escura` |
| `hover:bg-gray-50` / `-100` (20) | `hover:bg-superficie-2` |
| `hover:bg-blue-50` / `indigo-50` (14) | `hover:bg-marca-suave` |
| `hover:bg-orange-500` (9) | `hover:bg-destaque-escuro` |
| `bg-indigo-600` / `text-indigo-600` (30) | `bg-marca` / `text-marca` |
| `hover:bg-red-50` (5) | `hover:bg-erro/10` |
| `bg-purple-50` da sidebar admin (30) | tokens de marca |

**Tokens derivados de hover** (`--tema-destaque-escuro`, `--tema-sucesso-escuro`,
`--tema-erro-escuro`, `--tema-aviso-escuro`) não são editáveis na página de
propósito: derivam da cor base via `color-mix`, então acompanham qualquer cor
escolhida. No claro escurecem; no escuro clareiam, que é o padrão de superfícies
escuras. A exceção é a marca, cujo hover (`--tema-marca-escura`) já é um token
editável próprio.

**Chart.js** foi o caso mais sutil: canvas não herda CSS, então o gráfico
resolve a cor na criação e ficava com a paleta do modo anterior. Um efeito
observa `temaAtual()` e recria os três gráficos. Dois detalhes de implementação
importaram:

- **Sem `afterNextRender`** — os canvases já existem quando o tema muda, e a
  troca de tema não agenda um novo render do componente, então o callback
  simplesmente não disparava. A recriação é direta.
- **A cor vem do signal, não de `getComputedStyle`** — ler do DOM criaria
  dependência da ordem em que os efeitos rodam: se este corresse antes de o
  `TemaService` escrever as variáveis, os gráficos seriam pintados com as cores
  do modo anterior.

**Prévia interativa** — a prévia virou uma mini-aplicação (barra, menu lateral,
cartão, botões, campo) com `:hover` e `:focus` reais. Ela usa variáveis próprias
`--pv-*` em vez dos tokens globais, de propósito: mostra o modo **em edição**,
que pode não ser o aplicado. É o que permite ajustar o tema escuro navegando no
claro e ainda ver o hover de um botão.

**Auditoria estática** (`tokens-tema.spec.ts`) varre todos os templates e falha
se alguém reintroduzir cor hex literal, classe arbitrária `bg-[#...]`, paleta
fixa em papel de superfície/texto, hover de marca fora do tema, ou cor literal
no Chart.js. Uma regressão dessas não quebra nada visível no modo claro — ela só
deixa de responder à página de Aparência e vira mancha errada no escuro. É
silenciosa, e por isso vale um teste em vez de inspeção manual.

**Exportar/importar tema foi removido** a pedido: não seria usado.

### 8.4 Detalhes que exigiram cuidado

- **Angular Material** — o tema prebuilt `azure-blue` é só claro. Os tokens `--mat-sys-*` foram amarrados aos tokens do tema, então ícones, spinner, snackbar, tooltip, tabs, expansion e paginator acompanham o modo.
- **`text-white` ficou de fora** da migração de propósito: quase sempre está sobre fundo de marca e deve continuar branco nos dois modos.
- **A seta do `.lms-select`** é um SVG em data-URI; `currentColor` não resolve ali (é outro documento), então usa um cinza médio legível nos dois modos.
- **Widget de acessibilidade** — continua funcionando por cima do tema. O alto contraste aplica estilos inline, que vencem os tokens; é o comportamento correto (acessibilidade tem precedência).

---

## 9. Documentação original do projeto

O repositório já contém documentação própria mais extensa (datada de 2026-06-02/05, um pouco defasada em relação aos últimos 3 commits, já incorporados aqui):

- `README.md` — visão geral e como rodar
- `DOCUMENTACAO.md` — documentação técnica detalhada (API REST completa, decisões de arquitetura)
- `ROADMAP.md` — funcionalidades implementadas/planejadas
- `AUDITORIA.md` — histórico de auditorias de higiene de código
