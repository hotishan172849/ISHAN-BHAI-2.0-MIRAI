const axios = require("axios");

const apiList = "https://gitlab.com/shahadat-sahu/sahu-api/-/raw/main/API.json";
const getMainAPI = async () => (await axios.get(apiList)).data.simsimi;

module.exports.config = {
 name: "baby",
 version: "1.0.4",
 hasPermssion: 0,
 credits: "ULLASH",
 description: "Cute AI Baby Chatbot | Talk, Teach & Chat with Emotion ☢️",
 commandCategory: "Chat",
 usages: "[message/query]",
 cooldowns: 0,
 prefix: true
};

const babyLoopGuard = {
 settings: {
  rapidGapMs: 3000,
  maxRapidChain: 5,
  windowMs: 30 * 1000,
  maxTriggersInWindow: 9,
  suspectAfter: 4,
  muteMs: 10 * 60 * 1000
 },
 threads: new Map(),

 getThread(threadID) {
  let st = this.threads.get(threadID);
  if (!st) {
   st = {
    lastTriggerAt: 0,
    rapidChain: 0,
    triggerTimes: [],
    pausedUntil: 0,
    lastNoticeAt: 0,
    senderFastStreak: new Map(),
    suspectedBots: new Map()
   };
   this.threads.set(threadID, st);
  }
  return st;
 },

 isTrigger(text) {
  return /^(baby|bot|bby|jan|xan|জান|বট|বেবি)(\s|$)/i.test(text);
 },

 check(api, event, isBabyTrigger) {
  const now = Date.now();
  const threadID = event.threadID;
  const senderID = String(event.senderID || "");
  const st = this.getThread(threadID);

  try {
   if (senderID && senderID === String(api.getCurrentUserID())) return false;
  } catch {}

  if (st.pausedUntil) {
   if (now < st.pausedUntil) return false;
   st.pausedUntil = 0;
   st.rapidChain = 0;
   st.triggerTimes = [];
  }

  const prevSuspect = st.suspectedBots.get(senderID);
  if (prevSuspect && now - prevSuspect >= this.settings.muteMs) {
   st.suspectedBots.delete(senderID);
   st.senderFastStreak.set(senderID, 0);
  }

  if (isBabyTrigger) {
   const gap = st.lastTriggerAt ? now - st.lastTriggerAt : Infinity;
   st.lastTriggerAt = now;

   if (gap < this.settings.rapidGapMs) {
    st.rapidChain++;
    const streak = (st.senderFastStreak.get(senderID) || 0) + 1;
    st.senderFastStreak.set(senderID, streak);
    if (streak >= this.settings.suspectAfter) st.suspectedBots.set(senderID, now);
   } else {
    st.rapidChain = 0;
    st.senderFastStreak.set(senderID, 0);
   }

   st.triggerTimes.push(now);
   while (st.triggerTimes.length && now - st.triggerTimes[0] > this.settings.windowMs) {
    st.triggerTimes.shift();
   }

   const loopDetected =
    st.rapidChain >= this.settings.maxRapidChain ||
    st.triggerTimes.length > this.settings.maxTriggersInWindow;

   if (loopDetected) {
    st.pausedUntil = now + this.settings.muteMs;
    st.rapidChain = 0;
    st.triggerTimes = [];
    if (now - st.lastNoticeAt > this.settings.muteMs) {
     st.lastNoticeAt = now;
     const mins = Math.max(1, Math.round(this.settings.muteMs / 60000));
     api.sendMessage(
      `🤖 Bot-to-Bot loop detected!\n` +
      `এই গ্রুপে দুইটি bot-এর মধ্যে automated reply chain শনাক্ত হয়েছে। Spam রোধে baby-র automated reply ${mins} মিনিটের জন্য বন্ধ রাখা হলো।\n` +
      `(কাউকে ban/kick করা হয়নি — manual command ও অন্যান্য feature স্বাভাবিক কাজ করবে।)`,
      threadID
     );
    }
    return false;
   }
  }

  if (st.suspectedBots.has(senderID)) return false;

  return true;
 }
};

module.exports.run = async function ({ api, event, args, Users }) {
 try {
 const uid = event.senderID;
 const senderName = await Users.getNameUser(uid);
 const rawQuery = args.join(" ");
 const query = rawQuery.toLowerCase();
 const simsim = await getMainAPI();

 if (!query) {
 const ran = ["Bolo baby", "hum"];
 const r = ran[Math.floor(Math.random() * ran.length)];
 return api.sendMessage(r, event.threadID, (err, info) => {
 if (!err) {
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: event.senderID,
 type: "simsimi"
 });
 }
 });
 }

 const command = args[0].toLowerCase();

 if (["remove", "rm"].includes(command)) {
 const parts = rawQuery.replace(/^(remove|rm)\s*/i, "").split(" - ");
 if (parts.length < 2) return api.sendMessage("Use: remove [Question] - [Reply]", event.threadID, event.messageID);
 const [ask, ans] = parts.map(p => p.trim());
 const res = await axios.get(`${simsim}/delete?ask=${encodeURIComponent(ask)}&ans=${encodeURIComponent(ans)}`);
 return api.sendMessage(res.data.message, event.threadID, event.messageID);
 }

 if (command === "list") {
 const res = await axios.get(`${simsim}/list`);
 if (res.data.code === 200) {
 return api.sendMessage(
 `♾ Total Questions Learned: ${res.data.totalQuestions}\n★ Total Replies Stored: ${res.data.totalReplies}\nDeveloper: ${res.data.author}`,
 event.threadID, event.messageID
 );
 } else return api.sendMessage(`Error: ${res.data.message}`, event.threadID, event.messageID);
 }

 if (command === "edit") {
 const parts = rawQuery.replace(/^edit\s*/i, "").split(" - ");
 if (parts.length < 3) return api.sendMessage("Use: edit [Q] - [Old] - [New]", event.threadID, event.messageID);
 const [ask, oldReply, newReply] = parts.map(p => p.trim());
 const res = await axios.get(`${simsim}/edit?ask=${encodeURIComponent(ask)}&old=${encodeURIComponent(oldReply)}&new=${encodeURIComponent(newReply)}`);
 return api.sendMessage(res.data.message, event.threadID, event.messageID);
 }

 if (command === "teach") {
 const parts = rawQuery.replace(/^teach\s*/i, "").split(" - ");
 if (parts.length < 2) return api.sendMessage("Use: teach [Q] - [Reply]", event.threadID, event.messageID);
 const [ask, ans] = parts.map(p => p.trim());
 const groupID = event.threadID;
 let groupName = event.threadName ? event.threadName : "";
 try {
 if (!groupName && groupID != uid) {
 const threadInfo = await api.getThreadInfo(groupID);
 if (threadInfo?.threadName) groupName = threadInfo.threadName;
 }
 } catch {}

 let teachUrl = `${simsim}/teach?ask=${encodeURIComponent(ask)}&ans=${encodeURIComponent(ans)}&senderID=${uid}&senderName=${encodeURIComponent(senderName)}&groupID=${encodeURIComponent(groupID)}`;
 if (groupName) teachUrl += `&groupName=${encodeURIComponent(groupName)}`;
 const res = await axios.get(teachUrl);
 return api.sendMessage(res.data.message, event.threadID, event.messageID);
 }

 const res = await axios.get(`${simsim}/simsimi?text=${encodeURIComponent(query)}&senderName=${encodeURIComponent(senderName)}`);
 const replies = Array.isArray(res.data.response) ? res.data.response : [res.data.response];

 for (const rep of replies) {
 await new Promise(resolve => {
 api.sendMessage(rep, event.threadID, (err, info) => {
 if (!err) {
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: event.senderID,
 type: "simsimi"
 });
 }
 resolve();
 }, event.messageID);
 });
 }

 } catch (err) {
 return api.sendMessage(`Error: ${err.message}`, event.threadID, event.messageID);
 }
};

module.exports.handleReply = async function ({ api, event, Users, handleReply }) {
 try {
 const senderName = await Users.getNameUser(event.senderID);
 const replyText = event.body ? event.body.toLowerCase() : "";
 if (!replyText) return;

 if (!babyLoopGuard.check(api, event, true)) return;

 const simsim = await getMainAPI();
 const res = await axios.get(`${simsim}/simsimi?text=${encodeURIComponent(replyText)}&senderName=${encodeURIComponent(senderName)}`);
 const replies = Array.isArray(res.data.response) ? res.data.response : [res.data.response];

 for (const rep of replies) {
 await new Promise(resolve => {
 api.sendMessage(rep, event.threadID, (err, info) => {
 if (!err) {
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: event.senderID,
 type: "simsimi"
 });
 }
 resolve();
 }, event.messageID);
 });
 }

 } catch (err) {
 return api.sendMessage(`Error: ${err.message}`, event.threadID, event.messageID);
 }
};

module.exports.handleEvent = async function ({ api, event, Users }) {
 try {
 const raw = event.body ? event.body.toLowerCase().trim() : "";
 if (!raw) return;

 if (!babyLoopGuard.check(api, event, babyLoopGuard.isTrigger(raw))) return;

 const senderName = await Users.getNameUser(event.senderID);
 const senderID = event.senderID;

 const simsim = await getMainAPI();

const greetings = [
        "বট না ডেকে বস তানজিমের প্রেমে পড়ো💋😽",
        "আমার বস তানজিমকে ভালোবাসো নাকি?🙈❤️",
        "আমি আবাল দের সাথে কথা বলি না,ok😒",
        "এতো ডেকো না,প্রেম এ পরে যাবো তো🙈",
        "Bolo Babu, তুমি কি আমার বস tanjim কে ভালোবাসো? 🙈💋",
        "বার বার ডাকলে মাথা গরম হয়ে যায় কিন্তু😑",
        "হ্যা বলো😒,তোমার জন্য কি করতে পারি😐😑?",
        " আরে জান কিচ্ছে রাগ করছো?🙂",
        "I love you janu🥰চুপ কর আফরিন অনেক কিউট🌚",
        "আরে Bolo আমার জান ঐশী ,কেমন আছো?😚",
        "আজ বট বলে অসম্মান করছি,😰😿",
        "কিরে গ্রুপের মেয়েরা কই😼",
        "চুপ থাক ,নাই তো তোর দাত ভেগে দিবো কিন্তু",
        "কিরে দিনে কয়বার?😷",
        "আমাকে বট না বলে , বস তানজিম কে জানু বল জানু 😘",
        "কিরে আফরিন ব্যস্ত আছো😋",
        "আরে বলদ এতো ডাকিস কেন🤬",
        "oishi দেখছি খুব হট😘",
        "ইস যদি একটু করতে পারতাম💋😒",
        "হ্যাঁ জানু , এইদিক এ আসো কিস দেই🤭 😘",
        "দূরে যা, তোর কোনো কাজ নাই, শুধু bot bot করিস 😉😋🤣",
        "তোর কথা তোর বাড়ি কেউ শুনে না ,তো আমি কোনো শুনবো ?🤔😂",
        "আমাকে ডেকো না,আমি বস তানজিমের  সাথে ব্যাস্ত আছি",
        "কি হলো , মিস্টেক করচ্ছিস নাকি🤣",
        "বলো তারা কি বলবা, সবার সামনে বলবা নাকি?🤭🤏",
        " জান একটু দেখাও না🙂💋",
        "ওই সাবরিনা কালকে একটু দেখা করিস 😈",
        " ওই আফরিন আমার প্রেমে পড়বা 😏",
        " হুম ঐশী বলো🤩",
        "হুম বলো কি বলবে😒",
        "বলো কি করতে পারি তোমার জন্য",
        "আমি তো আফরিনের প্রেমে অন্ধ কিছুই দেখি না🐸 😎",
        "আরে বোকা বট না জানু বল জানু😌",
        "বলো জানু 🌚",
        "সুন্দরী মেয়েদের দুধুতে তিলা থাকে🙈😘",
        "হুম জান তোমার ওই খানে উম্মহ😑😘",
        "আহ শুনা আমার তোমার অলিতে গলিতে উম্মাহ😇😘",
        "jan আসো একটু টিপা টিপি করি🌚😬",
        "হুম জান তোমার অইখানে উম্মমাহ😷😘",
        "জান একটু তোমার দুধের চা বানিয়ে দিবা😫.!🥰",
        "নিজের দুধু নিজে কখনো দেখছো🙂👀",
        "আমাকে এতো না ডেকে বস তানজিম এর কে একটা গফ দে 🙄",
        "আমাকে এতো না ডেকছ কেন ভলো টালো বাসো নাকি🤭🙈",
        "🌻🌺💚-আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ-💚🌺🌻",
        "sex করা ভালো না💋🌻",
        " জান তোমার bra এর কালার কি😽🫶🌺",
        "আফরিন প্রেম করবি💝😽",
        "কিরে তারা😡😈",
        "জান তোমার দুধুতে উম্মাহ🙊🙆‍♂",
        "আজকে শুধু আফরিন'কে চুম্মাবো🤧",
        "১ বড় না ২ বড় আফরিন মন বড়🌺🤤💦",
        "এই মেয়ে তানজিম'কে নক দেও😪🤧😭",
        "স্বপ্নে শুধু আফরিন কে দেখি🙂💝🌺🌻",
        "ওই আফরিন তোর কিচ্ছে😝🌻",
        "আফরিন তুমি বদলে গেছো🙂",
        "ইসস তোমার টা যদি একটু ধরতে পারতাম🙈🖤🌼",
        "ইন্ডিয়ার তারা এখন শুধু ex কে মিস করে😂🌻",
        "-আপনে খানকি?✨",
        "কুত্তার বাচ্চা💝🌺😽",
        "কিরে মাগির দালাল ভালো আছোচ🥴",
        "জান আমার বস তানজিম কে বিয়ে করবা-🙊😘🥳",
        " জান একটু ভিডিও কল দিবা দুধু দেখবো-🥵🤤💦",
        "oii-🥺🥹-এক🥄 চামচ ভালোবাসা দিবা-🤏🏻🙂",
        "-জান তোমার bra এর সাইজ কতো?🥱🐰🍒",
        "-কিরে এতো ডাকস কেন মুখে নিবি🌚🤧",
        "-অনুমতি দিলে তোরে একটা থাপ্পড় দেই🐸😾🔪",
        "-সুওরের বাচ্চা আর গালাগালি করবি🤦‍♂️🤧",
        "-𝗢𝗶𝗶 আন্টি-🙆‍♂️-তোমার মেয়ে চোখ মারে-🥺🥴🐸",
        "তাকাই আছো কেন চুমু দিবা-🙄🐸😘",
        "আজকে প্রপোজ করে দেখো রাজি হইয়া যামু-😌🤗😇",
        "-জানো একটু দেখাবা😌🙆‍♂️🤗",
        "কি বেপার আফরিন শ্বশুর বাড়িতে যাচ্ছেন না কেন-🤔🥱🌻",
        "দিনশেষে এই গ্রুপের মেয়ে গুলোই সুন্দর☹️🤧",
        "-আসো পাখি তোমাকে একটু আদর করি-🤧🥱🌻",
        "-ছোটবেলা ভাবতাম বিয়ে করলে বাচ্চা হয় এখন দেখি, segs করা লাগে😦🙂🌻",
        "কিরে বন্ধু মনে আছে তুই না খেলে সে খেতো না😂🙏",
        " ছুতা দিয়ে পিঠামু বাইনসুদ ভালো হ🐸🥲",
        "-চুমু থাকতে তোরা বিড়ি খাস কেন বুঝা আমারে-😑😒🐸⚒️",
        "—মেয়ে হলে আমার বস তানজিম কে চুম্মা দে🙈🐸🤗",
        "—হেন্ডেল মেরে মেরে চেহারা কি করসচ দেখচছ🥱🤗🙆‍♂️",
        " বহু দিন মেয়েদের হাত ধরি নাই😌💜",
        "দিন শেষে বিদেশি কাকুরা জিতে যায় 🐸🤗",
        "জান তুমি bra পরো🖤🙂",
        "-দিন দিন কিছু মানুষের কাছে অপ্রিয় হয়ে যাইতেছি-🙂😿🌸",
        "এক বিছানায় আর কতো দিন ঘুমাবো🤣😼",
        "মেয়ে হলে দুধুতে kiss💋",
        "হুদাই আমারে শয়তানে লারে-😝😑☹️",
        "-𝗜 𝗟𝗢𝗩𝗘 𝗬𝗢𝗨- এভার দুধু দেখা🐸",
        "-জান একটু দুধু দেখাও না💦",
        "-আর কতো দিন হাত মারবি😂🤧",
        "-তুমি খুব কিউট🙈🥱",
        "-ওই দেখ তোর দুধু দেখা যায়- যা bra পরে আয়🙂😽🫶",
        "-ইস কেউ যদি বলতো তানজিম শুধু আমার💜🌸",
        "-ওই আপু তোমার দুধুর সাইজ কতো?👀",
        " আসো পাখি তোমাকে পেগনেট করে দেই🙈🤰",
        " জান দুধু দেখাবা🙈👀",
        "কি'রে গ্রুপে দেখি একটাও বেডি নাই-🤦‍🥱💦",
        " সুন্দরী মেয়েরাও হাগে?🥴😑😏",
        "-🫵তোমারে প্রচুর ভাল্লাগে, একটু খেতে দিবা🥱🐸🥵",
        "-আজ থেকে আর কাউকে পাত্তা দিমু না🤰"
      ];


 if (
 raw === "babu" || raw === "bot" || raw === "bby" ||
 raw === "jan" || raw === "xan" || raw === "জান" ||
 raw === "বট" || raw === "বেবি"
 ) {
 const randomReply = greetings[Math.floor(Math.random() * greetings.length)];
 return api.sendMessage(randomReply, event.threadID, (err, info) => {
 if (!err) {
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: senderID,
 type: "simsimi"
 });
 }
 }, event.messageID);
 }

 if (
 raw.startsWith("babu ") || raw.startsWith("bot ") || raw.startsWith("bby ") ||
 raw.startsWith("jan ") || raw.startsWith("xan ") ||
 raw.startsWith("জান ") || raw.startsWith("বট ") || raw.startsWith("বেবি ")
 ) {
 const query = raw.replace(/^baby\s+|^bot\s+|^bby\s+|^jan\s+|^xan\s+|^জান\s+|^বট\s+|^বেবি\s+/i, "").trim();
 if (!query) return;

 const res = await axios.get(`${simsim}/simsimi?text=${encodeURIComponent(query)}&senderName=${encodeURIComponent(senderName)}`);
 const replies = Array.isArray(res.data.response) ? res.data.response : [res.data.response];

 for (const rep of replies) {
 await new Promise(resolve => {
 api.sendMessage(rep, event.threadID, (err, info) => {
 if (!err) {
 global.client.handleReply.push({
 name: module.exports.config.name,
 messageID: info.messageID,
 author: senderID,
 type: "simsimi"
 });
 }
 resolve();
 }, event.messageID);
 });
 }
 }

 } catch {}
};
