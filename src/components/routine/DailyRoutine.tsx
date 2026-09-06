import React, { useEffect, useState } from "react";

interface RoutineItem {
    id: number;
    title: string;
    time: string;
    icon: string;
}

interface CompletedState {
    [id: number]: boolean;
}

const defaultRoutine: RoutineItem[] = [
    {
        id: 1,
        title: "Wake Up",
        time: "07:00",
        icon: "🌅",
    },
    {
        id: 2,
        title: "Drink Water",
        time: "08:00",
        icon: "💧",
    },
    {
        id: 3,
        title: "Breakfast",
        time: "08:30",
        icon: "🍳",
    },
    {
        id: 4,
        title: "Take a Walk",
        time: "10:00",
        icon: "🚶",
    },
    {
        id: 5,
        title: "Take Medicine",
        time: "14:00",
        icon: "💊",
    },
    {
        id: 6,
        title: "Dinner",
        time: "20:00",
        icon: "🍽️",
    },
    {
        id: 7,
        title: "Prepare for Sleep",
        time: "21:30",
        icon: "🌙",
    },
];

const ROUTINE_KEY = "lifeshield_daily_routine";
const COMPLETED_KEY = "lifeshield_completed_routines";
const LAST_DATE_KEY = "lifeshield_routine_date";

const getToday = () => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const DailyRoutine: React.FC = () => {
    const [routine, setRoutine] =
        useState<RoutineItem[]>(defaultRoutine);

    const [completed, setCompleted] =
        useState<CompletedState>({});

    const [showAdd, setShowAdd] =
        useState(false);

    const [newTitle, setNewTitle] =
        useState("");

    const [newTime, setNewTime] =
        useState("09:00");

    const [newIcon, setNewIcon] =
        useState("🔔");

    const [notificationsEnabled, setNotificationsEnabled] =
        useState(false);

    /* =========================================================
       LOAD SAVED ROUTINE
    ========================================================= */

    useEffect(() => {
        const savedRoutine =
            localStorage.getItem(ROUTINE_KEY);

        if (savedRoutine) {
            try {
                const parsed =
                    JSON.parse(savedRoutine);

                if (Array.isArray(parsed)) {
                    setRoutine(parsed);
                }
            } catch (error) {
                console.log(
                    "Could not load routine:",
                    error
                );
            }
        }

        const today = getToday();
        const savedDate =
            localStorage.getItem(LAST_DATE_KEY);

        if (savedDate !== today) {
            localStorage.setItem(
                LAST_DATE_KEY,
                today
            );

            localStorage.removeItem(
                COMPLETED_KEY
            );

            setCompleted({});
        } else {
            const savedCompleted =
                localStorage.getItem(
                    COMPLETED_KEY
                );

            if (savedCompleted) {
                try {
                    setCompleted(
                        JSON.parse(savedCompleted)
                    );
                } catch {
                    setCompleted({});
                }
            }
        }

        if (
            "Notification" in window &&
            Notification.permission === "granted"
        ) {
            setNotificationsEnabled(true);
        }
    }, []);

    /* =========================================================
       SAVE ROUTINE
    ========================================================= */

    useEffect(() => {
        localStorage.setItem(
            ROUTINE_KEY,
            JSON.stringify(routine)
        );
    }, [routine]);

    /* =========================================================
       SAVE COMPLETED STATUS
    ========================================================= */

    useEffect(() => {
        localStorage.setItem(
            COMPLETED_KEY,
            JSON.stringify(completed)
        );
    }, [completed]);

    /* =========================================================
       ENABLE NOTIFICATIONS
    ========================================================= */

    const enableNotifications = async () => {
        if (!("Notification" in window)) {
            alert(
                "Your browser does not support notifications."
            );
            return;
        }

        try {
            const permission =
                await Notification.requestPermission();

            if (permission === "granted") {
                setNotificationsEnabled(true);

                new Notification(
                    "🛡️ LifeShield",
                    {
                        body:
                            "Daily routine reminders are now enabled.",
                    }
                );
            } else {
                alert("Notification permission was not granted. Please enable notifications in your browser settings.");
            }
        } catch (error) {
            console.log(
                "Notification error:",
                error
            );
        }
    };

    /* =========================================================
       DAILY ROUTINE REMINDER CHECK
    ========================================================= */

    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();

            const currentHour =
                String(now.getHours()).padStart(
                    2,
                    "0"
                );

            const currentMinute =
                String(now.getMinutes()).padStart(
                    2,
                    "0"
                );

            const currentTime =
                `${currentHour}:${currentMinute}`;

            const today = getToday();

            routine.forEach((item) => {
                if (item.time !== currentTime) {
                    return;
                }

                const reminderKey =
                    `lifeshield_reminder_${today}_${item.id}_${item.time}`;

                const alreadyShown =
                    localStorage.getItem(
                        reminderKey
                    );

                if (alreadyShown) {
                    return;
                }

                localStorage.setItem(
                    reminderKey,
                    "shown"
                );

                const message =
                    `It's time for: ${item.title}`;

                if (
                    "Notification" in window &&
                    Notification.permission ===
                    "granted"
                ) {
                    new Notification(
                        `🔔 LifeShield Reminder ${item.icon}`,
                        {
                            body: message,
                        }
                    );
                } else {
                    alert(
                        `🔔 LifeShield Reminder\n\n${item.icon} ${item.title}`
                    );
                }
            });
        };

        // Check immediately
        checkReminders();

        // Check every 20 seconds
        const interval =
            window.setInterval(
                checkReminders,
                20000
            );

        return () => {
            window.clearInterval(interval);
        };
    }, [routine]);

    /* =========================================================
       MARK ROUTINE AS COMPLETED
    ========================================================= */

    const toggleCompleted = (
        id: number
    ) => {
        setCompleted((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    };

    /* =========================================================
       DELETE ROUTINE
    ========================================================= */

    const deleteRoutine = (
        id: number
    ) => {
        const confirmed =
            window.confirm(
                "Delete this routine?"
            );

        if (!confirmed) return;

        setRoutine((prev) =>
            prev.filter(
                (item) => item.id !== id
            )
        );

        setCompleted((prev) => {
            const updated = {
                ...prev,
            };

            delete updated[id];

            return updated;
        });
    };

    /* =========================================================
       ADD NEW ROUTINE
    ========================================================= */

    const addRoutine = () => {
        if (!newTitle.trim()) {
            alert(
                "Please enter a routine name."
            );
            return;
        }

        const newItem: RoutineItem = {
            id: Date.now(),
            title: newTitle.trim(),
            time: newTime,
            icon:
                newIcon.trim() || "🔔",
        };

        setRoutine((prev) =>
            [...prev, newItem].sort(
                (a, b) =>
                    a.time.localeCompare(
                        b.time
                    )
            )
        );

        setNewTitle("");
        setNewTime("09:00");
        setNewIcon("🔔");
        setShowAdd(false);
    };

    /* =========================================================
       COMPLETION COUNT
    ========================================================= */

    const completedCount =
        routine.filter(
            (item) => completed[item.id]
        ).length;

    const progress =
        routine.length > 0
            ? Math.round(
                (completedCount /
                    routine.length) *
                100
            )
            : 0;

    /* =========================================================
       UI
    ========================================================= */

    return (
        <div
            style={{
                background: "#ffffff",
                borderRadius: "20px",
                padding: "24px",
                border:
                    "1px solid #e5e7eb",
                boxShadow:
                    "0 8px 25px rgba(0,0,0,0.06)",
            }}
        >
            {/* =================================================
                HEADER
            ================================================= */}

            <div
                style={{
                    display: "flex",
                    justifyContent:
                        "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "20px",
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <h2
                        style={{
                            margin: 0,
                            fontSize: "22px",
                            fontWeight: 800,
                            color: "#172033",
                        }}
                    >
                        📅 Daily Routine
                    </h2>

                    <p
                        style={{
                            margin:
                                "5px 0 0",
                            fontSize: "13px",
                            color: "#6b7280",
                        }}
                    >
                        Stay on track with your
                        daily activities
                    </p>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "8px",
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        onClick={
                            enableNotifications
                        }
                        style={{
                            border:
                                "1px solid #99f6e4",
                            background:
                                notificationsEnabled
                                    ? "#dcfce7"
                                    : "#ecfdf5",
                            color:
                                "#0f766e",
                            borderRadius:
                                "10px",
                            padding:
                                "9px 12px",
                            cursor:
                                "pointer",
                            fontWeight:
                                700,
                            fontSize:
                                "12px",
                        }}
                    >
                        {notificationsEnabled
                            ? "🔔 Alerts On"
                            : "🔔 Enable Alerts"}
                    </button>

                    <button
                        onClick={() =>
                            setShowAdd(
                                true
                            )
                        }
                        style={{
                            border: "none",
                            background:
                                "linear-gradient(135deg, #0f766e, #14b8a6)",
                            color:
                                "#ffffff",
                            borderRadius:
                                "10px",
                            padding:
                                "9px 13px",
                            cursor:
                                "pointer",
                            fontWeight:
                                700,
                            fontSize:
                                "12px",
                        }}
                    >
                        + Add Routine
                    </button>
                </div>
            </div>

            {/* =================================================
                PROGRESS
            ================================================= */}

            <div
                style={{
                    background:
                        "#f0fdfa",
                    borderRadius:
                        "14px",
                    padding:
                        "14px",
                    marginBottom:
                        "18px",
                }}
            >
                <div
                    style={{
                        display:
                            "flex",
                        justifyContent:
                            "space-between",
                        marginBottom:
                            "8px",
                    }}
                >
                    <span
                        style={{
                            color:
                                "#115e59",
                            fontSize:
                                "13px",
                            fontWeight:
                                700,
                        }}
                    >
                        ✅ {completedCount} of{" "}
                        {routine.length}{" "}
                        completed
                    </span>

                    <span
                        style={{
                            color:
                                "#0f766e",
                            fontSize:
                                "13px",
                            fontWeight:
                                800,
                        }}
                    >
                        {progress}%
                    </span>
                </div>

                <div
                    style={{
                        height: "8px",
                        background:
                            "#ccfbf1",
                        borderRadius:
                            "20px",
                        overflow:
                            "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${progress}%`,
                            height:
                                "100%",
                            background:
                                "linear-gradient(90deg, #0f766e, #14b8a6)",
                            borderRadius:
                                "20px",
                            transition:
                                "width 0.3s ease",
                        }}
                    />
                </div>
            </div>

            {/* =================================================
                ROUTINE LIST
            ================================================= */}

            <div
                style={{
                    display:
                        "flex",
                    flexDirection:
                        "column",
                    gap: "10px",
                }}
            >
                {routine.length ===
                    0 ? (
                    <div
                        style={{
                            textAlign:
                                "center",
                            padding:
                                "30px",
                            color:
                                "#6b7280",
                            background:
                                "#f9fafb",
                            borderRadius:
                                "14px",
                        }}
                    >
                        No routines added yet.
                    </div>
                ) : (
                    routine.map(
                        (item) => {
                            const isDone =
                                !!completed[
                                item.id
                                ];

                            return (
                                <div
                                    key={
                                        item.id
                                    }
                                    style={{
                                        display:
                                            "flex",
                                        alignItems:
                                            "center",
                                        gap:
                                            "12px",
                                        padding:
                                            "13px",
                                        borderRadius:
                                            "14px",
                                        border:
                                            "1px solid #e5e7eb",
                                        background:
                                            isDone
                                                ? "#f0fdf4"
                                                : "#f9fafb",
                                    }}
                                >
                                    {/* Icon */}

                                    <div
                                        style={{
                                            width:
                                                "42px",
                                            height:
                                                "42px",
                                            borderRadius:
                                                "12px",
                                            background:
                                                "#ecfdf5",
                                            display:
                                                "flex",
                                            alignItems:
                                                "center",
                                            justifyContent:
                                                "center",
                                            fontSize:
                                                "21px",
                                            flexShrink:
                                                0,
                                        }}
                                    >
                                        {
                                            item.icon
                                        }
                                    </div>

                                    {/* Text */}

                                    <div
                                        style={{
                                            flex:
                                                1,
                                            minWidth:
                                                0,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontWeight:
                                                    700,
                                                fontSize:
                                                    "14px",
                                                color:
                                                    "#172033",
                                                textDecoration:
                                                    isDone
                                                        ? "line-through"
                                                        : "none",
                                            }}
                                        >
                                            {
                                                item.title
                                            }
                                        </div>

                                        <div
                                            style={{
                                                marginTop:
                                                    "3px",
                                                fontSize:
                                                    "12px",
                                                color:
                                                    "#6b7280",
                                            }}
                                        >
                                            ⏰{" "}
                                            {
                                                item.time
                                            }
                                        </div>
                                    </div>

                                    {/* Done */}

                                    <button
                                        onClick={() =>
                                            toggleCompleted(
                                                item.id
                                            )
                                        }
                                        style={{
                                            border:
                                                "none",
                                            borderRadius:
                                                "9px",
                                            padding:
                                                "7px 9px",
                                            background:
                                                isDone
                                                    ? "#dcfce7"
                                                    : "#e5e7eb",
                                            color:
                                                isDone
                                                    ? "#166534"
                                                    : "#374151",
                                            cursor:
                                                "pointer",
                                            fontSize:
                                                "11px",
                                            fontWeight:
                                                700,
                                            whiteSpace:
                                                "nowrap",
                                        }}
                                    >
                                        {isDone
                                            ? "✓ Done"
                                            : "Mark Done"}
                                    </button>

                                    {/* Delete */}

                                    <button
                                        onClick={() =>
                                            deleteRoutine(
                                                item.id
                                            )
                                        }
                                        title="Delete routine"
                                        style={{
                                            border:
                                                "none",
                                            background:
                                                "transparent",
                                            color:
                                                "#9ca3af",
                                            cursor:
                                                "pointer",
                                            fontSize:
                                                "18px",
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        }
                    )
                )}
            </div>

            {/* =================================================
                ADD ROUTINE FORM
            ================================================= */}

            {showAdd && (
                <div
                    style={{
                        marginTop:
                            "18px",
                        padding:
                            "18px",
                        borderRadius:
                            "16px",
                        background:
                            "#f8fafc",
                        border:
                            "1px solid #e5e7eb",
                    }}
                >
                    <h3
                        style={{
                            margin:
                                "0 0 14px",
                            fontSize:
                                "16px",
                            color:
                                "#172033",
                        }}
                    >
                        ➕ Add Daily Routine
                    </h3>

                    <div
                        style={{
                            display:
                                "grid",
                            gridTemplateColumns:
                                "1fr 120px 70px",
                            gap: "10px",
                        }}
                    >
                        <input
                            value={
                                newTitle
                            }
                            onChange={(e) =>
                                setNewTitle(
                                    e
                                        .target
                                        .value
                                )
                            }
                            placeholder="Routine name"
                            style={{
                                border:
                                    "1px solid #d1d5db",
                                borderRadius:
                                    "10px",
                                padding:
                                    "10px",
                                outline:
                                    "none",
                                color:
                                    "#172033",
                                background:
                                    "#ffffff",
                            }}
                        />

                        <input
                            type="time"
                            value={
                                newTime
                            }
                            onChange={(e) =>
                                setNewTime(
                                    e
                                        .target
                                        .value
                                )
                            }
                            style={{
                                border:
                                    "1px solid #d1d5db",
                                borderRadius:
                                    "10px",
                                padding:
                                    "10px",
                                color:
                                    "#172033",
                                background:
                                    "#ffffff",
                            }}
                        />

                        <input
                            value={
                                newIcon
                            }
                            onChange={(e) =>
                                setNewIcon(
                                    e
                                        .target
                                        .value
                                )
                            }
                            placeholder="🔔"
                            maxLength={2}
                            style={{
                                border:
                                    "1px solid #d1d5db",
                                borderRadius:
                                    "10px",
                                padding:
                                    "10px",
                                textAlign:
                                    "center",
                                fontSize:
                                    "18px",
                                background:
                                    "#ffffff",
                            }}
                        />
                    </div>

                    <div
                        style={{
                            display:
                                "flex",
                            gap: "8px",
                            marginTop:
                                "12px",
                        }}
                    >
                        <button
                            onClick={
                                addRoutine
                            }
                            style={{
                                border:
                                    "none",
                                background:
                                    "#0f766e",
                                color:
                                    "#ffffff",
                                borderRadius:
                                    "9px",
                                padding:
                                    "9px 14px",
                                cursor:
                                    "pointer",
                                fontWeight:
                                    700,
                            }}
                        >
                            Save Routine
                        </button>

                        <button
                            onClick={() =>
                                setShowAdd(
                                    false
                                )
                            }
                            style={{
                                border:
                                    "1px solid #d1d5db",
                                background:
                                    "#ffffff",
                                color:
                                    "#374151",
                                borderRadius:
                                    "9px",
                                padding:
                                    "9px 14px",
                                cursor:
                                    "pointer",
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* =================================================
                FOOTER
            ================================================= */}

            <div
                style={{
                    marginTop:
                        "14px",
                    fontSize:
                        "10px",
                    color:
                        "#9ca3af",
                    textAlign:
                        "center",
                }}
            >
                🛡️ LifeShield Daily Routine
                • Reminders run while the
                web app is open
            </div>
        </div>
    );
};

export { DailyRoutine };

export default DailyRoutine;