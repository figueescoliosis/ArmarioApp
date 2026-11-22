package com.nosotros.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InvitationTest {
    private val config = SupabaseConfig("https://abcdefgh.supabase.co/", "sb_publishable_AbC123-xyz_987654321")

    @Test
    fun `la invitación compartida se lee de vuelta entera`() {
        val parsed = Invitation.parse(Invitation.format(config, "K7Q2MZ"))!!
        assertEquals("K7Q2MZ", parsed.code)
        assertEquals("https://abcdefgh.supabase.co", parsed.config!!.normalizedUrl)
        assertEquals(config.key, parsed.config.key)
    }

    @Test
    fun `sobrevive al copiar desde WhatsApp con fecha y nombre delante`() {
        val pasted = "[22/11 15:30] Ana: " + Invitation.format(config, "K7Q2MZ")
        assertEquals("K7Q2MZ", Invitation.parse(pasted)!!.code)
    }

    @Test
    fun `acepta una clave anon con formato JWT`() {
        val jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJh"
        val parsed = Invitation.parse(Invitation.format(SupabaseConfig("https://x.supabase.co", jwt), "ABCDEF"))!!
        assertEquals(jwt, parsed.config?.key)
    }

    @Test
    fun `un código suelto o la línea Código sirven sin servidor`() {
        assertEquals(Invitation("ABC123", null), Invitation.parse("  abc123 "))
        assertEquals(Invitation("XYZ789", null), Invitation.parse("Hola!\nCódigo: xyz789"))
    }

    @Test
    fun `texto cualquiera no es una invitación`() {
        assertNull(Invitation.parse("te quiero mucho"))
        assertNull(Invitation.parse(""))
    }

    @Test
    fun `validación de la configuración`() {
        assertEquals(true, config.isValid())
        assertEquals(false, SupabaseConfig("http://x.supabase.co", config.key).isValid())
        assertEquals(false, SupabaseConfig("https://x.supabase.co", "corta").isValid())
    }
}
