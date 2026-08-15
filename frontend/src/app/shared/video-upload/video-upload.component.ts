import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Mesmo padrão de ImageUploadComponent: componente "burro" que só valida e
 * emite o File — quem decide quando/como enviar (upload imediato ou pendente
 * até o curso ser salvo) é o componente pai. A diferença é o botão de remover:
 * como vídeo pode já estar salvo (ou só selecionado localmente, pendente),
 * `temVideo` cobre os dois casos e o pai decide o que fazer no clique.
 */
@Component({
    selector: 'app-video-upload',
    imports: [MatIconModule, MatProgressSpinnerModule],
    changeDetection: ChangeDetectionStrategy.Eager,
    template: `
    <div>
      <div class="relative group cursor-pointer"
        (click)="fileInput.click()"
        (dragover)="$event.preventDefault()"
        (drop)="onDrop($event)">

        <div class="w-full h-40 rounded-xl bg-superficie-2 border-2 border-dashed border-gray-300
                    group-hover:border-marca overflow-hidden transition-colors
                    flex items-center justify-center relative">

          <!-- Preview do vídeo -->
          @if (displayUrl()) {
            <video [src]="displayUrl()!" controls muted
              class="w-full h-full object-cover absolute inset-0"></video>
          }

          <!-- Placeholder -->
          @if (!displayUrl()) {
            <div class="text-center p-4 z-10">
              <mat-icon class="text-texto-suave" style="font-size:36px;height:36px;width:36px">video_call</mat-icon>
              <p class="text-texto-suave text-xs mt-1 leading-tight">{{ placeholder }}</p>
            </div>
          }

          <!-- Botão de remover: some durante upload/remoção em andamento -->
          @if (displayUrl() && temVideo && !loading) {
            <button type="button" (click)="onRemover($event)"
              class="absolute top-2 right-2 z-30 p-1.5 bg-black/60 hover:bg-erro text-white rounded-lg border-0 cursor-pointer transition-colors flex items-center justify-center">
              <mat-icon style="font-size:18px;height:18px;width:18px;">delete</mat-icon>
            </button>
          }

          <!-- Spinner + progresso de upload -->
          @if (loading) {
            <div class="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-1 z-30">
              <mat-spinner diameter="28"></mat-spinner>
              @if (progress != null) {
                <span class="text-xs text-texto-suave">{{ progress }}%</span>
              }
            </div>
          }
        </div>
      </div>

      @if (erro()) {
        <p class="text-erro text-xs mt-1.5">{{ erro() }}</p>
      }

      <input #fileInput type="file" accept="video/mp4,video/webm,video/ogg"
        class="hidden" (change)="onFileChange($event)">
      </div>
    `
})
export class VideoUploadComponent {
  @Input() currentUrl: string | null | undefined = null;
  @Input() placeholder = 'Clique ou arraste um vídeo (MP4, WebM, OGG — até 300MB)';
  @Input() loading = false;
  @Input() progress: number | null = null;
  @Input() temVideo = false;
  @Output() fileSelected = new EventEmitter<File>();
  @Output() removerVideo = new EventEmitter<void>();

  private localPreview = signal<string | null>(null);
  erro = signal<string | null>(null);

  private readonly MAX_SIZE = 300 * 1024 * 1024;
  private readonly ALLOWED = ['video/mp4', 'video/webm', 'video/ogg'];

  displayUrl(): string | null {
    return this.localPreview() ?? this.currentUrl ?? null;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.processar(file);
  }

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processar(file);
  }

  onRemover(event: Event) {
    event.stopPropagation();
    // Limpa o preview local na hora: seja removendo um vídeo já salvo (o pai
    // dispara o DELETE) seja descartando uma seleção ainda pendente, o usuário
    // já pediu pra tirar esse vídeo da tela.
    this.localPreview.set(null);
    this.removerVideo.emit();
  }

  private processar(file: File) {
    this.erro.set(null);
    if (!this.ALLOWED.includes(file.type)) {
      this.erro.set('Formato inválido. Use MP4, WebM ou OGG.');
      return;
    }
    if (file.size > this.MAX_SIZE) {
      this.erro.set('Arquivo muito grande. Máximo 300MB.');
      return;
    }
    this.localPreview.set(URL.createObjectURL(file));
    this.fileSelected.emit(file);
  }
}
