package com.nosotros.app.data

import android.content.Context
import androidx.core.content.edit

data class Session(
    val accessToken: String,
    val refreshToken: String,
    /** Segundos desde epoch. */
    val expiresAt: Long,
    val userId: String,
)

data class AlbumInfo(val id: String, val code: String, val members: Int)

/** Sesión anónima de Supabase y álbum actual, guardados en el teléfono. */
class SessionStore(context: Context, name: String = "sesion") {
    private val prefs = context.getSharedPreferences(name, Context.MODE_PRIVATE)

    fun load(): Session? {
        val access = prefs.getString("access_token", null) ?: return null
        val refresh = prefs.getString("refresh_token", null) ?: return null
        val user = prefs.getString("user_id", null) ?: return null
        return Session(access, refresh, prefs.getLong("expires_at", 0), user)
    }

    fun save(session: Session) {
        prefs.edit {
            putString("access_token", session.accessToken)
            putString("refresh_token", session.refreshToken)
            putLong("expires_at", session.expiresAt)
            putString("user_id", session.userId)
        }
    }

    fun loadAlbum(): AlbumInfo? {
        val id = prefs.getString("album_id", null) ?: return null
        val code = prefs.getString("album_code", null) ?: return null
        return AlbumInfo(id, code, prefs.getInt("album_members", 1))
    }

    fun saveAlbum(album: AlbumInfo?) {
        prefs.edit {
            if (album == null) {
                remove("album_id"); remove("album_code"); remove("album_members")
            } else {
                putString("album_id", album.id)
                putString("album_code", album.code)
                putInt("album_members", album.members)
            }
        }
    }

    fun clear() = prefs.edit { clear() }
}
