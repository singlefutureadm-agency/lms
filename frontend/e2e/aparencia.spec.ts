import { test, expect } from '@playwright/test';
import { autenticarAdminE2E, entrarComo, coletarErrosDeConsole, Sessao } from './apoio';

let sessao: Sessao;

test.beforeAll(async () => {
  sessao = await autenticarAdminE2E();
});

/**
 * Página de Aparência e o sistema de temas.
 *
 * O que estes cenários realmente protegem é a cadeia inteira: a página escreve
 * no TemaService, que escreve custom properties no <html>, que o Tailwind
 * consome nos tokens. Se qualquer elo quebrar, a interface perde a cor sem
 * nenhum erro aparecer.
 */
test.describe('aparência e temas', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComo(page, sessao);
    await page.evaluate(() => localStorage.removeItem('lms_tema'));
  });

  test('a página abre e mostra os controles de cor e tipografia', async ({ page }) => {
    const erros = coletarErrosDeConsole(page);

    await page.goto('/aparencia');

    await expect(page.getByRole('heading', { name: 'Aparência' })).toBeVisible();
    // 14 tokens de cor, cada um com seu seletor
    await expect(page.locator('input[type="color"]')).toHaveCount(14);
    await expect(page.locator('#fonte-titulo')).toBeVisible();
    await expect(page.locator('#escala')).toBeVisible();

    expect(erros).toEqual([]);
  });

  test('alternar o modo repinta a aplicação e persiste', async ({ page }) => {
    await page.goto('/aparencia');

    await page.getByRole('button', { name: 'Escuro', exact: true }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    const fundoEscuro = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--tema-fundo').trim());

    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');

    const fundoClaro = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--tema-fundo').trim());
    expect(fundoClaro).not.toBe(fundoEscuro);

    // sobrevive ao reload
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'claro');
  });

  test('mudar uma cor repinta a interface na hora', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();

    // primeiro seletor = token "marca"
    await page.locator('input[type="color"]').first().evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '#0a7d3f');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect
      .poll(() => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--tema-marca').trim()))
      .toBe('#0a7d3f');

    // enquanto não publicada, a mudança é rascunho: o botão de publicar fica
    // habilitado e o aviso aparece
    await expect(page.getByRole('button', { name: /Publicar cores/ })).toBeEnabled();
    await expect(page.getByText('Rascunho não publicado.')).toBeVisible();
  });

  test('publicar as cores grava no servidor e vale para uma sessão nova', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();

    await page.locator('input[type="color"]').first().evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '#0a7d3f');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.getByRole('button', { name: /Publicar cores/ }).click();
    await expect(page.getByText('Rascunho não publicado.')).toBeHidden();

    // O ponto do recurso: a paleta é da INSTALAÇÃO. Um navegador sem nenhum
    // estado local — e sem sessão — tem de receber a mesma cor.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await expect
      .poll(() => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--tema-marca').trim()))
      .toBe('#0a7d3f');

    // devolve a instalação ao padrão para não vazar estado entre cenários
    await entrarComo(page, sessao);
    await page.goto('/aparencia');
    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: /Restaurar de fábrica na instalação/ }).click();
    await expect
      .poll(() => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--tema-marca').trim()))
      .toBe('#2563eb');
  });

  test('o modo escuro chega às telas do sistema, não só à página de Aparência', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Escuro', exact: true }).first().click();

    await page.goto('/admin/cursos');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'escuro');

    // A superfície dos cartões precisa ser escura de verdade. Se a migração para
    // tokens regredir, isto volta a ser branco.
    const luminancia = await page.locator('.bg-superficie').first().evaluate(el => {
      const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g)!.map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    });
    expect(luminancia).toBeLessThan(0.3);
  });

  test('voltar ao padrão nos dois modos repinta o rascunho', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();
    await page.locator('input[type="color"]').first().evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '#ff00ff');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Padrão nos dois modos/ }).click();

    // Restaurar mexe só no rascunho local — nada foi publicado, então basta a
    // custom property voltar ao padrão de fábrica.
    await expect
      .poll(() => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--tema-marca').trim()))
      .toBe('#2563eb');
  });

  test('a prévia mostra o hover com a cor configurada', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();

    const botao = page.locator('.pv-btn-marca');

    // A prévia fica abaixo da dobra desde que a seção de Identidade entrou na
    // página, então `hover()` precisa rolar até ela. Sem trazer o elemento para
    // a viewport ANTES de medir o repouso — e sem tirar o ponteiro de onde o
    // clique anterior o deixou — as duas leituras podiam sair do mesmo estado
    // e o teste falhava de forma intermitente.
    await botao.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const repouso = await botao.evaluate(el => getComputedStyle(el).backgroundColor);

    await botao.hover();
    await expect
      .poll(() => botao.evaluate(el => getComputedStyle(el).backgroundColor))
      .not.toBe(repouso);

    // e o hover segue a cor que o usuário definir para "marca escura"
    await page.locator('input[type="color"]').nth(1).evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '#e91e63');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await botao.hover();
    await expect
      .poll(() => botao.evaluate(el => getComputedStyle(el).backgroundColor))
      .toBe('rgb(233, 30, 99)');
  });

  test('a prévia mostra o estado de foco do campo', async ({ page }) => {
    await page.goto('/aparencia');

    const campo = page.locator('.pv-input');
    const semFoco = await campo.evaluate(el => getComputedStyle(el).borderColor);

    await campo.click();
    await expect
      .poll(() => campo.evaluate(el => getComputedStyle(el).borderColor))
      .not.toBe(semFoco);
  });

  test('não há mais exportar/importar tema', async ({ page }) => {
    await page.goto('/aparencia');

    await expect(page.getByRole('button', { name: /Exportar/ })).toHaveCount(0);
    await expect(page.getByText(/Importar tema/)).toHaveCount(0);
    // as ações que continuam (renomeadas quando a paleta virou config da
    // instalação: "restaurar" agora mexe no rascunho, "publicar" é que vale
    // para todos)
    await expect(page.getByRole('button', { name: /Padrão nos dois modos/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Publicar cores/ })).toBeVisible();
  });

  test('os gráficos do dashboard acompanham a troca de tema', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();

    await page.goto('/admin/dashboard');
    await expect(page.locator('canvas')).toHaveCount(3, { timeout: 20_000 });

    // O Chart.js pinta em canvas e resolve cor na criação: se não fosse
    // recriado na troca de tema, o gráfico ficaria com as cores do modo claro.
    const claroPx = await page.locator('canvas').first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().length);

    await page.getByRole('button', { name: /Mudar para o modo/ }).click();
    await page.waitForTimeout(2500);

    const escuroPx = await page.locator('canvas').first()
      .evaluate((c: HTMLCanvasElement) => c.toDataURL().length);

    expect(escuroPx).not.toBe(claroPx);
  });

  test('o botão da barra superior alterna o modo de qualquer tela', async ({ page }) => {
    await page.goto('/dashboard');

    const antes = await page.getAttribute('html', 'data-tema');
    await page.getByRole('button', { name: /Mudar para o modo/ }).click();
    const depois = await page.getAttribute('html', 'data-tema');

    expect(depois).not.toBe(antes);
  });
});
