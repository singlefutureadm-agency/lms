package br.com.lms.domain.upload;

import br.com.lms.domain.curso.Modulo;
import br.com.lms.domain.curso.ModuloRepository;
import br.com.lms.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * Orquestra "gravar vídeo + apontar o módulo para ele" — mesmo padrão de
 * {@link ImagemUploadService}: o vídeo anterior só é removido depois que o
 * novo já está gravado e o módulo persistido, evitando entidade órfã se a
 * gravação falhar no meio do caminho.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class VideoUploadService {

    private final UploadService uploadService;
    private final ModuloRepository moduloRepository;

    @Transactional
    public String atualizarVideoModulo(Long moduloId, MultipartFile file) throws IOException {
        Modulo modulo = buscar(moduloId);
        String anterior = modulo.getUrlVideo();
        String url = uploadService.salvarVideo(file, "modulos-video");
        modulo.setUrlVideo(url);
        moduloRepository.save(modulo);
        uploadService.deletar(anterior);
        log.info("Vídeo de módulo atualizado: modulo={}", moduloId);
        return url;
    }

    /**
     * Remove o vídeo salvo de um módulo: aponta a entidade para {@code null}
     * primeiro, só então apaga o arquivo — mesma ordem "atualiza entidade antes
     * de tocar no arquivo" usada em {@link #atualizarVideoModulo}.
     */
    @Transactional
    public void removerVideoModulo(Long moduloId) {
        Modulo modulo = buscar(moduloId);
        String urlAnterior = modulo.getUrlVideo();
        modulo.setUrlVideo(null);
        moduloRepository.save(modulo);
        uploadService.deletar(urlAnterior);
        log.info("Vídeo de módulo removido: modulo={}", moduloId);
    }

    private Modulo buscar(Long moduloId) {
        return moduloRepository.findById(moduloId)
                .orElseThrow(() -> new ResourceNotFoundException("Módulo", moduloId));
    }
}
