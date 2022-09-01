const {
  bot,
  util
} = require("../runtime/runtime");
const storage = require("./data.json");

let cj = {}
module.exports = {
  beforeSend: {
    kfc: async m => {
      let day = new Date().getDay()
      if (day > 4 || day < 3) {
        m.reply("周几了?").catch(util.f)
        return true
      }
    },
    cj: async m => {
      if (storage.config.cjWaitTime <= 0) {
        return
      }
      if (cj[m.uid]) {
        let s = "你已经抽过奖了,请稍后再试吧(cd: " + Math.floor(storage.config.cjWaitTime / 1000) + "秒)"
        if (typeof cj[m.uid] === 'string') {
          s += ",上次抽中的是:\n\n" + cj[m.uid]
        }
        let r = await m.reply(s)
        setTimeout(() => bot.deleteMessage(m.cid, r.mid).catch(util.f), 5000)
        return true
      }
    }
  },
  afterSend: {
    cj: (m, o) => {
      if (storage.config.cjWaitTime <= 0) {
        return
      }
      const uid = m.uid
      if (typeof o === 'string') {
        cj[uid] = o
      } else {
        cj[uid] = {}
      }
      setTimeout(() => delete cj[uid], storage.config.cjWaitTime)
    }
  }
}
