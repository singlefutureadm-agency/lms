package br.com.lms.dto.validation;

import br.com.lms.dto.DTOs.ModuloRequest;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.regex.Pattern;

public class ModuloRequestVideoValidator implements ConstraintValidator<ValidVideoModulo, ModuloRequest> {

    // Mesmos padrões documentados no schema de ModuloRequest.urlVideo — mantidos
    // aqui porque é aqui que efetivamente validam.
    private static final Pattern YOUTUBE = Pattern.compile(
            "^https?://(www\\.)?(youtube\\.com/watch\\?v=|youtu\\.be/)[\\w-]+");
    private static final Pattern VIMEO = Pattern.compile("^https?://(www\\.)?vimeo\\.com/\\d+");

    @Override
    public boolean isValid(ModuloRequest request, ConstraintValidatorContext context) {
        if (request == null || request.tipoVideo() == null) return true;
        String url = request.urlVideo();
        if (url == null || url.isBlank()) return false;

        return switch (request.tipoVideo()) {
            case YOUTUBE -> YOUTUBE.matcher(url).find();
            case VIMEO -> VIMEO.matcher(url).find();
            // ARQUIVO: url vem do upload local (/api/upload/modulo/{id}/video), sem
            // padrão fixo pra validar aqui.
            case ARQUIVO -> true;
        };
    }
}
