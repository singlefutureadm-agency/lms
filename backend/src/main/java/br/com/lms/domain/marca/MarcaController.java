package br.com.lms.domain.marca;

import br.com.lms.dto.DTOs.MarcaRequest;
import br.com.lms.dto.DTOs.MarcaResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Identidade visual da instalação.
 *
 * <p>O GET é <b>público</b> por necessidade: a tela de login precisa exibir o
 * nome e o logotipo do cliente antes de existir qualquer sessão. O que ele
 * expõe já é público de fato — é o que qualquer visitante vê no cabeçalho.
 *
 * <p>Os logotipos ficam fora do PUT porque são multipart; misturá-los com o
 * JSON obrigaria a tela inteira a virar um formulário multipart só por causa de
 * dois campos opcionais.
 */
@RestController
@RequestMapping("/api/marca")
@RequiredArgsConstructor
public class MarcaController {

    private final MarcaService marcaService;

    @GetMapping
    @Operation(summary = "Identidade visual da instalação (público — usado já na tela de login)")
    public ResponseEntity<MarcaResponse> buscar() {
        return ResponseEntity.ok(marcaService.buscar());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Atualiza nome e assinatura")
    public ResponseEntity<MarcaResponse> atualizar(@Valid @RequestBody MarcaRequest request) {
        return ResponseEntity.ok(marcaService.atualizar(request));
    }

    @PostMapping(value = "/logo/{variante}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Envia o logotipo PRINCIPAL (fundos claros) ou INVERSO (fundos escuros)")
    public ResponseEntity<MarcaResponse> enviarLogo(
            @PathVariable MarcaService.Variante variante,
            @RequestParam("file") MultipartFile file) throws IOException {
        return ResponseEntity.ok(marcaService.atualizarLogo(variante, file));
    }

    @DeleteMapping("/logo/{variante}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Remove o logotipo, voltando ao ícone genérico com o nome ao lado")
    public ResponseEntity<MarcaResponse> removerLogo(@PathVariable MarcaService.Variante variante) {
        return ResponseEntity.ok(marcaService.removerLogo(variante));
    }
}
