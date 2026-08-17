# Documentação Técnica — LMS

> Referência técnica para desenvolvedores e mantenedores.
> Atualizada em: 2026-08-17 | Backend: Spring Boot 4.1.0 (Java 25 LTS) / Frontend: Angular 22 (zoneless)
>
> Para trabalhar **dentro** do código (convenções, decisões e armadilhas), veja
> [`CLAUDE.md`](./CLAUDE.md). Este arquivo é a referência de **o que existe**.

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura](#2-arquitetura)
3. [Estrutura de Pastas](#3-estrutura-de-pastas)
4. [Banco de Dados](#4-banco-de-dados)
5. [Backend — API REST](#5-backend--api-rest)
6. [Frontend — Angular](#6-frontend--angular)
7. [Módulo de Acessibilidade](#7-módulo-de-acessibilidade)
8. [Segurança e Autenticação](#8-segurança-e-autenticação)
9. [Upload de Arquivos](#9-upload-de-arquivos)
10. [Aparência e White-label](#10-aparência-e-white-label)
11. [Decisões de Arquitetura](#11-decisões-de-arquitetura)
12. [Testes](#12-testes)
13. [Como Rodar Localmente](#13-como-rodar-localmente)

---

## 1. Visão Geral

LMS é uma plataforma fullstack de gestão de cursos educacionais, white-label: a identidade visual (nome, logotipo, paleta e tipografia) é configuração de cada instalação, definida pela tela de Aparência e persistida no servidor. Implementa um ciclo completo de LMS: catálogo de cursos por área/categoria/tipo, matrículas, progresso de alunos, lançamento de notas, controle de presença, gestão de regiões/unidades e painel administrativo com gráficos em tempo real. O sistema tem foco em acessibilidade, com um módulo dedicado que cobre critérios WCAG 2.1 AA/AAA.

| Funcionalidade | Status |
|---|---|
| Autenticação JWT (login + registro) | ✅ Implementado |
| Roles: ADMIN / PROFESSOR / ALUNO | ✅ Implementado |
| CRUD de Cursos com soft delete | ✅ Implementado |
| Áreas, Categorias e Tipos de curso | ✅ Implementado |
| Matrículas e progresso de aulas | ✅ Implementado |
| Lançamento de notas (≥ 6.0 = aprovado) | ✅ Implementado |
| Controle de presença por aula | ✅ Implementado |
| Conteúdo de aulas (VIDEO / PDF / TEXTO / LINK) | ✅ Implementado |
| Gestão de Regiões e Unidades | ✅ Implementado |
| Página de detalhe de Unidade com slug | ✅ Implementado |
| Vínculo Professor ↔ Curso | ✅ Implementado |
| Upload de imagens (avatar, curso, unidade, logotipo) | ✅ Implementado |
| Vídeo por módulo — upload de arquivo ou link YouTube/Vimeo | ✅ Implementado |
| Busca textual em cursos | ✅ Implementado |
| Notificações in-app (polling) | ✅ Implementado |
| Dashboard administrativo com Chart.js + GSAP | ✅ Implementado |
| Widget de Acessibilidade (12 funcionalidades) | ✅ Implementado |
| VLibras (tradução para Libras) | ✅ Implementado |
| **White-label: identidade da instalação no servidor** | ✅ Implementado |
| **White-label: paleta e tipografia no servidor** | ✅ Implementado |
| **Edição do admin em páginas dedicadas** | ✅ Implementado |
| Seed de exemplo: 4 regiões, 64 unidades, 35 cursos | ✅ Implementado |
| Testes automatizados backend (94 ITs) e frontend (73 specs + 30 E2E) | ✅ Implementado |
| Deploy em produção | 🔲 Planejado |
| Certificados de conclusão | 🔲 Planejado |

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────┐
│  Browser — Angular 22 SPA zoneless (:4200)  │
│  Tailwind CSS · Angular Material · Chart.js  │
│  GSAP · VlibrasWidgetComponent (gov.br)      │
└──────────────────┬──────────────────────────┘
                   │ HTTP/REST — Bearer JWT
                   ▼
┌─────────────────────────────────────────────┐
│  Spring Boot 4.1.0 (:8080)                  │
│  Spring Security · JPA/Hibernate · Flyway   │
│  JJWT 0.12.5 · Lombok                       │
└──────────────────┬──────────────────────────┘
                   │ JDBC (PostgreSQL driver)
                   ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL 18 — container lms-postgres     │
│  host :5433 → container :5432                │
└─────────────────────────────────────────────┘
```

**Decisões de infraestrutura:**
- Docker Compose sobe apenas o banco; backend e frontend rodam localmente.
- Porta 5433 no host porque 5432 pode estar ocupada por instância local do PostgreSQL no Windows.
- CORS configurado para `localhost:4200` (dev principal) e `localhost:4300` (alternativa).
- Arquivos de upload salvos em `${user.home}/lms-uploads/` e servidos via `/uploads/**`.

---

## 3. Estrutura de Pastas

### Backend (`backend/src/main/java/br/com/lms/`)

```
br/com/lms/
├── LmsApplication.java
├── config/
│   ├── SecurityConfig.java      # CORS, filtros JWT, regras de autorização
│   ├── UploadConfig.java        # ResourceHandler para /uploads/**
│   ├── CacheConfig.java         # Caffeine para dados de referência
│   └── OpenApiConfig.java       # Swagger UI + esquema bearerAuth
├── domain/
│   ├── area/
│   │   ├── Area.java            # @Entity — id, nome, slug, categorias (OneToMany)
│   │   ├── Categoria.java       # @Entity — id, area (ManyToOne), nome, slug
│   │   ├── Tipo.java            # @Entity — id, nome, slug
│   │   ├── AreaController.java  # GET /api/areas, /api/tipos
│   │   ├── AreaRepository.java
│   │   ├── CategoriaRepository.java
│   │   └── TipoRepository.java
│   ├── conteudo/
│   │   ├── ConteudoAula.java    # @Entity — tipo (VIDEO|PDF|TEXTO|LINK), titulo, conteudo, ordem
│   │   ├── ConteudoAulaController.java  # CRUD /api/aulas/{id}/conteudos
│   │   └── ConteudoAulaRepository.java
│   ├── curso/
│   │   ├── Curso.java           # @Entity — titulo, descricao, nivel, ativo, unidade, imagemUrl
│   │   ├── Aula.java            # @Entity — titulo, urlVideo, duracaoMin, ordem
│   │   ├── Modulo.java          # @Entity — titulo, ordem, aulas (OneToMany)
│   │   ├── CursoController.java # GET/POST/PUT/DELETE /api/cursos
│   │   └── CursoRepository.java
│   ├── marca/                   # White-label — identidade e tema da instalação
│   │   ├── ConfiguracaoMarca.java       # @Entity de linha única (id fixo = 1)
│   │   ├── ConfiguracaoMarcaRepository.java
│   │   ├── MarcaService.java            # leitura cacheada; escrita invalida
│   │   └── MarcaController.java         # GET público; PUT/POST/DELETE ADMIN
│   ├── matricula/
│   │   ├── Matricula.java       # @Entity — Status (EM_ANDAMENTO|CONCLUIDO|CANCELADO), nota, aprovado
│   │   ├── MatriculaController.java
│   │   ├── MatriculaRepository.java
│   │   ├── ProgressoAula.java   # @Entity — matricula, aula, concluida, concluido_em
│   │   └── ProgressoAulaRepository.java
│   ├── notificacao/
│   │   ├── Notificacao.java     # @Entity — tipo, mensagem, referenciaId, lida
│   │   ├── NotificacaoService.java      # criada dentro das transações de matrícula/nota
│   │   ├── NotificacaoController.java
│   │   └── NotificacaoRepository.java
│   ├── presenca/
│   │   ├── PresencaAula.java    # unique (matricula_id, aula_id, data_aula)
│   │   ├── PresencaAulaRepository.java
│   │   └── PresencaController.java
│   ├── professor/
│   │   ├── ProfessorCurso.java        # @EmbeddedId ProfessorCursoId
│   │   ├── ProfessorCursoId.java      # Serializable — professorId, cursoId
│   │   ├── ProfessorCursoRepository.java  # @Query JPQL explícita
│   │   └── ProfessorController.java
│   ├── regiao/
│   │   ├── Regiao.java          # @Entity — nome (UNIQUE), unidades (OneToMany)
│   │   ├── Unidade.java         # @Entity — nome, slug, endereco, regiao (EAGER), imagemUrl
│   │   ├── RegiaoController.java    # CRUD /api/regioes + /api/regioes/{id}/unidades
│   │   ├── UnidadeController.java   # GET /api/unidades/{slug} e /{slug}/cursos
│   │   ├── RegiaoRepository.java
│   │   └── UnidadeRepository.java
│   ├── upload/
│   │   ├── UploadController.java   # POST /api/upload/avatar|curso/{id}|unidade/{id}|modulo/{id}/video
│   │   ├── UploadService.java      # Valida tipo/tamanho (imagem e vídeo)
│   │   ├── StorageBackend.java     # Interface de I/O cru de arquivo
│   │   ├── LocalStorageBackend.java# Grava em lms-uploads/, devolve URL absoluta
│   │   ├── ImagemUploadService.java# Amarra o arquivo à entidade, em transação
│   │   └── VideoUploadService.java # Vídeo de módulo (upload e remoção)
│   └── usuario/
│       ├── Usuario.java         # @Entity — Role (ADMIN|PROFESSOR|ALUNO), avatarUrl
│       ├── AuthController.java  # POST /api/auth/login|register
│       ├── DevAdminSeeder.java  # @Profile("dev") — admin local de conveniência
│       ├── UsuarioController.java
│       └── UsuarioRepository.java
├── dto/
│   ├── DTOs.java                # Todos os records (request + response) em um arquivo
│   └── validation/              # @ValidVideoModulo + validador do par urlVideo/tipoVideo
├── exception/
│   ├── GlobalExceptionHandler.java
│   └── ResourceNotFoundException.java
└── security/
    ├── JwtAuthFilter.java           # Extrai email do JWT → carrega usuário do banco
    ├── JwtTokenProvider.java        # HMAC-SHA512, expiração 24h
    └── UserDetailsServiceImpl.java
```

### Frontend (`frontend/src/app/`)

```
app/
├── app.component.ts         # Roteador raiz — injeta AccessibilityComponent
├── app.config.ts            # providers: HttpClient + jwtInterceptor + errorInterceptor
├── app.routes.ts            # Todas as rotas com lazy load
├── accessibility/
│   ├── accessibility.component.{html,scss,ts}
│   ├── accessibility.service.ts   # Signal<AccessibilityState> + todas as ações
│   ├── color-manager.ts           # Análise de contraste WCAG e patching de CSS vars
│   ├── models/
│   │   └── accessibility-state.model.ts
│   └── vlibras.d.ts               # Tipos do widget VLibras do gov.br
├── core/
│   ├── guards/
│   │   └── auth.guard.ts          # authGuard / adminGuard / professorGuard
│   ├── interceptors/
│   │   ├── jwt.interceptor.ts     # Injeta Bearer token em todas as requests
│   │   └── error.interceptor.ts   # Erros HTTP + mensagemDeErro() (RFC 7807)
│   └── services/
│       ├── auth.service.ts        # signal currentUser, login/logout/refreshUser
│       ├── curso.service.ts       # Todos os métodos de API
│       ├── marca.service.ts       # White-label: identidade + busca do tema
│       ├── tema.service.ts        # Aplica paleta/tipografia em custom properties
│       ├── notificacao.service.ts # Polling de notificações (30s)
│       └── upload.service.ts      # avatar, curso, unidade, vídeo de módulo
├── features/
│   ├── admin/
│   │   ├── cursos/                # Listagem + painel Alunos & Notas
│   │   │   └── curso-form/        # Página dedicada de criação/edição
│   │   ├── dashboard/             # KPIs + Chart.js (bar, doughnut, horizontal) + GSAP
│   │   ├── professores/           # Listagem + vínculo professor ↔ curso
│   │   ├── regioes/               # Listagem de regiões + unidades (MatExpansionPanel)
│   │   │   ├── regiao-form/       # Página dedicada de região
│   │   │   └── unidade-form/      # Página dedicada de unidade
│   │   └── usuarios/              # Listagem + criação rápida
│   │       └── usuario-form/      # Página dedicada de edição
│   ├── aparencia/                 # White-label: identidade, cores e tipografia
│   ├── areas/
│   │   ├── detalhe-area/
│   │   ├── lista-areas/
│   │   ├── lista-cursos-categoria/
│   │   └── lista-cursos-tipo/
│   ├── cursos/
│   │   └── detalhe-curso/
│   ├── dashboard/
│   ├── home/
│   ├── login/
│   ├── matriculas/
│   │   └── minhas-matriculas/
│   ├── professor/
│   │   └── meus-cursos/
│   ├── sobre/
│   └── unidades/
│       ├── unidades.component.ts
│       ├── detalhe-unidade/
│       ├── cursos-unidade-area/
│       └── cursos-unidade-tipo/
└── shared/
    ├── curso-card/          # Card reutilizável para listagem de cursos
    ├── image-upload/        # Upload de imagem com preview (circle | circle-lg | rect | hero)
    ├── logo-marca/          # Assinatura visual do cliente (logo + nome)
    ├── navbar/              # Top bar fixa + sidebar colapsável (autenticados)
    ├── notificacao-sino/    # Badge + dropdown de notificações
    ├── public-nav/          # Navbar pública com mega-dropdown
    ├── video-embed/         # iframe de YouTube/Vimeo + util de detecção
    ├── video-upload/        # Upload de vídeo com progresso
    └── vlibras/             # Widget VLibras (gov.br)
```

---

## 4. Banco de Dados

### Migrations

| Migration | O que faz |
|---|---|
| `V1__create_usuarios.sql` | Tabela `usuarios` (id, nome, email, senha, role, unidade_id) |
| `V2__create_cursos.sql` | Tabelas `cursos`, `modulos`, `aulas` |
| `V3__create_matriculas.sql` | Tabelas `matriculas`, `progresso_aulas` |
| `V4__create_regioes.sql` | Tabelas `regioes`, `unidades`; coluna `unidade_id` em `usuarios` |
| `V5__create_professor_cursos.sql` | Tabela `professor_cursos` (PK composta professor_id + curso_id) |
| `V6__create_conteudos_aula.sql` | Tabela `conteudos_aula` com enum TipoConteudo |
| `V7__create_presencas.sql` | Tabela `presencas_aula` (UNIQUE: matricula + aula + data) |
| `V8__add_nota_matricula.sql` | Colunas `nota`, `aprovado`, `nota_lancada_em`, `nota_lancada_por` em `matriculas` |
| `V9__add_unidade_curso.sql` | Coluna `unidade_id` (nullable FK) em `cursos` |
| `V10__create_areas_tipos_categorias.sql` | Tabelas `areas`, `categorias`, `tipos`, `curso_categorias`, `curso_tipos` |
| `V11__seed_areas_tipos_categorias.sql` | Seed: 10 áreas, 44 categorias, 11 tipos; associações nos cursos 1 e 2 |
| `V12__seed_rico_cursos_unidades.sql` | Seed de exemplo: 4 regiões, 64 unidades, 35 cursos com vínculos |
| `V13__add_slug_unidades.sql` | Adiciona coluna `slug` em `unidades`, popula via transliteração SQL, índice UNIQUE |
| `V14__fix_slugs_unidades.sql` | Corrige 14 slugs com erro de mapeamento gerados pela V13 |
| `V15__add_imagem_fields.sql` | Adiciona `avatar_url` em `usuarios`, `imagem_url` em `cursos` e `unidades` |
| `V16__add_area_curso.sql` | Coluna `area_id` em `cursos` (vínculo direto curso ↔ área) |
| `V17__add_indices_fk.sql` | 15 índices de FK (o Postgres não indexa FK automaticamente) + índice parcial `cursos(criado_em DESC) WHERE ativo` |
| `V18__add_busca_textual.sql` | Suporte a busca textual em cursos |
| `V19__create_notificacoes.sql` | Tabela `notificacoes` + índice `(usuario_id, lida, criado_em DESC)` |
| `V20__add_video_modulo.sql` | Coluna `url_video` em `modulos` |
| `V21__add_tipo_video_modulo.sql` | Coluna `tipo_video` (ARQUIVO/YOUTUBE/VIMEO) em `modulos` |
| `V22__create_configuracao_marca.sql` | Tabela `configuracao_marca` (linha única, `CHECK id = 1`) — identidade da instalação |
| `V23__add_tema_configuracao_marca.sql` | Coluna `tema` (jsonb, nullable) — paleta e tipografia da instalação |
| `V24__remove_marca_do_seed_unidades.sql` | Remove a marca do cliente original dos dados de exemplo |

**Próxima migration disponível: V25.**

⚠️ Nunca edite uma migration já aplicada: o Flyway faz checksum do arquivo e a
validação passa a falhar em toda instalação existente. Corrija com uma nova.

### Schema atual

| Tabela | Colunas principais | Observações |
|---|---|---|
| `usuarios` | id, nome, email, senha, role, unidade_id, avatar_url | role: ADMIN / PROFESSOR / ALUNO |
| `cursos` | id, titulo, descricao, nivel, ativo, unidade_id, imagem_url, criado_em | soft delete via `ativo` |
| `modulos` | id, titulo, ordem, curso_id | |
| `aulas` | id, titulo, url_video, duracao_min, ordem, modulo_id | |
| `matriculas` | id, usuario_id, curso_id, status, nota, aprovado, nota_lancada_em, nota_lancada_por, matriculado_em | UNIQUE (usuario_id, curso_id) |
| `progresso_aulas` | id, matricula_id, aula_id, concluida, concluido_em | UNIQUE (matricula_id, aula_id) |
| `regioes` | id, nome, criado_em | nome UNIQUE |
| `unidades` | id, nome, slug, endereco, regiao_id, imagem_url, criado_em | slug UNIQUE |
| `professor_cursos` | professor_id, curso_id, vinculado_em | PK composta |
| `conteudos_aula` | id, tipo, titulo, conteudo, ordem, aula_id | tipo: VIDEO / PDF / TEXTO / LINK |
| `presencas_aula` | id, matricula_id, aula_id, presente, data_aula, registrado_por | UNIQUE (matricula_id, aula_id, data_aula) |
| `areas` | id, nome, slug | slug UNIQUE |
| `categorias` | id, nome, slug, area_id | UNIQUE (area_id, slug) |
| `tipos` | id, nome, slug | slug UNIQUE |
| `curso_categorias` | curso_id, categoria_id | PK composta N:N |
| `curso_tipos` | curso_id, tipo_id | PK composta N:N |
| `notificacoes` | id, usuario_id, tipo, mensagem, referencia_id, lida, criado_em | índice (usuario_id, lida, criado_em DESC) |
| `configuracao_marca` | id, nome, assinatura, logo_url, logo_inverso_url, tema, atualizado_em | linha única (`CHECK id = 1`); `tema` jsonb nullable |

### Diagrama de relacionamentos (simplificado)

```
regioes      ||--o{ unidades        : "contém"
unidades     ||--o{ usuarios        : "lotado em"
unidades     ||--o{ cursos          : "oferece"
usuarios     ||--o{ notificacoes    : "recebe"
usuarios     ||--o{ matriculas      : "faz"
cursos       ||--o{ matriculas      : "recebe"
cursos       ||--o{ modulos         : "tem"
modulos      ||--o{ aulas           : "tem"
aulas        ||--o{ progresso_aulas : "rastreia"
aulas        ||--o{ conteudos_aula  : "tem"
aulas        ||--o{ presencas_aula  : "registra"
matriculas   ||--o{ progresso_aulas : "inclui"
matriculas   ||--o{ presencas_aula  : "inclui"
usuarios     }o--o{ cursos          : "professor_cursos"
cursos       }o--o{ categorias      : "curso_categorias"
cursos       }o--o{ tipos           : "curso_tipos"
categorias   }o--|| areas           : "pertence a"
```

---

## 5. Backend — API REST

### Convenções transversais

**Erros — RFC 7807 (`application/problem+json`)**

Todas as rotas respondem erro no mesmo formato, inclusive os que nascem na cadeia
de filtros do Spring Security. Antes da migração de 2026-08-09 havia quatro
formatos diferentes convivendo.

```json
{
  "type": "https://lms.local/erros/recurso-nao-encontrado",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Curso não encontrado(a) com id: 999999",
  "instance": "/api/cursos/999999",
  "timestamp": "2026-08-09T06:25:45.466Z"
}
```

Falhas de validação trazem os campos na extensão `errors`:

```json
{
  "type": "https://lms.local/erros/validacao",
  "title": "Falha de validação",
  "status": 400,
  "detail": "2 campos inválidos",
  "instance": "/api/auth/register",
  "errors": {
    "email": "deve ser um endereço de e-mail bem formado",
    "senha": "tamanho deve ser entre 8 e 100"
  }
}
```

| `type` | Status | Quando |
|---|---|---|
| `recurso-nao-encontrado` | 404 | id/slug inexistente |
| `rota-nao-encontrada` | 404 | nenhum endpoint mapeado |
| `validacao` | 400 | Bean Validation (traz `errors`) |
| `json-invalido` | 400 | corpo mal formado |
| `parametro-invalido` | 400 | tipo incompatível no path/query |
| `requisicao-invalida` | 400 | argumento rejeitado pela regra |
| `nao-autenticado` | 401 | sem token, token inválido ou credenciais erradas |
| `acesso-negado` | 403 | autenticado sem a role necessária |
| `conflito` | 409 | regra de negócio (ex.: matrícula duplicada) |
| `integridade` | 409 | violação de constraint no banco |
| `arquivo-grande` | 413 | upload acima do limite |
| `erro-interno` | 500 | não tratado (registrado em log) |

**Paginação — `PagedModel`**

Endpoints paginados devolvem os metadados dentro de `page`, e não na raiz:

```json
{
  "content": [ { "id": 1, "titulo": "..." } ],
  "page": { "size": 10, "number": 0, "totalElements": 35, "totalPages": 12 }
}
```

Teto de `size` = 100 (`spring.data.web.pageable.max-page-size`); padrão = 20.

**Documentação interativa**: `/swagger-ui.html` (39 rotas, com Authorize para o JWT).
**Health check**: `/actuator/health`.

### Auth (`/api/auth`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/auth/login` | público | Autentica → retorna JWT + dados do usuário |
| POST | `/api/auth/register` | público | Cadastra novo usuário com role ALUNO |

### Cursos (`/api/cursos`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/cursos` | público | Listagem paginada (filtros: nivel, unidadeId, areaSlug, categoriaSlug, tipoSlug) |
| GET | `/api/cursos/{id}` | público | Detalhe com módulos, aulas, categorias, tipos |
| POST | `/api/cursos` | ADMIN | Criar curso |
| PUT | `/api/cursos/{id}` | ADMIN | Atualizar curso |
| DELETE | `/api/cursos/{id}` | ADMIN | Soft delete (ativo=false) |

### Áreas e Tipos (`/api/areas`, `/api/tipos`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/areas` | público | Todas as áreas com categorias |
| GET | `/api/areas/{areaSlug}` | público | Detalhe de uma área |
| GET | `/api/areas/{areaSlug}/{catSlug}` | público | Cursos por categoria (paginado) |
| GET | `/api/tipos` | público | Todos os tipos ordenados por nome |
| GET | `/api/tipos/{tipoSlug}/cursos` | público | Cursos por tipo (paginado) |

### Unidades (`/api/unidades`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/unidades/{slug}` | público | Detalhe de unidade com áreas e tipos disponíveis |
| GET | `/api/unidades/{slug}/cursos` | público | Cursos da unidade (query params: tipoSlug, areaSlug) |

### Matrículas (`/api/matriculas`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/matriculas/minhas` | auth | Matrículas do usuário logado |
| POST | `/api/matriculas` | auth | Matricular em curso |
| GET | `/api/matriculas/{id}/progresso` | auth | Progresso da matrícula |
| POST | `/api/matriculas/progresso` | auth | Marcar aula como concluída |
| GET | `/api/matriculas/curso/{cursoId}` | ADMIN/PROF | Alunos matriculados no curso |
| PATCH | `/api/matriculas/{id}/nota` | ADMIN/PROF | Lançar nota (≥ 6.0 = aprovado) |

### Usuários (`/api/usuarios`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/usuarios` | ADMIN | Listar todos os usuários |
| GET | `/api/usuarios/me` | auth | Perfil do usuário logado |
| PUT | `/api/usuarios/{id}` | ADMIN | Editar nome/email/role/unidade |
| PATCH | `/api/usuarios/{id}/role` | ADMIN | Alterar role |

### Regiões (`/api/regioes`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/regioes` | público | Regiões com totalUnidades |
| GET | `/api/regioes/unidades` | público | Todas as unidades com regiaoNome |
| GET | `/api/regioes/{id}` | auth | Detalhe de região |
| POST | `/api/regioes` | ADMIN | Criar região |
| PUT | `/api/regioes/{id}` | ADMIN | Atualizar região |
| DELETE | `/api/regioes/{id}` | ADMIN | Deletar região |
| GET | `/api/regioes/{id}/unidades` | auth | Unidades de uma região |
| POST | `/api/regioes/{id}/unidades` | ADMIN | Criar unidade |
| PUT | `/api/regioes/{id}/unidades/{uid}` | ADMIN | Atualizar unidade |
| DELETE | `/api/regioes/{id}/unidades/{uid}` | ADMIN | Deletar unidade |

### Professores (`/api/professores`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/professores` | ADMIN/PROF | Listar professores |
| GET | `/api/professores/{id}/cursos` | ADMIN/PROF | Cursos de um professor |
| GET | `/api/professores/meus-cursos` | ADMIN/PROF | Cursos do professor logado |
| POST | `/api/professores/{id}/cursos` | ADMIN | Vincular professor a curso |
| DELETE | `/api/professores/{id}/cursos/{cid}` | ADMIN | Desvincular |

### Conteúdo das Aulas (`/api/aulas`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/aulas/{id}/conteudos` | auth | Conteúdos de uma aula |
| POST | `/api/aulas/{id}/conteudos` | ADMIN/PROF | Criar conteúdo |
| PUT | `/api/aulas/{id}/conteudos/{cid}` | ADMIN/PROF | Atualizar conteúdo |
| DELETE | `/api/aulas/{id}/conteudos/{cid}` | ADMIN/PROF | Deletar conteúdo |

### Presença (`/api/presenca`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/presenca` | ADMIN/PROF | Registrar/atualizar presença (upsert por matricula+aula+data) |
| GET | `/api/presenca/matricula/{id}` | auth | Presenças de uma matrícula |
| GET | `/api/presenca/matricula/{id}/resumo` | auth | Resumo percentual de presença |

### Aparência / White-label (`/api/marca`)

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/marca` | **público** | Identidade + tema da instalação |
| PUT | `/api/marca` | ADMIN | Nome e assinatura |
| POST | `/api/marca/logo/{PRINCIPAL\|INVERSO}` | ADMIN | Upload de logotipo (multipart) |
| DELETE | `/api/marca/logo/{variante}` | ADMIN | Remove o logotipo |
| PUT | `/api/marca/tema` | ADMIN | Paleta (14 tokens) + tipografia dos dois modos |
| DELETE | `/api/marca/tema` | ADMIN | Restaura o tema de fábrica |

O GET é público por necessidade: a tela de login exibe nome e logotipo do
cliente antes de existir sessão. Leitura cacheada (cache `marca`); toda escrita
invalida. `tema` nulo na resposta = instalação nunca customizada.

Cores são validadas contra `^#[0-9A-Fa-f]{6}$` — os valores viram custom
properties CSS no cliente, então string livre permitiria injeção de CSS.

### Upload (`/api/upload`)

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/upload/avatar` | auth | Upload de avatar do usuário logado |
| POST | `/api/upload/curso/{cursoId}` | ADMIN | Upload de imagem de curso |
| POST | `/api/upload/unidade/{unidadeId}` | ADMIN | Upload de imagem de unidade |

| POST | `/api/upload/modulo/{moduloId}/video` | ADMIN/PROFESSOR | Upload de vídeo de módulo |
| DELETE | `/api/upload/modulo/{moduloId}/video` | ADMIN/PROFESSOR | Remove o vídeo do módulo |

Imagens: JPEG, PNG, WebP. Vídeos: MP4, WebM, OGG (teto em
`app.upload.video-max-size-mb`, padrão 300 MB).
Arquivos servidos via `GET /uploads/**` (público, sem autenticação).

**SVG não é aceito** em nenhum upload de imagem: é documento capaz de carregar
script e os uploads são servidos como estáticos — seria XSS armazenado.

---

## 6. Frontend — Angular

### Rotas

| Path | Componente | Guard |
|---|---|---|
| `/` | redirect `/home` | — |
| `/home` | `HomeComponent` | — |
| `/sobre` | `SobreComponent` | — |
| `/login` | `LoginComponent` | — |
| `/unidades` | `UnidadesComponent` | — |
| `/unidades/:unidadeSlug` | `DetalheUnidadeComponent` | — |
| `/unidades/:unidadeSlug/areas/:areaSlug` | `CursosUnidadeAreaComponent` | — |
| `/unidades/:unidadeSlug/:tipoSlug` | `CursosUnidadeTipoComponent` | — |
| `/cursos` | redirect `/cursos/areas` | — |
| `/cursos/areas` | `ListaAreasComponent` | — |
| `/cursos/areas/:areaSlug` | `DetalheAreaComponent` | — |
| `/cursos/areas/:areaSlug/:categoriaSlug` | `ListaCursosCategoriaComponent` | — |
| `/cursos/tipos/:tipoSlug` | `ListaCursosTipoComponent` | — |
| `/cursos/:id` | `DetalheCursoComponent` | — |
| `/dashboard` | `DashboardComponent` | `authGuard` |
| `/matriculas` | `MinhasMatriculasComponent` | `authGuard` |
| `/aparencia` | `AparenciaComponent` | `authGuard` |
| `/admin` | redirect `/admin/dashboard` | — |
| `/admin/dashboard` | `AdminDashboardComponent` | `adminGuard` |
| `/admin/cursos` | `AdminCursosComponent` | `adminGuard` |
| `/admin/cursos/novo` | `AdminCursoFormComponent` | `adminGuard` |
| `/admin/cursos/:id/editar` | `AdminCursoFormComponent` | `adminGuard` |
| `/admin/usuarios` | `AdminUsuariosComponent` | `adminGuard` |
| `/admin/usuarios/:id/editar` | `AdminUsuarioFormComponent` | `adminGuard` |
| `/admin/regioes` | `AdminRegioesComponent` | `adminGuard` |
| `/admin/regioes/nova` | `AdminRegiaoFormComponent` | `adminGuard` |
| `/admin/regioes/:id/editar` | `AdminRegiaoFormComponent` | `adminGuard` |
| `/admin/regioes/:regiaoId/unidades/nova` | `AdminUnidadeFormComponent` | `adminGuard` |
| `/admin/regioes/:regiaoId/unidades/:unidadeId/editar` | `AdminUnidadeFormComponent` | `adminGuard` |
| `/admin/professores` | `AdminProfessoresComponent` | `adminGuard` |
| `/professor` | redirect `/professor/cursos` | — |
| `/professor/cursos` | `ProfessorCursosComponent` | `professorGuard` |

Rotas mais específicas (`novo`/`nova`) vêm antes das paramétricas de mesma
profundidade. Todo "Editar" do admin leva a **página dedicada**, nunca a
formulário embutido na listagem.
| `/**` | redirect `/home` | — |

### Services

| Service | Responsabilidade |
|---|---|
| `AuthService` | `signal<AuthResponse\|null> currentUser`, login/logout, `refreshUser()` no startup |
| `CursoService` | Todos os métodos de API: cursos, áreas, tipos, matrículas, usuários, regiões, unidades, professores, conteúdos, presença, nota |
| `UploadService` | `uploadAvatar()`, `uploadCurso()`, `uploadUnidade()`, `uploadModuloVideo()` (com progresso), `removerVideoModulo()` |
| `MarcaService` | Identidade da instalação; faz o `GET /api/marca` e repassa o tema ao `TemaService` |
| `TemaService` | Aplica paleta/tipografia como custom properties `--tema-*` no `<html>`; guarda o modo do usuário |
| `NotificacaoService` | Polling de 30s da contagem de não lidas; lista sob demanda |

### AuthService — detalhe

- `currentUser` é um `signal<AuthResponse | null>` inicializado a partir do `localStorage`.
- No constructor, chama `refreshUser()` após 100ms para sincronizar dados do servidor.
- Token em `localStorage['lms_token']`; dados do usuário em `localStorage['lms_user']`.
- `isAdmin()` e `isProfessor()` são métodos síncronos que leem o signal.
- `isProfessor()` retorna `true` também para ADMIN.

### Interceptors

- `jwtInterceptor`: injeta `Authorization: Bearer <token>` em todas as requests autenticadas.
- `errorInterceptor`: tratamento global de erros HTTP.

### Admin Dashboard

`AdminDashboardComponent` usa Chart.js 4.x com três gráficos:
- **Bar chart** — matrículas por mês (últimos 6 meses)
- **Doughnut chart** — distribuição de cursos por nível (Básico / Intermediário / Avançado)
- **Horizontal bar chart** — unidades por região

Utiliza GSAP para animações de entrada dos cards KPI. Contadores KPI (alunos, cursos, professores, matrículas) têm animação `countUp` com easing cúbico via `requestAnimationFrame`.

---

## 7. Módulo de Acessibilidade

Feature folder standalone em `src/app/accessibility/`. Estado gerenciado por `AccessibilityService` via `signal<AccessibilityState>`.

### AccessibilityState — campos

```typescript
interface AccessibilityState {
  fontLevel:       number;        // -1 | 0 | 1 | 2 | 3
  dislexia:        boolean;
  linha:           'normal' | 'media' | 'ampla';
  letra:           'normal' | 'media' | 'ampla';
  contraste:       'normal' | 'alto' | 'invertido';
  saturacao:       'normal' | 'cinza' | 'sepia';
  daltonismo:      'normal' | 'protan' | 'deuter' | 'tritan';
  cursor:          'normal' | 'grande';
  lupa:            boolean;
  linksDestacados: boolean;
  mascara:         boolean;
  guia:            boolean;
}
```

### Funcionalidades implementadas

| Funcionalidade | Implementação |
|---|---|
| **Tamanho de fonte** (5 níveis: -1 a 3) | Cache de elementos via `FONT_SELECTOR`; `data-acc-orig-fs` guarda tamanho original; escala com `!important`. MutationObserver estende o cache para nós adicionados ao DOM. |
| **Fonte para dislexia** | Carrega OpenDyslexic via CDN (jsdelivr) on demand. Classe `acc-fonte-dislexia` no body. |
| **Espaçamento de linha** | Classes `acc-linha-media` / `acc-linha-ampla` no body. |
| **Espaçamento de letras** | Classes `acc-letra-media` / `acc-letra-ampla` no body. |
| **Alto contraste** | JS percorre todos os elementos; salva cores em `data-acc-orig-*`; aplica `#fff / #000`. Restaurado ao desativar. |
| **Contraste invertido** | CSS `filter: invert(1) hue-rotate(180deg)` em `document.documentElement`. |
| **Escala de cinza** | CSS `filter: grayscale(1)` em `document.documentElement`. |
| **Sépia** | CSS `filter: sepia(0.8)` em `document.documentElement`. |
| **Daltonismo** | SVG `<feColorMatrix>` injetado no DOM; `filter: url(#acc-filter-protan\|deuter\|tritan)`. Matrizes calibradas para protanopia, deuteranopia e tritanopia. |
| **Cursor grande** | Classe `acc-cursor-grande` no body. |
| **Lupa de navegação** | Overlay posicionado via `mousemove`. Exibe texto real do elemento semântico mais próximo (não tag HTML), máx. 80 chars. Texto via `textContent` (sem XSS). |
| **Links destacados** | Classe `acc-links-destacados` no body. |
| **Máscara de leitura** | Dois overlays (top/bottom) seguem o cursor, deixando janela de 90px ao redor do `clientY`. |
| **Guia de leitura** | Linha horizontal segue o `clientY` do cursor. |
| **VLibras** | `VlibrasWidgetComponent` próprio, que carrega o script oficial do gov.br em `afterNextRender`. O pacote `angular-vlibras` foi removido: travava no peer `@angular/core ^21`. |

### Persistência

Estado serializado em `localStorage['acessibilidade_prefs']` (JSON). Carregado no `init()`. Quotas de localStorage tratadas silenciosamente (try/catch).

### Isolamento de filter CSS

`filter` sempre em `document.documentElement` (`<html>`), nunca em `document.body`. Razão: elementos `position: fixed` criados pelo Angular pertencem ao viewport stacking context e não são alcançados por `filter` no `<body>`.

### MutationObserver

Observa `{ childList: true, subtree: true }` — **nunca** `attributes: true` (causaria loop infinito ao aplicar `style.setProperty`). Buffer de `pendingNodes` com debounce de 250ms para processar mutações em batch.

### ColorManager

Analisa variáveis CSS do painel (`--acc-color-base`, `--acc-color-contrast`, etc.) e garante contraste mínimo WCAG. Converte RGB → HSL, ajusta lightness em steps de 1.5% até atingir razão mínima (7:1 para texto principal, 4.5:1 para texto secundário, 3:1 para bordas). Injeta overrides via `<style id="acc-color-patch">` no `<head>`.

---

## 8. Segurança e Autenticação

### Fluxo JWT

```
1. POST /api/auth/login → AuthController
2. DaoAuthenticationProvider valida email/senha via BCrypt
3. JwtTokenProvider.generateToken(email) → HMAC-SHA512, exp=24h
4. Response: { token, tipo, nome, email, role, avatarUrl }
5. Frontend armazena token em localStorage
6. Próximas requests: jwtInterceptor injeta Authorization: Bearer <token>
7. JwtAuthFilter extrai email do JWT → UserDetailsServiceImpl.loadUserByUsername(email)
8. Banco consultado a cada request → role sempre atual
```

### Por que roles não ficam no token

O token contém apenas `sub=email`. `JwtAuthFilter` recarrega o `Usuario` completo do banco a cada request. Isso permite alterar a role de um usuário (ex: ALUNO → PROFESSOR) sem revogar tokens — na próxima request o novo role já é aplicado.

### Endpoints públicos

- `GET /api/cursos`, `GET /api/cursos/{id}`
- `GET /api/areas/**`, `GET /api/tipos/**`
- `GET /api/regioes`, `GET /api/regioes/unidades`
- `GET /api/unidades/**`
- `GET /uploads/**`
- `POST /api/auth/**`

### CORS

Origens permitidas: `http://localhost:4200` e `http://localhost:4300`. Métodos: GET, POST, PUT, PATCH, DELETE, OPTIONS. Credenciais: habilitadas.

---

## 9. Upload de Arquivos

`UploadService` (backend) salva arquivos em `${user.home}/lms-uploads/{subpasta}/` com nome gerado por UUID. `UploadConfig` registra `ResourceHandler` para servir arquivos em `/uploads/**`.

Entidades com suporte a imagem:
- `usuarios.avatar_url` — qualquer usuário autenticado pode atualizar seu próprio avatar
- `cursos.imagem_url` — apenas ADMIN
- `unidades.imagem_url` — apenas ADMIN

A URL armazenada é absoluta (`http://localhost:8080/uploads/...`). Ao fazer novo upload, o arquivo anterior é deletado antes de salvar o novo.

---

## 10. Aparência e White-label

Tudo que muda de um cliente para outro vive na tela **Aparência** e é
persistido no servidor:

| Configuração | Onde | Quem altera |
|---|---|---|
| Nome e assinatura | `configuracao_marca` | ADMIN |
| Logotipos (fundo claro e escuro) | `configuracao_marca` + arquivo | ADMIN |
| Paleta (14 tokens) e tipografia, por modo | `configuracao_marca.tema` (jsonb) | ADMIN |
| Modo claro/escuro/sistema | `localStorage` | cada usuário |

O modo é a exceção deliberada: é conforto de leitura, não identidade da empresa.

**Como a paleta chega à tela.** `MarcaService` faz o GET e repassa o tema ao
`TemaService`, que escreve custom properties `--tema-*` inline no `<html>`. O
Tailwind consome esses tokens no `@theme`, então a aplicação inteira repinta sem
rebuild. O `localStorage` mantém um cache de primeira pintura — nunca é a fonte
da verdade.

**Edição é rascunho.** Cores mudam ao vivo na tela mas só valem para os outros
usuários após "Publicar". Isso permite experimentar uma paleta inteira sem que
todo mundo veja cada passo.

### Design system de selos

Combinar dois tokens de marca (`bg-marca-suave` + `text-marca-escura`) produz
selo ilegível em paletas onde ambos são escuros. A solução é estrutural: use
`.lms-badge` + variante (`-marca`, `-destaque`, `-sucesso`, `-erro`, `-aviso`,
`-neutro`). A cor entra só como tinta de fundo (14%) e borda (40%); o texto usa
`--tema-texto`, cuja legibilidade sobre `--tema-superficie` a tela de Aparência
valida. Cores fixas do Tailwind (`bg-purple-100`) não acompanham o tema e foram
removidas.

---

## 11. Decisões de Arquitetura

| Decisão | Justificativa |
|---|---|
| **JWT sem roles no token** | Role sempre fresca do banco; mudança de role funciona sem revogar tokens |
| **DTOs centralizados em `DTOs.java`** | Todos os records visíveis num único arquivo; factory `from()` por response |
| **Soft delete em cursos** | Preserva histórico de matrículas; `ativo=false` exclui da listagem sem deletar dados |
| **Flyway ao invés de `ddl-auto=create`** | Schema versionado e auditável; `ddl-auto=validate` garante correspondência JPA/banco |
| **Angular Signals** | Estado reativo sem Observables; `currentUser` signal permite `computed()` e templates reativos |
| **Rotas estáticas antes de dinâmicas** | `/cursos/areas` antes de `/cursos/:id` evita "areas" ser interpretado como ID |
| **`filter` CSS em `<html>` não em `<body>`** | Elementos `position: fixed` não são alcançados por `filter` no body |
| **MutationObserver só `childList`** | `attributes: true` causaria loop infinito ao aplicar `style.setProperty` |
| **PK composta com `@EmbeddedId`** | Modelo relacional correto para professor_cursos; sem surrogate key desnecessária |
| **`@Query` JPQL para `ProfessorCurso`** | Spring Data não deriva queries de `@EmbeddedId`; necessário JPQL explícito com `pc.id.professorId` |
| **UnidadeController separado de RegiaoController** | Rota `/api/unidades/{slug}` (leitura por slug) é distinta do CRUD `/api/regioes/{id}/unidades` |
| **Identidade e tema no servidor** | São configuração da instalação, não preferência de navegador: um admin define uma vez e vale para todos, inclusive para o visitante sem sessão |
| **Modo claro/escuro no `localStorage`** | É conforto de leitura, não identidade; o botão da barra precisa responder sem exigir permissão de admin |
| **`configuracao_marca` de linha única com `CHECK id = 1`** | Impede um segundo registro disputando o papel de "a marca"; a linha nasce na migration, então nunca existe estado "não configurado" |
| **Tema como `jsonb` + (de)serialização no service** | O Postgres valida a sintaxe na escrita; manter o mapeamento fora do Hibernate deixa o contrato sob controle do DTO validado |
| **Edição do admin em páginas dedicadas** | O formulário embutido espremia a capa em 192px e escondia a listagem; a página é endereçável e carrega o registro pelo id |
| **Selos com contraste estrutural** | Num produto white-label a paleta é dado do cliente; par fixo de tokens quebra em alguma paleta válida |

---

## 12. Testes

| Suíte | Comando | Cobertura |
|---|---|---|
| Backend | `cd backend && ./mvnw verify` | 94 testes de integração |
| Frontend (unit) | `cd frontend && npm test` | 73 specs (Vitest) |
| Frontend (E2E) | `cd frontend && npm run e2e` | 30 cenários (Playwright) |

**Backend** — `IntegrationTestBase` sobe um Postgres 18 real via Testcontainers
(H2 não serve: o projeto usa recursos específicos do Postgres). O container é
singleton em bloco estático, compartilhado entre subclasses; cada teste roda em
transação revertida. Helpers: `criarUsuario`, `tokenPara`, `criarCurso`,
`criarModulo`, `matricular`, `contarQueries`.

⚠️ A senha mínima em `/api/auth/register` é **8 caracteres** — testes com senhas
curtas falham na validação.

**Frontend** — Vitest com `criarMock<T>(['metodo'])` de `src/testing/mock.ts`.
Use `npm test`; `npx vitest run` falha porque a configuração vem do builder do
Angular. Componente com `routerLink` precisa de `provideRouter([])` no TestBed.

**E2E** — rodam em série (escrevem no banco compartilhado). A fixture `apoio.ts`
cria e promove um admin de teste dedicado; senha em `E2E_ADMIN_PASSWORD`
(`frontend/e2e/.env.e2e`). Cobrem navegação pública, login pela interface,
guards por role, os gráficos do dashboard sob zoneless, o widget de
acessibilidade e a aparência — inclusive a prova de que a paleta publicada por
um admin chega a um navegador sem estado local.

⚠️ Teste instável conhecido: `aparencia.spec.ts` → "a prévia mostra o hover com
a cor configurada" falha esporadicamente na execução em sequência e passa
isolado. Não é regressão.

---

## 13. Como Rodar Localmente

**Pré-requisitos:** Java 25 (Temurin), Node.js 22+, Docker Desktop

```powershell
# 1. Configurar o ambiente
cd backend
copy .env.example .env      # preencha DB_PASSWORD, JWT_SECRET, DEV_ADMIN_PASSWORD

# 2. Banco de dados
docker compose up -d        # PostgreSQL 18 na porta 5433

# 3. Backend
.\mvnw.cmd spring-boot:run   # porta 8080, profile dev

# 4. Frontend
cd ..\frontend
npm install
npx ng serve                 # porta 4200
```

Acesso: **http://localhost:4200** · Swagger: **http://localhost:8080/swagger-ui.html**

O profile `dev` cria um ADMIN no boot (`DevAdminSeeder`) a partir de
`DEV_ADMIN_EMAIL` / `DEV_ADMIN_PASSWORD` do `.env`. Ele **não** existe sob o
profile `prod`.

### Primeira configuração de um cliente

1. Entre como ADMIN e vá em **Aparência**.
2. *Identidade*: nome, assinatura e os dois logotipos (PNG/JPG/WebP até 512 KB).
3. Ajuste as cores de cada modo e clique em **Publicar cores**.

**Aplicar nova migration sem subir o servidor:**
```powershell
.\mvnw.cmd flyway:migrate `
  -Dflyway.url=jdbc:postgresql://localhost:5433/lmsdb `
  -Dflyway.user=lms `
  -Dflyway.password=lms123
```
