import { test, expect } from '@playwright/test';
import { coletarErrosDeConsole, autenticarAdminE2E, E2E_ADMIN } from './apoio';

/**
 * Navegação pública: as telas que qualquer visitante alcança sem login.
 *
 * Estas rotas exercitam o catálogo inteiro (Área → Categoria, Tipo, Unidade),
 * que é onde a mudança de EAGER para LAZY e o novo shape de paginação
 * apareceriam.
 */
test.describe('navegação pública', () => {
  test('home carrega com conteúdo e estilo aplicado', async ({ page }) => {
    const erros = coletarErrosDeConsole(page);

    await page.goto('/home');
    // O host <app-public-nav> não tem caixa própria, então toBeVisible() nele
    // falha mesmo com o menu renderizado. A asserção é no conteúdo.
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

    // Uma utility do Tailwind precisa ter virado CSS de verdade. Se a varredura
    // de conteúdo falhar (o modo como o v4 quebrou em silêncio), a classe fica
    // no HTML mas sem regra correspondente, e o padding sai zerado.
    const comPadding = page.locator('.pt-16').first();
    await expect(comPadding).toBeAttached({ timeout: 15_000 });
    const paddingTop = await comPadding.evaluate(el => getComputedStyle(el).paddingTop);
    expect(paddingTop).toBe('64px'); // pt-16 = 4rem

    expect(erros).toEqual([]);
  });

  test('catálogo por área lista as áreas do seed', async ({ page }) => {
    await page.goto('/cursos/areas');
    await expect(page.locator('body')).toContainText(/Tecnologia da Informação/i);
  });

  test('unidades lista as regiões e permite abrir uma unidade', async ({ page }) => {
    await page.goto('/unidades');
    await expect(page.locator('body')).toContainText(/unidade/i);

    await page.goto('/unidades/santo-amaro');
    await expect(page.locator('body')).not.toContainText(/não encontrado/i);
  });

  test('sobre e login renderizam', async ({ page }) => {
    await page.goto('/sobre');
    await expect(page.locator('body')).not.toBeEmpty();

    await page.goto('/login');
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('rota inexistente cai no redirect para home', async ({ page }) => {
    await page.goto('/rota-que-nao-existe');
    await expect(page).toHaveURL(/\/home$/);
  });
});

test.describe('autenticação pela interface', () => {
  test.beforeAll(async () => {
    // Garante que o admin de teste exista antes do login pela UI — este describe
    // não depende da ordem de execução de autenticado.spec.ts.
    await autenticarAdminE2E();
  });

  test('login com credenciais válidas leva ao dashboard, sem erro de console', async ({ page }) => {
    const erros = coletarErrosDeConsole(page);

    await page.goto('/login');

    await page.getByRole('textbox').first().fill(E2E_ADMIN.email);
    await page.locator('input[type="password"]').first().fill(E2E_ADMIN.senha);
    await page.locator('form').first().locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/(dashboard|admin\/dashboard)/, { timeout: 15_000 });

    // A troca de layout da raiz (público -> logado) já disparou NG0100:
    // isLoggedIn() lia o localStorage direto, e o token era gravado num
    // microtask entre a verificação e o checkNoChanges. Agora deriva do signal.
    expect(erros.filter(e => e.includes('NG0100'))).toEqual([]);
  });

  test('credenciais inválidas mostram a mensagem vinda do ProblemDetail', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox').first().fill(E2E_ADMIN.email);
    await page.locator('input[type="password"]').first().fill('senha-errada');
    await page.locator('form').first().locator('button[type="submit"]').click();

    // O backend responde 401 em application/problem+json; a tela precisa
    // continuar mostrando algo ao usuário, e não ficar em silêncio.
    await expect(page.locator('body')).toContainText(/inválid|incorret|erro/i, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
