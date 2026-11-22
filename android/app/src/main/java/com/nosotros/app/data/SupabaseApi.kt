package com.nosotros.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/** Error devuelto por Supabase (HTTP no 2xx). Los fallos de red son IOException. */
class ApiException(val status: Int, message: String, val code: String? = null) : Exception(message)

@Serializable
data class RemotePhoto(
    val id: String,
    @SerialName("storage_path") val storagePath: String,
    @SerialName("created_at") val createdAt: String,
)

/**
 * Cliente mínimo de Supabase por REST: Auth anónimo, PostgREST y Storage.
 * Treinta líneas de OkHttp nos ahorran el SDK entero.
 */
class SupabaseApi(private val config: SupabaseConfig, private val sessions: SessionStore) {

    private val base = config.normalizedUrl
    private val apiKey = config.key.trim()
    private val authMutex = Mutex()

    // ─── Auth ───────────────────────────────────────────────────────────

    /** Devuelve una sesión válida: la guardada, renovada o una anónima nueva. */
    suspend fun ensureSession(): Session = authMutex.withLock {
        val current = sessions.load()
        when {
            current == null -> signInAnonymously()
            current.expiresAt - 60 < nowSeconds() -> refreshOrRestart(current)
            else -> current
        }
    }

    private suspend fun forceRefresh(stale: Session): Session = authMutex.withLock {
        val current = sessions.load()
        when {
            current == null -> signInAnonymously()
            current.accessToken != stale.accessToken -> current // otro hilo ya la renovó
            else -> refreshOrRestart(current)
        }
    }

    private suspend fun refreshOrRestart(session: Session): Session = try {
        val body = buildJsonObject { put("refresh_token", session.refreshToken) }
        parseSession(authCall("/auth/v1/token?grant_type=refresh_token", body))
    } catch (e: ApiException) {
        // El refresh token ya no vale (p. ej. el usuario anónimo se borró).
        // Se empieza una sesión nueva; el álbum habrá que volver a unirlo.
        if (e.status == 400 || e.status == 401 || e.status == 403) signInAnonymously() else throw e
    }

    private suspend fun signInAnonymously(): Session {
        val body = buildJsonObject { put("data", JsonObject(emptyMap())) }
        return parseSession(authCall("/auth/v1/signup", body))
    }

    private suspend fun authCall(path: String, body: JsonObject): JsonObject {
        val request = Request.Builder()
            .url(base + path)
            .header("apikey", apiKey)
            .post(body.toString().toRequestBody(JSON))
            .build()
        val (status, bytes) = execute(request)
        if (status !in 200..299) throw parseError(status, bytes)
        return json.parseToJsonElement(bytes.decodeToString()).jsonObject
    }

    private fun parseSession(obj: JsonObject): Session {
        val access = obj.string("access_token") ?: throw ApiException(500, "Respuesta de Auth sin access_token")
        val expiresIn = obj.string("expires_in")?.toLongOrNull() ?: 3600
        val session = Session(
            accessToken = access,
            refreshToken = obj.string("refresh_token") ?: "",
            expiresAt = obj.string("expires_at")?.toLongOrNull() ?: (nowSeconds() + expiresIn),
            userId = obj["user"]?.jsonObject?.string("id") ?: "",
        )
        sessions.save(session)
        return session
    }

    // ─── Base de datos ──────────────────────────────────────────────────

    suspend fun rpc(function: String, args: JsonObject = JsonObject(emptyMap())): JsonElement {
        val bytes = request("POST", "/rest/v1/rpc/$function", args.toString().toRequestBody(JSON))
        val text = bytes.decodeToString()
        return if (text.isBlank()) JsonNull else json.parseToJsonElement(text)
    }

    suspend fun listPhotos(albumId: String): List<RemotePhoto> {
        val bytes = request(
            "GET",
            "/rest/v1/photos?select=id,storage_path,created_at&album_id=eq.$albumId&order=created_at.desc",
        )
        return json.decodeFromString(bytes.decodeToString())
    }

    suspend fun insertPhoto(id: String, albumId: String, storagePath: String): RemotePhoto {
        val body = buildJsonObject {
            put("id", id)
            put("album_id", albumId)
            put("storage_path", storagePath)
        }
        val bytes = request(
            "POST", "/rest/v1/photos", body.toString().toRequestBody(JSON),
            mapOf("Prefer" to "return=representation"),
        )
        return json.decodeFromString<List<RemotePhoto>>(bytes.decodeToString()).first()
    }

    suspend fun deletePhotoRow(id: String) {
        request("DELETE", "/rest/v1/photos?id=eq.$id")
    }

    // ─── Storage ────────────────────────────────────────────────────────

    suspend fun upload(path: String, jpeg: ByteArray) {
        request(
            "POST", "/storage/v1/object/$BUCKET/$path", jpeg.toRequestBody(JPEG),
            mapOf("x-upsert" to "false", "cache-control" to "31536000"),
        )
    }

    suspend fun download(path: String): ByteArray =
        request("GET", "/storage/v1/object/authenticated/$BUCKET/$path")

    suspend fun removeObjects(paths: List<String>) {
        if (paths.isEmpty()) return
        val body = JsonObject(mapOf("prefixes" to JsonArray(paths.map { JsonPrimitive(it) })))
        request("DELETE", "/storage/v1/object/$BUCKET", body.toString().toRequestBody(JSON))
    }

    // ─── HTTP ───────────────────────────────────────────────────────────

    private suspend fun request(
        method: String,
        path: String,
        body: RequestBody? = null,
        headers: Map<String, String> = emptyMap(),
    ): ByteArray {
        var session = ensureSession()
        for (attempt in 0..1) {
            val request = Request.Builder()
                .url(base + path)
                .method(method, body)
                .header("apikey", apiKey)
                .header("Authorization", "Bearer ${session.accessToken}")
                .apply { headers.forEach { (k, v) -> header(k, v) } }
                .build()
            val (status, bytes) = execute(request)
            if (status in 200..299) return bytes
            val error = parseError(status, bytes)
            if (attempt == 0 && isExpiredToken(error)) {
                session = forceRefresh(session)
                continue
            }
            throw error
        }
        error("inalcanzable")
    }

    private fun isExpiredToken(e: ApiException): Boolean =
        e.status == 401 || e.message.orEmpty().contains("jwt", ignoreCase = true) &&
            e.message.orEmpty().contains("expired", ignoreCase = true)

    private suspend fun execute(request: Request): Pair<Int, ByteArray> = withContext(Dispatchers.IO) {
        http.newCall(request).execute().use { it.code to it.body.bytes() }
    }

    private fun parseError(status: Int, bytes: ByteArray): ApiException {
        val text = bytes.decodeToString()
        val obj = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull()
            ?: return ApiException(status, text.ifBlank { "HTTP $status" })
        val message = obj.string("message") ?: obj.string("msg") ?: obj.string("error_description")
            ?: obj.string("error") ?: "HTTP $status"
        val code = obj.string("code") ?: obj.string("error_code") ?: obj.string("statusCode")
        return ApiException(status, message, code)
    }

    private fun JsonObject.string(key: String): String? =
        (this[key] as? JsonPrimitive)?.contentOrNull

    private fun nowSeconds() = System.currentTimeMillis() / 1000

    companion object {
        const val BUCKET = "nosotros"
        private val JSON = "application/json".toMediaType()
        private val JPEG = "image/jpeg".toMediaType()
        private val json = Json { ignoreUnknownKeys = true }
        private val http = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()

        fun parseAlbum(element: JsonElement): AlbumInfo? {
            if (element is JsonNull) return null
            val obj = element as? JsonObject ?: return null
            val id = obj["album_id"]?.jsonPrimitive?.contentOrNull ?: return null
            val code = obj["code"]?.jsonPrimitive?.contentOrNull ?: return null
            val members = obj["members"]?.jsonPrimitive?.contentOrNull?.toIntOrNull() ?: 1
            return AlbumInfo(id, code, members)
        }
    }
}
