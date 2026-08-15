import { Component, inject, OnInit, signal, computed, ChangeDetectionStrategy } from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CursoService, Curso, Area } from '../../core/services/curso.service';

@Component({
    selector: 'app-home',
    imports: [RouterModule, MatIconModule, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  auth = inject(AuthService);
  private cursoService = inject(CursoService);
  private router = inject(Router);

  cursosDestaque = signal<Curso[]>([]);
  totalCursos = signal(0);
  loading = signal(true);
  pesquisa = signal('');
  areas = signal<Area[]>([]);

  unidadesDestaque = computed(() => {
    const seen = new Set<string>();
    return this.cursosDestaque()
      .filter(c => c.unidadeNome && !seen.has(c.unidadeNome) && seen.add(c.unidadeNome))
      .slice(0, 6);
  });

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    forkJoin({
      cursos: this.cursoService.listarCursos(0),
      areas: this.cursoService.listarAreas()
    }).subscribe({
      next: ({ cursos, areas }) => {
        this.cursosDestaque.set(cursos.content);
        this.totalCursos.set(cursos.page.totalElements);
        this.areas.set(areas);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  irParaCursos(nivel?: string) {
    const termo = this.pesquisa().trim();
    if (!nivel && termo) {
      this.router.navigate(['/cursos/busca'], { queryParams: { q: termo } });
      return;
    }
    const queryParams = nivel ? { nivel } : {};
    this.router.navigate(['/cursos'], { queryParams });
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
      'BASICO': 'from-green-400 to-emerald-500',
      'INTERMEDIARIO': 'from-yellow-400 to-orange-400',
      'AVANCADO': 'from-red-400 to-rose-500'
    };
    return map[nivel] || 'from-marca to-marca-escura';
  }

  year = new Date().getFullYear();

  trackById = (_: number, item: { id: number }) => item.id;
  trackBySlug = (_: number, item: { slug: string }) => item.slug;
}
