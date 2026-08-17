import { Component, inject, OnInit, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { CursoService, Curso, MatriculaDetalhe } from '../../../core/services/curso.service';

const FILTRO_DEBOUNCE_MS = 300;

/**
 * Listagem administrativa de cursos.
 *
 * A criação/edição vive em página própria (`/admin/cursos/novo` e
 * `/admin/cursos/:id/editar`, ver AdminCursoFormComponent) — este componente
 * só lista, filtra, pagina, desativa e gerencia alunos/notas. O formulário
 * ficava embutido aqui, abrindo acima da tabela; a capa e os módulos não
 * cabiam bem nesse espaço e a listagem sumia atrás do painel aberto.
 */
@Component({
    selector: 'app-admin-cursos',
    imports: [RouterLink, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule, MatPaginatorModule],
    templateUrl: './admin-cursos.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./admin-cursos.component.scss']
})
export class AdminCursosComponent implements OnInit, OnDestroy {
  private svc = inject(CursoService);
  private snack = inject(MatSnackBar);

  cursos = signal<Curso[]>([]);
  loading = signal(true);
  cursoExpandido = signal<number | null>(null);
  matriculasCurso = signal<Record<number, MatriculaDetalhe[]>>({});
  loadingAlunos = signal<number | null>(null);
  notasEditando = signal<Record<number, string>>({});
  salvandoNota = signal<number | null>(null);

  // Paginação da listagem — o backend já pagina via Pageable (page/size); antes
  // o componente carregava as 200 primeiras linhas de uma vez com listarTodosCursos().
  pageIndex = signal(0);
  pageSize = signal(10);
  totalCursos = signal(0);
  filtro = signal('');
  private filtroDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.carregarCursos(0);
  }

  ngOnDestroy() {
    if (this.filtroDebounceHandle) clearTimeout(this.filtroDebounceHandle);
  }

  carregarCursos(pageIndex: number) {
    this.pageIndex.set(pageIndex);
    this.loading.set(true);
    const q = this.filtro().trim() || undefined;
    this.svc.listarCursosAdmin(pageIndex, this.pageSize(), q).subscribe({
      next: page => {
        this.cursos.set(page.content);
        this.totalCursos.set(page.page.totalElements);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onPage(evento: PageEvent) {
    this.pageSize.set(evento.pageSize);
    this.carregarCursos(evento.pageIndex);
  }

  onFiltroChange(valor: string) {
    this.filtro.set(valor);
    if (this.filtroDebounceHandle) clearTimeout(this.filtroDebounceHandle);
    this.filtroDebounceHandle = setTimeout(() => this.carregarCursos(0), FILTRO_DEBOUNCE_MS);
  }

  excluir(curso: Curso) {
    if (!confirm(`Desativar o curso "${curso.titulo}"?`)) return;
    this.svc.deletarCurso(curso.id).subscribe({
      next: () => { this.snack.open('Curso desativado!', 'OK', { duration: 3000 }); this.carregarCursos(this.pageIndex()); },
      error: () => this.snack.open('Erro ao desativar curso', 'Fechar', { duration: 3000 })
    });
  }

  toggleAlunos(cursoId: number) {
    if (this.cursoExpandido() === cursoId) {
      this.cursoExpandido.set(null);
      return;
    }
    this.cursoExpandido.set(cursoId);
    this.carregarAlunos(cursoId);
  }

  carregarAlunos(cursoId: number) {
    this.loadingAlunos.set(cursoId);
    this.svc.listarMatriculasCurso(cursoId).subscribe({
      next: data => {
        this.matriculasCurso.update(m => ({ ...m, [cursoId]: data }));
        const notas: Record<number, string> = {};
        data.forEach(mat => { notas[mat.id] = mat.nota != null ? String(mat.nota) : ''; });
        this.notasEditando.update(n => ({ ...n, ...notas }));
        this.loadingAlunos.set(null);
      },
      error: () => this.loadingAlunos.set(null)
    });
  }

  getAlunos(cursoId: number): MatriculaDetalhe[] {
    return this.matriculasCurso()[cursoId] || [];
  }

  getNota(matriculaId: number): string {
    return this.notasEditando()[matriculaId] ?? '';
  }

  setNota(matriculaId: number, valor: string) {
    this.notasEditando.update(n => ({ ...n, [matriculaId]: valor }));
  }

  lancarNota(matricula: MatriculaDetalhe, cursoId: number) {
    const notaStr = this.getNota(matricula.id);
    const nota = parseFloat(notaStr);
    if (isNaN(nota) || nota < 0 || nota > 10) {
      this.snack.open('Nota inválida. Use um valor entre 0 e 10.', 'Fechar', { duration: 3000 });
      return;
    }
    this.salvandoNota.set(matricula.id);
    this.svc.lancarNota(matricula.id, nota).subscribe({
      next: () => {
        this.snack.open(`Nota ${nota} lançada para ${matricula.usuarioNome}!`, 'OK', { duration: 3000 });
        this.salvandoNota.set(null);
        this.carregarAlunos(cursoId);
      },
      error: () => {
        this.snack.open('Erro ao lançar nota', 'Fechar', { duration: 3000 });
        this.salvandoNota.set(null);
      }
    });
  }

  getNivelClass(nivel: string): string {
    const map: Record<string, string> = {
      BASICO: 'lms-badge-sucesso',
      INTERMEDIARIO: 'lms-badge-aviso',
      AVANCADO: 'lms-badge-erro'
    };
    return map[nivel] || 'lms-badge-neutro';
  }

  getStatusClass(status: string): string {
    return status === 'CONCLUIDO' ? 'lms-badge-sucesso' : 'lms-badge-marca';
  }

  trackById = (_: number, item: { id: number }) => item.id;
}
