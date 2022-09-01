module.exports = {
  debug: process.env.TGBOT_DEBUG === "true" || false,
  baseUrl: process.env.TGBOT_BASE_URL,
  token: process.env.TGBOT_TOKEN,
  superAdminTgId: process.env.TGBOT_SUPER_ADMIN_ID,
}

module.exports.superAdminTgId = parseInt(module.exports.superAdminTgId) || 0
if (!module.exports.token) {
  setTimeout(() => process.exit(1), 100)
  throw "请使用环境变量TGBOT_TOKEN,设置bot的token"
}
if (!module.exports.superAdminTgId) {
  setTimeout(() => process.exit(1), 100)
  throw "请使用环境变量TGBOT_SUPER_ADMIN_ID,设置一个超级管理员"
}
module.exports.storageChatId = parseInt(process.env.TGBOT_STORAGE_CHAT_ID || module.exports.superAdminTgId) || 0
