package com.nosotros.app.data

import android.content.Context
import android.net.Uri
import com.nosotros.app.widget.WidgetUpdater
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

class NotConfiguredException : Exception("Falta configurar Supabase")

/**
 * Única puerta entre la app y los datos: habla con Supabase, mantiene la copia
 * local de las fotos y avisa al widget cuando algo cambia.
 */
class AlbumRepository(private val context: Context) {

    val configStore = ConfigStore(context)
    private val sessions = SessionStore(context)
    val store = LocalPhotoStore(context)

    /** Serializa sync, subidas y borrados para que no pisen la copia local. */
    private val mutex = Mutex()
    private var api: Pair<SupabaseConfig, SupabaseApi>? = null

    private val _configured = MutableStateFlow(configStore.current() != null)
    val configured: StateFlow<Boolean> = _configured.asStateFlow()

    private val _album = MutableStateFlow(sessions.loadAlbum())
    val album: StateFlow<AlbumInfo?> = _album.asStateFlow()

    val photos: StateFlow<List<LocalPhoto>> = store.photos

    val config: SupabaseConfig? get() = configStore.current()

    fun isPaired(): Boolean = _configured.value && _album.value != null

    private fun api(): SupabaseApi {
        val config = configStore.current() ?: throw NotConfiguredException()
        api?.let { (c, client) -> if (c == config) return client }
        return SupabaseApi(config, sessions).also { api = config to it }
    }

    // ─── Configuración ──────────────────────────────────────────────────

    /** Guarda la URL y la clave, y comprueba que funcionan creando la sesión anónima. */
    suspend fun configure(config: SupabaseConfig) {
        if (!config.isValid()) throw IllegalArgumentException("URL o clave incompletas")
        val previous = configStore.current()
        if (previous?.normalizedUrl == config.normalizedUrl && previous.key.trim() == config.key.trim()) return
        // Se prueba con una sesión aparte para no perder la actual si falla.
        val trial = SessionStore(context, "sesion_prueba").also { it.clear() }
        val session = SupabaseApi(config, trial).ensureSession()
        trial.clear()
        // Otro proyecto: lo de antes ya no sirve.
        sessions.clear()
        sessions.save(session)
        configStore.save(config)
        api = null
        setAlbum(null)
        store.clear()
        _configured.value = true
        WidgetUpdater.refresh(context)
    }

    // ─── Álbum ──────────────────────────────────────────────────────────

    suspend fun refreshAlbum(): AlbumInfo? {
        val album = SupabaseApi.parseAlbum(api().rpc("my_album"))
        setAlbum(album)
        if (album == null && store.current().isNotEmpty()) {
            store.clear()
            WidgetUpdater.refresh(context)
        }
        return album
    }

    suspend fun createAlbum(): AlbumInfo {
        val album = SupabaseApi.parseAlbum(api().rpc("create_album"))
            ?: throw ApiException(500, "Respuesta inesperada al crear el álbum")
        setAlbum(album)
        return album
    }

    suspend fun joinAlbum(code: String): AlbumInfo {
        val args = buildJsonObject { put("p_code", code.trim().uppercase()) }
        val album = SupabaseApi.parseAlbum(api().rpc("join_album", args))
            ?: throw ApiException(500, "Respuesta inesperada al unirse")
        setAlbum(album)
        runCatching { sync() } // si falla, la pantalla del álbum reintenta en 5 s
        return album
    }

    suspend fun leaveAlbum() = mutex.withLock {
        // Se pregunta al servidor: el número guardado puede estar desfasado si
        // la pareja se acaba de unir, y entonces no hay que borrar nada.
        val album = SupabaseApi.parseAlbum(api().rpc("my_album"))
        if (album != null && album.members <= 1) {
            // Última persona: borra también los archivos, que el SQL no puede.
            runCatching { api().removeObjects(api().listPhotos(album.id).map { it.storagePath }) }
        }
        api().rpc("leave_album")
        setAlbum(null)
        store.clear()
        WidgetUpdater.refresh(context)
    }

    suspend fun removePartner() {
        api().rpc("remove_partner")
        refreshAlbum()
    }

    private fun setAlbum(album: AlbumInfo?) {
        sessions.saveAlbum(album)
        _album.value = album
    }

    // ─── Fotos ──────────────────────────────────────────────────────────

    /**
     * Trae del servidor lo nuevo y borra lo que ya no está. Devuelve true si
     * cambió algo. La usan la pantalla del álbum (cada pocos segundos) y el
     * trabajo periódico del widget.
     */
    suspend fun sync(): Boolean = mutex.withLock {
        if (!_configured.value) return false
        val album = refreshAlbum() ?: return false
        val remote = api().listPhotos(album.id)
        val before = store.current().map { it.id }.toSet()

        store.retainOnly(remote.map { it.id }.toSet())
        var added = false
        try {
            for (photo in remote) {
                if (store.contains(photo.id)) continue
                val bytes = try {
                    api().download(photo.storagePath)
                } catch (e: ApiException) {
                    continue // fila sin archivo (subida a medias): se ignora
                }
                withContext(Dispatchers.IO) {
                    store.put(LocalPhoto(photo.id, photo.storagePath, photo.createdAt), bytes)
                }
                added = true
            }
        } finally {
            val changed = before != store.current().map { it.id }.toSet()
            if (changed) WidgetUpdater.refresh(context, showNewest = added)
        }
        before != store.current().map { it.id }.toSet()
    }

    suspend fun addPhoto(uri: Uri) = mutex.withLock {
        val album = _album.value ?: throw IllegalStateException("No hay álbum")
        val jpeg = withContext(Dispatchers.IO) { ImageCompressor.compress(context.contentResolver, uri) }
        val id = UUID.randomUUID().toString()
        val path = "${album.id}/$id.jpg"
        api().upload(path, jpeg)
        val row = try {
            api().insertPhoto(id, album.id, path)
        } catch (e: Exception) {
            runCatching { api().removeObjects(listOf(path)) }
            throw e
        }
        withContext(Dispatchers.IO) { store.put(LocalPhoto(row.id, row.storagePath, row.createdAt), jpeg) }
        WidgetUpdater.refresh(context, showNewest = true)
    }

    suspend fun deletePhoto(photo: LocalPhoto) = mutex.withLock {
        api().deletePhotoRow(photo.id)
        // Si falla el borrado del archivo solo queda un huérfano invisible.
        runCatching { api().removeObjects(listOf(photo.storagePath)) }
        store.remove(photo.id)
        WidgetUpdater.refresh(context)
    }
}
