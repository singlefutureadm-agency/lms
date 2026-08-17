import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CursoService, Regiao, Unidade } from '../../../../core/services/curso.service';
import { mensagemDeErro } from '../../../../core/interceptors/error.interceptor';

/**
 * Página dedicada de criação/edição de região (`/admin/regioes/nova` e
 * `/admin/regioes/:id/editar`).
 *
 * Além do nome — único campo editável — a página lista as unidades da região,
 * cada uma com link para a própria página de edição. Antes isso só existia
 * dentro do accordion da listagem, com o formulário abrindo por cima.
 */
@Component({
    selector: 'app-admin-regiao-form',
    imports: [RouterLink, ReactiveFormsModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule],
    templateUrl: './admin-regiao-form.component.html',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class AdminRegiaoFormComponent implements OnInit {
  private svc = inject(CursoService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  regiaoId = signal<number | null>(null);
  regiao = signal<Regiao | null>(null);
  unidades = signal<Unidade[]>([]);
  carregando = signal(true);
  naoEncontrada = signal(false);
  salvando = signal(false);

  ehEdicao = computed(() => this.regiaoId() !== null);

  form = this.fb.group({ nome: ['', Validators.required] });

  ngOnInit() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.carregando.set(false);
      return;
    }
    const id = Number(idParam);
    this.regiaoId.set(id);

    this.svc.buscarRegiao(id).subscribe({
      next: regiao => {
        this.regiao.set(regiao);
        this.form.setValue({ nome: regiao.nome });
        this.carregando.set(false);
      },
      error: () => { this.naoEncontrada.set(true); this.carregando.set(false); }
    });
    this.svc.listarUnidades(id).subscribe({
      next: data => this.unidades.set(data),
      error: err => console.error('Erro ao carregar unidades da região:', err)
    });
  }

  voltar() {
    this.router.navigate(['/admin/regioes']);
  }

  salvar() {
    if (this.form.invalid) return;
    this.salvando.set(true);
    const nome = this.form.value.nome!;
    const id = this.regiaoId();

    const obs = id ? this.svc.atualizarRegiao(id, nome) : this.svc.criarRegiao(nome);

    obs.subscribe({
      next: () => {
        this.salvando.set(false);
        this.snack.open(id ? 'Região atualizada!' : 'Região criada!', 'OK', { duration: 3000 });
        this.voltar();
      },
      error: (e: any) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao salvar região'), 'Fechar', { duration: 3000 });
        this.salvando.set(false);
      }
    });
  }

  excluirUnidade(unidade: Unidade) {
    const id = this.regiaoId();
    if (id == null) return;
    if (!confirm(`Excluir a unidade "${unidade.nome}"?`)) return;
    this.svc.deletarUnidade(id, unidade.id).subscribe({
      next: () => {
        this.unidades.update(lista => lista.filter(u => u.id !== unidade.id));
        this.snack.open('Unidade excluída!', 'OK', { duration: 3000 });
      },
      error: () => this.snack.open('Erro ao excluir unidade', 'Fechar', { duration: 3000 })
    });
  }
}
