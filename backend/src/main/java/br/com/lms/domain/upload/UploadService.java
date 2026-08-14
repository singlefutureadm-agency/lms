package br.com.lms.domain.upload;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Set;

/**
 * Valida tipo/tamanho e delega a gravação/remoção crua ao {@link StorageBackend}
 * injetado.
 */
@Service
@RequiredArgsConstructor
public class UploadService {

    private final StorageBackend storageBackend;

    @Value("${app.upload.video-max-size-mb:300}")
    private long videoMaxSizeMb;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
        "image/jpeg", "image/png", "image/webp"
    );

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
        "jpg", "jpeg", "png", "webp"
    );

    private static final Set<String> ALLOWED_VIDEO_TYPES = Set.of(
        "video/mp4", "video/webm", "video/ogg"
    );

    public String salvar(MultipartFile file, String subpasta) throws IOException {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_IMAGE_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Formato inválido. Use JPEG, PNG ou WebP.");
        }

        String extensao = getExtensaoImagem(file.getOriginalFilename() != null ? file.getOriginalFilename() : "file.jpg");
        return storageBackend.salvar(file, subpasta, extensao);
    }

    public String salvarVideo(MultipartFile file, String subpasta) throws IOException {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_VIDEO_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Formato inválido. Use MP4, WebM ou OGG.");
        }

        long maxBytes = videoMaxSizeMb * 1024 * 1024;
        if (file.getSize() > maxBytes) {
            throw new IllegalArgumentException("Vídeo excede o tamanho máximo de " + videoMaxSizeMb + "MB.");
        }

        String extensao = getExtensaoVideo(contentType);
        return storageBackend.salvar(file, subpasta, extensao);
    }

    public void deletar(String urlAtual) {
        storageBackend.deletar(urlAtual);
    }

    private String getExtensaoImagem(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot > 0) {
            String ext = filename.substring(dot + 1).toLowerCase();
            return ALLOWED_IMAGE_EXTENSIONS.contains(ext) ? ext : "jpg";
        }
        return "jpg";
    }

    private String getExtensaoVideo(String contentType) {
        return switch (contentType) {
            case "video/mp4" -> "mp4";
            case "video/webm" -> "webm";
            case "video/ogg" -> "ogv";
            default -> "mp4";
        };
    }
}
