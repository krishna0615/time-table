
const form = document.getElementById("taskForm");
const taskList = document.getElementById("taskList");
const emptyMessage = document.getElementById("emptyMessage");
const taskCount = document.getElementById("taskCount");
const alarmStatus = document.getElementById("alarmStatus");
const notificationButton =
  document.getElementById("enableNotifications");

const STORAGE_KEY = "student-timetable-v1";

let tasks = [];
let notificationsEnabled = false;
let audioContext = null;

// Load saved tasks safely.
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (Array.isArray(saved)) {
    tasks = saved.filter(task =>
      task &&
      Number.isInteger(task.id) &&
      typeof task.name === "string" &&
      typeof task.date === "string" &&
      typeof task.start === "string" &&
      typeof task.end === "string"
    );
  }
} catch {
  tasks = [];
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    alarmStatus.textContent =
      "Tasks could not be saved in this browser.";
  }
}

function dateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function validDate(date, time) {
  const result = dateTime(date, time);
  return Number.isFinite(result.getTime());
}

function playAlarm() {
  if (!audioContext || audioContext.state !== "running") return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.18;

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.6);
}

function notify(title, message) {
  if (notificationsEnabled &&
      "Notification" in window &&
      Notification.permission === "granted") {
    try {
      new Notification(title, { body: message });
    } catch {
      // Some browsers may block page-created notifications.
    }
  }

  playAlarm();
}

notificationButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alarmStatus.textContent =
      "This browser does not support notifications.";
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alarmStatus.textContent =
        "Allow notifications in browser settings to receive reminders.";
      return;
    }

    notificationsEnabled = true;

    const AudioClass =
      window.AudioContext || window.webkitAudioContext;

    if (AudioClass) {
      if (!audioContext) audioContext = new AudioClass();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
    }

    alarmStatus.textContent =
      "Notifications enabled. Keep this website open for alarms.";
    notificationButton.textContent = "✅ Notifications Enabled";
  } catch {
    alarmStatus.textContent =
      "Could not enable notifications. Check browser permissions.";
  }
});

function renderTasks() {
  taskList.replaceChildren();

  const sortedTasks = [...tasks].sort((a, b) =>
    dateTime(a.date, a.start) - dateTime(b.date, b.start)
  );

  emptyMessage.hidden = sortedTasks.length > 0;
  taskCount.textContent =
    `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  for (const task of sortedTasks) {
    const card = document.createElement("article");
    card.className = "task" + (task.done ? " done" : "");

    const heading = document.createElement("h3");
    heading.textContent = task.name;

    const details = document.createElement("p");
    details.textContent =
      `${task.date} · ${task.start} – ${task.end}`;

    const status = document.createElement("p");
    status.textContent = task.done
      ? "Completed ✅"
      : dateTime(task.end, task.end) < new Date()
        ? "Scheduled task"
        : "Start and end reminders scheduled";

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const completeButton = document.createElement("button");
    completeButton.className = "complete-btn";
    completeButton.textContent = task.done
      ? "Mark Incomplete"
      : "Mark Complete";

    completeButton.addEventListener("click", () => {
      task.done = !task.done;
      saveTasks();
      renderTasks();
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-btn";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
      tasks = tasks.filter(item => item.id !== task.id);
      saveTasks();
      renderTasks();
    });

    actions.append(completeButton, deleteButton);
    card.append(heading, details, status, actions);
    taskList.append(card);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("taskName").value.trim();
  const date = document.getElementById("taskDate").value;
  const start = document.getElementById("startTime").value;
  const end = document.getElementById("endTime").value;

  if (!name || !date || !start || !end) {
    alert("Please fill in all fields.");
    return;
  }

  if (!validDate(date, start) || !validDate(date, end)) {
    alert("Please enter a valid date and time.");
    return;
  }

  const startDate = dateTime(date, start);
  const endDate = dateTime(date, end);
  const now = new Date();

  if (endDate <= startDate) {
    alert("End time must be after start time.");
    return;
  }

  if (startDate <= now || endDate <= now) {
    alert("Please choose a future start and end time.");
    return;
  }

  tasks.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    name,
    date,
    start,
    end,
    done: false,
    startNotified: false,
    endNotified: false
  });

  saveTasks();
  renderTasks();
  form.reset();
  setDefaultDate();
});

function checkAlarms() {
  const now = new Date();
  let changed = false;

  for (const task of tasks) {
    if (task.done) continue;

    const startDate = dateTime(task.date, task.start);
    const endDate = dateTime(task.date, task.end);

    if (!task.startNotified && now >= startDate) {
      task.startNotified = true;
      changed = true;
      notify("⏰ Time to Start!", `Start now: ${task.name}`);
    }

    if (!task.endNotified && now >= endDate) {
      task.endNotified = true;
      changed = true;
      notify("✅ Time's Up!", `Finish your task: ${task.name}`);
    }
  }

  if (changed) saveTasks();
}

function setDefaultDate() {
  const today = new Date();
  const localDate = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");

  document.getElementById("taskDate").min = localDate;
  document.getElementById("taskDate").value = localDate;
}

setDefaultDate();
renderTasks();

// Check once per second while the page is running.
checkAlarms();
setInterval(checkAlarms, 1000);
