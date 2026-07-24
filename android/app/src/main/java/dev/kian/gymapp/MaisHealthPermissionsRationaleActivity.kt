package dev.kian.gymapp

import android.app.Activity
import android.os.Bundle
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class MaisHealthPermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val density = resources.displayMetrics.density
        fun dp(value: Int): Int = (value * density).toInt()

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(32), dp(24), dp(24))
        }
        val title = TextView(this).apply {
            text = "How My Mettle uses health data"
            textSize = 24f
            setPadding(0, 0, 0, dp(16))
        }
        val body = TextView(this).apply {
            text = "My Mettle requests read-only access to health and fitness records that you explicitly enable. Heart-rate samples can be aligned with your own workout timestamps to estimate cardiovascular response and recovery. Steps and walking distance provide day-level activity context. Optional body-composition, nutrition, oxygen saturation, blood-glucose and VO₂ max records are supplementary evidence only.\n\nHealth records remain on this device inside My Mettle's private storage. They are not uploaded, sold or shared with advertisers. The local intelligence system receives provenance-linked summaries and cannot change Health Connect or Samsung Health records. You can revoke access at any time in Health Connect settings."
            textSize = 16f
            movementMethod = ScrollingMovementMethod()
        }
        val close = Button(this).apply {
            text = "Close"
            setOnClickListener { finish() }
        }

        content.addView(title, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        content.addView(body, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        content.addView(close, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(ScrollView(this).apply { addView(content) })
    }
}
