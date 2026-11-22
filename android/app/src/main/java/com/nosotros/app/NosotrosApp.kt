package com.nosotros.app

import android.app.Application
import android.content.Context
import com.nosotros.app.data.AlbumRepository
import com.nosotros.app.widget.RotationScheduler

class NosotrosApp : Application() {
    lateinit var repository: AlbumRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = AlbumRepository(this)
        RotationScheduler.schedule(this)
    }
}

val Context.repository: AlbumRepository
    get() = (applicationContext as NosotrosApp).repository
