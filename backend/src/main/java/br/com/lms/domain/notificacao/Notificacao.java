package br.com.lms.domain.notificacao;

import br.com.lms.domain.usuario.Usuario;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "notificacoes")
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
public class Notificacao {

    @EqualsAndHashCode.Include
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Tipo tipo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String mensagem;

    /** Id do registro relacionado (ex.: a matrícula), opcional. */
    @Column(name = "referencia_id")
    private Long referenciaId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean lida = false;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private LocalDateTime criadoEm;

    @PrePersist
    protected void onCreate() { criadoEm = LocalDateTime.now(); }

    public enum Tipo { NOTA_LANCADA, MATRICULA_CONFIRMADA }
}
