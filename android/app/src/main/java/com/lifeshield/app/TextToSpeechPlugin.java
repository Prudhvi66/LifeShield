package com.lifeshield.app;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "TextToSpeech")
public class TextToSpeechPlugin extends Plugin implements TextToSpeech.OnInitListener {

    private static final String TAG = "TextToSpeechPlugin";
    private TextToSpeech tts;
    private boolean ttsReady = false;
    private CountDownLatch initLatch = new CountDownLatch(1);

    private static final Map<String, Locale> LANGUAGE_MAP = new HashMap<>();
    static {
        LANGUAGE_MAP.put("en", Locale.ENGLISH);
        LANGUAGE_MAP.put("hi", new Locale("hi", "IN"));
        LANGUAGE_MAP.put("te", new Locale("te", "IN"));
    }

    @Override
    public void load() {
        super.load();
        Context ctx = getContext();
        if (ctx != null) {
            tts = new TextToSpeech(ctx, this);
            Log.d(TAG, "TTS instance created");
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            ttsReady = true;
            Log.d(TAG, "TTS initialized successfully");
        } else {
            ttsReady = false;
            Log.e(TAG, "TTS init failed with status: " + status);
        }
        initLatch.countDown();
    }

    private boolean waitForInit(long timeoutMs) throws InterruptedException {
        if (ttsReady) return true;
        return initLatch.await(timeoutMs, TimeUnit.MILLISECONDS);
    }

    private Locale resolveLocale(String langCode) {
        Locale loc = LANGUAGE_MAP.get(langCode);
        if (loc == null) loc = Locale.ENGLISH;

        int result = tts.isLanguageAvailable(loc);
        if (result >= TextToSpeech.LANG_AVAILABLE) {
            return loc;
        }

        // Try base language without country code
        Locale base = new Locale(langCode);
        result = tts.isLanguageAvailable(base);
        if (result >= TextToSpeech.LANG_AVAILABLE) {
            return base;
        }

        Log.w(TAG, "Language " + langCode + " not available on device, falling back to English");
        return Locale.ENGLISH;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", tts != null && ttsReady);
        call.resolve(result);
    }

    @PluginMethod
    public void getAvailableLanguages(PluginCall call) {
        JSObject result = new JSObject();
        if (tts == null || !ttsReady) {
            result.put("languages", new String[]{});
            call.resolve(result);
            return;
        }

        Set<Locale> locales = tts.getAvailableLanguages();
        String[] langs = new String[locales.size()];
        int i = 0;
        for (Locale loc : locales) {
            langs[i++] = loc.getLanguage();
        }
        result.put("languages", langs);
        call.resolve(result);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        String lang = call.getString("lang", "en");
        float rate = call.getFloat("rate", 1.0f).floatValue();

        if (text.isEmpty()) {
            call.reject("Text is empty");
            return;
        }

        // Check master voice if provided
        Boolean masterEnabled = call.getBoolean("masterVoiceEnabled", true);
        if (!masterEnabled) {
            JSObject result = new JSObject();
            result.put("skipped", true);
            result.put("reason", "master_voice_off");
            call.resolve(result);
            return;
        }

        if (tts == null) {
            call.reject("TTS not initialized");
            return;
        }

        try {
            if (!waitForInit(3000)) {
                call.reject("TTS initialization timeout");
                return;
            }
        } catch (InterruptedException e) {
            call.reject("TTS initialization interrupted");
            return;
        }

        if (!ttsReady) {
            call.reject("TTS not available on this device");
            return;
        }

        // Set language with fallback
        Locale resolvedLocale = resolveLocale(lang);
        tts.setLanguage(resolvedLocale);
        tts.setSpeechRate(rate);

        String utteranceId = "lifeshield_" + System.currentTimeMillis();

        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                Log.d(TAG, "TTS started: " + text.substring(0, Math.min(text.length(), 50)));
                JSObject data = new JSObject();
                data.put("event", "started");
                data.put("utteranceId", utteranceId);
                notifyListeners("ttsEvent", data);
            }

            @Override
            public void onDone(String utteranceId) {
                Log.d(TAG, "TTS completed");
                JSObject data = new JSObject();
                data.put("event", "ended");
                data.put("utteranceId", utteranceId);
                notifyListeners("ttsEvent", data);
            }

            @Override
            public void onError(String utteranceId) {
                Log.e(TAG, "TTS error for utterance: " + utteranceId);
                JSObject data = new JSObject();
                data.put("event", "error");
                data.put("utteranceId", utteranceId);
                data.put("reason", "utterance_error");
                notifyListeners("ttsEvent", data);
            }
        });

        Bundle params = new Bundle();
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
        int queueMode = TextToSpeech.QUEUE_ADD;

        int result = tts.speak(text, queueMode, params, utteranceId);

        JSObject response = new JSObject();
        if (result == TextToSpeech.SUCCESS) {
            response.put("success", true);
            response.put("language", resolvedLocale.getLanguage());
            response.put("utteranceId", utteranceId);
            call.resolve(response);
        } else {
            response.put("success", false);
            response.put("error", "speak_returned_" + result);
            call.resolve(response);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null && ttsReady) {
            tts.stop();
        }
        JSObject result = new JSObject();
        result.put("stopped", true);
        call.resolve(result);
    }

    @PluginMethod
    public void shutdown(PluginCall call) {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
            ttsReady = false;
            initLatch = new CountDownLatch(1);
        }
        JSObject result = new JSObject();
        result.put("shutdown", true);
        call.resolve(result);
    }

    @Override
    public void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
            ttsReady = false;
        }
        super.handleOnDestroy();
    }
}
