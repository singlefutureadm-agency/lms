package br.com.lms.domain.curso;

import br.com.lms.dto.DTOs.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cursos")
@RequiredArgsConstructor
public class CursoController {

    private final CursoService cursoService;

    @GetMapping
    public ResponseEntity<Page<CursoResumoResponse>> listar(
            @RequestParam(required = false) Curso.Nivel nivel,
            @RequestParam(required = false) Long unidadeId,
            @RequestParam(required = false) String areaSlug,
            @RequestParam(required = false) String categoriaSlug,
            @RequestParam(required = false) String tipoSlug,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 10, sort = "criadoEm") Pageable pageable) {
        return ResponseEntity.ok(
                cursoService.listar(nivel, unidadeId, areaSlug, categoriaSlug, tipoSlug, q, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CursoDetalheResponse> detalhe(@PathVariable Long id) {
        return ResponseEntity.ok(cursoService.detalhe(id));
    }

    @PostMapping
    public ResponseEntity<CursoDetalheResponse> criar(@Valid @RequestBody CursoRequest request) {
        return ResponseEntity.status(201).body(cursoService.criar(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<CursoDetalheResponse> atualizar(@PathVariable Long id,
            @Valid @RequestBody CursoRequest request) {
        return ResponseEntity.ok(cursoService.atualizar(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desativar(@PathVariable Long id) {
        cursoService.desativar(id);
        return ResponseEntity.noContent().build();
    }
}
