package com.nosotros.app.data

import android.content.Context
import androidx.core.content.edit
import com.nosotros.app.BuildConfig

/** Datos del proyecto de Supabase: la URL y la clave pública (anon / publishable). */
data class SupabaseConfig(val url: String, val key: String) {
    val normalizedUrl: String get() = url.trim().trimEnd('/')

    fun isValid(): Boolean =
        normalizedUrl.startsWith("https://") && normalizedUrl.length > 12 && key.trim().length > 20
}

/**
 * La configuración sale de local.properties (compilada en BuildConfig) o, si la
 * APK se compiló sin ella, de lo que el usuario pegó en la primera pantalla.
 */
class ConfigStore(context: Context) {
    private val prefs = context.getSharedPreferences("ajustes", Context.MODE_PRIVATE)

    val isBuiltIn: Boolean = BuildConfig.SUPABASE_URL.isNotBlank() && BuildConfig.SUPABASE_KEY.isNotBlank()

    fun current(): SupabaseConfig? {
        if (isBuiltIn) return SupabaseConfig(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_KEY)
        val url = prefs.getString(KEY_URL, null) ?: return null
        val key = prefs.getString(KEY_KEY, null) ?: return null
        return SupabaseConfig(url, key)
    }

    fun save(config: SupabaseConfig) {
        prefs.edit {
            putString(KEY_URL, config.normalizedUrl)
            putString(KEY_KEY, config.key.trim())
        }
    }

    var rotationMinutes: Int
        get() = prefs.getInt(KEY_ROTATION, DEFAULT_ROTATION)
        set(value) = prefs.edit { putInt(KEY_ROTATION, value) }

    companion object {
        private const val KEY_URL = "supabase_url"
        private const val KEY_KEY = "supabase_key"
        private const val KEY_ROTATION = "rotacion_min"
        const val DEFAULT_ROTATION = 30
        val ROTATION_OPTIONS = listOf(15, 30, 60)
    }
}

/**
 * Invitación que se comparte por WhatsApp o similar. Lleva el código y, para
 * que el segundo teléfono no tenga que teclear nada, la URL y la clave pública
 * de Supabase (la clave anon está pensada para ir en la app: lo que protege
 * los datos son las políticas RLS).
 */
data class Invitation(val code: String, val config: SupabaseConfig?) {
    companion object {
        private val FULL = Regex("""nosotros:(https://\S+?)\|(\S+?)\|([A-Za-z0-9]{6})""")
        private val CODE_LINE = Regex("""[Cc][óo]digo:\s*([A-Za-z0-9]{6})""")
        private val BARE = Regex("""^\s*([A-Za-z0-9]{6})\s*$""")

        fun format(config: SupabaseConfig, code: String): String = buildString {
            appendLine("💞 Únete a nuestro álbum en Nosotros")
            appendLine("Código: $code")
            appendLine()
            appendLine("Copia este mensaje entero, abre Nosotros y toca «Pegar invitación».")
            append("nosotros:${config.normalizedUrl}|${config.key.trim()}|$code")
        }

        fun parse(text: String): Invitation? {
            FULL.find(text)?.let { m ->
                val (url, key, code) = m.destructured
                return Invitation(code.uppercase(), SupabaseConfig(url, key))
            }
            val code = CODE_LINE.find(text)?.groupValues?.get(1) ?: BARE.find(text)?.groupValues?.get(1)
            return code?.let { Invitation(it.uppercase(), null) }
        }
    }
}
