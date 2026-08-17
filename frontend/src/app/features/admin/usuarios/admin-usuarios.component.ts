import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CursoService, Unidade, UsuarioResponse } from '../../../core/services/curso.service';
import { mensagemDeErro } from '../../../core/interceptors/error.interceptor';

/**
 * Listagem administrativa de usuários. A edição vive em página própria
 * (`/admin/usuarios/:id/editar`, ver AdminUsuarioFormComponent) — aqui ficam
 * só a listagem e a criação rápida (nome/email/senha, três campos).
 */
@Component({
    selector: 'app-admin-usuarios',
    imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatSnackBarModule],
    templateUrl: './admin-usuarios.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styles: []
})
export class AdminUsuariosComponent implements OnInit {
  private svc = inject(CursoService);
  private snack = inject(MatSnackBar);

  readonly backendBase = 'http://localhost:8080';

  usuarios = signal<UsuarioResponse[]>([]);
  unidades = signal<Unidade[]>([]);
  loading = signal(true);
  salvando = signal(false);
  mostrarFormCriar = signal(false);

  adminCount = computed(() => this.usuarios().filter(u => u.role === 'ADMIN').length);
  professoresCount = computed(() => this.usuarios().filter(u => u.role === 'PROFESSOR').length);

  criarForm: { nome: string; email: string; senha: string } = {
    nome: '', email: '', senha: ''
  };

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.svc.listarUsuarios().subscribe({
      next: data => { this.usuarios.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.svc.listarTodasUnidades().subscribe({
      next: data => this.unidades.set(data)
    });
  }

  abrirCriar(): void {
    this.criarForm = { nome: '', email: '', senha: '' };
    this.mostrarFormCriar.set(true);
  }

  fecharCriar(): void {
    this.mostrarFormCriar.set(false);
  }

  salvarCriar(): void {
    if (!this.criarForm.nome || !this.criarForm.email || this.criarForm.senha.length < 6) return;
    this.salvando.set(true);
    this.svc.criarUsuario(this.criarForm).subscribe({
      next: () => {
        this.snack.open('Usuário criado!', 'OK', { duration: 3000 });
        this.fecharCriar();
        this.carregar();
        this.salvando.set(false);
      },
      error: (e: any) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao criar usuário'), 'Fechar', { duration: 3000 });
        this.salvando.set(false);
      }
    });
  }

  /**
   * O backend grava a URL já absoluta (`app.upload.base-url` + caminho), mas
   * nem todo registro antigo tem — prefixar às cegas produziria
   * `http://localhost:8080http://...`. Só completa o que vier relativo.
   */
  getAvatarSrc(u: UsuarioResponse): string | null {
    if (!u.avatarUrl) return null;
    return /^https?:\/\//i.test(u.avatarUrl) ? u.avatarUrl : this.backendBase + u.avatarUrl;
  }

  hasPhoto(u: UsuarioResponse): boolean {
    return !!u.avatarUrl;
  }

  getInitial(nome: string): string {
    return nome ? nome.charAt(0).toUpperCase() : '?';
  }

  getRoleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      ADMIN:     'lms-badge lms-badge-destaque',
      PROFESSOR: 'lms-badge lms-badge-sucesso',
      ALUNO:     'lms-badge lms-badge-marca',
    };
    return map[role] ?? 'lms-badge lms-badge-neutro';
  }

  getAvatarBg(role: string): string {
    const map: Record<string, string> = {
      ADMIN:     'bg-marca',
      PROFESSOR: 'bg-sucesso',
      ALUNO:     'bg-marca',
    };
    return map[role] ?? 'bg-texto-suave';
  }

  trackById(_: number, item: { id: number }): number { return item.id; }
}
