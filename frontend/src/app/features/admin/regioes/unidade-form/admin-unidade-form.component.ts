import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CursoService, Regiao, Unidade } from '../../../../core/services/curso.service';
import { UploadService } from '../../../../core/services/upload.service';
import { ImageUploadComponent } from '../../../../shared/image-upload/image-upload.component';
import { mensagemDeErro } from '../../../../core/interceptors/error.interceptor';

/**
 * Página dedicada de criação/edição de unidade
 * (`/admin/regioes/:regiaoId/unidades/nova` e `.../:unidadeId/editar`).
 *
 * A foto aparece em 16:9, e não mais na faixa de 192px espremida dentro do
 * accordion da listagem. O backend não expõe busca de unidade por id — só por
 * slug, e o slug é derivado do nome, então mudaria junto com ele; o registro é
 * localizado na lista de unidades da região.
 */
@Component({
    selector: 'app-admin-unidade-form',
    imports: [RouterLink, ReactiveFormsModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule, ImageUploadComponent],
    templateUrl: './admin-unidade-form.component.html',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class AdminUnidadeFormComponent implements OnInit {
  private svc = inject(CursoService);
  private uploadSvc = inject(UploadService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  regiaoId = signal<number>(0);
  regiao = signal<Regiao | null>(null);
  unidadeId = signal<number | null>(null);
  unidade = signal<Unidade | null>(null);
  carregando = signal(true);
  naoEncontrada = signal(false);
  salvando = signal(false);
  uploadandoImagem = signal(false);
  imagemSelecionada = signal<File | null>(null);

  ehEdicao = computed(() => this.unidadeId() !== null);

  form = this.fb.group({
    nome: ['', Validators.required],
    endereco: ['']
  });

  ngOnInit() {
    const regiaoId = Number(this.route.snapshot.paramMap.get('regiaoId'));
    this.regiaoId.set(regiaoId);

    this.svc.buscarRegiao(regiaoId).subscribe({
      next: r => this.regiao.set(r),
      error: err => console.error('Erro ao carregar região:', err)
    });

    const unidadeIdParam = this.route.snapshot.paramMap.get('unidadeId');
    if (!unidadeIdParam) {
      this.carregando.set(false);
      return;
    }
    const unidadeId = Number(unidadeIdParam);
    this.unidadeId.set(unidadeId);

    this.svc.listarUnidades(regiaoId).subscribe({
      next: lista => {
        const encontrada = lista.find(u => u.id === unidadeId) ?? null;
        if (!encontrada) {
          this.naoEncontrada.set(true);
        } else {
          this.unidade.set(encontrada);
          this.form.setValue({ nome: encontrada.nome, endereco: encontrada.endereco || '' });
        }
        this.carregando.set(false);
      },
      error: () => { this.naoEncontrada.set(true); this.carregando.set(false); }
    });
  }

  voltar() {
    this.router.navigate(['/admin/regioes']);
  }

  onImagemSelected(file: File) { this.imagemSelecionada.set(file); }

  salvar() {
    if (this.form.invalid) return;
    this.salvando.set(true);
    const regiaoId = this.regiaoId();
    const data = { nome: this.form.value.nome!, endereco: this.form.value.endereco || '' };
    const id = this.unidadeId();

    const obs = id
      ? this.svc.atualizarUnidade(regiaoId, id, data)
      : this.svc.criarUnidade(regiaoId, data);

    obs.subscribe({
      next: (unidade: Unidade) => {
        this.salvando.set(false);
        this.snack.open(id ? 'Unidade atualizada!' : 'Unidade criada!', 'OK', { duration: 3000 });

        const imagem = this.imagemSelecionada();
        if (!imagem) { this.voltar(); return; }

        // A foto vai num endpoint próprio (multipart), depois do PUT/POST de
        // JSON — numa unidade nova só existe id para enviar a foto aqui.
        this.uploadandoImagem.set(true);
        this.uploadSvc.uploadUnidade(unidade.id, imagem).subscribe({
          next: () => { this.uploadandoImagem.set(false); this.voltar(); },
          error: () => {
            this.uploadandoImagem.set(false);
            this.snack.open('Unidade salva, mas houve erro ao enviar a foto', 'Fechar', { duration: 4000 });
            this.voltar();
          }
        });
      },
      error: (e: any) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao salvar unidade'), 'Fechar', { duration: 3000 });
        this.salvando.set(false);
      }
    });
  }
}
