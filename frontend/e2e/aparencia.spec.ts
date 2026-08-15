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

    // e a escolha foi persistida
    const salvo = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('lms_tema')!).claro.cores.marca);
    expect(salvo).toBe('#0a7d3f');
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

  test('restaurar tudo volta ao padrão', async ({ page }) => {
    await page.goto('/aparencia');
    await page.locator('input[type="color"]').first().evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '#ff00ff');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await page.getByRole('button', { name: /Restaurar tudo/ }).click();

    const marca = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('lms_tema')!).claro.cores.marca);
    expect(marca.toLowerCase()).toBe('#0054a6');
  });

  test('a prévia mostra o hover com a cor configurada', async ({ page }) => {
    await page.goto('/aparencia');
    await page.getByRole('button', { name: 'Claro', exact: true }).first().click();

    const botao = page.locator('.pv-btn-marca');
    const repouso = await botao.evaluate(el => getComputedStyle(el).backgroundColor);

    await botao.hover();
    const comHover = await botao.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(comHover).not.toBe(repouso);

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
    // as ações que continuam
    await expect(page.getByRole('button', { name: /Restaurar tudo/ })).toBeVisible();
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
