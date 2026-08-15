import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/services/auth.service';
import { CursoService, CursoDetalhe } from '../../../core/services/curso.service';
import { VideoEmbedComponent } from '../../../shared/video-embed/video-embed.component';
import { mensagemDeErro } from '../../../core/interceptors/error.interceptor';

@Component({
    selector: 'app-detalhe-curso',
    imports: [CommonModule, NgClass, RouterModule, MatSnackBarModule, MatProgressSpinnerModule, MatExpansionModule, MatIconModule, VideoEmbedComponent],
    templateUrl: './detalhe-curso.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./detalhe-curso.component.scss']
})
export class DetalheCursoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cursoService = inject(CursoService);
  private snack = inject(MatSnackBar);
  auth = inject(AuthService);

  curso = signal<CursoDetalhe | null>(null);
  loading = signal(true);
  matriculando = signal(false);

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cursoService.buscarCurso(id).subscribe({
      next: data => { this.curso.set(data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  matricular() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.matriculando.set(true);
    this.cursoService.matricular(this.curso()!.id).subscribe({
      next: () => {
        this.snack.open('Matrícula realizada com sucesso!', 'OK', { duration: 3000 });
        this.matriculando.set(false);
      },
      error: (e: any) => {
        this.snack.open(mensagemDeErro(e, 'Erro ao realizar matrícula'), 'Fechar', { duration: 3000 });
        this.matriculando.set(false);
      }
    });
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
    return map[nivel] || 'from-marca to-marca';
  }

  getTotalAulas(): number {
    return this.curso()?.modulos.reduce((acc, m) => acc + m.aulas.length, 0) ?? 0;
  }

  trackById = (_: number, item: { id: number }) => item.id;
  trackBySlug = (_: number, item: { slug: string }) => item.slug;
}
