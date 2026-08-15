package br.com.lms.dto.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Vínculo entre {@code tipoVideo} e {@code urlVideo} num
 * {@code br.com.lms.dto.DTOs.ModuloRequest}: se {@code tipoVideo} for
 * {@code YOUTUBE}/{@code VIMEO}, {@code urlVideo} precisa bater no padrão do
 * respectivo serviço. {@code ARQUIVO} (upload local) e {@code null} (sem
 * vídeo) não têm formato fixo — o primeiro é preenchido pelo próprio backend
 * via {@code /api/upload/modulo/{id}/video}, não pelo cliente.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = ModuloRequestVideoValidator.class)
public @interface ValidVideoModulo {
    String message() default "URL do vídeo não corresponde ao formato esperado para o tipo informado (YouTube ou Vimeo)";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
