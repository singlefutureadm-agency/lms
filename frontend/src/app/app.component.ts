import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { PublicNavComponent } from './shared/public-nav/public-nav.component';
import { AuthService } from './core/services/auth.service';
import { MarcaService } from './core/services/marca.service';
import { AccessibilityComponent } from './accessibility/accessibility.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent, PublicNavComponent, AccessibilityComponent],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    @if (auth.isLoggedIn()) {
      <app-navbar></app-navbar>
      <main class="pt-16 lg:pl-64 min-h-screen bg-fundo">
        <router-outlet></router-outlet>
      </main>
    } @else {
      @if (showPublicNav()) {
        <app-public-nav></app-public-nav>
        <main class="pt-16 min-h-screen">
          <router-outlet></router-outlet>
        </main>
      }
      @if (!showPublicNav()) {
        <router-outlet></router-outlet>
      }
    }
    
    
    <app-accessibility></app-accessibility>
    `
})
export class AppComponent {
  auth = inject(AuthService);
  private router = inject(Router);
  // Injetado na raiz para garantir que o serviço exista desde o primeiro
  // render: é o efeito dele que escreve título da aba e favicon. Sem isso,
  // uma rota que não exiba o logotipo abriria com o título de partida.
  private marca = inject(MarcaService);
  currentUrl = signal('');

  constructor() {
    this.currentUrl.set(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(e => this.currentUrl.set(e.urlAfterRedirects));
  }

  showPublicNav(): boolean {
    const url = this.currentUrl();
    return !url.startsWith('/login');
  }
}
