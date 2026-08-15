import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImageUploadComponent } from '../../shared/image-upload/image-upload.component';
import { AuthService } from '../../core/services/auth.service';
import { CursoService, Matricula, Progresso, Curso } from '../../core/services/curso.service';
import { UploadService } from '../../core/services/upload.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

interface MatriculaComProgresso extends Matricula {
  progresso?: Progresso;
}

@Component({
    selector: 'app-dashboard',
    imports: [CommonModule, RouterModule, MatIconModule, MatProgressSpinnerModule, ImageUploadComponent],
    templateUrl: './dashboard.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private cursoService = inject(CursoService);
  private uploadService = inject(UploadService);
  private router = inject(Router);

  matriculas = signal<MatriculaComProgresso[]>([]);
  cursosDestaque = signal<Curso[]>([]);
  totalCursos = signal(0);
  loading = signal(true);
  pesquisa = signal('');
  uploadingAvatar = signal(false);

  emAndamento = computed(() => this.matriculas().filter(m => m.status === 'EM_ANDAMENTO'));
  concluidos = computed(() => this.matriculas().filter(m => m.status === 'CONCLUIDO'));
  mediaProgresso = computed(() => {
    const lista = this.emAndamento();
    if (!lista.length) return 0;
    const soma = lista.reduce((acc, m) => acc + (m.progresso?.percentual || 0), 0);
    return Math.round(soma / lista.length);
  });

  hora = new Date().getHours();
  saudacao = this.hora < 12 ? 'Bom dia' : this.hora < 18 ? 'Boa tarde' : 'Boa noite';

  ngOnInit() {
    forkJoin({
      matriculas: this.cursoService.minhasMatriculas(),
      cursos: this.cursoService.listarCursos(0)
    }).subscribe({
      next: ({ matriculas, cursos }) => {
        this.totalCursos.set(cursos.page.totalElements);
        this.cursosDestaque.set(cursos.content.slice(0, 6));
        if (!matriculas.length) { this.matriculas.set([]); this.loading.set(false); return; }
        const progressos$ = matriculas.map(m =>
          this.cursoService.progresso(m.id).pipe(catchError(() => of(null)))
        );
        forkJoin(progressos$).subscribe({
          next: progressos => {
            this.matriculas.set(matriculas.map((m, i) => ({ ...m, progresso: progressos[i] as Progresso })));
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });
  }

  onAvatarSelected(file: File) {
    this.uploadingAvatar.set(true);
    this.uploadService.uploadAvatar(file).subscribe({
      next: () => { this.auth.refreshUser(); this.uploadingAvatar.set(false); },
      error: () => this.uploadingAvatar.set(false)
    });
  }

  irParaCursos(nivel?: string) {
    const termo = this.pesquisa().trim();
    if (!nivel && termo) {
      this.router.navigate(['/cursos/busca'], { queryParams: { q: termo } });
      return;
    }
    this.router.navigate(['/cursos/areas']);
  }

  getNivelClass(nivel: string): string {
    const map: Record<string, string> = {
      'BASICO': 'bg-green-100 text-sucesso',
      'INTERMEDIARIO': 'bg-yellow-100 text-aviso',
      'AVANCADO': 'bg-red-100 text-erro'
    };
    return map[nivel] || 'bg-superficie-2 text-texto';
  }

  getNivelBg(nivel: string): string {
    const map: Record<string, string> = {
      'BASICO': 'bg-sucesso',
      'INTERMEDIARIO': 'bg-yellow-400',
      'AVANCADO': 'bg-red-400'
    };
    return map[nivel] || 'bg-gray-400';
  }

  trackById = (_: number, item: { id: number }) => item.id;
}
