import React, { useEffect, useRef, useState } from "react";

type RepeatType = "Daily" | "Once";

interface Medicine {
    id: string;
    name: string;
    time: string;
    dosage: string;
    repeat: RepeatType;
    lastTriggered?: string;
}

interface HistoryItem {
    id: string;
    medicineName: string;
    scheduledTime: string;
    action: "Taken" | "Skipped";
    timestamp: string;
}

const MEDICINES_KEY = "lifeshield_medicines";
const HISTORY_KEY = "lifeshield_medication_history";
const VOICE_KEY = "lifeshield_voice_alerts";

const MedicationReminder: React.FC = () => {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    const [medicineName, setMedicineName] = useState("");
    const [reminderTime, setReminderTime] = useState("");
    const [dosage, setDosage] = useState("");
    const [repeat, setRepeat] = useState<RepeatType>("Daily");

    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [message, setMessage] = useState("");

    // Prevent the same reminder from firing repeatedly
    const triggeredRef = useRef<Set<string>>(new Set());

    // Load saved data
    useEffect(() => {
        try {
            const savedMedicines = localStorage.getItem(MEDICINES_KEY);
            const savedHistory = localStorage.getItem(HISTORY_KEY);
            const savedVoice = localStorage.getItem(VOICE_KEY);

            if (savedMedicines) {
                setMedicines(JSON.parse(savedMedicines));
            }

            if (savedHistory) {
                setHistory(JSON.parse(savedHistory));
            }

            if (savedVoice !== null) {
                setVoiceEnabled(savedVoice === "true");
            }

            if ("Notification" in window) {
                setNotificationsEnabled(
                    Notification.permission === "granted"
                );
            }
        } catch (error) {
            console.error("Unable to load medication data:", error);
        }
    }, []);

    // Save medicines
    useEffect(() => {
        localStorage.setItem(
            MEDICINES_KEY,
            JSON.stringify(medicines)
        );
    }, [medicines]);

    // Save history
    useEffect(() => {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(history)
        );
    }, [history]);

    // Save voice setting
    useEffect(() => {
        localStorage.setItem(
            VOICE_KEY,
            String(voiceEnabled)
        );
    }, [voiceEnabled]);

    // ============================
    // BROWSER NOTIFICATIONS
    // ============================

    const enableNotifications = async () => {
        if (!("Notification" in window)) {
            setMessage("❌ This browser does not support notifications.");
            return;
        }

        try {
            const permission = await Notification.requestPermission();

            if (permission === "granted") {
                setNotificationsEnabled(true);
                setMessage("✅ Notifications enabled successfully!");

                new Notification("💊 LifeShield", {
                    body: "Medicine reminders are now enabled.",
                });
            } else {
                setNotificationsEnabled(false);
                setMessage(
                    "⚠️ Notification permission was not granted."
                );
            }
        } catch (error) {
            console.error(error);
            setMessage("❌ Could not enable notifications.");
        }
    };

    // ============================
    // VOICE ALERT
    // ============================

    const speakReminder = (
        name: string,
        dose: string
    ) => {
        if (!voiceEnabled) return;

        if (!("speechSynthesis" in window)) {
            setMessage(
                "⚠️ Voice alerts are not supported by this browser."
            );
            return;
        }

        window.speechSynthesis.cancel();

        const text =
            `Reminder. It is time to take your ${name}. ` +
            `Please take ${dose}.`;

        const utterance = new SpeechSynthesisUtterance(text);

        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices = window.speechSynthesis.getVoices();

        const englishVoice = voices.find(
            (voice) =>
                voice.lang.toLowerCase().startsWith("en")
        );

        if (englishVoice) {
            utterance.voice = englishVoice;
        }

        window.speechSynthesis.speak(utterance);
    };

    const testVoice = () => {
        speakReminder(
            medicineName || "your medicine",
            dosage || "your prescribed dosage"
        );

        setMessage("🔊 Voice alert tested.");
    };

    // ============================
    // REMINDER ENGINE
    // ============================

    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();

            const currentHours = String(
                now.getHours()
            ).padStart(2, "0");

            const currentMinutes = String(
                now.getMinutes()
            ).padStart(2, "0");

            const currentTime =
                `${currentHours}:${currentMinutes}`;

            const today =
                `${now.getFullYear()}-${String(
                    now.getMonth() + 1
                ).padStart(2, "0")}-${String(
                    now.getDate()
                ).padStart(2, "0")}`;

            medicines.forEach((medicine) => {
                if (medicine.time !== currentTime) {
                    return;
                }

                const triggerKey =
                    `${medicine.id}-${today}-${medicine.time}`;

                if (triggeredRef.current.has(triggerKey)) {
                    return;
                }

                triggeredRef.current.add(triggerKey);

                // Browser notification
                if (
                    notificationsEnabled &&
                    "Notification" in window &&
                    Notification.permission === "granted"
                ) {
                    new Notification(
                        "💊 LifeShield Medicine Reminder",
                        {
                            body:
                                `Time to take ${medicine.name} — ` +
                                `${medicine.dosage}`,
                            icon: "/favicon.ico",
                        }
                    );
                }

                // Voice reminder
                speakReminder(
                    medicine.name,
                    medicine.dosage
                );

                setMessage(
                    `🔔 Reminder: Time to take ${medicine.name}`
                );

                // For "Once", remove after triggering
                if (medicine.repeat === "Once") {
                    setMedicines((current) =>
                        current.filter(
                            (item) => item.id !== medicine.id
                        )
                    );
                }
            });
        };

        // Check immediately
        checkReminders();

        // Check every 10 seconds
        const interval = window.setInterval(
            checkReminders,
            10000
        );

        return () => {
            window.clearInterval(interval);
        };
    }, [medicines, notificationsEnabled, voiceEnabled]);

    // ============================
    // ADD MEDICINE
    // ============================

    const addMedicine = () => {
        if (!medicineName.trim()) {
            setMessage("⚠️ Please enter a medicine name.");
            return;
        }

        if (!reminderTime) {
            setMessage("⚠️ Please select a reminder time.");
            return;
        }

        if (!dosage.trim()) {
            setMessage("⚠️ Please enter the dosage.");
            return;
        }

        const newMedicine: Medicine = {
            id:
                Date.now().toString() +
                Math.random().toString(36).slice(2),
            name: medicineName.trim(),
            time: reminderTime,
            dosage: dosage.trim(),
            repeat,
        };

        setMedicines((current) => [
            ...current,
            newMedicine,
        ]);

        setMedicineName("");
        setReminderTime("");
        setDosage("");
        setRepeat("Daily");

        setMessage(
            `✅ ${newMedicine.name} reminder added.`
        );
    };

    // ============================
    // DELETE MEDICINE
    // ============================

    const deleteMedicine = (id: string) => {
        setMedicines((current) =>
            current.filter(
                (medicine) => medicine.id !== id
            )
        );

        setMessage("🗑️ Medicine reminder deleted.");
    };

    // ============================
    // MEDICATION HISTORY
    // ============================

    const recordMedication = (
        medicine: Medicine,
        action: "Taken" | "Skipped"
    ) => {
        const item: HistoryItem = {
            id:
                Date.now().toString() +
                Math.random().toString(36).slice(2),
            medicineName: medicine.name,
            scheduledTime: medicine.time,
            action,
            timestamp: new Date().toLocaleString(),
        };

        setHistory((current) => [
            item,
            ...current,
        ]);

        setMessage(
            action === "Taken"
                ? `✅ ${medicine.name} marked as taken.`
                : `⚠️ ${medicine.name} marked as skipped.`
        );
    };

    const toggleVoice = () => {
        setVoiceEnabled((current) => !current);
    };

    return (
        <div
            style={{
                width: "100%",
                color: "#f8fafc",
            }}
        >
            {/* HEADER */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "20px",
                    marginBottom: "28px",
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <h1
                        style={{
                            margin: 0,
                            fontSize: "32px",
                            fontWeight: 800,
                            letterSpacing: "-0.5px",
                        }}
                    >
                        💊 Medicine Reminder
                    </h1>

                    <p
                        style={{
                            marginTop: "8px",
                            marginBottom: 0,
                            color: "#94a3b8",
                            fontSize: "15px",
                        }}
                    >
                        Manage your medicines and never miss a dose.
                    </p>
                </div>

                <button
                    onClick={enableNotifications}
                    style={{
                        border: "none",
                        borderRadius: "10px",
                        padding: "13px 20px",
                        background:
                            notificationsEnabled
                                ? "#059669"
                                : "#2563eb",
                        color: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow:
                            "0 8px 20px rgba(37,99,235,.25)",
                    }}
                >
                    {notificationsEnabled
                        ? "🔔 Notifications Enabled"
                        : "🔔 Enable Notifications"}
                </button>
            </div>

            {/* STATUS MESSAGE */}
            {message && (
                <div
                    style={{
                        marginBottom: "20px",
                        padding: "12px 16px",
                        borderRadius: "10px",
                        background: "#0f172a",
                        border: "1px solid #1e3a5f",
                        color: "#cbd5e1",
                    }}
                >
                    {message}
                </div>
            )}

            {/* FEATURE CARDS */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "14px",
                    marginBottom: "24px",
                }}
            >
                <FeatureCard
                    icon="🔔"
                    title="Smart Reminders"
                    text={
                        notificationsEnabled
                            ? "Notifications are active"
                            : "Get notified on time"
                    }
                />

                <FeatureCard
                    icon="🔊"
                    title="Voice Alerts"
                    text={
                        voiceEnabled
                            ? "Voice alerts are ON"
                            : "Voice alerts are OFF"
                    }
                    action={
                        <button
                            onClick={toggleVoice}
                            style={smallButtonStyle}
                        >
                            {voiceEnabled ? "Turn OFF" : "Turn ON"}
                        </button>
                    }
                />

                <FeatureCard
                    icon="🛡️"
                    title="Safe & Secure"
                    text="Your medicine data stays on this device"
                />

                <FeatureCard
                    icon="📜"
                    title="Medication History"
                    text={`${history.length} recorded events`}
                />
            </div>

            {/* ADD MEDICINE */}
            <div style={panelStyle}>
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "20px",
                    }}
                >
                    <div
                        style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: "#17345f",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "20px",
                        }}
                    >
                        +
                    </div>

                    <div>
                        <h2 style={sectionTitleStyle}>
                            Add New Medicine
                        </h2>

                        <p style={subTextStyle}>
                            Add your medicine and set a reminder time.
                        </p>
                    </div>
                </div>

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                        gap: "14px",
                    }}
                >
                    <InputField
                        label="Medicine Name"
                        placeholder="e.g. Paracetamol 500mg"
                        value={medicineName}
                        onChange={setMedicineName}
                    />

                    <div>
                        <label style={labelStyle}>
                            Reminder Time
                        </label>

                        <input
                            type="time"
                            value={reminderTime}
                            onChange={(e) =>
                                setReminderTime(e.target.value)
                            }
                            style={inputStyle}
                        />
                    </div>

                    <InputField
                        label="Dosage"
                        placeholder="e.g. 1 tablet"
                        value={dosage}
                        onChange={setDosage}
                    />

                    <div>
                        <label style={labelStyle}>
                            Repeat
                        </label>

                        <select
                            value={repeat}
                            onChange={(e) =>
                                setRepeat(
                                    e.target.value as RepeatType
                                )
                            }
                            style={inputStyle}
                        >
                            <option value="Daily">Daily</option>
                            <option value="Once">Once</option>
                        </select>
                    </div>

                    <button
                        onClick={addMedicine}
                        style={{
                            alignSelf: "end",
                            minHeight: "48px",
                            border: "none",
                            borderRadius: "10px",
                            background:
                                "linear-gradient(90deg,#10b981,#16c784)",
                            color: "white",
                            fontWeight: 800,
                            fontSize: "15px",
                            cursor: "pointer",
                        }}
                    >
                        + Add Medicine
                    </button>

                    <button
                        onClick={testVoice}
                        style={{
                            alignSelf: "end",
                            minHeight: "48px",
                            borderRadius: "10px",
                            border: "1px solid #374151",
                            background: "#111c32",
                            color: "#cbd5e1",
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        🔊 Test Voice
                    </button>
                </div>
            </div>

            {/* MEDICINES */}
            <div style={panelStyle}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "18px",
                    }}
                >
                    <div>
                        <h2 style={sectionTitleStyle}>
                            💊 Your Medicines
                        </h2>

                        <p style={subTextStyle}>
                            Upcoming reminders
                        </p>
                    </div>

                    <span
                        style={{
                            background: "#1e1b4b",
                            color: "#c4b5fd",
                            padding: "8px 13px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 700,
                        }}
                    >
                        {medicines.length}{" "}
                        {medicines.length === 1
                            ? "medicine"
                            : "medicines"}
                    </span>
                </div>

                {medicines.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "35px",
                            color: "#64748b",
                        }}
                    >
                        No medicines added yet.
                    </div>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                        }}
                    >
                        {medicines.map((medicine) => (
                            <div
                                key={medicine.id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "15px",
                                    padding: "16px",
                                    borderRadius: "12px",
                                    border: "1px solid #293750",
                                    background: "#0a1427",
                                    flexWrap: "wrap",
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
                                            width: "40px",
                                            height: "40px",
                                            borderRadius: "50%",
                                            background: "#30205f",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        💊
                                    </div>

                                    <div>
                                        <div
                                            style={{
                                                fontWeight: 800,
                                            }}
                                        >
                                            {medicine.name}
                                        </div>

                                        <div
                                            style={{
                                                color: "#94a3b8",
                                                fontSize: "13px",
                                                marginTop: "3px",
                                            }}
                                        >
                                            💊 {medicine.dosage} •{" "}
                                            {medicine.repeat}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <div
                                        style={{
                                            color: "#cbd5e1",
                                            fontWeight: 700,
                                        }}
                                    >
                                        ⏰ {formatTime(medicine.time)}
                                    </div>

                                    <button
                                        onClick={() =>
                                            recordMedication(
                                                medicine,
                                                "Taken"
                                            )
                                        }
                                        style={{
                                            ...smallButtonStyle,
                                            color: "#34d399",
                                            borderColor: "#065f46",
                                        }}
                                    >
                                        ✓ Taken
                                    </button>

                                    <button
                                        onClick={() =>
                                            recordMedication(
                                                medicine,
                                                "Skipped"
                                            )
                                        }
                                        style={{
                                            ...smallButtonStyle,
                                            color: "#fbbf24",
                                            borderColor: "#78350f",
                                        }}
                                    >
                                        Skip
                                    </button>

                                    <button
                                        onClick={() =>
                                            deleteMedicine(medicine.id)
                                        }
                                        style={{
                                            ...smallButtonStyle,
                                            color: "#f87171",
                                            borderColor: "#7f1d1d",
                                        }}
                                    >
                                        🗑 Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* HISTORY */}
            {history.length > 0 && (
                <div style={panelStyle}>
                    <h2 style={sectionTitleStyle}>
                        📜 Medication History
                    </h2>

                    <p style={subTextStyle}>
                        Recent medication activity
                    </p>

                    <div
                        style={{
                            marginTop: "15px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                        }}
                    >
                        {history.slice(0, 10).map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    padding: "12px",
                                    background: "#0a1427",
                                    borderRadius: "8px",
                                    border: "1px solid #1e293b",
                                    gap: "10px",
                                    flexWrap: "wrap",
                                }}
                            >
                                <span>
                                    {item.action === "Taken"
                                        ? "✅"
                                        : "⚠️"}{" "}
                                    <strong>
                                        {item.medicineName}
                                    </strong>{" "}
                                    — {item.action}
                                </span>

                                <span
                                    style={{
                                        color: "#64748b",
                                        fontSize: "12px",
                                    }}
                                >
                                    {item.timestamp}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================
// SMALL COMPONENTS
// ============================

const FeatureCard = ({
    icon,
    title,
    text,
    action,
}: {
    icon: string;
    title: string;
    text: string;
    action?: React.ReactNode;
}) => (
    <div
        style={{
            padding: "18px",
            borderRadius: "12px",
            background: "#0b162a",
            border: "1px solid #1e2d45",
            minHeight: "95px",
        }}
    >
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
            }}
        >
            <span style={{ fontSize: "23px" }}>
                {icon}
            </span>

            <strong>{title}</strong>
        </div>

        <div
            style={{
                color: "#94a3b8",
                fontSize: "13px",
                lineHeight: 1.4,
            }}
        >
            {text}
        </div>

        {action && (
            <div style={{ marginTop: "8px" }}>
                {action}
            </div>
        )}
    </div>
);

const InputField = ({
    label,
    placeholder,
    value,
    onChange,
}: {
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}) => (
    <div>
        <label style={labelStyle}>
            {label}
        </label>

        <input
            type="text"
            placeholder={placeholder}
            value={value}
            onChange={(e) =>
                onChange(e.target.value)
            }
            style={inputStyle}
        />
    </div>
);

// ============================
// STYLES
// ============================

const panelStyle: React.CSSProperties = {
    background: "#0b162a",
    border: "1px solid #1e2d45",
    borderRadius: "15px",
    padding: "22px",
    marginBottom: "20px",
};

const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
};

const subTextStyle: React.CSSProperties = {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "13px",
};

const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "7px",
    color: "#cbd5e1",
    fontSize: "13px",
    fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    padding: "0 14px",
    borderRadius: "10px",
    border: "1px solid #334155",
    background: "#091426",
    color: "#f8fafc",
    outline: "none",
    fontSize: "14px",
};

const smallButtonStyle: React.CSSProperties = {
    border: "1px solid #334155",
    background: "#111c32",
    color: "#cbd5e1",
    borderRadius: "7px",
    padding: "7px 10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
};

const formatTime = (time: string) => {
    if (!time) return "--:--";

    const [hour, minute] = time.split(":");
    const h = Number(hour);

    const suffix = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
};

export default MedicationReminder;