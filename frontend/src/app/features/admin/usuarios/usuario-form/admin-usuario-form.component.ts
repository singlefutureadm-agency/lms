import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CursoService, Unidade, UsuarioResponse } from '../../../../core/services/curso.service';
import { ImageUploadComponent } from '../../../../shared/image-upload/image-upload.component';
import { mensagemDeErro } from '../../../../core/interceptors/error.interceptor';

/**
 * Página dedicada de edição de usuário (`/admin/usuarios/:id/editar`).
 *
 * Substitui o painel que abria dentro do card na listagem. Como o backend não
 * expõe `GET /api/usuarios/{id}`, o registro é localizado na listagem completa
 * (a mesma que a tela de gerenciamento já carrega, sem paginação).
 */
@Component({
    selector: 'app-admin-usuario-form',
    imports: [RouterLink, FormsModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, ImageUploadComponent],
    templateUrl: './admin-usuario-form.component.html',
    changeDetection: ChangeDetectionStrategy.Eager
})
export class AdminUsuarioFormComponent implements OnInit {
  private svc = inject(CursoService);
  private snack = inject(MatSnackBar);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly backendBase = 'http://localhost:8080';
  readonly roles = ['ADMIN', 'PROFESSOR', 'ALUNO'];

  usuarioId = signal<number | null>(null);
  usuario = signal<UsuarioResponse | null>(null);
  unidades = signal<Unidade[]>([]);
  carregando = signal(true);
  naoEncontrado = signal(false);
  salvando = signal(false);
  enviandoFoto = signal(false);

  form: { nome: string; email: string; role: string; unidadeId: number | null } = {
    nome: '', email: '', role: 'ALUNO', unidadeId: null
  };

  ngOnInit(): void {
    this.svc.listarTodasUnidades().subscribe({
      next: data => this.unidades.set(data),
      error: err => console.error('Erro ao carregar unidades:', err)
    });

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.usuarioId.set(id);
    this.svc.listarUsuarios().subscribe({
      next: lista => {
        const encontrado = lista.find(u => u.id === id) ?? null;
        if (!encontrado) {
          this.naoEncontrado.set(true);
        } else {
          this.usuario.set(encontrado);
          this.form = {
            nome: encontrado.nome,
            email: encontrado.email,
            role: encontrado.role,
            unidadeId: encontrado.unidadeId ?? null
          };
        }
        this.carregando.set(false);
      },
      error: () => { this.naoEncontrado.set(true); this.carregando.set(false); }
    });
  }

  voltar(): void {
    this.router.navigate(['/admin/usuarios']);
  }

  salvar(): void {
    if (!this.form.nome || !this.form.email) return;
    const id = this.usuarioId();
    if (id == null) return;

    this.salvando.set(true);
    this.svc.atualizarUsuario(id, this.form).subscribe({
      next: () => {
        this.salvando.set(false);
        this.snack.open('Usuário atualizado!', 'OK', { duration: 3000 });
        this.voltar();
      },
      error: (e: any) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao atualizar'), 'Fechar', { duration: 3000 });
        this.salvando.set(false);
      }
    });
  }

  // A foto é enviada na hora (endpoint próprio, multipart), independente do
  // submit dos demais campos — que vão num PUT de JSON.
  onFotoSelected(file: File): void {
    const id = this.usuarioId();
    if (id == null) return;
    this.enviandoFoto.set(true);
    this.svc.uploadAvatar(id, file).subscribe({
      next: (atualizado) => {
        this.usuario.set(atualizado);
        this.enviandoFoto.set(false);
        this.snack.open('Foto atualizada!', 'OK', { duration: 2000 });
      },
      error: () => {
        this.enviandoFoto.set(false);
        this.snack.open('Erro ao fazer upload da foto', 'Fechar', { duration: 3000 });
      }
    });
  }

  /**
   * O backend grava a URL já absoluta (`app.upload.base-url` + caminho), mas
   * nem todo registro antigo tem — prefixar às cegas produziria
   * `http://localhost:8080http://...`. Só completa o que vier relativo.
   */
  avatarUrl(): string | null {
    const url = this.usuario()?.avatarUrl;
    if (!url) return null;
    return /^https?:\/\//i.test(url) ? url : this.backendBase + url;
  }

  getRoleBadgeClass(role: string | undefined | null): string {
    const map: Record<string, string> = {
      ADMIN:     'lms-badge lms-badge-destaque',
      PROFESSOR: 'lms-badge lms-badge-sucesso',
      ALUNO:     'lms-badge lms-badge-marca',
    };
    return map[role ?? ''] ?? 'lms-badge lms-badge-neutro';
  }
}
