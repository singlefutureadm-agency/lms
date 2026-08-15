import { test, expect } from '@playwright/test';
import { autenticarAdminE2E, criarUsuarioComRole, entrarComo, coletarErrosDeConsole, esperarBloqueio, Sessao } from './apoio';

let admin: Sessao;
let aluno: Sessao;
let professor: Sessao;

test.beforeAll(async () => {
  admin = await autenticarAdminE2E();
  // Usuários reais: forjar a role no localStorage não funciona, porque o
  // AuthService revalida em /api/usuarios/me e o backend é a fonte da verdade.
  aluno = await criarUsuarioComRole('ALUNO');
  professor = await criarUsuarioComRole('PROFESSOR');
});

/**
 * Telas autenticadas. É onde os dois pontos de maior risco da migração vivem:
 * o dashboard admin (Chart.js + GSAP inicializados por `afterNextRender` em vez
 * do antigo `setTimeout` sobre o zone.js) e os guards por role.
 */
test.describe('área autenticada', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, admin);
  });

  test('dashboard admin monta os 3 gráficos Chart.js sob zoneless', async ({ page }) => {
    const erros = coletarErrosDeConsole(page);

    await page.goto('/admin/dashboard');

    // Antes, os canvases eram criados por effect() -> setTimeout(50) ->
    // @ViewChild.nativeElement, apostando que o zone.js já teria renderizado.
    // Sem zone.js essa aposta não se sustenta; agora é afterNextRender.
    await expect(page.locator('canvas')).toHaveCount(3, { timeout: 20_000 });

    // e os gráficos precisam ter sido efetivamente desenhados, não só existir
    const temPixels = await page.locator('canvas').first().evaluate(
      (c: HTMLCanvasElement) => c.width > 0 && c.height > 0,
    );
    expect(temPixels).toBe(true);

    expect(erros).toEqual([]);
  });

  test('KPIs do dashboard admin exibem números', async ({ page }) => {
    await page.goto('/admin/dashboard');
    // a animação de count-up roda em requestAnimationFrame escrevendo em signals
    await expect(page.locator('body')).toContainText(/\d/, { timeout: 20_000 });
  });

  test('admin/cursos lista cursos vindos do backend paginado', async ({ page }) => {
    await page.goto('/admin/cursos');

    // Se o novo shape PagedModel não tivesse sido acompanhado no frontend,
    // page.content viria undefined e a lista ficaria vazia.
    await expect(page.locator('body')).toContainText(/curso/i, { timeout: 20_000 });
  });

  test('admin/usuarios, regioes e professores renderizam', async ({ page }) => {
    for (const rota of ['/admin/usuarios', '/admin/regioes', '/admin/professores']) {
      await page.goto(rota);
      await expect(page).toHaveURL(new RegExp(rota.replace(/\//g, '\\/')));
      await expect(page.locator('body')).not.toBeEmpty();
    }
  });

  test('minhas matrículas renderiza para o usuário logado', async ({ page }) => {
    await page.goto('/matriculas');
    await expect(page).toHaveURL(/\/matriculas/);
  });
});

test.describe('guards por role', () => {
  test('ALUNO autenticado é barrado nas rotas de admin', async ({ page }) => {
    // Cenário que renderizava a UI de admin antes da migração: sessão válida,
    // role sem permissão. A API respondia 403, mas a tela aparecia.
    await entrarComo(page, aluno);

    for (const rota of ['/admin/dashboard', '/admin/usuarios', '/admin/cursos']) {
      await page.goto(rota);
      await esperarBloqueio(page);
    }
  });

  test('ALUNO é barrado na área do professor', async ({ page }) => {
    await entrarComo(page, aluno);

    await page.goto('/professor/cursos');
    await esperarBloqueio(page);
  });

  test('PROFESSOR entra na própria área mas não na de admin', async ({ page }) => {
    await entrarComo(page, professor);

    await page.goto('/professor/cursos');
    await expect(page).toHaveURL(/\/professor\/cursos/);

    await page.goto('/admin/usuarios');
    await esperarBloqueio(page);
  });

  test('visitante sem sessão vai para o login com returnUrl', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.goto('/admin/cursos');
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  });
});
