import { Component, inject, OnInit, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CursoService, Curso, Page } from '../../../core/services/curso.service';

const DEBOUNCE_MS = 300;

@Component({
    selector: 'app-busca-cursos',
    imports: [CommonModule, RouterLink, MatIconModule, MatPaginatorModule, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    templateUrl: './busca-cursos.component.html'
})
export class BuscaCursosComponent implements OnInit, OnDestroy {
  private cursoService = inject(CursoService);
  private route = inject(ActivatedRoute);
  private debounceHandle: ReturnType<typeof setTimeout> | null = null;

  termo = signal('');
  resultado = signal<Page<Curso> | null>(null);
  loading = signal(true);

  ngOnInit() {
    this.termo.set(this.route.snapshot.queryParamMap.get('q') ?? '');
    this.carregar(0);
  }

  ngOnDestroy() {
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
  }

  onTermoChange(valor: string) {
    this.termo.set(valor);
    if (this.debounceHandle) clearTimeout(this.debounceHandle);
    this.debounceHandle = setTimeout(() => this.carregar(0), DEBOUNCE_MS);
  }

  carregar(pagina: number) {
    this.loading.set(true);
    const q = this.termo().trim() || undefined;
    this.cursoService.listarCursos(pagina, undefined, undefined, q).subscribe({
      next: data => { this.resultado.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  onPage(e: PageEvent) { this.carregar(e.pageIndex); }

  nivelLabel(nivel: string) {
    return nivel === 'BASICO' ? 'Básico' : nivel === 'INTERMEDIARIO' ? 'Intermediário' : 'Avançado';
  }

  nivelBg(nivel: string) {
    const map: Record<string, string> = {
      'BASICO': 'from-green-400 to-emerald-500',
      'INTERMEDIARIO': 'from-yellow-400 to-orange-400',
      'AVANCADO': 'from-red-400 to-rose-500'
    };
    return map[nivel] ?? 'from-marca to-marca';
  }

  trackById = (_: number, item: { id: number }) => item.id;
}
