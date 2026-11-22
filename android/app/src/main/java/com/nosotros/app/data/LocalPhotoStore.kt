package com.nosotros.app.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class LocalPhoto(val id: String, val storagePath: String, val createdAt: String)

/**
 * Copia local de las fotos del álbum. El widget lee solo de aquí, así que
 * funciona sin internet. index.json es la lista de fotos ya descargadas,
 * de la más nueva a la más vieja.
 */
class LocalPhotoStore(context: Context) {
    private val photoDir = File(context.filesDir, "fotos").apply { mkdirs() }
    private val thumbDir = File(context.filesDir, "miniaturas").apply { mkdirs() }
    private val indexFile = File(photoDir, "index.json")
    private val json = Json { ignoreUnknownKeys = true }

    private val _photos = MutableStateFlow(readIndex())
    val photos: StateFlow<List<LocalPhoto>> = _photos.asStateFlow()

    fun current(): List<LocalPhoto> = _photos.value

    fun file(photo: LocalPhoto) = File(photoDir, "${photo.id}.jpg")
    fun thumb(photo: LocalPhoto) = File(thumbDir, "${photo.id}.jpg")

    fun contains(id: String) = _photos.value.any { it.id == id }

    @Synchronized
    fun put(photo: LocalPhoto, jpeg: ByteArray) {
        writeAtomically(file(photo), jpeg)
        writeThumb(jpeg, thumb(photo))
        setIndex(_photos.value.filterNot { it.id == photo.id } + photo)
    }

    @Synchronized
    fun remove(id: String) {
        _photos.value.firstOrNull { it.id == id }?.let { deleteFiles(it) }
        setIndex(_photos.value.filterNot { it.id == id })
    }

    /** Borra todo lo que ya no está en el servidor. */
    @Synchronized
    fun retainOnly(ids: Set<String>) {
        val (keep, drop) = _photos.value.partition { it.id in ids }
        if (drop.isEmpty()) return
        drop.forEach(::deleteFiles)
        setIndex(keep)
    }

    @Synchronized
    fun clear() {
        _photos.value.forEach(::deleteFiles)
        setIndex(emptyList())
    }

    private fun deleteFiles(photo: LocalPhoto) {
        file(photo).delete()
        thumb(photo).delete()
    }

    private fun setIndex(list: List<LocalPhoto>) {
        val sorted = list.sortedByDescending { it.createdAt }
        writeAtomically(indexFile, json.encodeToString(sorted).toByteArray())
        _photos.value = sorted
    }

    private fun readIndex(): List<LocalPhoto> = runCatching {
        json.decodeFromString<List<LocalPhoto>>(indexFile.readText())
            .filter { File(photoDir, "${it.id}.jpg").exists() }
    }.getOrDefault(emptyList())

    private fun writeThumb(jpeg: ByteArray, target: File) {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, bounds)
        val options = BitmapFactory.Options().apply {
            inSampleSize = ImageCompressor.sampleSizeFor(bounds.outWidth, bounds.outHeight, THUMB_SIZE)
        }
        val bitmap = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.size, options) ?: return
        val bytes = java.io.ByteArrayOutputStream().use { out ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
            out.toByteArray()
        }
        bitmap.recycle()
        writeAtomically(target, bytes)
    }

    private fun writeAtomically(target: File, bytes: ByteArray) {
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.writeBytes(bytes)
        if (!tmp.renameTo(target)) {
            target.delete()
            tmp.renameTo(target)
        }
    }

    companion object {
        private const val THUMB_SIZE = 400
    }
}
