import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthService } from '../../core/services/auth.service';
import { MarcaService } from '../../core/services/marca.service';
import { LogoMarcaComponent } from '../../shared/logo-marca/logo-marca.component';

@Component({
    selector: 'app-login',
    imports: [ReactiveFormsModule, MatSnackBarModule, MatTabsModule, LogoMarcaComponent],
    templateUrl: './login.component.html',
    changeDetection: ChangeDetectionStrategy.Eager,
    styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snack = inject(MatSnackBar);
  readonly marca = inject(MarcaService);

  /** Argumentos de venda do produto, não de um cliente específico. */
  readonly destaques = [
    'Cursos de nível básico ao avançado',
    'Acompanhe seu progresso em tempo real',
    'Certificados ao concluir cada curso',
  ];

  loginForm = this.fb.group({ email: ['', [Validators.required, Validators.email]], senha: ['', Validators.required] });
  registerForm = this.fb.group({ nome: ['', Validators.required], email: ['', [Validators.required, Validators.email]], senha: ['', [Validators.required, Validators.minLength(6)]] });
  // Signal, e não campo comum: sob zoneless, mutar um campo dentro de um
  // callback de HTTP não avisa o Angular. O componente até era verificado por
  // estar marcado como Eager, mas a escrita caía no meio do ciclo e disparava
  // NG0100 (ExpressionChangedAfterItHasBeenChecked) no [disabled] do botão.
  loading = signal(false);
  year = new Date().getFullYear();

  onLogin() {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.auth.login(this.loginForm.value as any).subscribe({
      next: () => this.router.navigateByUrl(returnUrl),
      error: () => { this.snack.open('Email ou senha inválidos', 'Fechar', { duration: 3000 }); this.loading.set(false); }
    });
  }

  onRegister() {
    if (this.registerForm.invalid) return;
    this.loading.set(true);
    this.auth.register(this.registerForm.value as any).subscribe({
      next: () => { this.snack.open('Conta criada! Faça login.', 'OK', { duration: 3000 }); this.loading.set(false); },
      error: () => { this.snack.open('Erro ao criar conta', 'Fechar', { duration: 3000 }); this.loading.set(false); }
    });
  }
}
