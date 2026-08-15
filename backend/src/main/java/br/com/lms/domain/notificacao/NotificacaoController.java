package br.com.lms.domain.notificacao;

import br.com.lms.domain.usuario.Usuario;
import br.com.lms.dto.DTOs.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notificacoes")
@RequiredArgsConstructor
public class NotificacaoController {

    private final NotificacaoService notificacaoService;

    @GetMapping
    public ResponseEntity<Page<NotificacaoResponse>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean apenasNaoLidas,
            @AuthenticationPrincipal Usuario usuario,
            @PageableDefault(size = 20, sort = "criadoEm", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(notificacaoService.listar(usuario.getId(), apenasNaoLidas, pageable));
    }

    @GetMapping("/contagem-nao-lidas")
    public ResponseEntity<ContagemNaoLidasResponse> contagemNaoLidas(@AuthenticationPrincipal Usuario usuario) {
        return ResponseEntity.ok(new ContagemNaoLidasResponse(notificacaoService.contarNaoLidas(usuario.getId())));
    }

    @PatchMapping("/{id}/lida")
    public ResponseEntity<Void> marcarComoLida(@PathVariable Long id, @AuthenticationPrincipal Usuario usuario) {
        notificacaoService.marcarComoLida(id, usuario.getId());
        return ResponseEntity.noContent().build();
    }
}
