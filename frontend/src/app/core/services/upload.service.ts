import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  uploadAvatar(file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ avatarUrl: string }>(`${this.api}/upload/avatar`, form);
  }

  uploadCurso(cursoId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ imagemUrl: string }>(`${this.api}/upload/curso/${cursoId}`, form);
  }

  uploadUnidade(unidadeId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ imagemUrl: string }>(`${this.api}/upload/unidade/${unidadeId}`, form);
  }

  // observe: 'events' + reportProgress: true — o vídeo pode passar de 300MB, o
  // chamador acompanha o progresso via HttpEventType.UploadProgress em vez de
  // só esperar a resposta final.
  uploadModuloVideo(moduloId: number, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ urlVideo: string }>(`${this.api}/upload/modulo/${moduloId}/video`, form, {
      reportProgress: true,
      observe: 'events'
    });
  }

  removerVideoModulo(moduloId: number) {
    return this.http.delete<void>(`${this.api}/upload/modulo/${moduloId}/video`);
  }
}
