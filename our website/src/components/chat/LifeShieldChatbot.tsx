import React, { useState } from "react";
import { useApp } from "../../context/AppContext";

interface Message {
    id: number;
    sender: "user" | "bot";
    text: string;
    time: string;
}

const LifeShieldChatbot: React.FC = () => {
    // Read the same live health data used by the LifeShield dashboard
    const { vitals, user } = useApp();

    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            sender: "bot",
            text: "Hello! 👋 I'm your LifeShield AI Assistant. Ask me about your heart rate, SpO₂, temperature, blood pressure, steps, hydration, sleep, medicines, safety, or emergency features.",
            time: "Now",
        },
    ]);

    const getTime = () => {
        return new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // =========================================================
    // LIFE SHIELD AI RESPONSE ENGINE
    // Uses the actual values from the LifeShield app
    // =========================================================
    const generateReply = (question: string): string => {
        const q = question.toLowerCase().trim();

        // ❤️ HEART RATE
        if (
            q.includes("heart rate") ||
            q.includes("heart-rate") ||
            q.includes("pulse") ||
            q.includes("bpm") ||
            q === "heart"
        ) {
            const heartRate = vitals?.heartRate ?? 0;
            const baseline = user?.baseline?.restingHeartRate ?? 70;

            let status = "within the normal range shown by LifeShield.";

            if (heartRate > baseline + 20 || heartRate > 105) {
                status = "currently elevated.";
            } else if (heartRate < 50) {
                status = "currently low.";
            }

            return `❤️ Your current heart rate is ${heartRate} BPM. It is ${status}`;
        }

        // 🫁 SpO2
        if (
            q.includes("spo2") ||
            q.includes("sp02") ||
            q.includes("oxygen") ||
            q.includes("blood oxygen")
        ) {
            const spo2 = vitals?.spO2 ?? 0;

            return `🫁 Your current SpO₂ level is ${spo2}%.`;
        }

        // 🌡️ TEMPERATURE
        if (
            q.includes("temperature") ||
            q.includes("body temperature") ||
            q.includes("fever")
        ) {
            const temperature = vitals?.bodyTemperature ?? 0;

            return `🌡️ Your current body temperature is ${temperature}°C.`;
        }

        // 🩺 BLOOD PRESSURE
        if (
            q.includes("blood pressure") ||
            q.includes("bloodpressure") ||
            q === "bp"
        ) {
            const systolic = vitals?.bloodPressureSys ?? 0;
            const diastolic = vitals?.bloodPressureDia ?? 0;

            return `🩺 Your current blood pressure is ${systolic}/${diastolic} mmHg.`;
        }

        // 👣 STEPS
        if (
            q.includes("steps") ||
            q.includes("step count") ||
            q.includes("walking") ||
            q.includes("walked")
        ) {
            const steps = vitals?.stepsCount ?? 0;

            return `👣 You have completed ${steps.toLocaleString()} steps today.`;
        }

        // 💧 HYDRATION
        if (
            q.includes("hydration") ||
            q.includes("hydrated") ||
            q.includes("water")
        ) {
            const hydration = Math.round(vitals?.hydrationIndex ?? 0);

            return `💧 Your current hydration index is ${hydration}%.`;
        }

        // 😴 SLEEP
        if (
            q.includes("sleep") ||
            q.includes("slept") ||
            q.includes("sleeping")
        ) {
            const sleep = vitals?.sleepHours ?? 0;

            return `😴 Your recorded sleep duration is ${sleep} hours.`;
        }

        // 🏃 ACTIVITY
        if (
            q.includes("activity") ||
            q.includes("active") ||
            q.includes("exercise")
        ) {
            const activity = vitals?.activityLevel ?? "unknown";
            const steps = vitals?.stepsCount ?? 0;

            return `🏃 Your current activity level is ${activity}, with ${steps.toLocaleString()} steps recorded.`;
        }

        // 🦺 SAFETY
        if (
            q.includes("safety score") ||
            q.includes("safe") ||
            q.includes("safety")
        ) {
            return "🛡️ Your LifeShield dashboard provides a Safety Score based on your health, environment, and safety information.";
        }

        // 💊 MEDICINE
        if (
            q.includes("medicine") ||
            q.includes("medication") ||
            q.includes("tablet") ||
            q.includes("pills") ||
            q.includes("dose")
        ) {
            return "💊 Your Medicine Reminder section handles scheduled medicine reminders. Open the Health section to view your medicine schedule.";
        }

        // 🚨 EMERGENCY
        if (
            q.includes("emergency") ||
            q.includes("sos") ||
            q.includes("urgent")
        ) {
            return "🚨 If this is a real emergency, use the LifeShield Emergency/SOS feature immediately or contact your local emergency service. Do not rely on the chatbot for emergency medical care.";
        }

        // 🧍 FALL DETECTION
        if (
            q.includes("fall") ||
            q.includes("fell") ||
            q.includes("fall detection")
        ) {
            return "🧍 LifeShield includes fall-detection and emergency alert functionality. If a serious fall occurs, use the Emergency/SOS feature and seek emergency assistance.";
        }

        // ⌚ SMARTWATCH
        if (
            q.includes("smartwatch") ||
            q.includes("smart watch") ||
            q.includes("watch") ||
            q.includes("noise") ||
            q.includes("boult") ||
            q.includes("fire-boltt") ||
            q.includes("firebolt") ||
            q.includes("fire boltt")
        ) {
            return "⌚ LifeShield can work with supported smartwatch integrations for health and safety monitoring.";
        }

        // 🎤 VOICE
        if (
            q.includes("voice") ||
            q.includes("microphone") ||
            q.includes("speak") ||
            q.includes("listen")
        ) {
            return "🎤 Tap the microphone button and speak your LifeShield question. Your browser may ask for microphone permission.";
        }

        // 🔒 PRIVACY
        if (
            q.includes("privacy") ||
            q.includes("private") ||
            q.includes("data security") ||
            q.includes("secure")
        ) {
            return "🔐 You can review LifeShield's privacy and data settings in the Privacy Center.";
        }

        // ❤️ GENERAL HEALTH
        if (
            q.includes("health") ||
            q.includes("healthy") ||
            q.includes("vitals") ||
            q.includes("health data")
        ) {
            return `❤️ I can help you understand your LifeShield health information, including heart rate (${vitals?.heartRate ?? 0} BPM), SpO₂ (${vitals?.spO2 ?? 0}%), temperature (${vitals?.bodyTemperature ?? 0}°C), blood pressure (${vitals?.bloodPressureSys ?? 0}/${vitals?.bloodPressureDia ?? 0}), steps, hydration, and sleep.`;
        }

        // 👋 GREETING
        if (
            q === "hi" ||
            q === "hello" ||
            q === "hey" ||
            q.includes("good morning") ||
            q.includes("good evening")
        ) {
            return "👋 Hello! I'm your LifeShield AI Assistant. You can ask me about your heart rate, SpO₂, temperature, blood pressure, steps, hydration, sleep, medicines, safety, falls, emergencies, and smartwatch features.";
        }

        // ❌ OUTSIDE LIFESHIELD
        return "🛡️ I'm LifeShield AI. I can answer questions related to your LifeShield app, including your health readings, medicine reminders, safety features, emergency/SOS, fall detection, and smartwatch features.";
    };

    // =========================================================
    // SEND MESSAGE
    // =========================================================
    const sendMessage = (text?: string) => {
        const messageText = (text ?? input).trim();

        if (
            !messageText ||
            messageText === "Listening..." ||
            isTyping
        ) {
            return;
        }

        const userMessage: Message = {
            id: Date.now(),
            sender: "user",
            text: messageText,
            time: getTime(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        setTimeout(() => {
            const botMessage: Message = {
                id: Date.now() + 1,
                sender: "bot",
                text: generateReply(messageText),
                time: getTime(),
            };

            setMessages((prev) => [...prev, botMessage]);
            setIsTyping(false);
        }, 700);
    };

    // =========================================================
    // VOICE INPUT
    // =========================================================
    const startVoiceInput = () => {
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert(
                "Voice input is not supported. Please use Microsoft Edge or Google Chrome."
            );
            return;
        }

        const recognition = new SpeechRecognition();

        recognition.lang = "en-IN";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setInput("Listening...");
        };

        recognition.onresult = (event: any) => {
            const transcript =
                event.results?.[0]?.[0]?.transcript?.trim();

            if (transcript) {
                setInput(transcript);

                // Automatically send the spoken question
                setTimeout(() => {
                    sendMessage(transcript);
                }, 200);
            }
        };

        recognition.onerror = (event: any) => {
            console.log(
                "Speech recognition error:",
                event.error
            );

            setInput("");

            if (event.error === "not-allowed") {
                alert(
                    "Microphone permission is blocked. Please allow microphone access for localhost."
                );
            } else if (event.error === "no-speech") {
                alert(
                    "I couldn't hear you. Please speak clearly and try again."
                );
            } else if (event.error === "audio-capture") {
                alert(
                    "No microphone was detected. Please check your microphone."
                );
            } else {
                alert(
                    "Could not hear you. Please try again."
                );
            }
        };

        recognition.onend = () => {
            // Listening finished
        };

        try {
            recognition.start();
        } catch (error) {
            console.log(
                "Could not start voice recognition:",
                error
            );
            setInput("");
        }
    };

    return (
        <>
            {/* =========================================================
                FLOATING AI CHAT BUTTON
            ========================================================= */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    aria-label="Open LifeShield AI Assistant"
                    title="Open LifeShield AI"
                    style={{
                        position: "fixed",
                        right: "28px",
                        bottom: "28px",
                        width: "64px",
                        height: "64px",
                        borderRadius: "50%",
                        border: "none",
                        background:
                            "linear-gradient(135deg, #0f766e, #14b8a6)",
                        color: "#ffffff",
                        fontSize: "28px",
                        cursor: "pointer",
                        boxShadow:
                            "0 10px 30px rgba(0,0,0,0.22)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    💬
                </button>
            )}

            {/* =========================================================
                CHAT WINDOW
            ========================================================= */}
            {isOpen && (
                <div
                    style={{
                        position: "fixed",
                        right: "28px",
                        bottom: "28px",
                        width: "390px",
                        height: "600px",
                        background: "#ffffff",
                        borderRadius: "22px",
                        boxShadow:
                            "0 20px 60px rgba(0,0,0,0.25)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        zIndex: 9999,
                        border: "1px solid #e5e7eb",
                        fontFamily:
                            "Inter, Arial, Helvetica, sans-serif",
                    }}
                >
                    {/* =================================================
                        HEADER
                    ================================================= */}
                    <div
                        style={{
                            background:
                                "linear-gradient(135deg, #0f766e, #14b8a6)",
                            color: "#ffffff",
                            padding: "18px 20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                            }}
                        >
                            <div
                                style={{
                                    width: "44px",
                                    height: "44px",
                                    borderRadius: "50%",
                                    background:
                                        "rgba(255,255,255,0.18)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "23px",
                                }}
                            >
                                🛡️
                            </div>

                            <div>
                                <div
                                    style={{
                                        fontWeight: 700,
                                        fontSize: "16px",
                                        color: "#ffffff",
                                    }}
                                >
                                    LifeShield AI
                                </div>

                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "#ffffff",
                                        opacity: 0.9,
                                        marginTop: "3px",
                                    }}
                                >
                                    ● Online • Health & Safety Assistant
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setIsOpen(false)}
                            aria-label="Close LifeShield AI"
                            title="Close"
                            style={{
                                background:
                                    "rgba(255,255,255,0.15)",
                                border: "none",
                                color: "#ffffff",
                                width: "34px",
                                height: "34px",
                                borderRadius: "50%",
                                cursor: "pointer",
                                fontSize: "18px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* =================================================
                        MESSAGES
                    ================================================= */}
                    <div
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "18px",
                            background: "#f8fafc",
                        }}
                    >
                        {messages.length === 1 && (
                            <div
                                style={{
                                    background: "#ecfdf5",
                                    border:
                                        "1px solid #d1fae5",
                                    borderRadius: "14px",
                                    padding: "13px",
                                    marginBottom: "15px",
                                    fontSize: "12px",
                                    color: "#065f46",
                                    lineHeight: 1.5,
                                }}
                            >
                                🛡️{" "}
                                <strong
                                    style={{
                                        color: "#065f46",
                                    }}
                                >
                                    LifeShield Assistant
                                </strong>
                                <br />
                                Ask me about your live health
                                readings, medicines, emergencies,
                                fall detection, smartwatches,
                                and safety features.
                            </div>
                        )}

                        {messages.map((message) => (
                            <div
                                key={message.id}
                                style={{
                                    display: "flex",
                                    justifyContent:
                                        message.sender === "user"
                                            ? "flex-end"
                                            : "flex-start",
                                    marginBottom: "12px",
                                }}
                            >
                                <div
                                    style={{
                                        maxWidth: "82%",
                                        padding: "11px 14px",
                                        borderRadius:
                                            message.sender === "user"
                                                ? "16px 16px 4px 16px"
                                                : "16px 16px 16px 4px",
                                        background:
                                            message.sender === "user"
                                                ? "#0f766e"
                                                : "#ffffff",
                                        color:
                                            message.sender === "user"
                                                ? "#ffffff"
                                                : "#1f2937",
                                        border:
                                            message.sender === "user"
                                                ? "none"
                                                : "1px solid #e5e7eb",
                                        fontSize: "13px",
                                        lineHeight: 1.5,
                                        boxShadow:
                                            message.sender === "bot"
                                                ? "0 2px 8px rgba(0,0,0,0.04)"
                                                : "none",
                                    }}
                                >
                                    <div
                                        style={{
                                            color:
                                                message.sender === "user"
                                                    ? "#ffffff"
                                                    : "#1f2937",
                                        }}
                                    >
                                        {message.text}
                                    </div>

                                    <div
                                        style={{
                                            fontSize: "9px",
                                            marginTop: "5px",
                                            opacity: 0.6,
                                            textAlign:
                                                message.sender === "user"
                                                    ? "right"
                                                    : "left",
                                        }}
                                    >
                                        {message.time}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {isTyping && (
                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "flex-start",
                                    marginBottom: "12px",
                                }}
                            >
                                <div
                                    style={{
                                        background: "#ffffff",
                                        border:
                                            "1px solid #e5e7eb",
                                        borderRadius:
                                            "16px 16px 16px 4px",
                                        padding: "12px 16px",
                                        color: "#6b7280",
                                        fontSize: "13px",
                                    }}
                                >
                                    LifeShield is typing...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* =================================================
                        QUICK ACTIONS
                    ================================================= */}
                    <div
                        style={{
                            padding: "10px 14px",
                            borderTop:
                                "1px solid #e5e7eb",
                            background: "#ffffff",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "#6b7280",
                                marginBottom: "7px",
                            }}
                        >
                            QUICK ACTIONS
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: "6px",
                                overflowX: "auto",
                            }}
                        >
                            {[
                                ["❤️", "Heart Rate"],
                                ["💊", "Medicine"],
                                ["🚨", "Emergency"],
                                ["⌚", "Smartwatch"],
                            ].map(([icon, label]) => (
                                <button
                                    key={label}
                                    onClick={() =>
                                        sendMessage(label)
                                    }
                                    style={{
                                        whiteSpace: "nowrap",
                                        border:
                                            "1px solid #d1d5db",
                                        background: "#f9fafb",
                                        color: "#172033",
                                        borderRadius: "20px",
                                        padding: "7px 10px",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                    }}
                                >
                                    {icon} {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* =================================================
                        INPUT AREA
                    ================================================= */}
                    <div
                        style={{
                            padding: "12px",
                            background: "#ffffff",
                            borderTop:
                                "1px solid #e5e7eb",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "7px",
                                border:
                                    "1px solid #d1d5db",
                                borderRadius: "14px",
                                padding:
                                    "5px 6px 5px 12px",
                                background: "#f9fafb",
                            }}
                        >
                            <input
                                value={input}
                                onChange={(e) =>
                                    setInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        sendMessage();
                                    }
                                }}
                                placeholder="Ask LifeShield..."
                                style={{
                                    flex: 1,
                                    border: "none",
                                    outline: "none",
                                    background:
                                        "transparent",
                                    color: "#172033",
                                    fontSize: "13px",
                                    minWidth: 0,
                                    fontWeight: 500,
                                }}
                            />

                            {/* Voice */}
                            <button
                                onClick={startVoiceInput}
                                title="Voice input"
                                aria-label="Voice input"
                                style={{
                                    width: "35px",
                                    height: "35px",
                                    borderRadius: "50%",
                                    border: "none",
                                    background:
                                        "#e0f2f1",
                                    color: "#0f766e",
                                    cursor: "pointer",
                                    fontSize: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                🎤
                            </button>

                            {/* Send */}
                            <button
                                onClick={() => sendMessage()}
                                title="Send message"
                                aria-label="Send message"
                                style={{
                                    width: "35px",
                                    height: "35px",
                                    borderRadius: "50%",
                                    border: "none",
                                    background: "#0f766e",
                                    color: "#ffffff",
                                    cursor: "pointer",
                                    fontSize: "16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                ➤
                            </button>
                        </div>

                        <div
                            style={{
                                textAlign: "center",
                                fontSize: "9px",
                                color: "#6b7280",
                                marginTop: "7px",
                            }}
                        >
                            LifeShield AI provides general
                            information, not medical diagnosis.
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default LifeShieldChatbot;