module.exports = {
  config: {
    name: "ختم",
    aliases: ["seal"],
    version: "1.0",
    author: "BlackBot",
    countDown: 3,
    role: 1,
    shortDescription: "تفعيل/إيقاف وضع السلام الداخلي للبوت",
    category: "admin",
    guide: "{pn} | {pn} رفع"
  },

  onStart: async function ({ args, message }) {
    const input = args.join(" ").trim().toLowerCase();

    if (input === "رفع" || input === "off") {
      if (!global.BlackBot.peaceMode) {
        return message.reply("ورفع");
      }
      global.BlackBot.peaceMode = false;
      return message.reply("ورفع");
    }

    if (global.BlackBot.peaceMode) {
      return message.reply("نعم");
    }

    global.BlackBot.peaceMode = true;
    return message.reply("نعم");
  }
};
