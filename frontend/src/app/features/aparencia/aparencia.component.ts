import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  TemaService, TOKENS_COR, ROTULOS_COR, FONTES_DISPONIVEIS,
  type TokenCor, type ModoTema,
} from '../../core/services/tema.service';
import {
  MarcaService, LOGO_MAX_BYTES, LOGO_TIPOS_ACEITOS, type Marca, type VarianteLogo,
} from '../../core/services/marca.service';
import { AuthService } from '../../core/services/auth.service';
import { mensagemDeErro } from '../../core/interceptors/error.interceptor';

/**
 * Configuração de aparência: identidade (nome e logotipos), cores e tipografia.
 * Cores e tipografia são definidas separadamente para o modo claro e o escuro;
 * a identidade é uma só, porque não muda com o modo.
 *
 * Esta é a única tela de personalização do produto: o que um cliente precisa
 * trocar para a instalação virar "dele" está todo aqui.
 *
 * O modo que está sendo **editado** é independente do modo que está **ativo**
 * na aplicação: dá para ajustar o tema escuro enquanto se navega no claro. Por
 * isso existe o botão "Ver este modo", que ativa o modo em edição para conferir
 * o resultado ao vivo.
 */
@Component({
  selector: 'app-aparencia',
  imports: [MatIconModule, MatSnackBarModule, MatTooltipModule],
  templateUrl: './aparencia.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // A prévia não usa os tokens globais de propósito: ela mostra o modo EM
  // EDIÇÃO, que pode não ser o aplicado. As variáveis --pv-* são vinculadas na
  // seção via [style.--pv-*], e os hovers/focus abaixo reagem a elas — é o que
  // permite ver o estado de hover de um botão sem trocar o tema inteiro.
  styles: [`
    .pv-quadro { background: var(--pv-fundo); font-family: var(--pv-fonte-corpo); }
    .pv-topo { background: var(--pv-marca); }
    .pv-menu { background: var(--pv-superficie); }

    .pv-titulo {
      color: var(--pv-texto);
      font-family: var(--pv-fonte-titulo);
      font-weight: var(--pv-peso-titulo);
    }
    .pv-suave { color: var(--pv-texto-suave); }

    .pv-nav-item { color: var(--pv-texto-suave); transition: background-color .15s, color .15s; }
    .pv-nav-item:hover { background: var(--pv-marca-suave); color: var(--pv-marca); }
    .pv-nav-ativo { background: var(--pv-marca-suave); color: var(--pv-marca); }

    .pv-cartao {
      background: var(--pv-superficie);
      border: 1px solid var(--pv-borda);
      transition: border-color .15s, box-shadow .15s;
    }
    .pv-cartao:hover {
      border-color: var(--pv-marca);
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / .1);
    }

    .pv-btn-marca { background: var(--pv-marca); transition: background-color .15s; }
    .pv-btn-marca:hover { background: var(--pv-marca-escura); }

    .pv-btn-destaque { background: var(--pv-destaque); transition: background-color .15s; }
    .pv-btn-destaque:hover {
      background: color-mix(in srgb, var(--pv-destaque) 85%, var(--pv-mistura));
    }

    .pv-btn-erro-suave {
      color: var(--pv-erro);
      background: color-mix(in srgb, var(--pv-erro) 12%, var(--pv-superficie));
      transition: background-color .15s;
    }
    .pv-btn-erro-suave:hover {
      background: color-mix(in srgb, var(--pv-erro) 24%, var(--pv-superficie));
    }

    .pv-chip { background: var(--pv-marca-suave); color: var(--pv-marca); }

    .pv-link { color: var(--pv-marca); transition: color .15s; }
    .pv-link:hover { color: var(--pv-marca-escura); text-decoration: underline; }

    .pv-input {
      background: var(--pv-superficie);
      color: var(--pv-texto);
      border: 1px solid var(--pv-borda);
      outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .pv-input::placeholder { color: var(--pv-texto-suave); }
    .pv-input:focus {
      border-color: var(--pv-marca);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--pv-marca) 25%, transparent);
    }
  `],
})
export class AparenciaComponent {
  private readonly snack = inject(MatSnackBar);
  readonly tema = inject(TemaService);
  readonly marca = inject(MarcaService);

  readonly tokens = TOKENS_COR;
  readonly rotulos = ROTULOS_COR;
  readonly fontes = FONTES_DISPONIVEIS;

  private readonly auth = inject(AuthService);

  readonly logoMaxKb = Math.round(LOGO_MAX_BYTES / 1024);
  readonly tiposAceitos = LOGO_TIPOS_ACEITOS.join(',');
  readonly erroLogo = signal<string | null>(null);
  readonly salvandoMarca = signal(false);
  readonly enviandoLogo = signal<VarianteLogo | null>(null);
  readonly salvandoTema = signal(false);

  /** Identidade é configuração da instalação — só ADMIN escreve (o backend também barra). */
  readonly podeEditarMarca = computed(() => this.auth.isAdmin());

  /**
   * Rascunho local de nome/assinatura. Existe porque o salvamento é explícito:
   * digitar não pode alterar o que os outros usuários veem antes de o
   * administrador confirmar.
   */
  readonly formMarca = signal({ nome: '', assinatura: '' });

  readonly marcaAlterada = computed(() => {
    const atual = this.marca.marca();
    const form = this.formMarca();
    return form.nome !== atual.nome || form.assinatura !== atual.assinatura;
  });

  readonly camposDeLogo: { variante: VarianteLogo; chave: keyof Pick<Marca, 'logo' | 'logoInverso'>; rotulo: string; ajuda: string }[] = [
    { variante: 'PRINCIPAL', chave: 'logo', rotulo: 'Logotipo principal', ajuda: 'Usado no site público e em fundos claros.' },
    { variante: 'INVERSO', chave: 'logoInverso', rotulo: 'Logotipo em fundo escuro', ajuda: 'Barra do sistema e login. Sem ele, usa o principal.' },
  ];

  /** Modo cuja paleta está sendo editada — não necessariamente o modo ativo. */
  readonly editando = signal<'claro' | 'escuro'>(this.tema.modoEfetivo());

  readonly paletaEmEdicao = computed(() => this.tema.config()[this.editando()].cores);
  readonly tipografiaEmEdicao = computed(() => this.tema.config()[this.editando()].tipografia);

  /** Verdadeiro quando o modo em edição é o que está aplicado na tela. */
  readonly editandoOModoAtivo = computed(() => this.editando() === this.tema.modoEfetivo());

  readonly pesos = [
    { valor: 500, rotulo: 'Médio' },
    { valor: 600, rotulo: 'Seminegrito' },
    { valor: 700, rotulo: 'Negrito' },
    { valor: 800, rotulo: 'Extranegrito' },
  ];

  readonly modos: { valor: ModoTema; rotulo: string; icone: string }[] = [
    { valor: 'claro',   rotulo: 'Claro',   icone: 'light_mode' },
    { valor: 'escuro',  rotulo: 'Escuro',  icone: 'dark_mode' },
    { valor: 'sistema', rotulo: 'Sistema', icone: 'contrast' },
  ];

  // ─── Identidade ──────────────────────────────────────────────────────────

  /**
   * Marca que o administrador começou a digitar. Sem esta flag, o efeito de
   * sincronização abaixo teria de comparar o rascunho com o servidor — e
   * comparar significaria LER o rascunho, que é o mesmo sinal que ele escreve:
   * um ciclo infinito de leitura→escrita→reexecução.
   */
  private readonly rascunhoTocado = signal(false);

  constructor() {
    // Espelha o valor do servidor no rascunho sempre que ele muda (carga
    // inicial, salvamento, upload de logotipo) — sem sobrescrever o que o
    // administrador está digitando agora. `untracked` mantém `marca.marca()`
    // como única dependência do efeito.
    effect(() => {
      const atual = this.marca.marca();
      untracked(() => {
        if (this.rascunhoTocado()) return;
        this.formMarca.set({ nome: atual.nome, assinatura: atual.assinatura });
      });
    });
  }

  aoMudarNome(evento: Event): void {
    this.rascunhoTocado.set(true);
    this.formMarca.update(f => ({ ...f, nome: (evento.target as HTMLInputElement).value }));
  }

  aoMudarAssinatura(evento: Event): void {
    this.rascunhoTocado.set(true);
    this.formMarca.update(f => ({ ...f, assinatura: (evento.target as HTMLInputElement).value }));
  }

  salvarMarca(): void {
    const form = this.formMarca();
    if (!form.nome.trim()) return;
    this.salvandoMarca.set(true);
    this.marca.salvar({ nome: form.nome.trim(), assinatura: form.assinatura.trim() }).subscribe({
      next: () => {
        this.salvandoMarca.set(false);
        // Solta o rascunho: o efeito volta a espelhar o servidor, que agora é
        // quem tem o valor confirmado.
        this.rascunhoTocado.set(false);
        this.snack.open('Identidade salva para toda a instalação', 'OK', { duration: 3000 });
      },
      error: (e) => {
        this.salvandoMarca.set(false);
        this.snack.open(mensagemDeErro(e, 'Erro ao salvar a identidade'), 'Fechar', { duration: 4000 });
      },
    });
  }

  descartarMarca(): void {
    const atual = this.marca.marca();
    this.formMarca.set({ nome: atual.nome, assinatura: atual.assinatura });
    this.rascunhoTocado.set(false);
  }

  aoSelecionarLogo(variante: VarianteLogo, evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const file = input.files?.[0];
    // Limpa o input para que reenviar o MESMO arquivo depois de um erro ainda
    // dispare o change.
    input.value = '';
    if (!file) return;

    const erro = this.marca.validarArquivo(file);
    this.erroLogo.set(erro);
    if (erro) return;

    this.enviandoLogo.set(variante);
    this.marca.enviarLogo(variante, file).subscribe({
      next: () => {
        this.enviandoLogo.set(null);
        this.snack.open('Logotipo atualizado', 'OK', { duration: 2500 });
      },
      error: (e) => {
        this.enviandoLogo.set(null);
        this.erroLogo.set(mensagemDeErro(e, 'Erro ao enviar o logotipo'));
      },
    });
  }

  removerLogo(variante: VarianteLogo): void {
    this.erroLogo.set(null);
    this.marca.removerLogo(variante).subscribe({
      next: () => this.snack.open('Logotipo removido', 'OK', { duration: 2500 }),
      error: (e) => this.erroLogo.set(mensagemDeErro(e, 'Erro ao remover o logotipo')),
    });
  }

  // ─── Cores e tipografia ──────────────────────────────────────────────────

  editarModo(modo: 'claro' | 'escuro'): void {
    this.editando.set(modo);
  }

  aplicarModoEmEdicao(): void {
    this.tema.definirModo(this.editando());
  }

  aoMudarCor(token: TokenCor, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.tema.definirCor(this.editando(), token, valor);
  }

  /** Aceita hex digitado à mão; ignora enquanto estiver incompleto. */
  aoDigitarHex(token: TokenCor, evento: Event): void {
    const bruto = (evento.target as HTMLInputElement).value.trim();
    const valor = bruto.startsWith('#') ? bruto : `#${bruto}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(valor)) {
      this.tema.definirCor(this.editando(), token, valor);
    }
  }

  aoMudarFonte(campo: 'fonteTitulo' | 'fonteCorpo', evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.tema.definirTipografia(this.editando(), { [campo]: valor });
  }

  aoMudarEscala(evento: Event): void {
    const escala = Number((evento.target as HTMLInputElement).value);
    this.tema.definirTipografia(this.editando(), { escala });
  }

  aoMudarPeso(evento: Event): void {
    const pesoTitulo = Number((evento.target as HTMLSelectElement).value);
    this.tema.definirTipografia(this.editando(), { pesoTitulo });
  }

  /**
   * Restaurar mexe só no rascunho local — o que está no ar para os outros
   * usuários continua igual até "Publicar". É o mesmo contrato de qualquer
   * outra edição de cor nesta tela.
   */
  restaurarModo(): void {
    this.tema.restaurarModo(this.editando());
    this.snack.open(`Modo ${this.editando()} voltou ao padrão — publique para valer para todos`,
      'OK', { duration: 4000 });
  }

  restaurarTudo(): void {
    this.tema.restaurarTudo();
    this.snack.open('Cores e tipografia voltaram ao padrão — publique para valer para todos',
      'OK', { duration: 4000 });
  }

  descartarTema(): void {
    this.tema.descartarRascunho();
  }

  /** Publica a paleta para toda a instalação. */
  publicarTema(): void {
    this.salvandoTema.set(true);
    this.marca.salvarTema(this.tema.temaDaInstalacao()).subscribe({
      next: () => {
        this.salvandoTema.set(false);
        this.snack.open('Cores e tipografia publicadas para toda a instalação', 'OK', { duration: 3000 });
      },
      error: (e) => {
        this.salvandoTema.set(false);
        this.snack.open(mensagemDeErro(e, 'Erro ao publicar a aparência'), 'Fechar', { duration: 4000 });
      },
    });
  }

  /** Apaga a customização no servidor: a instalação volta ao padrão do produto. */
  restaurarTemaDeFabrica(): void {
    if (!confirm('Restaurar as cores de fábrica para TODOS os usuários da instalação?')) return;
    this.salvandoTema.set(true);
    this.marca.restaurarTema().subscribe({
      next: () => {
        this.salvandoTema.set(false);
        this.snack.open('Instalação de volta ao padrão de fábrica', 'OK', { duration: 3000 });
      },
      error: (e) => {
        this.salvandoTema.set(false);
        this.snack.open(mensagemDeErro(e, 'Erro ao restaurar'), 'Fechar', { duration: 4000 });
      },
    });
  }

  /**
   * Contraste WCAG entre a cor e a superfície do modo em edição.
   * Serve de aviso: uma combinação abaixo de 4.5 deixa o texto difícil de ler.
   */
  contrasteCom(token: TokenCor): number {
    const cores = this.paletaEmEdicao();
    const fundo = token === 'texto' || token === 'textoSuave' ? cores.superficie : cores.fundo;
    return razaoDeContraste(cores[token], fundo);
  }

  contrasteRuim(token: TokenCor): boolean {
    return (token === 'texto' || token === 'textoSuave' || token === 'marca')
      && this.contrasteCom(token) < 4.5;
  }
}

/** Luminância relativa conforme WCAG 2.1. */
function luminancia(hex: string): number {
  const n = hex.replace('#', '');
  const canais = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

function razaoDeContraste(corA: string, corB: string): number {
  if (!/^#[0-9A-Fa-f]{6}$/.test(corA) || !/^#[0-9A-Fa-f]{6}$/.test(corB)) return 21;
  const a = luminancia(corA);
  const b = luminancia(corB);
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return Math.round(((claro + 0.05) / (escuro + 0.05)) * 10) / 10;
}
