import { Page, expect } from '@playwright/test';
import { Client } from 'pg';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const API = 'http://localhost:8080/api';

/**
 * Lê pares KEY=value de um arquivo .env simples (mesmo formato do backend/.env),
 * sem depender de nenhuma lib de dotenv. Arquivo ausente não é erro — só
 * significa que aquelas variáveis precisam vir de outro lugar (process.env).
 */
function lerArquivoEnv(caminhoRelativo: string): Record<string, string> {
  const caminho = path.resolve(__dirname, caminhoRelativo);
  if (!fs.existsSync(caminho)) return {};
  const vars: Record<string, string> = {};
  for (const linha of fs.readFileSync(caminho, 'utf-8').split('\n')) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i === -1) continue;
    vars[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  return vars;
}

// process.env (shell/CI) tem prioridade; os arquivos só preenchem o que faltar.
// backend/.env é reaproveitado para as credenciais do Postgres (o e2e sobe
// contra o mesmo banco que o backend local usa); .env.e2e é específico dos
// testes — ver frontend/e2e/README.md.
const envArquivos: Record<string, string> = {
  ...lerArquivoEnv('../../backend/.env'),
  ...lerArquivoEnv('.env.e2e'),
};

function env(nome: string): string | undefined {
  return process.env[nome] ?? envArquivos[nome];
}

/**
 * Usuário ADMIN dedicado aos testes E2E — nunca o usuário pessoal usado no dia
 * a dia. A senha vem de E2E_ADMIN_PASSWORD; o valor abaixo só existe para os
 * testes rodarem sem configurar nada em ambiente local de dev, e não deve ser
 * o que protege nenhum ambiente real (CI deve sempre setar a variável).
 */
export const E2E_ADMIN = {
  email: env('E2E_ADMIN_EMAIL') ?? 'e2e.admin@lms.local',
  senha: env('E2E_ADMIN_PASSWORD') ?? 'e2e_somente_dev_local_9f3a1c',
};

export interface Sessao {
  token: string;
  nome: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

async function api(caminho: string, init: RequestInit = {}) {
  return fetch(`${API}${caminho}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function tentarLogin(email: string, senha: string): Promise<Sessao | null> {
  const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
  return r.ok ? r.json() : null;
}

/** Autentica direto na API — o formulário de login tem teste próprio. */
export async function autenticar(email: string, senha: string): Promise<Sessao> {
  const sessao = await tentarLogin(email, senha);
  if (!sessao) throw new Error(`Login falhou para ${email}. A conta existe no banco?`);
  return sessao;
}

/**
 * Promove um usuário a ADMIN via SQL direto no banco de teste.
 *
 * PATCH /api/usuarios/{id}/role exige um ADMIN já autenticado (ver
 * SecurityConfig), então não há caminho via API para o primeiro admin de teste
 * se auto-promover. O Postgres do docker-compose já fica exposto para o
 * backend local, então uma conexão direta é a alternativa que menos
 * infraestrutura nova exige — ver frontend/e2e/README.md.
 */
async function promoverParaAdmin(email: string): Promise<void> {
  const senhaBanco = env('DB_PASSWORD');
  if (!senhaBanco) {
    throw new Error(
      'DB_PASSWORD não encontrado (nem em process.env, nem em backend/.env). ' +
        'É necessário para promover o admin de teste direto no banco — ver frontend/e2e/README.md.',
    );
  }

  const client = new Client({
    host: env('E2E_DB_HOST') ?? 'localhost',
    port: Number(env('E2E_DB_PORT') ?? 5433),
    database: env('E2E_DB_NAME') ?? 'lmsdb',
    user: env('DB_USERNAME') ?? 'lms',
    password: senhaBanco,
  });
  await client.connect();
  try {
    await client.query('UPDATE usuarios SET role = $1 WHERE email = $2', ['ADMIN', email]);
  } finally {
    await client.end();
  }
}

/**
 * Garante a sessão do admin dedicado aos testes E2E, criando-o (e promovendo)
 * se ainda não existir. Idempotente: rodar de novo, numa outra máquina ou no
 * CI, não falha por "usuário já existe" nem deixa duplicata — a segunda rodada
 * só encontra o usuário já pronto no primeiro tentarLogin.
 */
export async function autenticarAdminE2E(): Promise<Sessao> {
  const existente = await tentarLogin(E2E_ADMIN.email, E2E_ADMIN.senha);
  if (existente) return existente;

  const registro = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nome: 'E2E Admin', email: E2E_ADMIN.email, senha: E2E_ADMIN.senha }),
  });
  // 409 = "Email já cadastrado": uma rodada anterior parou entre o registro e a
  // promoção. Qualquer outra falha aqui é inesperada.
  if (!registro.ok && registro.status !== 409) {
    throw new Error(`Falha ao registrar o admin de teste ${E2E_ADMIN.email}: ${registro.status}`);
  }

  await promoverParaAdmin(E2E_ADMIN.email);

  const sessao = await tentarLogin(E2E_ADMIN.email, E2E_ADMIN.senha);
  if (!sessao) {
    throw new Error(
      `O admin de teste ${E2E_ADMIN.email} existe no banco mas o login falhou após a promoção — ` +
        'a senha em E2E_ADMIN_PASSWORD bate com a de um usuário já existente de uma rodada anterior?',
    );
  }
  return sessao;
}

/**
 * Cria um usuário com a role pedida e devolve a sessão dele.
 *
 * Forjar a role no localStorage não funciona — e isso é o app se comportando
 * corretamente: o `AuthService` revalida o usuário em `/api/usuarios/me` logo
 * após o boot, e o backend é a fonte da verdade. Então os cenários de
 * permissão precisam de usuários de verdade.
 */
export async function criarUsuarioComRole(role: 'ALUNO' | 'PROFESSOR' | 'ADMIN'): Promise<Sessao> {
  const admin = await autenticarAdminE2E();
  const email = `e2e.${role.toLowerCase()}.${Date.now()}@lms.com`;
  const senha = 'senha12345';

  const criado = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ nome: `E2E ${role}`, email, senha }),
  });
  if (!criado.ok) throw new Error(`Falha ao registrar ${email}: ${criado.status}`);
  const usuario = await criado.json();

  if (role !== 'ALUNO') {
    const promovido = await api(`/usuarios/${usuario.id}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}` },
      body: JSON.stringify({ role }),
    });
    if (!promovido.ok) throw new Error(`Falha ao promover para ${role}: ${promovido.status}`);
  }

  return autenticar(email, senha);
}

/** Injeta a sessão do mesmo jeito que o AuthService faz após o login. */
export async function entrarComo(page: Page, sessao: Sessao) {
  await page.goto('/');
  await page.evaluate(s => {
    localStorage.setItem('lms_token', s.token);
    localStorage.setItem('lms_user', JSON.stringify(s));
  }, sessao);
}

/** Acumula erros de console e de página para asserção no fim do teste. */
export function coletarErrosDeConsole(page: Page): string[] {
  const erros: string[] = [];
  page.on('console', m => {
    if (m.type() === 'error') erros.push(m.text());
  });
  page.on('pageerror', e => erros.push(String(e)));
  return erros;
}

/** O guard manda para /dashboard, que não pode ser confundido com /admin/dashboard. */
export async function esperarBloqueio(page: Page) {
  await expect(page).toHaveURL(/localhost:4200\/dashboard$/, { timeout: 15_000 });
}
