package br.com.lms.domain.curso;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "modulos")
@Getter
@Setter
@ToString
// equals/hashCode apenas pelo id: com @Data, o Lombok os gerava sobre TODOS os
// campos, incluindo associacoes — um Modulo.equals() chamava Curso.equals(),
// que percorria a colecao de modulos, e um simples List.contains() forcava a
// carga do grafo inteiro (ou entrava em recursao).
@EqualsAndHashCode(onlyExplicitlyIncluded = true)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Modulo {

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "curso_id", nullable = false)
    private Curso curso;

    @Column(nullable = false, length = 200)
    private String titulo;

    @Column(nullable = false)
    @Builder.Default
    private Integer ordem = 0;

    @Column(name = "url_video", length = 500)
    private String urlVideo;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_video", length = 20)
    private TipoVideo tipoVideo;

    @OneToMany(mappedBy = "modulo", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("ordem ASC")
    @Builder.Default
    private List<Aula> aulas = new ArrayList<>();

    // ARQUIVO = upload local, gerido por VideoUploadService/UploadService.
    // YOUTUBE/VIMEO = link externo, validado em ModuloRequest e gravado direto
    // pelo CursoService — nunca toca em disco.
    public enum TipoVideo { ARQUIVO, YOUTUBE, VIMEO }
}
