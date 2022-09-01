const fs = require('fs')
const path = require('path');

//加载所有的runtime
fs.readdirSync(path.resolve(__dirname, "runtime")).forEach(p => {
  let stat = fs.lstatSync(path.resolve(__dirname, "runtime/" + p));
  if (!stat.isDirectory()) {
    if (p.endsWith(".js")) {
      require("./runtime/" + p)
    }
  }
})
