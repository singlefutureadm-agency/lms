import { Routes } from '@angular/router';
import { authGuard, adminGuard, professorGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },

  // Públicas
  {
    path: 'home',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'sobre',
    loadComponent: () => import('./features/sobre/sobre.component').then(m => m.SobreComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'unidades',
    loadComponent: () => import('./features/unidades/unidades.component').then(m => m.UnidadesComponent)
  },
  {
    path: 'unidades/:unidadeSlug',
    loadComponent: () => import('./features/unidades/detalhe-unidade/detalhe-unidade.component').then(m => m.DetalheUnidadeComponent)
  },
  {
    path: 'unidades/:unidadeSlug/areas/:areaSlug',
    loadComponent: () => import('./features/unidades/cursos-unidade-area/cursos-unidade-area.component').then(m => m.CursosUnidadeAreaComponent)
  },
  {
    path: 'unidades/:unidadeSlug/:tipoSlug',
    loadComponent: () => import('./features/unidades/cursos-unidade-tipo/cursos-unidade-tipo.component').then(m => m.CursosUnidadeTipoComponent)
  },

  // Catálogo de cursos (público) — estáticos antes de dinâmicos
  { path: 'cursos', redirectTo: 'cursos/areas', pathMatch: 'full' },
  {
    path: 'cursos/areas',
    loadComponent: () => import('./features/areas/lista-areas/lista-areas.component').then(m => m.ListaAreasComponent)
  },
  {
    path: 'cursos/areas/:areaSlug',
    loadComponent: () => import('./features/areas/detalhe-area/detalhe-area.component').then(m => m.DetalheAreaComponent)
  },
  {
    path: 'cursos/areas/:areaSlug/:categoriaSlug',
    loadComponent: () => import('./features/areas/lista-cursos-categoria/lista-cursos-categoria.component').then(m => m.ListaCursosCategoriaComponent)
  },
  {
    path: 'cursos/tipos/:tipoSlug',
    loadComponent: () => import('./features/areas/lista-cursos-tipo/lista-cursos-tipo.component').then(m => m.ListaCursosTipoComponent)
  },
  {
    path: 'cursos/busca',
    loadComponent: () => import('./features/cursos/busca-cursos/busca-cursos.component').then(m => m.BuscaCursosComponent)
  },
  {
    path: 'cursos/:id',
    loadComponent: () => import('./features/cursos/detalhe-curso/detalhe-curso.component').then(m => m.DetalheCursoComponent)
  },

  // Autenticadas
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'matriculas',
    canActivate: [authGuard],
    loadComponent: () => import('./features/matriculas/minhas-matriculas.component').then(m => m.MinhasMatriculasComponent)
  },
  {
    path: 'aparencia',
    canActivate: [authGuard],
    loadComponent: () => import('./features/aparencia/aparencia.component').then(m => m.AparenciaComponent)
  },

  // Admin (rotas planas — sem parent componentless)
  {
    path: 'admin',
    redirectTo: 'admin/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'admin/dashboard',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
  },
  {
    path: 'admin/cursos',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/cursos/admin-cursos.component').then(m => m.AdminCursosComponent)
  },
  // Criação/edição em páginas dedicadas — antes eram painéis que abriam dentro
  // das próprias listagens. Rotas mais específicas ('novo'/'nova') vêm antes
  // das paramétricas de mesma profundidade.
  {
    path: 'admin/cursos/novo',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/cursos/curso-form/admin-curso-form.component').then(m => m.AdminCursoFormComponent)
  },
  {
    path: 'admin/cursos/:id/editar',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/cursos/curso-form/admin-curso-form.component').then(m => m.AdminCursoFormComponent)
  },
  {
    path: 'admin/usuarios',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/usuarios/admin-usuarios.component').then(m => m.AdminUsuariosComponent)
  },
  {
    path: 'admin/usuarios/:id/editar',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/usuarios/usuario-form/admin-usuario-form.component').then(m => m.AdminUsuarioFormComponent)
  },
  {
    path: 'admin/regioes',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/regioes/admin-regioes.component').then(m => m.AdminRegioesComponent)
  },
  {
    path: 'admin/regioes/nova',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/regioes/regiao-form/admin-regiao-form.component').then(m => m.AdminRegiaoFormComponent)
  },
  {
    path: 'admin/regioes/:id/editar',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/regioes/regiao-form/admin-regiao-form.component').then(m => m.AdminRegiaoFormComponent)
  },
  {
    path: 'admin/regioes/:regiaoId/unidades/nova',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/regioes/unidade-form/admin-unidade-form.component').then(m => m.AdminUnidadeFormComponent)
  },
  {
    path: 'admin/regioes/:regiaoId/unidades/:unidadeId/editar',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/regioes/unidade-form/admin-unidade-form.component').then(m => m.AdminUnidadeFormComponent)
  },
  {
    path: 'admin/professores',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/professores/admin-professores.component').then(m => m.AdminProfessoresComponent)
  },

  // Professor
  {
    path: 'professor',
    redirectTo: 'professor/cursos',
    pathMatch: 'full'
  },
  {
    path: 'professor/cursos',
    canActivate: [professorGuard],
    loadComponent: () => import('./features/professor/meus-cursos/professor-cursos.component').then(m => m.ProfessorCursosComponent)
  },

  // Wildcard — sempre último
  { path: '**', redirectTo: 'home' }
];
