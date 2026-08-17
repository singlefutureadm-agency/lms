import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { CursoService, Regiao, Unidade } from '../../../core/services/curso.service';

/**
 * Listagem de regiões e suas unidades.
 *
 * Criar/editar região e unidade acontecem em páginas próprias
 * (AdminRegiaoFormComponent e AdminUnidadeFormComponent) — este componente só
 * lista e exclui. Os formulários abriam dentro do accordion, onde a foto da
 * unidade ficava numa faixa estreita.
 */
@Component({
    selector: 'app-admin-regioes',
    imports: [RouterLink, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule, MatExpansionModule],
    templateUrl: './admin-regioes.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./admin-regioes.component.scss']
})
export class AdminRegioesComponent implements OnInit {
  private svc = inject(CursoService);
  private snack = inject(MatSnackBar);

  regioes = signal<Regiao[]>([]);
  unidadesPorRegiao = signal<Record<number, Unidade[]>>({});
  loading = signal(true);

  ngOnInit() { this.carregar(); }

  carregar() {
    this.loading.set(true);
    this.svc.listarRegioes().subscribe({
      next: data => {
        this.regioes.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  carregarUnidades(regiaoId: number) {
    this.svc.listarUnidades(regiaoId).subscribe({
      next: data => this.unidadesPorRegiao.update(m => ({ ...m, [regiaoId]: data }))
    });
  }

  deletarRegiao(regiao: Regiao) {
    if (!confirm(`Excluir a região "${regiao.nome}" e todas as suas unidades?`)) return;
    this.svc.deletarRegiao(regiao.id).subscribe({
      next: () => {
        this.snack.open('Região excluída!', 'OK', { duration: 3000 });
        this.carregar();
      },
      error: () => this.snack.open('Erro ao excluir região', 'Fechar', { duration: 3000 })
    });
  }

  deletarUnidade(regiaoId: number, unidade: Unidade) {
    if (!confirm(`Excluir a unidade "${unidade.nome}"?`)) return;
    this.svc.deletarUnidade(regiaoId, unidade.id).subscribe({
      next: () => {
        this.snack.open('Unidade excluída!', 'OK', { duration: 3000 });
        this.carregarUnidades(regiaoId);
        this.carregar();
      },
      error: () => this.snack.open('Erro ao excluir unidade', 'Fechar', { duration: 3000 })
    });
  }

  getUnidades(regiaoId: number): Unidade[] {
    return this.unidadesPorRegiao()[regiaoId] || [];
  }

  trackById = (_: number, item: { id: number }) => item.id;
}
