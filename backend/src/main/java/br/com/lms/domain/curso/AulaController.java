package br.com.lms.domain.curso;

import br.com.lms.dto.DTOs.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/aulas")
@RequiredArgsConstructor
public class AulaController {

    private final AulaService aulaService;

    @GetMapping("/{id}")
    public ResponseEntity<AulaResponse> buscar(@PathVariable Long id) {
        return ResponseEntity.ok(aulaService.buscarPorId(id));
    }

    @PostMapping
    public ResponseEntity<AulaResponse> criar(@Valid @RequestBody CriarAulaRequest request) {
        return ResponseEntity.status(201).body(aulaService.criar(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AulaResponse> atualizar(@PathVariable Long id,
            @Valid @RequestBody AtualizarAulaRequest request) {
        return ResponseEntity.ok(aulaService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        aulaService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
