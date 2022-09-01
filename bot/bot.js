const {
  bot,
  util
} = require("../runtime/runtime");
const config = require("../config/tgbot");
const storage = require("./data.json");
const plugin = require("./plugin");
const fs = require("fs");
const path = require('path');

let send = 0
let groupSend = {}
let sendIndex = 0

const superAdmin = config.superAdminTgId
const storageChatId = config.storageChatId

if (!storage.admin.includes(superAdmin)) {
  storage.admin.push(superAdmin)
}
let chatSendLimit = {}
let userSendLimit = {}

async function doChatLimit(msg) {
  const id = msg.cid;
  if (chatSendLimit[id]) {
    if (chatSendLimit[id].num >= storage.config.chatLimitNumber) {
      if (!chatSendLimit[id].sendLimit) {
        chatSendLimit[id].sendLimit = true
        await msg.reply("休息一下吧,这个群最近已经使用了我 " + chatSendLimit[id].num + " 次了,短时间内我不会再响应本群的消息了")
      }
      return true
    }
    chatSendLimit[id].num++
  } else {
    chatSendLimit[id] = {num: 1, sendLimit: false}
    let t
    let f = () => {
      chatSendLimit[id].num = Math.floor(chatSendLimit[id].num / 2)
      chatSendLimit[id].sendLimit = false
      if (chatSendLimit[id].num < (storage.config.chatLimitNumber / 5)) {
        delete chatSendLimit[id]
      } else {
        t = setTimeout(f, storage.config.chatLimitTime)
      }
    }
    t = setTimeout(f, storage.config.chatLimitTime)
  }
}

async function doUserLimit(msg) {
  const id = msg.uid;
  if (userSendLimit[id]) {
    if (userSendLimit[id].num >= storage.config.limitNumber) {
      if (!userSendLimit[id].sendLimit) {
        userSendLimit[id].sendLimit = true
        await msg.reply("休息一下吧,你最近已经使用了我 " + userSendLimit[id].num + " 次了,短时间内我不会再响应你的消息了")
      }
      return true
    }
    userSendLimit[id].num++
  } else {
    userSendLimit[id] = {num: 1, sendLimit: false}
    let t
    let f = () => {
      userSendLimit[id].num = Math.floor(userSendLimit[id].num / 2)
      userSendLimit[id].sendLimit = false
      if (userSendLimit[id].num < (storage.config.limitNumber / 5)) {
        delete userSendLimit[id]
      } else {
        t = setTimeout(f, storage.config.limitTime)
      }
    }
    t = setTimeout(f, storage.config.limitTime)
  }
}

async function doLimit(msg) {
  return await doChatLimit(msg) || await doUserLimit(msg)
}

function getFn(name) {
  if (!storage[name]) {
    storage[name] = []
  }
  return async msg => {
    if (msg.chat.type !== "private") {
      if (await doLimit(msg)) {
        return
      }
      groupSend[msg.cid]++ || (groupSend[msg.cid] = 1)
    } else {
      if (!storage.admin.includes(msg.uid)) {
        await msg.reply("管理员才能私聊使用")
        return
      }
    }
    if (plugin[name]?.before && await plugin[name]?.before(msg)) {
      return
    }
    sendIndex = (sendIndex + util.randomInt(storage[name].length / 3, storage[name].length * 3)) % storage[name].length
    let o = storage[name][sendIndex]
    let r = await doSend(msg, o)
    send++
    if (msg.chat.type !== "private") {
      let exist = !!storage.groups[msg.cid]
      storage.groups[msg.cid] = msg.chat
      if (!exist) {
        doSave()
        // todo 查询用户数量
        await bot.sendMessage(superAdmin, "有新的群使用了我:\n" + JSON.stringify(msg.chat))
      }
    }
    if (r) {
      const cid = msg.cid
      const mid = msg.mid
      const mrid = r.mid
      setTimeout(() => (bot.deleteMessage(cid, mrid).catch(util.f), bot.deleteMessage(cid, mid).catch(util.f)), storage.config.messageRemoveWait)
    }
    plugin[name]?.after && await plugin[name]?.after(msg, o, r)
  }
}

bot.onText('/limitStatus', async msg => {
  if (msg.uid === superAdmin) {
    let uid = msg.ruid
    if (!uid) {
      uid = msg.uid
    }
    let r = await msg.reply(`
user: id: ${uid} number: ${userSendLimit[uid]?.num || 0} limit: ${storage.config.limitNumber} time: ${storage.config.limitTime}
chat: id: ${msg.cid} number: ${chatSendLimit[msg.cid]?.num || 0} limit: ${storage.config.chatLimitNumber} time: ${storage.config.chatLimitTime}
`)
    await util.sleep(5000)
    await r.delete()
  }
})

for (let k in storage.entryPoint) {
  let c = storage.entryPoint[k].commands
  for (let s of c) {
    bot.onText('/' + s, getFn(k))
  }
}

function formatStrLen(str) {
  if (str.length > 30) {
    return str.substring(0, 26) + "...(" + str.length + "字)"
  }
  return str
}

onAdmin('列表概览??', async (msg, t) => {
  let k = storage[t] ? t : toKey(t)
  let s = ""
  let last = ""
  let same = 0
  for (let i = 0; i < storage[k].length; i++) {
    const o = storage[k][i]
    let ss = "：" + doFormat(msg, o)
    if (last === ss) {
      same++
    } else {
      if (same) {
        s += "\n~" + i + ": 同上,重复 " + same + "次"
        same = 0
      }
      s += "\n" + (i + 1) + ss
    }
    last = ss
  }
  if (same) {
    s += "\n~" + storage[k].length + ": 同上,重复 " + same + "次"
  }
  s += "\n共计:" + storage[k].length
  await msg.send(s)
})

onAdmin('管理列表??', async (msg, oldKey = "") => {
  let k = emoji2Key(oldKey)
  oldKey = toEmoji(oldKey)
  let lk = {
    reply_markup: {
      keyboard: [
        ['上一个', '当前详情', '下一个'],
        ['修改描述', '删除', '退出' + oldKey],
      ]
    }
  }
  await msg.reply(
    `好的,从第一条消息开始查看

支持如下命令:
数字:跳转到指定序号
上一个:查看上一个
下一个:查看下一个
删除:删除当前并查看下一个
退出:退出

如果没反应了,可以试试点击退出重来
`, lk)
  await doSend(msg, storage[k][0])
  let i = 1
  let fns = bot.registerChatListener(msg.cid, async m => {
    if (inWhite(m.text)) {
      await m.reply("接受到其他指令,退出流程")
      fns.cancel()
      return
    }
    if (m.text === 'q' || m.text?.startsWith("退出")) {
      fns.cancel()
      return
    }
    fns.resetTimeout()
    let data = m.text
    if ("上一个" === data) {
      if (i <= 1) {
        await m.reply("这已经是第一个了")
      } else {
        i--
        await m.reply(doFormat(m, storage[k][i - 1]) + "\n" + i + "/" + storage[k].length)
        await doSend(m, storage[k][i - 1])
      }
    } else if ("当前详情" === data) {
      let o = storage[k][i - 1]
      let s = "当前: " + doFormat(m, o) + "\n" + i + "/" + storage[k].length
      await m.reply(s)
      await doSend(m, o)
    } else if ("下一个" === data) {
      if (i >= storage[k].length) {
        await m.reply("这已经是最后一个了")
      } else {
        i++
        await m.reply(doFormat(m, storage[k][i - 1]) + "\n" + i + "/" + storage[k].length)
        await doSend(m, storage[k][i - 1])
      }
    } else if ("修改描述" === data) {
      if (typeof storage[k][i - 1] === 'string') {
        await m.reply("纯文本内容不支持编辑,删除后再添加")
      } else {
        await m.reply("请发送新的描述,当前描述为:\n\n" + storage[k][i - 1].name)
        fns.pause()
        let fns1 = bot.registerChatListener(msg.cid, async m1 => {
          if (inWhite(m1.text)) {
            await m1.reply("接受到其他指令,退出流程")
            fns1.cancel()
            fns.cancel()
            return
          }
          if (m1.text === 'q' || m1.text === "退出") {
            fns1.cancel()
            fns.cancel()
            return
          }
          if (!m1.text) {
            await m1.reply("请发送文本内容")
            return
          }
          let oldName = storage[k][i - 1].name
          storage[k][i - 1].name = m1.text
          doSave()
          let s = `编号 ${i} 修改描述成功,由 ${oldName} 修改为 ${m1.text}`
          await m1.reply(s)
          if (m1.uid !== superAdmin) {
            await bot.sendMessage(superAdmin, JSON.stringify(m1.from) + ": " + s)
          }
          fns1.cancel()
        }, {
          timeoutCallback: () => m.reply("修改超时,请重试"),
          complete: () => fns.pause(false)
        })
      }
    } else if ("删除" === data) {
      let d = storage[k].splice(i - 1, 1)[0]
      console.log(msg.uid, '减少', d)
      doSave()
      if (i > storage[k].length) {
        i = storage[k].length
      }
      await doSend(m, d)
      await msg.reply(doFormat(null, d) + "已被删除,剩余:" + storage[k].length + ",下一个内容为:" + doFormat(m, storage[k][i - 1]))
      await doSend(m, storage[k][i - 1])
      if (msg.uid !== superAdmin) {
        await bot.sendMessage(superAdmin, "高级删除:" + doFormat(null, d))
      }
    } else {
      try {
        i = util.int(data, null, 1, storage[k].length)
      } catch {
        await m.reply("不支持的操作,请使用键盘", lk)
        return
      }
      let s = "已跳转,当前:" + doFormat(m, storage[k][i - 1]) + "\n" + i + "/" + storage[k].length
      await m.reply(s, lk)
      await doSend(m, storage[k][i - 1])
    }
  }, {
    timeout: 120 * 1000,
    timeoutCallback: () => msg.send("已超时!"),
    complete: () => msg.send("已退出!", toKeyboard(oldKey))
  })
})

onAdmin('删除语录??', async (msg, t, r) => {
  let k = storage[t] ? t : toKey(t)
  await msg.reply("ok,请发送一条语录或者编号吧 (发送q退出)")
  let fns = bot.registerChatListener(msg.cid, async m => {
    if (inWhite(m.text)) {
      await m.reply("接受到其他指令,已退出流程")
      fns.cancel()
      return
    }
    if (m.text === 'q') {
      await m.reply("ok,已退出")
      fns.cancel()
      return
    }
    let data = m.text
    let d = data
    try {
      try {
        let i = util.int(data, null, 1, storage[k].length) - 1
        d = storage[k].splice(i, 1)[0]
        return
      } catch (e) {
      }
      storage[k].forEach((t, i) => {
        if (t === data) {
          storage[k].splice(i, 1)
        }
      })
    } finally {
      console.log(msg.uid, '减少', d)
      doSave()
      await msg.reply("ok,已删除:" + (d.name || d) + ",剩余:" + storage[k].length + ",请继续 (发送q退出)")
      r()
      if (msg.uid !== superAdmin) {
        await msg.forward(superAdmin)
        await bot.sendMessage(superAdmin, "删除: " + m.text + "=>" + (d.name || d))
      }
    }
  }, {
    timeout: 120 * 1000,
    timeoutCallback: () => msg.send("已超时!")
  })
})

onAdmin('添加文本??', async (msg, t) => {
  let k = storage[t] ? t : toKey(t)
  await msg.reply("ok,请发送一条语录吧 (发送q退出)")
  let fns = bot.registerChatListener(msg.cid, async m => {
    if (!m.text) {
      await m.reply("请发送文本")
      return
    }
    if (inWhite(m.text)) {
      await m.reply("接受到其他指令,已退出流程")
      fns.cancel()
      return
    }
    if (m.text === 'q') {
      await m.reply("ok,已退出")
      fns.cancel()
      return
    }
    let data = m.text
    if (storage[k].includes(data)) {
      await msg.reply("错误,词条重复啦!")
      return
    }
    storage[k].push(data)
    console.log(m.uid, '增加词汇', data)
    await m.reply("ok,已增加:" + data + ",当前数量:" + storage[k].length + ",继续下一条要添加的语录吧 (发送q退出)")
    fns.resetTimeout()
    if (m.uid !== superAdmin) {
      await m.forward(superAdmin)
    }
  }, {
    timeout: 120 * 1000,
    timeoutCallback: () => msg.send("已超时!")
  })
})

onAdmin('添加转发??', async (msg, t) => {
  let k = storage[t] ? t : toKey(t)
  await msg.reply("ok,请转发一条消息给我,我将原样保留该消息 (发送q退出)")
  let o = {type: "forward"}
  let fns = bot.registerChatListener(msg.cid, async m => {
    if (inWhite(m.text)) {
      await m.reply("接受到其他指令,已退出流程")
      fns.cancel()
      return
    }
    if (m.text === 'q') {
      await m.reply("ok,已退出")
      fns.cancel()
      return
    }
    if (!m.forward_date) {
      await m.reply("这不是一条转发消息.请转发一条消息给我")
      return
    }
    let f = async () => {
      let fm = await m.forward(storageChatId)
      o.chatId = storageChatId
      o.id = fm.mid
      let data = o
      storage[k].push(data)
      doSave()
      o = {type: "forward"}
      console.log(m.uid, '增加转发', data)
      await m.reply("ok,已增加:" + data.name + ",当前数量:" + storage[k].length + ",继续下一条要转发消息 (发送q退出)")
      fns.resetTimeout()
      if (m.uid !== superAdmin) {
        await bot.sendMessage(superAdmin, JSON.stringify(m.from) + '增加转发')
        await m.forward(superAdmin)
      }
    }
    if (!m.text) {
      await m.reply("该消息没有文本消息,请对我发送一段文本描述该消息")
      fns.pause()
      let fns1 = bot.registerChatListener(m.cid, async m1 => {
        if (!m1.text) {
          await m.reply("请发送一段文本内容用来描述该消息")
          return
        }
        o.name = m1.text
        await f()
        fns1.cancel()
      }, {
        complete: () => fns.pause(false)
      })
      return
    } else {
      o.name = m.text
    }
    await f()
  }, {
    timeout: 120 * 1000,
    timeoutCallback: () => msg.send("已超时!")
  })
})

onAdmin('添加其他??', async (msg, t) => {
  let k = storage[t] ? t : toKey(t)
  let zf
  let obj = {}
  await msg.reply("请发送你想要添加的内容,发送q取消,目前支持的内容:\n\n" + objNames.join("\n"))
  let fns = bot.registerChatListener(msg.cid, async m => {
    if (inWhite(m.text)) {
      await m.reply("接受到其他指令,已退出流程")
      fns.cancel()
      return
    }
    if (m.text === 'q') {
      await m.reply("ok,已退出")
      fns.cancel()
      return
    }
    let save = async () => {
      storage[k].push(obj)
      let existName = !!obj.name
      obj = {}
      doSave()
      if (m.uid !== superAdmin) {
        if (existName) {
          await m.forward(superAdmin)
        }
        await zf.forward(superAdmin)
      }
      await m.send("添加成功,当前数量:" + storage[k].length + ",继续下一个,发送q取消,目前支持的内容:\n\n" + objNames.join("\n"))
      fns.resetTimeout()
    }
    let t
    Object.keys(objKey2Name).some(k => m[k.toLowerCase()] && (t = k))
    let changeObj = () => {
      obj.type = t
      const e = m[t.toLowerCase()];
      obj.id = e.file_id
      if (!obj.id) {
        //一般后面的是高清图
        obj.id = (e[e.length - 1])?.file_id
      }
      zf = m
    }
    //如果是支持的媒体
    if (t) {
      //允许没名字
      if (storage.entryPoint[k]?.allowNoName) {
        //上次的内容存在,则先保存上次的内容
        if (obj.id) {
          await save()
        }
        changeObj()
        await m.reply("你可以发送文本来描述这个" + objKey2Name[obj.type] + ",方便后续管理,也可以发送下一个内容或者发送\"保存\"来保存当前内容")
      } else {
        changeObj()
        await m.reply("已收到" + objKey2Name[obj.type] + ",请给我一段描述吧")
      }
    } else {
      //文本
      if (m.text) {
        if (m.text === "保存") {
          if (!obj.id) {
            await m.reply("当前没有需要保存的内容,请发送一个媒体爱")
            return
          }
          await save()
        } else {
          obj.name = m.text
          if (obj.id) {
            await save()
          } else {
            await m.reply("已命名,请发送一个内容吧,目前支持的内容:\n\n" + objNames.join("\n"))
          }
        }
      } else {
        await m.reply("不支持的类型")
      }
    }
  }, {
    timeout: 120 * 1000,
    timeoutCallback: () => msg.send("已超时!")
  })
})

const keyboard = {
  reply_markup: {
    keyboard: [
      ['添加文本', '添加转发', '添加其他'],
      ['列表概览', '管理列表', '删除语录'],
      ["切换目标", '申请新语录', 'bug反馈'],
    ]
  }
}

const whitelist = ["/", ",", "-"]
for (let i = 0; i < keyboard.reply_markup.keyboard.length; i++) {
  const out = keyboard.reply_markup.keyboard[i];
  for (let j = 0; j < out.length; j++) {
    whitelist.push(out[j])
  }
}

function inWhite(text) {
  return text && whitelist.some(o => text.startsWith(o))
}

let helpText = `
/start 重置菜单
/see [目标] 编号 查看目标指定编号的内容
/edit 编号 内容 修改指定贴纸的文本
/ikun_info 查询机器人状态

>>切换目标<< 可以更换操作的对象

===命令===
`

function toEmoji(emoji) {
  if (!Object.keys(storage.entryPoint).some(k => emoji === storage.entryPoint[k].emoji)) {
    emoji = storage.entryPoint[Object.keys(storage.entryPoint)[0]].emoji
  }
  return emoji
}

function toKey(key) {
  return storage.entryPoint[key] ? key : Object.keys(storage.entryPoint)[0]
}

function emoji2Key(emoji) {
  let r
  Object.keys(storage.entryPoint).some(k => emoji === storage.entryPoint[k].emoji && (r = k))
  if (!r) {
    emoji = Object.keys(storage.entryPoint)[0]
  }
  return r
}

const objKey2Name = {
  "Photo": "图片",
  "Audio": "音乐文件",
  // "Document":"文件",
  "Video": "视频",
  "Animation": "动图",
  "Voice": "语音",
  "Sticker": "贴纸",
}

let objNames = []
for (let k in objKey2Name) {
  objNames.push(objKey2Name[k])
}

let mediaGroupObjKey = ["Photo", "Animation", "Video"]
let mediaGroupNames = []

for (let k of mediaGroupObjKey) {
  mediaGroupNames.push(objKey2Name[k])
}

function doSave() {
  fs.writeFileSync(path.resolve(__dirname, "./data.json"), JSON.stringify(storage, null, 2))
}

setInterval(doSave, 1000 * 60 * 60 * 4)

function toKeyboard(data) {
  if (!Object.keys(storage.entryPoint).some(k => data === storage.entryPoint[k].emoji)) {
    data = storage.entryPoint[Object.keys(storage.entryPoint)[0]].emoji
  }
  let t = clone(keyboard.reply_markup.keyboard)
  for (let i = 0; i < 2; i++) {
    const out = t[i];
    for (let j = 0; j < out.length; j++) {
      out[j] = out[j] + data
    }
  }
  return {reply_markup: {keyboard: t}}
}

onAdmin("切换目标", async msg => {
  let bs = []
  let ep = storage.entryPoint
  for (let k in ep) {
    bs.push(bot.button(ep[k].buttonText, {data: ep[k].emoji}))
  }
  let len = Math.ceil(Math.sqrt(bs.length))
  let buttons = []
  let bg
  for (let i = 0; i < bs.length; i++) {
    if (i % len === 0) {
      bg = []
      buttons.push(bg)
    }
    bg.push(bs[i])
  }
  let send = await bot.sendWithButton(msg.cid, "请选择目标", buttons, {
    callback: async (m, fns) => {
      await bot.sendMessage(msg.cid, "已修改为:" + storage.entryPoint[emoji2Key(m.data)]?.description || m.data, toKeyboard(m.data))
      await bot.deleteMessage(msg.cid, send.message_id)
      fns.cancel()
    }
  })
})
onAdmin("bug反馈", async msg => {
  await msg.reply("ok,请发送要反馈的内容")
  let fns = bot.registerChatListener(msg.cid, async m => {
    await bot.sendMessage(superAdmin, "反馈bug!")
    await m.forward(superAdmin)
    await m.reply("已收到,感谢反馈!")
    fns.cancel()
  })
})

onAdmin("/edit ?? ? ?", async (msg, t, p) => {
  let i = p(2)
  try {
    i = util.int(i)
  } catch {
    await msg.reply("请输入一个正确的数字")
    return
  }
  let k = storage[t] ? t : toKey(t)
  let o = storage[k][util.int(i) - 1]
  if (!o) {
    await msg.reply("编号不正确")
    return
  }
  if (typeof o === 'string') {
    await msg.reply("不能编辑文本的内容")
  } else {
    let n = o.name
    o.name = p(3)
    doSave()
    await msg.reply(`ok,已从 ${n} 修改为 ${o.name}`)
  }
})

bot.onText(/^\/see (\d+)$/m, async (msg, i) => {
  if (storage.admin.includes(msg.uid)) {
    let o = storage.cxk[util.int(i, null, 1, storage.cxk.length) - 1]
    await doSend(msg, o)
  }
})

bot.onText(/^\/see (\S+) (\d+)$/m, async (msg, t, p) => {
  if (storage.admin.includes(msg.uid)) {
    let k = storage[t] ? t : toKey(t)
    let i = p(2)
    let o = storage[k][util.int(i, null, 1, storage[k].length) - 1]
    await doSend(msg, o)
  }
})

onAdmin(['/start ??', '帮助', '退出??'], async (msg, data) => {
  try {
    if (msg.uid !== util.int(data)) {
      await msg.reply("尊敬的管理员,感谢您的使用")
      return
    }
  } catch {
  }
  await msg.reply("尊敬的管理员,感谢您的使用", toKeyboard(data))
})

onAdmin('申请新语录', async msg => {
  await msg.reply("ok,请用一句话描述想增加的语录")
  let fns = bot.registerChatListener(msg.cid, async m => {
    if (inWhite(m.text)) {
      await m.reply("接受到其他指令,已退出")
    } else {
      await m.forward(superAdmin)
      await m.reply("已收录,感谢您的想法,如果通过,会尽快通知您!")
    }
    fns.cancel()
  })
})

bot.onText('/help', async msg => {
  if (storage.admin.includes(msg.uid)) {
    if (msg.chat.type === "private") {
      let s = helpText
      let ep = storage.entryPoint;
      for (let k in ep) {
        s += `${"/" + ep[k].commands.join(" /")} ${ep[k].description}\n`
      }
      await msg.reply(s, toKeyboard())
    } else {
      let r = await msg.reply("尊敬的管理员,请私聊")
      await util.sleep(5 * 1000)
      await r.delete()
      msg.delete()
    }
  } else {
    if (msg.chat.type === "private") {
      await msg.reply("管理员才能使用")
    }
  }
})


bot.onText('/addAdmin ??', async (msg, data) => {
  if (msg.uid === superAdmin) {
    if (data) {
      data = util.int(data)
    } else if (msg.ruid) {
      data = msg.ruid
    } else {
      await msg.reply("请回复一条消息")
      return
    }
    if (storage.admin.includes(data)) {
      await bot.sendWithButton(msg.cid, "错误,重复的管理:" + data + " ,他已经可以编辑我的词库了", [[bot.button("点击进行管理", {
        url: "https://t.me/" + bot.username + "?start=" + data
      })]], {
        option: {reply_to_message_id: msg.mid}
      })
      return
    }
    storage.admin.push(data)
    console.log(msg.uid, '增加管理', data)
    doSave()
    await bot.sendWithButton(msg.cid, "ok,已增加: " + data + " ,他可以私聊编辑我的词库了", [[bot.button("点击进行管理", {
      url: "https://t.me/" + bot.username + "?start=" + data
    })]], {
      option: {reply_to_message_id: msg.mid}
    })
  }
})

bot.onText('/delAdmin ??', async (msg, data) => {
  if (msg.uid === superAdmin) {
    if (data) {
      data = util.int(data)
    } else if (msg.ruid) {
      data = msg.ruid
    } else {
      await msg.reply("请回复一条消息")
      return
    }
    if (!storage.admin.includes(data)) {
      await msg.reply("错误,没有这个管理:" + data)
      return
    }
    storage.admin = storage.admin.filter(t => t !== data)
    console.log(msg.uid, '减少管理', data)
    doSave()
    await msg.reply("ok,已删除:" + data + ",现在管理数:" + storage.admin.length)
  }
})

bot.onText('/isAdmin ??', async (msg, data) => {
  if (msg.uid === superAdmin) {
    if (data) {
      data = util.int(data)
    } else if (msg.ruid) {
      data = msg.ruid
    } else {
      await msg.reply("请回复一条消息")
      return
    }
    await bot.sendWithButton(msg.cid, "是否管理: " + storage.admin.includes(data), [[bot.button("点击进行管理", {
      url: "https://t.me/" + bot.username + "?start=" + data
    })]], {
      option: {reply_to_message_id: msg.mid}
    })
  }
})

bot.onText('/kunConfig ? ??', async (msg, _, p) => {
  if (msg.uid === superAdmin) {
    if (storage.config[p(1)] === undefined) {
      await msg.reply("错误,请检查目标" + p(1) + "是否正确")
      return
    }
    let data = p(2)
    if (data === undefined) {
      await msg.reply(p(1) + " 的值为 " + storage.config[p(1)] + " (" + typeof storage.config[p(1)] + ")")
      return
    }
    try {
      data = util.int(data)
    } catch {
      await msg.reply("错误,请检查参数是否正确")
    }
    storage.config[p(1)] = data
    doSave()
    await msg.reply("ok,已修改 " + p(1) + " 为 " + data + " (" + typeof data + ")")
  }
})

bot.onPrivate('/sendAdmin ?', async (msg, data) => {
  if (msg.uid === superAdmin) {
    await Promise.all(storage.admin.map(async id => {
      try {
        return await bot.sendMessage(id, data, clone(keyboard))
      } catch (e) {
        console.log("发送失败", id, JSON.stringify(e))
      }
    }))
  }
})

bot.onPrivate('/sendMe ?', async (msg, data) => {
  if (msg.uid === superAdmin) {
    await bot.sendMessage(superAdmin, data, clone(keyboard))
  }
})

onAdmin('/groupsInfo', async (msg, data) => {
  if (msg.uid === superAdmin) {
    let g = []
    for (let k in storage.groups) {
      g.push(storage.groups[k])
    }
    g.sort((a, b) => (groupSend[a.id] || 0) - (groupSend[b.id] || 0))
    let r = "共有" + g.length + "个,详情:\n"
    for (let o of g) {
      for (let k1 in o) {
        r += `\n${k1}:${o[k1]}`
      }
      if (groupSend[o.id]) {
        r += "\n最近发送:" + groupSend[o.id]
      }
      r += "\n"
    }
    await msg.send(r)
  }
})

onAdmin('/restart', async (msg, data) => {
  if (msg.uid === superAdmin) {
    await msg.reply("ok,即将重启")
    setTimeout(() => process.exit(0), 500)
  }
})

onAdmin('/backup', async (msg, data) => {
  if (msg.uid === superAdmin) {
    let name = `kun.${new Date().getTime()}.json`
    fs.writeFileSync(path.resolve(__dirname, "./" + name), JSON.stringify(storage, null, 4))
    await msg.reply("ok,已备份:" + name)
  }
})

bot.onText('/ikun_info', async (msg) => {
  if (storage.admin.includes(msg.uid)) {
    await msg.reply("最近发送次数:" + send)
  }
})

function onAdmin() {
  let f = arguments[1]
  arguments[1] = function (msg) {
    if (storage.admin.includes(msg.uid)) {
      f.apply(bot, arguments)
    }
  }
  bot.onPrivate.apply(bot, arguments)
}

async function doSend(msg, o) {
  if (typeof o === 'string') {
    return await msg.reply(o)
  }
  if (objKey2Name[o.type]) {
    return await bot["send" + o.type](msg.cid, o.id, {
      reply_to_message_id: msg.message_id
    })
  }
  if (o.type === "forward") {
    return await bot.forwardMessage(msg.cid, o.chatId, o.id)
  }
  console.error("未知的消息类型:", JSON.stringify(o))
}

function doFormat(msg, o) {
  if (typeof o === 'string') {
    return formatStrLen(o.replace(/\n/g, "\\n"))
  }
  if (objKey2Name[o.type]) {
    return formatStrLen(o.name || "未命名") + " (" + objKey2Name[o.type] + ")"
  }
  if (o.type === "forward") {
    return formatStrLen(o.name || "未命名") + " (转发消息)"
  }
  return "特殊类型:" + o.type
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

let check = {}

let chatWhitelist = [storageChatId]
bot.on("notHandle", async m => {
  if (storage.config.allowBotIsGroupAdmin || m.chat.type === "private" || chatWhitelist.includes(m.cid) || !m.text || check[m.cid] || Math.random() < 0.9) {
    return
  }
  let botStatus = await bot.getChatMember(m.cid, bot.id)
  if (botStatus.status === "administrator") {
    //todo: 关闭bot接受消息功能
    console.log("接受到奇怪的消息,而且是管理员", JSON.stringify(m), JSON.stringify(botStatus))
    m.send("检测到当前机器人为管理员,请将本机器人设置为普通用户\n本消息随机出现,如果长期作为管理员运行,本机器人会退出并拉黑该群")
  } else {
    check[m.cid] = botStatus
  }
})
