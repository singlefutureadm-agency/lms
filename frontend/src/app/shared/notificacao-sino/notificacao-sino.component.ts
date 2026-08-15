import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotificacaoService, Notificacao } from '../../core/services/notificacao.service';

@Component({
    selector: 'app-notificacao-sino',
    imports: [CommonModule, MatIconModule, MatBadgeModule, MatMenuModule, MatProgressSpinnerModule],
    templateUrl: './notificacao-sino.component.html',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class NotificacaoSinoComponent {
  svc = inject(NotificacaoService);

  onAbrirMenu() {
    this.svc.carregarLista();
  }

  marcarLida(notificacao: Notificacao) {
    if (notificacao.lida) return;
    this.svc.marcarComoLida(notificacao.id);
  }

  tipoIcon(tipo: string): string {
    return tipo === 'NOTA_LANCADA' ? 'grade' : 'how_to_reg';
  }
}
