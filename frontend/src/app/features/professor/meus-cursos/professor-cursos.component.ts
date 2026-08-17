import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { CursoService, Curso, ConteudoAula, TipoVideoModulo } from '../../../core/services/curso.service';
import { AuthService } from '../../../core/services/auth.service';
import { VideoEmbedComponent } from '../../../shared/video-embed/video-embed.component';
import { mensagemDeErro } from '../../../core/interceptors/error.interceptor';

interface CursoDetalhe {
  id: number; titulo: string; descricao: string; nivel: string; criadoEm: string;
  modulos: {
    id: number; titulo: string; ordem: number; urlVideo: string | null; tipoVideo: TipoVideoModulo | null;
    aulas: { id: number; titulo: string; urlVideo: string; duracaoMin: number; ordem: number }[];
  }[];
}

@Component({
    selector: 'app-professor-cursos',
    imports: [RouterModule, ReactiveFormsModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule, MatExpansionModule, VideoEmbedComponent],
    templateUrl: './professor-cursos.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./professor-cursos.component.scss']
})
export class ProfessorCursosComponent implements OnInit {
  private svc = inject(CursoService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  cursos = signal<Curso[]>([]);
  cursoDetalhe = signal<Record<number, CursoDetalhe>>({});
  conteudosPorAula = signal<Record<number, ConteudoAula[]>>({});
  loading = signal(true);
  loadingDetalhe = signal<number | null>(null);
  salvando = signal(false);
  cursoAberto = signal<number | null>(null);
  aulaAberta = signal<number | null>(null);
  mostrarFormConteudo = signal<number | null>(null);
  tiposConteudo = ['VIDEO', 'PDF', 'TEXTO', 'LINK'];

  formConteudo = this.fb.group({
    titulo: ['', Validators.required],
    tipo: ['TEXTO', Validators.required],
    conteudo: [''],
    ordem: [0]
  });

  get isAdmin(): boolean { return this.auth.isAdmin(); }

  ngOnInit() { this.carregar(); }

  carregar() {
    this.loading.set(true);
    const obs = this.isAdmin
      ? this.svc.listarCursos(0).pipe()
      : this.svc.meusCursosProfessor();

    if (this.isAdmin) {
      this.svc.listarCursos(0).subscribe({
        next: page => { this.cursos.set(page.content); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    } else {
      this.svc.meusCursosProfessor().subscribe({
        next: data => { this.cursos.set(data); this.loading.set(false); },
        error: () => this.loading.set(false)
      });
    }
  }

  abrirCurso(cursoId: number) {
    if (this.cursoAberto() === cursoId) {
      this.cursoAberto.set(null);
      return;
    }
    this.cursoAberto.set(cursoId);
    this.aulaAberta.set(null);
    if (!this.cursoDetalhe()[cursoId]) {
      this.carregarDetalhe(cursoId);
    }
  }

  carregarDetalhe(cursoId: number) {
    this.loadingDetalhe.set(cursoId);
    this.svc.buscarCurso(cursoId).subscribe({
      next: (data: any) => {
        this.cursoDetalhe.update(m => ({ ...m, [cursoId]: data }));
        this.loadingDetalhe.set(null);
      },
      error: () => this.loadingDetalhe.set(null)
    });
  }

  abrirAula(aulaId: number) {
    if (this.aulaAberta() === aulaId) {
      this.aulaAberta.set(null);
      this.mostrarFormConteudo.set(null);
      return;
    }
    this.aulaAberta.set(aulaId);
    this.mostrarFormConteudo.set(null);
    this.carregarConteudos(aulaId);
  }

  carregarConteudos(aulaId: number) {
    this.svc.listarConteudos(aulaId).subscribe({
      next: data => this.conteudosPorAula.update(m => ({ ...m, [aulaId]: data }))
    });
  }

  getDetalhe(cursoId: number): CursoDetalhe | null {
    return this.cursoDetalhe()[cursoId] || null;
  }

  getConteudos(aulaId: number): ConteudoAula[] {
    return this.conteudosPorAula()[aulaId] || [];
  }

  abrirFormConteudo(aulaId: number) {
    this.formConteudo.reset({ titulo: '', tipo: 'TEXTO', conteudo: '', ordem: 0 });
    this.mostrarFormConteudo.set(aulaId);
  }

  fecharFormConteudo() {
    this.mostrarFormConteudo.set(null);
    this.formConteudo.reset();
  }

  salvarConteudo(aulaId: number) {
    if (this.formConteudo.invalid) return;
    this.salvando.set(true);
    const data = {
      titulo: this.formConteudo.value.titulo!,
      tipo: this.formConteudo.value.tipo!,
      conteudo: this.formConteudo.value.conteudo || '',
      ordem: this.formConteudo.value.ordem || 0
    };
    this.svc.criarConteudo(aulaId, data).subscribe({
      next: () => {
        this.snack.open('Conteúdo adicionado!', 'OK', { duration: 3000 });
        this.fecharFormConteudo();
        this.carregarConteudos(aulaId);
        this.salvando.set(false);
      },
      error: (e: any) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao adicionar conteúdo'), 'Fechar', { duration: 3000 });
        this.salvando.set(false);
      }
    });
  }

  deletarConteudo(aulaId: number, conteudoId: number) {
    if (!confirm('Excluir este conteúdo?')) return;
    this.svc.deletarConteudo(aulaId, conteudoId).subscribe({
      next: () => {
        this.snack.open('Conteúdo excluído!', 'OK', { duration: 3000 });
        this.carregarConteudos(aulaId);
      },
      error: () => this.snack.open('Erro ao excluir', 'Fechar', { duration: 3000 })
    });
  }

  getTipoIcon(tipo: string): string {
    const icons: Record<string, string> = {
      VIDEO: 'play_circle', PDF: 'picture_as_pdf', TEXTO: 'article', LINK: 'link'
    };
    return icons[tipo] || 'description';
  }

  getTipoColor(tipo: string): string {
    const colors: Record<string, string> = {
      VIDEO: 'text-erro', PDF: 'text-orange-500', TEXTO: 'text-blue-500', LINK: 'text-sucesso'
    };
    return colors[tipo] || 'text-texto-suave';
  }

  getNivelClass(nivel: string): string {
    const map: Record<string, string> = {
      BASICO: 'lms-badge-sucesso',
      INTERMEDIARIO: 'lms-badge-aviso',
      AVANCADO: 'lms-badge-erro'
    };
    return map[nivel] || 'lms-badge-neutro';
  }

  trackById = (_: number, item: { id: number }) => item.id;
}
