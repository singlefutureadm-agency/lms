import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/core';

export type ModoTema = 'claro' | 'escuro' | 'sistema';

/** Chaves dos tokens de cor, na ordem em que aparecem na página de Aparência. */
export const TOKENS_COR = [
  'marca', 'marcaEscura', 'marcaProfunda', 'marcaSuave', 'destaque',
  'fundo', 'superficie', 'superficie2', 'texto', 'textoSuave', 'borda',
  'sucesso', 'erro', 'aviso',
] as const;
export type TokenCor = typeof TOKENS_COR[number];

export interface Tipografia {
  fonteTitulo: string;
  fonteCorpo: string;
  /** Multiplicador do tamanho base (1 = 16px). */
  escala: number;
  pesoTitulo: number;
}

export interface Paleta extends Record<TokenCor, string> {}

export interface TemaDoModo {
  cores: Paleta;
  tipografia: Tipografia;
}

export interface ConfiguracaoTema {
  modo: ModoTema;
  claro: TemaDoModo;
  escuro: TemaDoModo;
}

/** Rótulos legíveis, usados na página de Aparência. */
export const ROTULOS_COR: Record<TokenCor, { nome: string; ajuda: string }> = {
  marca:         { nome: 'Marca',            ajuda: 'Cor principal: botões, links e destaques de navegação' },
  marcaEscura:   { nome: 'Marca escura',     ajuda: 'Estado hover e gradientes da cor principal' },
  marcaProfunda: { nome: 'Marca profunda',   ajuda: 'Fundos institucionais e rodapés' },
  marcaSuave:    { nome: 'Marca suave',      ajuda: 'Fundo de selos e áreas de realce leve' },
  destaque:      { nome: 'Destaque',         ajuda: 'Chamadas para ação secundárias (o laranja da identidade)' },
  fundo:         { nome: 'Fundo',            ajuda: 'Fundo geral das páginas' },
  superficie:    { nome: 'Superfície',       ajuda: 'Cartões, painéis e barras' },
  superficie2:   { nome: 'Superfície 2',     ajuda: 'Áreas elevadas: cabeçalhos de tabela, campos' },
  texto:         { nome: 'Texto',            ajuda: 'Texto principal e títulos' },
  textoSuave:    { nome: 'Texto suave',      ajuda: 'Legendas, rótulos e texto secundário' },
  borda:         { nome: 'Borda',            ajuda: 'Divisórias e contornos de cartão' },
  sucesso:       { nome: 'Sucesso',          ajuda: 'Confirmações e estados positivos' },
  erro:          { nome: 'Erro',             ajuda: 'Falhas de validação e alertas' },
  aviso:         { nome: 'Aviso',            ajuda: 'Alertas de atenção' },
};

export const FONTES_DISPONIVEIS = [
  { rotulo: 'Roboto (padrão)', valor: "Roboto, 'Segoe UI', system-ui, sans-serif" },
  { rotulo: 'Sistema',         valor: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { rotulo: 'Serifada',        valor: "Georgia, 'Times New Roman', serif" },
  { rotulo: 'Monoespaçada',    valor: "'Cascadia Code', 'Consolas', monospace" },
  { rotulo: 'Arredondada',     valor: "'Trebuchet MS', 'Segoe UI', sans-serif" },
];

/**
 * Padrões de fábrica do produto — uma paleta neutra, não a identidade de um
 * cliente. Era a paleta institucional do cliente original (azul #0054A6 e
 * laranja #F7941E), o que fazia toda instalação nova nascer com a marca de
 * outra empresa.
 *
 * O escuro não é o claro invertido: a marca clareia para manter contraste sobre
 * superfície escura, e o destaque é dessaturado para não vibrar.
 */
export const TEMA_PADRAO: ConfiguracaoTema = {
  modo: 'sistema',
  claro: {
    cores: {
      marca: '#2563eb', marcaEscura: '#1d4ed8', marcaProfunda: '#1e3a8a',
      marcaSuave: '#eff6ff', destaque: '#f97316',
      fundo: '#f8fafc', superficie: '#ffffff', superficie2: '#f1f5f9',
      texto: '#0f172a', textoSuave: '#64748b', borda: '#e5e7eb',
      sucesso: '#16a34a', erro: '#e11d48', aviso: '#f59e0b',
    },
    tipografia: {
      fonteTitulo: FONTES_DISPONIVEIS[0].valor,
      fonteCorpo: FONTES_DISPONIVEIS[0].valor,
      escala: 1,
      pesoTitulo: 700,
    },
  },
  escuro: {
    cores: {
      marca: '#4d9fff', marcaEscura: '#7db4ff', marcaProfunda: '#a8ccff',
      marcaSuave: '#16243a', destaque: '#f0a844',
      fundo: '#0d1117', superficie: '#161b22', superficie2: '#21262d',
      texto: '#e6edf3', textoSuave: '#9198a1', borda: '#30363d',
      sucesso: '#3fb950', erro: '#f85149', aviso: '#d29922',
    },
    tipografia: {
      fonteTitulo: FONTES_DISPONIVEIS[0].valor,
      fonteCorpo: FONTES_DISPONIVEIS[0].valor,
      escala: 1,
      pesoTitulo: 600,
    },
  },
};

/** Nome da custom property CSS correspondente a cada token. */
const VAR_DE: Record<TokenCor, string> = {
  marca: '--tema-marca', marcaEscura: '--tema-marca-escura',
  marcaProfunda: '--tema-marca-profunda', marcaSuave: '--tema-marca-suave',
  destaque: '--tema-destaque', fundo: '--tema-fundo',
  superficie: '--tema-superficie', superficie2: '--tema-superficie-2',
  texto: '--tema-texto', textoSuave: '--tema-texto-suave', borda: '--tema-borda',
  sucesso: '--tema-sucesso', erro: '--tema-erro', aviso: '--tema-aviso',
};

/**
 * Cor de segurança para quem lê tokens fora do CSS (o Chart.js pinta em canvas
 * e precisa de um valor resolvido). Só entra em cena se a custom property não
 * existir — o que indicaria um token removido do tema.
 */
export const COR_FALLBACK = '#888888';

const CHAVE = 'lms_tema';

/** Paleta e tipografia dos dois modos — o que vem do servidor. */
export interface TemaDaInstalacao {
  claro: TemaDoModo;
  escuro: TemaDoModo;
}

/**
 * Estado da aparência da aplicação.
 *
 * Aplica escrevendo custom properties inline no `<html>`. Isso vence as regras
 * de `tema.css` por especificidade, e o Tailwind (que consome esses tokens no
 * `@theme`) repinta tudo sem rebuild.
 *
 * ## O que é da instalação e o que é do usuário
 * **Paleta e tipografia** são identidade visual do cliente: definidas por um
 * administrador, guardadas no servidor e iguais para todo mundo — na mesma
 * linha do nome e do logotipo (ver {@link MarcaService}, que faz o GET e
 * repassa o tema para cá).
 *
 * **O modo (claro/escuro/sistema)** continua sendo de cada usuário, no
 * `localStorage`: é escolha de conforto de leitura, não de marca, e o botão de
 * alternância na barra superior precisa responder sem exigir permissão de
 * administrador.
 *
 * O `localStorage` também guarda a última paleta conhecida, como cache de
 * primeira pintura — sem ele a aplicação abriria com as cores de fábrica até o
 * GET responder.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly doc = inject(DOCUMENT);

  readonly config = signal<ConfiguracaoTema>(this.carregar());

  /** Falso enquanto a paleta em tela vier do cache, e não do servidor. */
  readonly sincronizado = signal(false);

  /**
   * Último tema confirmado pelo servidor, serializado. Serve de referência para
   * saber se o que está na tela é um rascunho ainda não publicado — a edição de
   * cores é ao vivo (é o valor da prévia), então só a comparação com o
   * publicado distingue "experimentando" de "no ar para todos".
   */
  private readonly publicado = signal('');

  readonly temaAlterado = computed(() =>
    JSON.stringify(this.temaDaInstalacao()) !== this.publicado());

  /**
   * Substitui a paleta e a tipografia pelo que veio do servidor, preservando o
   * modo escolhido pelo usuário. `null` = instalação nunca customizada: aplica
   * o padrão de fábrica do produto.
   */
  aplicarDaInstalacao(tema: TemaDaInstalacao | null): void {
    const origem = tema ?? TEMA_PADRAO;
    this.config.update(c => ({
      modo: c.modo,
      claro: mesclarModo(TEMA_PADRAO.claro, origem.claro),
      escuro: mesclarModo(TEMA_PADRAO.escuro, origem.escuro),
    }));
    this.publicado.set(JSON.stringify(this.temaDaInstalacao()));
    this.sincronizado.set(true);
  }

  /** Snapshot do que seria enviado ao servidor — sem o modo, que é local. */
  temaDaInstalacao(): TemaDaInstalacao {
    const c = this.config();
    return { claro: c.claro, escuro: c.escuro };
  }

  /** Descarta o rascunho local e volta ao que está publicado no servidor. */
  descartarRascunho(): void {
    if (!this.publicado()) return;
    const tema = JSON.parse(this.publicado()) as TemaDaInstalacao;
    this.config.update(c => ({ modo: c.modo, claro: tema.claro, escuro: tema.escuro }));
  }

  /** Modo efetivo: resolve 'sistema' pela preferência do SO. */
  readonly modoEfetivo = computed<'claro' | 'escuro'>(() => {
    const modo = this.config().modo;
    if (modo !== 'sistema') return modo;
    return this.prefereEscuroDoSistema() ? 'escuro' : 'claro';
  });

  readonly temaAtual = computed<TemaDoModo>(() =>
    this.modoEfetivo() === 'escuro' ? this.config().escuro : this.config().claro);

  private readonly prefereEscuroDoSistema = signal(
    this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  constructor() {
    // Acompanha a troca no SO enquanto o modo estiver em 'sistema'.
    const mq = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', e => this.prefereEscuroDoSistema.set(e.matches));

    // Um único efeito: qualquer mudança de config ou de preferência do SO
    // reaplica os tokens e persiste. Sem subscrição manual para vazar.
    effect(() => {
      this.aplicar(this.temaAtual(), this.modoEfetivo());
      this.salvar(this.config());
    });
  }

  definirModo(modo: ModoTema): void {
    this.config.update(c => ({ ...c, modo }));
  }

  /** Alterna claro↔escuro. Partindo de 'sistema', assume o oposto do vigente. */
  alternarModo(): void {
    this.definirModo(this.modoEfetivo() === 'escuro' ? 'claro' : 'escuro');
  }

  definirCor(modo: 'claro' | 'escuro', token: TokenCor, valor: string): void {
    this.config.update(c => ({
      ...c,
      [modo]: { ...c[modo], cores: { ...c[modo].cores, [token]: valor } },
    }));
  }

  definirTipografia(modo: 'claro' | 'escuro', mudanca: Partial<Tipografia>): void {
    this.config.update(c => ({
      ...c,
      [modo]: { ...c[modo], tipografia: { ...c[modo].tipografia, ...mudanca } },
    }));
  }

  /** Restaura um modo específico, preservando o outro e o modo ativo. */
  restaurarModo(modo: 'claro' | 'escuro'): void {
    this.config.update(c => ({ ...c, [modo]: estruturaClonada(TEMA_PADRAO[modo]) }));
  }

  restaurarTudo(): void {
    this.config.set(estruturaClonada(TEMA_PADRAO));
  }

  private aplicar(tema: TemaDoModo, modo: 'claro' | 'escuro'): void {
    const raiz = this.doc.documentElement;
    raiz.setAttribute('data-tema', modo);

    for (const token of TOKENS_COR) {
      raiz.style.setProperty(VAR_DE[token], tema.cores[token]);
    }
    raiz.style.setProperty('--tema-fonte-titulo', tema.tipografia.fonteTitulo);
    raiz.style.setProperty('--tema-fonte-corpo', tema.tipografia.fonteCorpo);
    raiz.style.setProperty('--tema-escala', String(tema.tipografia.escala));
    raiz.style.setProperty('--tema-peso-titulo', String(tema.tipografia.pesoTitulo));
  }

  private carregar(): ConfiguracaoTema {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (!bruto) return estruturaClonada(TEMA_PADRAO);
      const salvo = JSON.parse(bruto) as Partial<ConfiguracaoTema>;
      return {
        modo: salvo.modo ?? TEMA_PADRAO.modo,
        claro: mesclarModo(TEMA_PADRAO.claro, salvo.claro),
        escuro: mesclarModo(TEMA_PADRAO.escuro, salvo.escuro),
      };
    } catch {
      return estruturaClonada(TEMA_PADRAO);
    }
  }

  private salvar(config: ConfiguracaoTema): void {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(config));
    } catch {
      // Storage cheio ou bloqueado: o tema segue aplicado nesta sessão.
    }
  }
}

function mesclarModo(padrao: TemaDoModo, parcial?: Partial<TemaDoModo>): TemaDoModo {
  return {
    cores: { ...padrao.cores, ...(parcial?.cores ?? {}) },
    tipografia: { ...padrao.tipografia, ...(parcial?.tipografia ?? {}) },
  };
}

function estruturaClonada<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}
