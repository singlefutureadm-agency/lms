import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificacaoService, Notificacao } from './notificacao.service';
import { AuthService } from './auth.service';
import { Page } from './curso.service';
import { criarMock, Mocked } from '../../../testing/mock';

describe('NotificacaoService', () => {
  let httpSpy: Mocked<HttpClient>;
  let isLoggedIn: ReturnType<typeof signal<boolean>>;
  let service: NotificacaoService;

  beforeEach(() => {
    // O construtor agenda observarSessao() em afterNextRender (mesmo padrão do
    // AuthService.refreshUser()) — timers falsos evitam que esse agendamento
    // dispare HTTP fora do controle do teste.
    vi.useFakeTimers();

    httpSpy = criarMock<HttpClient>(['get', 'patch']);
    httpSpy.get.mockReturnValue(of({ total: 0 }));

    isLoggedIn = signal(true);
    const authStub = { isLoggedIn } as unknown as AuthService;

    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpSpy },
        { provide: AuthService, useValue: authStub }
      ]
    });

    service = TestBed.inject(NotificacaoService);
    // Zera qualquer chamada que o afterNextRender do construtor possa ter
    // agendado, para os testes partirem de um estado limpo e previsível.
    httpSpy.get.mockClear();
    httpSpy.patch.mockClear();
  });

  afterEach(() => {
    // Sem isto, um setInterval agendado (via iniciar()) num teste sobrevive ao
    // vi.useFakeTimers() do próximo, e cada advanceTimersByTime soma mais um
    // intervalo nunca parado — memória cresce sem limite entre os testes.
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** TestBed.tick() flusha o afterNextRender agendado no construtor, que cria
   *  o effect() real de observarSessao() — o mesmo caminho de produção. */
  function iniciar() {
    TestBed.tick();
  }

  it('atualizarContagem() busca a contagem e atualiza o signal', () => {
    httpSpy.get.mockReturnValue(of({ total: 5 }));

    service.atualizarContagem();

    expect(httpSpy.get).toHaveBeenCalledWith(expect.stringContaining('/notificacoes/contagem-nao-lidas'));
    expect(service.contagemNaoLidas()).toBe(5);
  });

  it('logado: inicia o polling buscando a contagem de imediato e de novo a cada 30s', () => {
    httpSpy.get.mockReturnValue(of({ total: 2 }));
    iniciar();

    expect(httpSpy.get).toHaveBeenCalledTimes(1);
    expect(service.contagemNaoLidas()).toBe(2);

    httpSpy.get.mockReturnValue(of({ total: 3 }));
    vi.advanceTimersByTime(30000);

    expect(httpSpy.get).toHaveBeenCalledTimes(2);
    expect(service.contagemNaoLidas()).toBe(3);
  });

  it('deslogado: não busca nada e mantém a contagem zerada', () => {
    isLoggedIn.set(false);
    iniciar();

    expect(httpSpy.get).not.toHaveBeenCalled();
    expect(service.contagemNaoLidas()).toBe(0);
  });

  it('para de pollar assim que o usuário desloga', () => {
    httpSpy.get.mockReturnValue(of({ total: 1 }));
    iniciar();
    expect(httpSpy.get).toHaveBeenCalledTimes(1);

    isLoggedIn.set(false);
    TestBed.tick();
    httpSpy.get.mockClear();

    vi.advanceTimersByTime(60000);

    expect(httpSpy.get).not.toHaveBeenCalled();
    expect(service.contagemNaoLidas()).toBe(0);
  });

  it('carregarLista() busca a página e popula o signal de notificações', () => {
    const notificacao: Notificacao = {
      id: 1, tipo: 'NOTA_LANCADA', mensagem: 'Nota lançada em Curso X',
      referenciaId: 9, lida: false, criadoEm: '2026-01-01T10:00:00'
    };
    const pagina: Page<Notificacao> = {
      content: [notificacao],
      page: { size: 20, number: 0, totalElements: 1, totalPages: 1 }
    };
    httpSpy.get.mockReturnValue(of(pagina));

    service.carregarLista();

    expect(httpSpy.get).toHaveBeenCalledWith(expect.stringContaining('/notificacoes'), expect.anything());
    expect(service.notificacoes()).toEqual([notificacao]);
    expect(service.carregando()).toBe(false);
  });

  it('marcarComoLida() atualiza a notificação local e decrementa a contagem não lida', () => {
    const notificacao: Notificacao = {
      id: 1, tipo: 'MATRICULA_CONFIRMADA', mensagem: 'Matrícula confirmada',
      referenciaId: 3, lida: false, criadoEm: '2026-01-01T10:00:00'
    };
    service.notificacoes.set([notificacao]);
    service.contagemNaoLidas.set(1);
    httpSpy.patch.mockReturnValue(of(undefined));

    service.marcarComoLida(1);

    expect(service.notificacoes()[0].lida).toBe(true);
    expect(service.contagemNaoLidas()).toBe(0);
  });

  it('marcarComoLida() não decrementa a contagem se a notificação já estava lida', () => {
    const notificacao: Notificacao = {
      id: 1, tipo: 'MATRICULA_CONFIRMADA', mensagem: 'Já lida',
      referenciaId: null, lida: true, criadoEm: '2026-01-01T10:00:00'
    };
    service.notificacoes.set([notificacao]);
    service.contagemNaoLidas.set(0);
    httpSpy.patch.mockReturnValue(of(undefined));

    service.marcarComoLida(1);

    expect(service.contagemNaoLidas()).toBe(0);
  });
});
