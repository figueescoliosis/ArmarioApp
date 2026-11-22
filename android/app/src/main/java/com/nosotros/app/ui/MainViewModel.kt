package com.nosotros.app.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nosotros.app.data.AlbumInfo
import com.nosotros.app.data.ApiException
import com.nosotros.app.data.Invitation
import com.nosotros.app.data.LocalPhoto
import com.nosotros.app.data.NotConfiguredException
import com.nosotros.app.data.SupabaseConfig
import com.nosotros.app.data.UnreadableImageException
import com.nosotros.app.repository
import com.nosotros.app.widget.RotationScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.IOException

enum class Screen { Loading, Setup, Pairing, Album }

data class UiState(
    val loading: Boolean = true,
    val busy: Boolean = false,
    val offline: Boolean = false,
    /** «Subiendo 2 de 3…» */
    val upload: Pair<Int, Int>? = null,
    val message: String? = null,
    val rotationMinutes: Int = 30,
)

class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = app.repository

    val configured: StateFlow<Boolean> = repo.configured
    val album: StateFlow<AlbumInfo?> = repo.album
    val photos: StateFlow<List<LocalPhoto>> = repo.photos
    val configBuiltIn: Boolean = repo.configStore.isBuiltIn

    private val _ui = MutableStateFlow(UiState(rotationMinutes = repo.configStore.rotationMinutes))
    val ui: StateFlow<UiState> = _ui.asStateFlow()

    init {
        viewModelScope.launch {
            // Si ya hay álbum guardado se entra directo (sirve sin conexión);
            // si no, se pregunta al servidor.
            if (repo.configured.value && repo.album.value == null) {
                runCatching { repo.refreshAlbum() }.onFailure { show(it) }
            }
            _ui.update { it.copy(loading = false) }
        }
    }

    fun screen(configured: Boolean, album: AlbumInfo?, loading: Boolean): Screen = when {
        !configured -> Screen.Setup
        loading -> Screen.Loading
        album != null -> Screen.Album
        else -> Screen.Pairing
    }

    fun dismissMessage() = _ui.update { it.copy(message = null) }

    // ─── Configuración y emparejamiento ─────────────────────────────────

    fun saveConfig(url: String, key: String) = work {
        repo.configure(SupabaseConfig(url, key))
        repo.refreshAlbum()
    }

    /** Pega una invitación: configura el servidor si viene incluido y se une al álbum. */
    fun useInvitation(text: String) = work {
        val invitation = Invitation.parse(text)
            ?: throw IllegalArgumentException("Eso no parece una invitación de Nosotros.")
        if (invitation.config != null && !repo.configStore.isBuiltIn) {
            repo.configure(invitation.config)
        } else if (!repo.configured.value) {
            throw IllegalArgumentException("La invitación no trae los datos del servidor. Pide a tu pareja que la comparta otra vez.")
        }
        repo.refreshAlbum()
        if (repo.album.value?.code != invitation.code) repo.joinAlbum(invitation.code)
    }

    fun useInvitationMissing() =
        show("No hay nada copiado. Copia el mensaje de invitación entero y vuelve a tocar el botón.")

    fun createAlbum() = work { repo.createAlbum() }

    fun joinAlbum(code: String) = work {
        if (code.trim().length != 6) throw IllegalArgumentException("El código tiene 6 caracteres.")
        repo.joinAlbum(code)
    }

    fun leaveAlbum() = work { repo.leaveAlbum() }

    fun removePartner() = work {
        repo.removePartner()
        show("Listo. Tu pareja puede volver a entrar con el código.")
    }

    fun invitationText(): String? {
        val config = repo.config ?: return null
        val code = repo.album.value?.code ?: return null
        return Invitation.format(config, code)
    }

    // ─── Fotos ──────────────────────────────────────────────────────────

    fun addPhotos(uris: List<Uri>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            var failed = 0
            var lastError: Throwable? = null
            uris.forEachIndexed { i, uri ->
                _ui.update { it.copy(upload = i + 1 to uris.size) }
                runCatching { repo.addPhoto(uri) }.onFailure { failed++; lastError = it }
            }
            _ui.update { it.copy(upload = null) }
            lastError?.let {
                val prefix = if (uris.size > 1) "No se subieron $failed de ${uris.size}. " else ""
                show(prefix + friendly(it))
            }
        }
    }

    fun deletePhoto(photo: LocalPhoto) = work { repo.deletePhoto(photo) }

    /** Lo llama la pantalla del álbum cada pocos segundos mientras está visible. */
    suspend fun syncQuietly() {
        try {
            repo.sync()
            _ui.update { it.copy(offline = false) }
        } catch (e: IOException) {
            _ui.update { it.copy(offline = true) }
        } catch (e: Exception) {
            // Errores del servidor en segundo plano: no se molesta al usuario.
        }
    }

    fun setRotation(minutes: Int) {
        repo.configStore.rotationMinutes = minutes
        RotationScheduler.schedule(getApplication(), replace = true)
        _ui.update { it.copy(rotationMinutes = minutes) }
    }

    // ─── Ayudantes ──────────────────────────────────────────────────────

    private fun work(block: suspend () -> Unit) {
        if (_ui.value.busy) return
        viewModelScope.launch {
            _ui.update { it.copy(busy = true) }
            try {
                block()
            } catch (e: Exception) {
                show(e)
            } finally {
                _ui.update { it.copy(busy = false) }
            }
        }
    }

    private fun show(e: Throwable) = show(friendly(e))
    private fun show(message: String) = _ui.update { it.copy(message = message) }

    private fun friendly(e: Throwable): String {
        val text = e.message.orEmpty()
        return when {
            e is NotConfiguredException -> "Falta configurar el servidor."
            e is UnreadableImageException -> "No se pudo leer esa imagen."
            e is IOException -> "Sin conexión. Inténtalo de nuevo."
            e is IllegalArgumentException -> text
            e !is ApiException -> "Algo salió mal: $text"
            "ALBUM_LLENO" in text -> "Ese álbum ya tiene a sus dos personas."
            "CODIGO_INVALIDO" in text -> "No existe un álbum con ese código. Revísalo."
            "YA_TIENES_ALBUM" in text -> "Ya estás en un álbum. Sal de él en Ajustes para unirte a otro."
            "anonymous" in text.lowercase() ->
                "En Supabase falta activar «Allow anonymous sign-ins» (mira SETUP.md)."
            "api key" in text.lowercase() || e.status == 401 -> "La clave de Supabase no es válida."
            e.code in setOf("PGRST202", "PGRST205", "42883", "42P01") || "bucket" in text.lowercase() ->
                "Falta ejecutar el SQL de SETUP.md en Supabase."
            else -> "Error del servidor: $text"
        }
    }
}
