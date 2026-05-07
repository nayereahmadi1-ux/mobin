const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TOKEN = "1731130247:1H4m73yGPaRF0S8fDFUN8d0TyBWN1jfNUtE";
const BASE = `https://tapi.bale.ai/bot${TOKEN}`;
let warnings = {}; // user_id -> count
let lastMessage = {}; // برای تشخیص اسپم

// ✅ تابع ارسال پیام ساده
async function sendMessage(chat_id, text) {
  await axios.post(`${BASE}/sendMessage`, { chat_id, text });
}

// حذف پیام
async function deleteMessage(chat_id, message_id) {
  await axios.post(`${BASE}/deleteMessage`, { chat_id, message_id });
}

// سکوت کاربر
async function muteUser(chat_id, user_id, duration = 600) {
  await axios.post(`${BASE}/restrictChatMember`, {
    chat_id,
    user_id,
    permissions: { can_send_messages: false },
    until_date: Math.floor(Date.now() / 1000) + duration,
  });
}

// اخراج کاربر
async function kickUser(chat_id, user_id) {
  await axios.post(`${BASE}/kickChatMember`, { chat_id, user_id });
}

// 😡 لیست کلمات توهین
const badWords = ["فحش1", "فحش2", "کلمه بد دیگر"];

// بررسی توهین
function containsBadWord(text) {
  return badWords.some(b => text.includes(b));
}

// تشخیص اسپم
function isSpam(user_id, text) {
  const now = Date.now();
  if (!lastMessage[user_id]) {
    lastMessage[user_id] = { time: now, count: 1 };
    return false;
  }
  const diff = now - lastMessage[user_id].time;
  if (diff < 5000) { // کمتر از ۵ ثانیه بین دو پیام
    lastMessage[user_id].count++;
    if (lastMessage[user_id].count > 5) return true;
  } else {
    lastMessage[user_id] = { time: now, count: 1 };
  }
  return false;
}

app.post("/webhook", async (req, res) => {
  const update = req.body;
  if (!update.message) return res.send("ok");

  const msg = update.message;
  const chat_id = msg.chat.id;
  const user = msg.from;
  const text = msg.text || "";

  // 🚫 تشخیص توهین
  if (containsBadWord(text)) {
    await deleteMessage(chat_id, msg.message_id);
    warnings[user.id] = (warnings[user.id] || 0) + 1;
    const count = warnings[user.id];
    await sendMessage(chat_id, `⚠️ ${user.first_name}، این ${count}مین اخطار توست!`);
    if (count >= 3) {
      await kickUser(chat_id, user.id);
      delete warnings[user.id];
      await sendMessage(chat_id, `❌ ${user.first_name} به دلیل ۳ اخطار از گروه حذف شد.`);
    }
  }

  // 🧨 تشخیص اسپم
  if (isSpam(user.id, text)) {
    await muteUser(chat_id, user.id, 600);
    await sendMessage(chat_id, `⚠️ ${user.first_name} به علت ارسال اسپم برای ۱۰ دقیقه ساکت شد.`);
  }

  // 🛠 دستورات مدیر
  if (text.startsWith("/")) {
    const [cmd, target, arg] = text.split(" ");
    if (cmd === "/kick" && target) {
      const username = target.replace("@", "");
      await sendMessage(chat_id, `${username} از گروه حذف شد (دستور مدیر).`);
    }
    // مشابه برای ban, mute, warn می‌توان افزود
  }

  res.send("ok");
});

app.listen(3000, () => console.log("Bot running"));
