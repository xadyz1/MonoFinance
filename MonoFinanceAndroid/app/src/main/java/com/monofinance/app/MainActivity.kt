package com.monofinance.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.monofinance.app.databinding.ActivityMainBinding
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var okHttpClient: OkHttpClient
    private lateinit var sharedPreferences: SharedPreferences
    
    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    
    private var serverUrl = ""
    private var username = ""
    private var isLoggedIn = false
    
    // Cache for server data
    private var currentSavingsTarget = 10000.0
    private var currentRecurringExpensesJson = "[]"
    private var transactionsList = JsonArray()

    // Animation variables (60 FPS smooth transitions)
    private val animationHandler = Handler(Looper.getMainLooper())
    private var isAnimating = false
    private var currentRms = 0f

    private var animationCols = 70
    private var animationRows = 90
    private var animationAspect = 0.55f
    private var intensityGrid: Array<FloatArray>? = null

    // Smoothly interpolated animation state values
    private var activeSpeed = 0.035f
    private var activeAmplitude = 0.25f

    private val animationRunnable = object : Runnable {
        override fun run() {
            if (!isAnimating) return
            
            val cols = animationCols
            val rows = animationRows
            val aspect = animationAspect
            val centerX = cols / 2.0f
            // Shift center slightly up above the buttons
            val centerY = (rows / 2.0f) - 6.0f 
            val sb = StringBuilder()
            
            val rmsVal = currentRms.coerceAtLeast(0f)

            // Initialize or resize temporal intensity grid buffer
            var grid = intensityGrid
            if (grid == null || grid.size != rows || grid[0].size != cols) {
                grid = Array(rows) { FloatArray(cols) }
                intensityGrid = grid
            }

            // Determine targets based on state and voice volume
            val targetSpeed: Float
            val targetAmplitude: Float
            if (isListening) {
                targetSpeed = if (rmsVal < 1.5f) 0.02f else (0.02f + rmsVal * 0.012f)
                targetAmplitude = if (rmsVal < 1.5f) 0.25f else (0.25f + rmsVal * 0.12f)
            } else {
                targetSpeed = 0.038f // Fast, smooth, lively movement in calm state
                targetAmplitude = 0.25f // Faint, subtle ambient wave amplitude
            }

            // Smoothly interpolate active animation parameters to prevent jumps
            activeSpeed = activeSpeed + (targetSpeed - activeSpeed) * 0.15f
            activeAmplitude = activeAmplitude + (targetAmplitude - activeAmplitude) * 0.15f

            animationPhase += activeSpeed
            
            for (y in 0 until rows) {
                for (x in 0 until cols) {
                    val dx = (x - centerX) * aspect
                    val dy = (y - centerY)
                    val dist = Math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()
                    
                    // Unified Volumetric Wave Generator (alternating crests and troughs for volume depth)
                    val wave = Math.sin((dist * 0.38f - animationPhase).toDouble()).toFloat()
                    val maxDist = 28f
                    val fade = (1f - (dist / maxDist)).coerceIn(0f, 1f)
                    
                    val targetIntensity = (wave * fade * activeAmplitude).coerceIn(0f, 1f)

                    // Apply temporal smoothing (persistence/decay blur)
                    val currentVal = grid[y][x]
                    val newVal = if (targetIntensity > currentVal) {
                        // Fast rise (fade-in)
                        currentVal + (targetIntensity - currentVal) * 0.35f
                    } else {
                        // Moderately fast decay to keep wave boundaries volumetric and sharp
                        currentVal + (targetIntensity - currentVal) * 0.14f
                    }
                    val pixelIntensity = newVal.coerceIn(0f, 1f)
                    grid[y][x] = pixelIntensity

                    // Map smoothed intensity to smooth-fading character ramp
                    val char = when {
                        pixelIntensity > 0.85f -> '@'
                        pixelIntensity > 0.70f -> '%'
                        pixelIntensity > 0.55f -> '#'
                        pixelIntensity > 0.40f -> '*'
                        pixelIntensity > 0.25f -> '+'
                        pixelIntensity > 0.12f -> '='
                        pixelIntensity > 0.04f -> '.'
                        else -> '\u00A0'
                    }
                    sb.append(char)
                }
                sb.append('\n')
            }
            
            binding.tvAsciiAnimation.text = sb.toString()
            
            if (isAnimating) {
                animationHandler.postDelayed(this, 16) // ~60 FPS
            }
        }
    }

    private var animationPhase = 0f

    companion object {
        private const val REQUEST_RECORD_AUDIO_PERMISSION = 200
        private const val PREFS_NAME = "MonoFinancePrefs"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_USERNAME = "username"
        private const val KEY_COOKIES = "cookies"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Make status bar and navigation bar solid black to match true dark theme
        window.statusBarColor = android.graphics.Color.BLACK
        window.navigationBarColor = android.graphics.Color.BLACK

        setupDynamicGridSize()

        sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        initNetworkClient()
        initViews()
        checkSavedSession()
    }

    private fun setupDynamicGridSize() {
        val displayMetrics = resources.displayMetrics
        val density = displayMetrics.density
        val screenWidthDp = displayMetrics.widthPixels / density
        val screenHeightDp = displayMetrics.heightPixels / density

        // Set cols based on screen width. We aim for a high density look (e.g. 70 columns)
        animationCols = 70
        
        // Compute the text size in SP so that 70 monospace characters fit the screen width exactly
        val charWidthDp = screenWidthDp / animationCols.toFloat()
        // Multiply by 0.90f safety scaling factor to guarantee it fits 100% inside screen width without wrapping
        val textSizeSp = (charWidthDp / 0.55f) * 0.90f
        
        binding.tvAsciiAnimation.textSize = textSizeSp
        binding.tvAsciiAnimation.setLineSpacing(0f, 0.8f)
        
        // A monospace character's physical height is about 1.8 * charWidth
        // With lineSpacingMultiplier = 0.8, the line height is 1.8 * 0.8 * charWidth = 1.44 * charWidth
        val charHeightDp = charWidthDp * 1.8f * 0.8f
        animationRows = (screenHeightDp / charHeightDp).toInt() + 4
        animationAspect = 0.55f
        
        // Force reset intensity grid on layout configuration changes
        intensityGrid = null
    }

    private fun initNetworkClient() {
        val cookieJar = object : CookieJar {
            override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                val cookieStrings = cookies.map { it.toString() }.toSet()
                sharedPreferences.edit().putStringSet(KEY_COOKIES, cookieStrings).apply()
            }

            override fun loadForRequest(url: HttpUrl): List<Cookie> {
                val cookieStrings = sharedPreferences.getStringSet(KEY_COOKIES, emptySet()) ?: emptySet()
                val cookies = mutableListOf<Cookie>()
                for (cookieStr in cookieStrings) {
                    Cookie.parse(url, cookieStr)?.let { cookies.add(it) }
                }
                return cookies
            }
        }

        okHttpClient = OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .build()
    }

    private fun initViews() {
        binding.btnRecord.setOnClickListener {
            if (!isLoggedIn) {
                Toast.makeText(this, "Будь ласка, увійдіть в акаунт у налаштуваннях", Toast.LENGTH_LONG).show()
                showSettingsDialog()
                return@setOnClickListener
            }
            
            if (isListening) {
                stopSpeechRecognition()
            } else {
                startSpeechRecognition()
            }
        }

        binding.btnSettings.setOnClickListener {
            showSettingsDialog()
        }

        binding.btnLogs.setOnClickListener {
            if (!isLoggedIn) {
                Toast.makeText(this, "Будь ласка, спочатку увійдіть в акаунт", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            showHistoryDialog()
        }
    }

    private fun checkSavedSession() {
        serverUrl = sharedPreferences.getString(KEY_SERVER_URL, "") ?: ""
        if (serverUrl.isEmpty()) {
            updateLoginState(false, "")
            return
        }

        val request = Request.Builder()
            .url(normalizeUrl(serverUrl, "/api/me"))
            .get()
            .build()

        okHttpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread { updateLoginState(false, "") }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                if (response.isSuccessful && body.contains("username")) {
                    try {
                        val json = Gson().fromJson(body, JsonObject::class.java)
                        val user = json.get("username").asString
                        runOnUiThread { updateLoginState(true, user) }
                    } catch (e: Exception) {
                        runOnUiThread { updateLoginState(false, "") }
                    }
                } else {
                    runOnUiThread { updateLoginState(false, "") }
                }
            }
        })
    }

    private fun updateLoginState(loggedIn: Boolean, user: String) {
        isLoggedIn = loggedIn
        if (loggedIn) {
            username = user
            fetchFinanceData()
            startAnimation()
        } else {
            username = ""
            transactionsList = JsonArray()
            stopAnimation()
        }
    }

    private fun fetchFinanceData() {
        if (serverUrl.isEmpty()) return

        val request = Request.Builder()
            .url(normalizeUrl(serverUrl, "/api/data"))
            .get()
            .build()

        okHttpClient.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    try {
                        val json = Gson().fromJson(body, JsonObject::class.java)
                        transactionsList = json.getAsJsonArray("transactions")
                        currentSavingsTarget = json.get("savingsTarget")?.asDouble ?: 10000.0
                        currentRecurringExpensesJson = json.get("recurringExpenses")?.toString() ?: "[]"
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        })
    }

    private fun showSettingsDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_server_settings, null)
        val etUrl = dialogView.findViewById<EditText>(R.id.dialog_et_server_url)
        val etUser = dialogView.findViewById<EditText>(R.id.dialog_et_username)
        val etPass = dialogView.findViewById<EditText>(R.id.dialog_et_password)
        val tvStatus = dialogView.findViewById<TextView>(R.id.dialog_tv_status)
        val btnClose = dialogView.findViewById<Button>(R.id.dialog_btn_close)
        val btnLogin = dialogView.findViewById<Button>(R.id.dialog_btn_login)
        val btnLogout = dialogView.findViewById<Button>(R.id.dialog_btn_logout)

        // Prepopulate fields
        etUrl.setText(sharedPreferences.getString(KEY_SERVER_URL, "https://finance.swiftapps.cloud"))
        etUser.setText(sharedPreferences.getString(KEY_USERNAME, ""))

        if (isLoggedIn) {
            tvStatus.text = "Підключено як: $username"
            tvStatus.setTextColor(ContextCompat.getColor(this, R.color.type_income))
            btnLogout.visibility = View.VISIBLE
            btnLogin.visibility = View.GONE
        } else {
            tvStatus.text = "Не підключено"
            tvStatus.setTextColor(ContextCompat.getColor(this, R.color.text_secondary))
            btnLogout.visibility = View.GONE
            btnLogin.visibility = View.VISIBLE
        }

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setCancelable(true)
            .create()

        btnClose.setOnClickListener {
            alertDialog.dismiss()
        }

        btnLogout.setOnClickListener {
            if (serverUrl.isEmpty()) return@setOnClickListener

            val request = Request.Builder()
                .url(normalizeUrl(serverUrl, "/api/logout"))
                .post("".toRequestBody())
                .build()

            btnLogout.isEnabled = false
            btnLogout.text = "Вихід..."

            okHttpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        clearSession()
                        updateLoginState(false, "")
                        alertDialog.dismiss()
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    runOnUiThread {
                        clearSession()
                        updateLoginState(false, "")
                        Toast.makeText(this@MainActivity, "Вихід успішний", Toast.LENGTH_SHORT).show()
                        alertDialog.dismiss()
                    }
                }
            })
        }

        btnLogin.setOnClickListener {
            val url = etUrl.text.toString().trim()
            val user = etUser.text.toString().trim()
            val password = etPass.text.toString().trim()

            if (url.isEmpty() || user.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Будь ласка, заповніть усі поля", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            sharedPreferences.edit()
                .putString(KEY_SERVER_URL, url)
                .putString(KEY_USERNAME, user)
                .apply()

            serverUrl = url

            val jsonBody = JsonObject().apply {
                addProperty("username", user)
                addProperty("password", password)
            }

            val requestBody = Gson().toJson(jsonBody)
                .toRequestBody("application/json; charset=utf-8".toMediaType())

            val request = Request.Builder()
                .url(normalizeUrl(url, "/api/login"))
                .post(requestBody)
                .build()

            btnLogin.isEnabled = false
            btnLogin.text = "Вхід..."
            btnClose.isEnabled = false

            okHttpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        btnLogin.isEnabled = true
                        btnLogin.text = "Увійти"
                        btnClose.isEnabled = true
                        Toast.makeText(this@MainActivity, "Помилка підключення: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    val body = response.body?.string() ?: ""
                    runOnUiThread {
                        btnLogin.isEnabled = true
                        btnLogin.text = "Увійти"
                        btnClose.isEnabled = true
                        if (response.isSuccessful) {
                            Toast.makeText(this@MainActivity, "Вхід успішний", Toast.LENGTH_SHORT).show()
                            updateLoginState(true, user)
                            alertDialog.dismiss()
                        } else {
                            var errMsg = "Неправильне ім'я користувача або пароль"
                            try {
                                val json = Gson().fromJson(body, JsonObject::class.java)
                                if (json.has("message")) {
                                    errMsg = json.get("message").asString
                                }
                            } catch (e: Exception) {}
                            Toast.makeText(this@MainActivity, errMsg, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            })
        }

        alertDialog.show()
    }

    private fun showHistoryDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_history, null)
        val container = dialogView.findViewById<LinearLayout>(R.id.ll_history_dialog_container)
        val btnClose = dialogView.findViewById<Button>(R.id.btn_history_dialog_close)

        val expensesList = JsonArray()
        for (i in 0 until transactionsList.size()) {
            val trans = transactionsList.get(i).asJsonObject
            val typeEl = trans.get("type")
            val typeStr = if (typeEl != null && !typeEl.isJsonNull) typeEl.asString else ""
            if (typeStr == "expense") {
                expensesList.add(trans)
            }
        }

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setCancelable(true)
            .create()

        btnClose.setOnClickListener {
            alertDialog.dismiss()
        }

        if (expensesList.size() == 0) {
            val tvEmpty = TextView(this).apply {
                text = "Немає збережених витрат"
                setTextColor(ContextCompat.getColor(this@MainActivity, R.color.text_secondary))
                textSize = 14f
                setPadding(0, 24, 0, 24)
                gravity = android.view.Gravity.CENTER
            }
            container.addView(tvEmpty)
        } else {
            val start = Math.max(0, expensesList.size() - 20) // Show last 20 expenses
            for (i in expensesList.size() - 1 downTo start) {
                val trans = expensesList.get(i).asJsonObject
                val descEl = trans.get("description")
                val amountEl = trans.get("amount")
                val dateEl = trans.get("date")
                val desc = if (descEl != null && !descEl.isJsonNull) descEl.asString else ""
                val amount = if (amountEl != null && !amountEl.isJsonNull) amountEl.asDouble else 0.0
                val date = if (dateEl != null && !dateEl.isJsonNull) dateEl.asString else ""

                val itemView = LayoutInflater.from(this).inflate(android.R.layout.simple_list_item_2, container, false)
                val t1 = itemView.findViewById<TextView>(android.R.id.text1)
                val t2 = itemView.findViewById<TextView>(android.R.id.text2)

                t1.text = desc
                t1.setTextColor(ContextCompat.getColor(this, R.color.text_primary))
                t1.textSize = 15f

                t2.text = "- $amount грн | $date"
                t2.setTextColor(ContextCompat.getColor(this, R.color.accent_orange))
                t2.textSize = 12f

                itemView.setPadding(0, 12, 0, 12)
                container.addView(itemView)
            }
        }

        alertDialog.show()
    }

    private fun startSpeechRecognition() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_RECORD_AUDIO_PERMISSION)
            return
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "uk-UA")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "uk-UA")
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "uk-UA")
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                isListening = true
                binding.btnRecord.text = "Стоп"
                binding.btnRecord.isSelected = true
                binding.tvRecordStatus.text = "Запис активовано"
                binding.tvRecordStatus.visibility = View.VISIBLE
            }

            override fun onBeginningOfSpeech() {}
            
            override fun onRmsChanged(rmsdB: Float) {
                currentRms = rmsdB
            }
            
            override fun onBufferReceived(buffer: ByteArray?) {}
            
            override fun onEndOfSpeech() {
                stopSpeechRecognitionState()
            }

            override fun onError(error: Int) {
                stopSpeechRecognitionState()
                val message = when (error) {
                    SpeechRecognizer.ERROR_AUDIO -> "Помилка запису аудіо"
                    SpeechRecognizer.ERROR_CLIENT -> "Помилка клієнта"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Недостатньо дозволів"
                    SpeechRecognizer.ERROR_NETWORK -> "Мережева помилка"
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Таймаут мережі"
                    SpeechRecognizer.ERROR_NO_MATCH -> "Не вдалося розпізнати мову"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Служба зайнята"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Немає звукового сигналу"
                    else -> "Помилка розпізнавання: $error"
                }
                Toast.makeText(this@MainActivity, message, Toast.LENGTH_SHORT).show()
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val textResult = matches[0]
                    showConfirmationDialog(textResult)
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        speechRecognizer?.startListening(intent)
    }

    private fun stopSpeechRecognition() {
        speechRecognizer?.stopListening()
        stopSpeechRecognitionState()
    }

    private fun stopSpeechRecognitionState() {
        isListening = false
        binding.btnRecord.text = "Запис"
        binding.btnRecord.isSelected = false
        binding.tvRecordStatus.text = ""
        binding.tvRecordStatus.visibility = View.GONE
    }

    private fun startAnimation() {
        if (isAnimating) return
        isAnimating = true
        animationPhase = 0f
        animationHandler.post(animationRunnable)
    }

    private fun stopAnimation() {
        isAnimating = false
        animationHandler.removeCallbacks(animationRunnable)
        showIdlePattern()
    }

    private fun showIdlePattern() {
        binding.tvAsciiAnimation.text = ""
    }

    private fun isNumericOrNumberWord(word: String): Boolean {
        val cleanWord = word.lowercase(Locale.ROOT).replace(Regex("[.,!?]"), "")
        if (cleanWord.matches(Regex("\\d+([.,]\\d+)?"))) {
            return true
        }
        val numberWords = setOf(
            "один", "одна", "одне", "два", "дві", "три", "чотири",
            "п'ять", "п`ять", "п’ять", "шість", "сім", "вісім", "дев'ять", "десять",
            "одинадцять", "дванадцять", "тринадцять", "чотирнадцять", "п'ятнадцять",
            "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять",
            "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят", "дев'яносто",
            "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот", "вісімсот", "дев'ятсот",
            "тисяча", "тисячі", "тисяч"
        )
        return numberWords.contains(cleanWord)
    }

    private fun showConfirmationDialog(dictatedText: String) {
        val words = dictatedText.split(Regex("\\s+"))
        val parsedItems = mutableListOf<Pair<String, Double>>()

        val currentDesc = mutableListOf<String>()
        val currentAmt = mutableListOf<String>()
        val conjunctions = setOf("і", "й", "та", "також", "ще", "плюс", "а")

        fun saveCurrentItem() {
            val rawDesc = currentDesc.joinToString(" ")
            val rawAmt = currentAmt.joinToString(" ")
            
            val cleanDesc = cleanDescription(rawDesc)
            val amount = extractNumber(rawAmt)
            
            if (cleanDesc.isNotEmpty() || amount > 0.0) {
                val finalDesc = if (cleanDesc.isEmpty()) "Витрата" else cleanDesc.replaceFirstChar { 
                    if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() 
                }
                parsedItems.add(Pair(finalDesc, amount))
            }
            currentDesc.clear()
            currentAmt.clear()
        }

        for (word in words) {
            val cleanWord = word.replace(Regex("[.,!?]"), "").lowercase(Locale.ROOT)
            if (conjunctions.contains(cleanWord)) {
                // If we already have a parsed item segment, conjunction acts as split boundary
                if (currentDesc.isNotEmpty() && currentAmt.isNotEmpty()) {
                    saveCurrentItem()
                }
                continue
            }

            if (isNumericOrNumberWord(word)) {
                currentAmt.add(word)
            } else {
                if (currentAmt.isNotEmpty()) {
                    // We transition from a number to a new product word: save previous item!
                    saveCurrentItem()
                }
                currentDesc.add(word)
            }
        }

        if (currentDesc.isNotEmpty() || currentAmt.isNotEmpty()) {
            saveCurrentItem()
        }

        if (parsedItems.isEmpty()) {
            Toast.makeText(this, "Не вдалося знайти витрати у записаному тексті", Toast.LENGTH_LONG).show()
            return
        }

        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_confirm_transactions, null)
        val tvDictated = dialogView.findViewById<TextView>(R.id.tv_dictated_text)
        val container = dialogView.findViewById<LinearLayout>(R.id.ll_dialog_items_container)
        val btnCancel = dialogView.findViewById<Button>(R.id.btn_dialog_cancel)
        val btnSubmit = dialogView.findViewById<Button>(R.id.btn_dialog_submit)

        tvDictated.text = "Результат запису: \"$dictatedText\""

        val rowViews = mutableListOf<View>()

        for (item in parsedItems) {
            val rowView = LayoutInflater.from(this).inflate(R.layout.parsed_item_row, container, false)
            val etDesc = rowView.findViewById<EditText>(R.id.et_item_description)
            val etAmount = rowView.findViewById<EditText>(R.id.et_item_amount)
            val btnDelete = rowView.findViewById<Button>(R.id.btn_delete_item)

            etDesc.setText(item.first)
            etAmount.setText(if (item.second > 0) item.second.toString() else "")

            btnDelete.setOnClickListener {
                container.removeView(rowView)
                rowViews.remove(rowView)
                if (rowViews.isEmpty()) {
                    btnSubmit.isEnabled = false
                }
            }

            container.addView(rowView)
            rowViews.add(rowView)
        }

        val alertDialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .setCancelable(false)
            .create()

        btnCancel.setOnClickListener {
            alertDialog.dismiss()
        }

        btnSubmit.setOnClickListener {
            btnSubmit.isEnabled = false
            btnSubmit.text = "Обробка..."
            btnCancel.isEnabled = false

            val tempNewTransactions = mutableListOf<JsonObject>()

            for (i in 0 until container.childCount) {
                val rowView = container.getChildAt(i)
                val etDesc = rowView.findViewById<EditText>(R.id.et_item_description)
                val etAmount = rowView.findViewById<EditText>(R.id.et_item_amount)

                val description = etDesc.text.toString().trim()
                val amountStr = etAmount.text.toString().trim()

                if (description.isEmpty() || amountStr.isEmpty()) {
                    Toast.makeText(this, "Заповніть опис та суму для всіх пунктів", Toast.LENGTH_SHORT).show()
                    btnSubmit.isEnabled = true
                    btnSubmit.text = "Надіслати"
                    btnCancel.isEnabled = true
                    return@setOnClickListener
                }

                val amount = try {
                    amountStr.toDouble()
                } catch (e: Exception) {
                    Toast.makeText(this, "Неправильний формат суми у рядку ${i+1}", Toast.LENGTH_SHORT).show()
                    btnSubmit.isEnabled = true
                    btnSubmit.text = "Надіслати"
                    btnCancel.isEnabled = true
                    return@setOnClickListener
                }

                val dateStr = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())

                val newTransaction = JsonObject().apply {
                    addProperty("id", (System.currentTimeMillis() + i).toString())
                    addProperty("amount", amount)
                    addProperty("type", "expense")
                    addProperty("description", description)
                    addProperty("date", dateStr)
                }

                tempNewTransactions.add(newTransaction)
            }

            if (tempNewTransactions.isEmpty()) {
                Toast.makeText(this, "Немає витрат для збереження", Toast.LENGTH_SHORT).show()
                btnSubmit.isEnabled = true
                btnSubmit.text = "Надіслати"
                btnCancel.isEnabled = true
                return@setOnClickListener
            }

            // Sync with server
            for (newTx in tempNewTransactions) {
                transactionsList.add(newTx)
            }

            val syncObject = JsonObject().apply {
                add("transactions", transactionsList)
                addProperty("savingsTarget", currentSavingsTarget)
                add("recurringExpenses", Gson().fromJson(currentRecurringExpensesJson, JsonArray::class.java))
            }

            val requestBody = Gson().toJson(syncObject)
                .toRequestBody("application/json; charset=utf-8".toMediaType())

            val request = Request.Builder()
                .url(normalizeUrl(serverUrl, "/api/data"))
                .post(requestBody)
                .build()

            btnSubmit.text = "Надсилання..."

            okHttpClient.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    runOnUiThread {
                        btnSubmit.isEnabled = true
                        btnSubmit.text = "Надіслати"
                        btnCancel.isEnabled = true
                        Toast.makeText(this@MainActivity, "Помилка надсилання: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onResponse(call: Call, response: Response) {
                    runOnUiThread {
                        if (response.isSuccessful) {
                            Toast.makeText(this@MainActivity, "Витрати успішно додано", Toast.LENGTH_SHORT).show()
                            alertDialog.dismiss()
                            fetchFinanceData() // Reload latest data state
                        } else {
                            btnSubmit.isEnabled = true
                            btnSubmit.text = "Надіслати"
                            btnCancel.isEnabled = true
                            Toast.makeText(this@MainActivity, "Помилка сервера: ${response.code}", Toast.LENGTH_LONG).show()
                        }
                    }
                }
            })
        }

        alertDialog.show()
    }

    private fun clearSession() {
        sharedPreferences.edit().remove(KEY_COOKIES).apply()
    }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        stopAnimation()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_RECORD_AUDIO_PERMISSION) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startSpeechRecognition()
            } else {
                Toast.makeText(this, "Дозвіл на запис аудіо необхідний для розпізнавання голосу", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun extractNumber(text: String): Double {
        val lowercaseText = text.lowercase(Locale.ROOT)
        
        val numericRegex = Regex("\\b\\d+([.,]\\d+)?\\b")
        val matches = numericRegex.findAll(lowercaseText).toList()
        if (matches.isNotEmpty()) {
            val rawNum = matches.last().value.replace(",", ".")
            try {
                return rawNum.toDouble()
            } catch (e: Exception) {}
        }

        val words = lowercaseText.split(Regex("\\s+"))
        var totalAmount = 0.0
        var tempAmount = 0.0
        
        val numberMap = mapOf(
            "один" to 1, "одна" to 1, "одне" to 1,
            "два" to 2, "дві" to 2,
            "три" to 3,
            "чотири" to 4,
            "п'ять" to 5, "п`ять" to 5, "п’ять" to 5,
            "шість" to 6,
            "сім" to 7,
            "вісім" to 8,
            "дев'ять" to 9, "дев`ять" to 9, "дев’ять" to 9,
            "десять" to 10,
            "одинадцять" to 11,
            "дванадцять" to 12,
            "тринадцять" to 13,
            "чотирнадцять" to 14,
            "п'ятнадцять" to 15, "п`ятнадцять" to 15, "п’ятнадцять" to 15,
            "шістнадцять" to 16,
            "сімнадцять" to 17,
            "вісімнадцять" to 18,
            "дев'ятнадцять" to 19,
            "двадцять" to 20,
            "тридцять" to 30,
            "сорок" to 40,
            "п'ятдесят" to 50, "п`ятдесят" to 50, "п’ятдесят" to 50, "шістдесят" to 60,
            "сімдесят" to 70,
            "вісімдесят" to 80,
            "дев'яносто" to 90, "дев`яносто" to 90, "дев’яносто" to 90,
            "сто" to 100,
            "двісті" to 200,
            "триста" to 300,
            "чотириста" to 400,
            "п'ятсот" to 500, "п`ятсот" to 500, "п’ятсот" to 500,
            "шістсот" to 600,
            "сімсот" to 700,
            "вісімсот" to 800,
            "дев'ятсот" to 900, "дев`ятсот" to 900, "дев’ятсот" to 900,
            "тисяча" to 1000, "тисячі" to 1000, "тисяч" to 1000
        )

        for (word in words) {
            val cleanWord = word.replace(Regex("[.,!?]"), "")
            if (numberMap.containsKey(cleanWord)) {
                val value = numberMap[cleanWord]!!
                if (value == 1000) {
                    if (tempAmount == 0.0) tempAmount = 1.0
                    totalAmount += tempAmount * 1000
                    tempAmount = 0.0
                } else {
                    tempAmount += value
                }
            }
        }
        totalAmount += tempAmount

        return totalAmount
    }

    private fun cleanDescription(text: String): String {
        val lowercaseText = text.lowercase(Locale.ROOT)
        val removePatterns = listOf(
            "гривень", "гривні", "гривня", "грн", "рублів", "євро", "доларів", "долари",
            "один", "одна", "одне", "два", "дві", "три", "чотири", "п'ять", "п`ять", "п’ять",
            "шість", "сім", "вісім", "дев'ять", "десять", "одинадцять", "дванадцять", "тринадцять",
            "чотирнадцять", "п'ятнадцять", "шістнадцять", "сімнадцять", "вісімнадцять", "дев'ятнадцять",
            "двадцять", "тридцять", "сорок", "п'ятдесят", "шістдесят", "сімдесят", "вісімдесят",
            "дев'яносто", "сто", "двісті", "триста", "чотириста", "п'ятсот", "шістсот", "сімсот",
            "вісімсот", "дев'ятсот", "тисяча", "тисячі", "тисяч",
            "купив", "купила", "купити", "взяв", "взяла", "придбав", "придбала", "придбати",
            "заплатив", "заплатила", "заплатити", "за", "на", "ціна", "вартість", "коштує", "коштують"
        )

        val words = lowercaseText.split(Regex("\\s+"))
        val cleanWords = mutableListOf<String>()

        for (word in words) {
            val cleanWord = word.replace(Regex("[.,!?]"), "")
            if (cleanWord.matches(Regex("\\d+([.,]\\d+)?"))) {
                continue
            }
            if (!removePatterns.contains(cleanWord)) {
                cleanWords.add(word)
            }
        }

        return cleanWords.joinToString(" ").trim()
    }

    private fun normalizeUrl(base: String, endpoint: String): String {
        var cleanBase = base.trim()
        if (!cleanBase.startsWith("http://") && !cleanBase.startsWith("https://")) {
            cleanBase = "http://$cleanBase"
        }
        if (cleanBase.endsWith("/")) {
            cleanBase = cleanBase.substring(0, cleanBase.length - 1)
        }
        return "$cleanBase$endpoint"
    }
}
