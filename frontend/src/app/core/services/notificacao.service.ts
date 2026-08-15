import { Injectable, Injector, afterNextRender, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Page } from './curso.service';

export interface Notificacao {
  id: number;
  tipo: 'NOTA_LANCADA' | 'MATRICULA_CONFIRMADA';
  mensagem: string;
  referenciaId: number | null;
  lida: boolean;
  criadoEm: string;
}

/**
 * Notificações in-app via polling — sem WebSocket, para não adicionar infra
 * nova ao projeto. A contagem (leve) é verificada a cada 30s; a lista
 * completa só é buscada quando o dropdown do sino abre.
 */
@Injectable({ providedIn: 'root' })
export class NotificacaoService {
  private static readonly POLL_INTERVAL_MS = 30000;

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private injector = inject(Injector);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  contagemNaoLidas = signal(0);
  notificacoes = signal<Notificacao[]>([]);
  carregando = signal(false);

  constructor() {
    // afterNextRender, no mesmo espírito do AuthService.refreshUser(): evita
    // disparar a primeira chamada (e a escrita no signal) no meio do ciclo de
    // verificação inicial (NG0100) sob zoneless.
    afterNextRender(() => this.observarSessao(), { injector: this.injector });
  }

  /**
   * Liga o polling à sessão: reaproveita o signal de auth já existente (não
   * duplica checagem de login). Roda como effect() para reagir tanto ao login
   * quanto ao logout, em vez de checar isLoggedIn() só uma vez no boot.
   */
  private observarSessao() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.atualizarContagem();
        this.agendarPolling();
      } else {
        this.pararPolling();
        this.contagemNaoLidas.set(0);
        this.notificacoes.set([]);
      }
    }, { injector: this.injector });
  }

  private agendarPolling() {
    this.pararPolling();
    this.intervalId = setInterval(() => this.atualizarContagem(), NotificacaoService.POLL_INTERVAL_MS);
  }

  private pararPolling() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  atualizarContagem() {
    this.http.get<{ total: number }>(`${environment.apiUrl}/notificacoes/contagem-nao-lidas`).subscribe({
      next: r => this.contagemNaoLidas.set(r.total),
      error: () => {}
    });
  }

  carregarLista(apenasNaoLidas = false) {
    this.carregando.set(true);
    let params = new HttpParams().set('page', 0).set('size', 20);
    if (apenasNaoLidas) params = params.set('apenasNaoLidas', true);
    this.http.get<Page<Notificacao>>(`${environment.apiUrl}/notificacoes`, { params }).subscribe({
      next: page => { this.notificacoes.set(page.content); this.carregando.set(false); },
      error: () => this.carregando.set(false)
    });
  }

  marcarComoLida(id: number) {
    this.http.patch<void>(`${environment.apiUrl}/notificacoes/${id}/lida`, {}).subscribe({
      next: () => {
        let eraNaoLida = false;
        this.notificacoes.update(lista => lista.map(n => {
          if (n.id === id && !n.lida) eraNaoLida = true;
          return n.id === id ? { ...n, lida: true } : n;
        }));
        if (eraNaoLida) this.contagemNaoLidas.update(c => Math.max(0, c - 1));
      }
    });
  }
}
