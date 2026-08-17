# LMS

![Java](https://img.shields.io/badge/Java-25%20LTS-ED8B00?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.0-6DB33F?logo=springboot)
![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Tailwind](https://img.shields.io/badge/Tailwind-4.3-06B6D4?logo=tailwindcss)

> Plataforma de gestão de cursos **white-label**: cada cliente configura nome,
> logotipo, cores e tipografia pela própria interface, sem rebuild e sem tocar
> em código.

---

## White-label

Tudo que muda de um cliente para outro vive numa única tela — **Aparência** — e
é persistido no servidor, valendo para todos os usuários da instalação:

| Configuração | Onde é guardada | Quem altera |
|---|---|---|
| Nome da empresa e assinatura | Servidor (`configuracao_marca`) | ADMIN |
| Logotipo (fundo claro e fundo escuro) | Servidor + arquivo em disco | ADMIN |
| Paleta (14 tokens) e tipografia, por modo | Servidor (`configuracao_marca.tema`) | ADMIN |
| Modo claro/escuro/sistema | Navegador do usuário | cada usuário |

O modo é a única exceção deliberada: é conforto de leitura, não identidade da
empresa, então continua sendo escolha de cada pessoa.

O nome e o logotipo alimentam também o título da aba e o favicon. A leitura
(`GET /api/marca`) é pública porque a tela de login já precisa exibir a marca do
cliente antes de existir sessão.

**Contraste independente da paleta.** Os selos (`.lms-badge`) usam a cor de
destaque apenas como tinta de fundo e borda; o texto usa o token de texto, cuja
legibilidade sobre a superfície é validada na própria tela de Aparência. Assim
nenhuma combinação escolhida pelo cliente produz um selo ilegível.

---

## Funcionalidades

- **Autenticação JWT** com controle de roles: ADMIN / PROFESSOR / ALUNO
- **Catálogo de cursos** organizado por área, categoria e tipo, com filtro por unidade/região
- **CRUD completo** de cursos, áreas, categorias, tipos, regiões e unidades, em
  páginas dedicadas de edição (capa em 16:9, resumo do registro e link para a
  página pública)
- **Matrículas** de alunos em cursos com rastreamento de progresso por aula
- **Lançamento de notas** com aprovação automática (≥ 6,0)
- **Controle de presença** por aula, com resumo percentual
- **Conteúdo de aulas** com suporte a vídeo, PDF, texto e link externo
- **Vídeo por módulo**: upload de arquivo ou link de YouTube/Vimeo
- **Vínculo Professor ↔ Curso** gerenciado pelo ADMIN
- **Upload de imagens** para avatar, capa de curso, foto de unidade e logotipo
- **Notificações in-app** por polling (nota lançada, matrícula confirmada)
- **Dashboard administrativo** com gráficos Chart.js e animações GSAP
- **Modo claro e escuro** com prévia interativa e aviso de contraste WCAG
- **Documentação da API** em OpenAPI/Swagger e health check via Actuator
- **Widget de acessibilidade** completo (WCAG 2.1 AA/AAA):
  - Controle de tamanho de fonte (5 níveis)
  - Fonte para dislexia (OpenDyslexic)
  - Espaçamento de linha e letras
  - Alto contraste, contraste invertido
  - Escala de cinza e sépia
  - Suporte a daltonismo (protanopia, deuteranopia, tritanopia) via SVG feColorMatrix
  - Cursor grande, lupa de navegação, links destacados
  - Máscara e guia de leitura
  - Integração com **VLibras** (tradução para Libras — gov.br)

---

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | Angular | 22 |
| UI | Tailwind CSS | 4.3 |
| Componentes | Angular Material | 22.1 (tema M3) |
| Gráficos | Chart.js | 4.5 |
| Animações | GSAP | 3.15 |
| Backend | Spring Boot | 4.1.0 |
| Linguagem | Java | 25 LTS |
| Banco | PostgreSQL | 18 |
| Migrations | Flyway | 12.4 (V1–V24) |
| Auth | JWT (jjwt) | 0.13.0 |
| Testes (back) | JUnit 6 + Testcontainers | 94 testes de integração |
| Testes (front) | Vitest · Playwright | 73 specs · 30 cenários E2E |
| Infra | Docker Compose | — |

---

## Arquitetura

```
Browser (Angular 22 SPA, zoneless)
    │
    │ HTTP/REST — Bearer JWT
    ▼
Spring Boot 4.1.0 (:8080)
    │ JPA/Hibernate + Flyway
    ▼
PostgreSQL 18 (:5433)
```

O token JWT contém apenas o `sub=email`. A cada request, o backend carrega o
usuário completo do banco, incluindo a role atual — isso permite alterar roles
sem revogar tokens.

---

## Como rodar localmente

**Pré-requisitos:** Java 25 (Temurin), Node.js 22+, Docker Desktop

```bash
# 1. Configurar o ambiente do backend
cd backend
cp .env.example .env        # preencha DB_PASSWORD e JWT_SECRET

# 2. Subir o banco (PostgreSQL no Docker)
docker compose up -d

# 3. Backend (porta 8080)
# Windows — definir JAVA_HOME se necessário:
# $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25"
./mvnw spring-boot:run

# 4. Frontend (porta 4200)
cd ../frontend
npm install
npx ng serve
```

Acesse: **http://localhost:4200**

- Documentação da API (Swagger UI): **http://localhost:8080/swagger-ui.html**
- Health check: **http://localhost:8080/actuator/health**

O profile `dev` cria um usuário ADMIN no boot (`DevAdminSeeder`) a partir de
`DEV_ADMIN_EMAIL`/`DEV_ADMIN_PASSWORD` no `.env`. Ele **não** existe sob o
profile `prod`.

### Primeira configuração de um cliente

1. Entre como ADMIN e vá em **Aparência**.
2. Em *Identidade*, defina nome e assinatura e envie os dois logotipos
   (PNG/JPG/WebP até 512KB) — o de fundo claro para o site, o de fundo escuro
   para a barra do sistema.
3. Ajuste as cores de cada modo e clique em **Publicar cores**.

---

## Estrutura do projeto

```
lms/
├── backend/          # Spring Boot 4.1.0 — API REST
│   └── src/main/java/br/com/lms/
│       ├── config/       # Security, Upload, Cache, OpenAPI
│       ├── domain/       # area, conteudo, curso, marca, matricula, notificacao,
│       │                 # presenca, professor, regiao, upload, usuario
│       │                 # (cada um com Entity + Controller + Service + Repository)
│       ├── dto/          # DTOs centralizados (DTOs.java)
│       ├── exception/    # GlobalExceptionHandler (RFC 7807)
│       └── security/     # JWT filter, provider, UserDetails
├── frontend/         # Angular 22 SPA (zoneless)
│   └── src/app/
│       ├── accessibility/  # Widget de acessibilidade standalone
│       ├── core/           # guards, interceptors, services (marca, tema, auth…)
│       ├── features/       # admin, areas, cursos, dashboard, home,
│       │                   # login, matriculas, professor, sobre, unidades
│       └── shared/         # Navbar, PublicNav, LogoMarca, CursoCard,
│                           # ImageUpload, VideoUpload, VideoEmbed, Vlibras
│   └── src/tailwind.css    # Tailwind 4: @theme e design system .lms-*
├── CLAUDE.md            # Contexto operacional: convenções, decisões e armadilhas
└── DOCUMENTACAO.md      # Referência técnica: o que existe e onde
```

**`CLAUDE.md`** é lido automaticamente por agentes de IA (Claude Code) no início
de cada sessão. Quem for trabalhar no código — pessoa ou agente — deve começar
por ele: concentra as decisões que precisam ser respeitadas e as armadilhas já
descobertas.

---

## Banco de dados

24 migrations Flyway (V1–V24) gerenciam o schema. Highlights:

- **V12**: seed de exemplo com 4 regiões, 64 unidades e 35 cursos
- **V13/V14**: slugs únicos para unidades
- **V15**: campos de imagem em usuários, cursos e unidades
- **V17**: 15 índices de chave estrangeira (o Postgres não indexa FK automaticamente)
- **V18**: busca textual em cursos
- **V19**: notificações in-app
- **V20/V21**: vídeo por módulo (arquivo ou link externo)
- **V22**: `configuracao_marca` — identidade da instalação (linha única)
- **V23**: coluna `tema` (jsonb) — paleta e tipografia da instalação
- **V24**: remove a marca do cliente original dos dados de exemplo

---

## Testes

```bash
# Backend — testes de integração contra Postgres real (Testcontainers)
cd backend && ./mvnw verify

# Frontend — testes unitários (Vitest, jsdom)
cd frontend && npm test

# Frontend — cenários end-to-end (Playwright)
# exige o backend em :8080; o servidor do Angular sobe sozinho
cd frontend && npm run e2e
```

Os E2E cobrem navegação pública, login pela interface, guards por role, o
dashboard admin (os 3 gráficos Chart.js montando sob zoneless), o widget de
acessibilidade e a configuração de aparência — inclusive a prova de que a
paleta publicada por um admin chega a um navegador sem nenhum estado local.

Os cenários de permissão criam usuários de verdade via API — forjar a role no
`localStorage` não funciona, porque o `AuthService` revalida em
`/api/usuarios/me` e o backend é a fonte da verdade.
