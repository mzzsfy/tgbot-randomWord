exports.bot = require("./tgbot")
exports.util = {
  //@formatter:off
  f: () => {},
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),
  int: (str,defaultValue,min,max) => (i =parseInt(str), isNaN(i)&&(i=defaultValue,defaultValue===undefined||defaultValue===null)&&(function (){throw "请输入一个数字"}()), undefined!==min&&null!==min&&i<min&&(i=min), undefined!==max&&null!==max&&i>max&&(i=max), i),
  randomOne: (arr) => (arr||(arr=[]),arr[Math.floor(Math.random()*arr.length)]),
  randomInt: (min,max) => Math.floor(Math.random()*(max-min)+min),
  //@formatter:on
}
exports.webUtil = {
  async: callback => (req, res, next) => callback(req, res, next).catch(next)
}
let botUtil = {};
exports.botUtil = botUtil
