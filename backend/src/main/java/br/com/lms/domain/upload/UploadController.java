package br.com.lms.domain.upload;

import br.com.lms.domain.usuario.Usuario;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * Os erros de upload não são mais capturados aqui: {@code IllegalArgumentException}
 * (formato/tamanho) e {@code ResourceNotFoundException} sobem para o
 * GlobalExceptionHandler, que responde no mesmo formato do resto da API — antes
 * este controller devolvia um {@code {"error": ...}} próprio, um quarto formato
 * de erro.
 */
@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
public class UploadController {

    private final ImagemUploadService imagemUploadService;
    private final VideoUploadService videoUploadService;

    @PostMapping("/avatar")
    public ResponseEntity<Map<String, String>> uploadAvatar(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Usuario usuario) throws IOException {
        return ResponseEntity.ok(Map.of("avatarUrl", imagemUploadService.atualizarAvatar(usuario, file)));
    }

    @PostMapping("/curso/{cursoId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> uploadCurso(
            @PathVariable Long cursoId,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(
                Map.of("imagemUrl", imagemUploadService.atualizarImagemCurso(cursoId, file)));
    }

    @PostMapping("/unidade/{unidadeId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> uploadUnidade(
            @PathVariable Long unidadeId,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(
                Map.of("imagemUrl", imagemUploadService.atualizarImagemUnidade(unidadeId, file)));
    }

    @PostMapping("/modulo/{moduloId}/video")
    @PreAuthorize("hasAnyRole('ADMIN','PROFESSOR')")
    public ResponseEntity<Map<String, String>> uploadVideoModulo(
            @PathVariable Long moduloId,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(
                Map.of("urlVideo", videoUploadService.atualizarVideoModulo(moduloId, file)));
    }

    @DeleteMapping("/modulo/{moduloId}/video")
    @PreAuthorize("hasAnyRole('ADMIN','PROFESSOR')")
    public ResponseEntity<Void> removerVideoModulo(@PathVariable Long moduloId) {
        videoUploadService.removerVideoModulo(moduloId);
        return ResponseEntity.noContent().build();
    }
}
