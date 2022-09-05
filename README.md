# 一个简单的tgbot

使用了最简单的依赖,并且自行简单包装 https://github.com/mzzsfy/node-telegram-bot-wrapper

该bot实现了一些简单的功能

- 根据自定义命令返回随机内容
- 自定义词库内容
- 自定义命令对应词库
- 动态添加词库

bot支持的内容

- 纯文本
- 转发的消息
- 贴图
- 图片,视频等媒体文件

##部署

首先确保有node,并且npm可用,然后执行如下代码

```bash
npm install

export TGBOT_TOKEN=你的botToken
export TGBOT_SUPER_ADMIN_ID=你的tgId
#以上2条可在config/tgbot.js手动修改,不使用环境变量

node app
```
