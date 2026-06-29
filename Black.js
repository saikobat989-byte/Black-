/**
 * @author Saint
 * ! The source code is written by Saint, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/saint03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 *
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * Vietnamese:
 * ! Vui lòng không thay đổi mã bên dưới, nó rất quan trọng đối với dự án.
 * Nó là động lực để tôi duy trì và phát triển dự án miễn phí.
 * ! Nếu thay đổi nó, bạn sẽ bị cấm vĩnh viễn
 * Cảm ơn bạn đã sử dụng
 */

process.on('unhandledRejection', (error, promise) => {
        console.error('[UNHANDLED_REJECTION]', error?.stack || error);
});
process.on('uncaughtException', (error) => {
        console.error('[UNCAUGHT_EXCEPTION]', error?.stack || error);
        const code = error?.code || '';
        const isNetwork = code === 'ECONNRESET' || code === 'EPIPE' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ERR_IPC_CHANNEL_CLOSED';
        if (isNetwork) {
                console.error('[RECOVERY] Network error, continuing...');
                return;
        }
        console.error('[FATAL] Unrecoverable error, exiting for restart...');
        process.exit(2);
});

const axios = require("axios");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");
const { execSync } = require('child_process');
const log = require('./logger/log.js');
const path = require("path");

process.env.BLUEBIRD_W_FORGOTTEN_RETURN = 0; // Disable warning: "Warning: a promise was created in a handler but was not returned from it"

function validJSON(pathDir) {
        try {
                if (!fs.existsSync(pathDir))
                        throw new Error(`File "${pathDir}" not found`);
                execSync(`npx jsonlint "${pathDir}"`, { stdio: 'pipe' });
                return true;
        }
        catch (err) {
                let msgError = err.message;
                msgError = msgError.split("\n").slice(1).join("\n");
                const indexPos = msgError.indexOf("    at");
                msgError = msgError.slice(0, indexPos != -1 ? indexPos - 1 : msgError.length);
                throw new Error(msgError);
        }
}

const { NODE_ENV } = process.env;
const dirConfig = path.normalize(`${__dirname}/config${['production', 'development'].includes(NODE_ENV) ? '.dev.json' : '.json'}`);
const dirConfigCommands = path.normalize(`${__dirname}/configCommands${['production', 'development'].includes(NODE_ENV) ? '.dev.json' : '.json'}`);
const dirAccount = path.normalize(`${__dirname}/account${['production', 'development'].includes(NODE_ENV) ? '.dev.txt' : '.txt'}`);

for (const pathDir of [dirConfig, dirConfigCommands]) {
        try {
                validJSON(pathDir);
        }
        catch (err) {
                log.error("CONFIG", `Invalid JSON file "${pathDir.replace(__dirname, "")}":\n${err.message.split("\n").map(line => `  ${line}`).join("\n")}\nPlease fix it and restart bot`);
                process.exit(0);
        }
}
const config = require(dirConfig);
// Inject Gemini key from environment at runtime.
// Use a non-enumerable property so JSON.stringify (disk writes) never exposes the key.
if (process.env.GOOGLE_API_KEY) {
        Object.defineProperty(config.apiKeys, 'gemini', {
                get: () => process.env.GOOGLE_API_KEY,
                enumerable: false,
                configurable: true
        });
}
if (config.blackListMode?.blackListIds && Array.isArray(config.blackListMode.blackListIds))
        config.blackListMode.blackListIds = config.blackListMode.blackListIds.map(id => id.toString());

if (config.optionsFca) {
        config.optionsFca.updatePresence = false;
        config.optionsFca.listenTyping   = false;
        config.optionsFca.online         = false;
}
const configCommands = require(dirConfigCommands);

global.BlackBot = {
        startTime: Date.now() - process.uptime() * 1000, // time start bot (ms)
        commands: new Map(), // store all commands
        eventCommands: new Map(), // store all event commands
        commandFilesPath: [], // [{ filePath: "", commandName: [] }
        eventCommandsFilesPath: [], // [{ filePath: "", commandName: [] }
        aliases: new Map(), // store all aliases
        onFirstChat: [], // store all onFirstChat [{ commandName: "", threadIDsChattedFirstTime: [] }}]
        onChat: [], // store all onChat
        onEvent: [], // store all onEvent
        onReply: new Map(), // store all onReply
        onReaction: new Map(), // store all onReaction
        onAnyEvent: [], // store all onAnyEvent
        config, // store config
        configCommands, // store config commands
        envCommands: {}, // store env commands
        envEvents: {}, // store env events
        envGlobal: {}, // store env global
        reLoginBot: function () { }, // function relogin bot, will be set in bot/login/login.js
        Listening: null, // store current listening handle
        oldListening: [], // store old listening handle
        callbackListenTime: {}, // store callback listen 
        storage5Message: [], // store 5 message to check listening loop
        fcaApi: null, // store fca api
        botID: null // store bot id
};

global.db = {
        // all data
        allThreadData: [],
        allUserData: [],
        allDashBoardData: [],
        allGlobalData: [],

        // model
        threadModel: null,
        userModel: null,
        dashboardModel: null,
        globalModel: null,

        // handle data
        threadsData: null,
        usersData: null,
        dashBoardData: null,
        globalData: null,

        receivedTheFirstMessage: {}

        // all will be set in bot/login/loadData.js
};

global.client = {
        dirConfig,
        dirConfigCommands,
        dirAccount,
        countDown: {},
        cache: {},
        database: {
                creatingThreadData: [],
                creatingUserData: [],
                creatingDashBoardData: [],
                creatingGlobalData: []
        },
        commandBanned: configCommands.commandBanned
};

const utils = require("./utils.js");
global.utils = utils;
const { colors } = utils;

global.temp = {
        createThreadData: [],
        createUserData: [],
        createThreadDataError: [], // Can't get info of groups with instagram members
        filesOfGoogleDrive: {
                arraybuffer: {},
                stream: {},
                fileNames: {}
        },
        contentScripts: {
                cmds: {},
                events: {}
        }
};

// watch dirConfigCommands file and dirConfig
const watchAndReloadConfig = (dir, type, prop, logName, afterReload) => {
        let lastModified = fs.statSync(dir).mtimeMs;
        let isFirstModified = true;

        fs.watch(dir, (eventType) => {
                if (eventType === type) {
                        const oldConfig = global.BlackBot[prop];

                        // wait 200ms to reload config
                        setTimeout(() => {
                                try {
                                        // if file change first time (when start bot, maybe you know it's called when start bot?) => not reload
                                        if (isFirstModified) {
                                                isFirstModified = false;
                                                return;
                                        }
                                        // if file not change => not reload
                                        if (lastModified === fs.statSync(dir).mtimeMs) {
                                                return;
                                        }
                                        global.BlackBot[prop] = JSON.parse(fs.readFileSync(dir, 'utf-8'));
                                        if (afterReload) afterReload(global.BlackBot[prop]);
                                        log.success(logName, `Reloaded ${dir.replace(process.cwd(), "")}`);
                                }
                                catch (err) {
                                        log.warn(logName, `Can't reload ${dir.replace(process.cwd(), "")}`);
                                        global.BlackBot[prop] = oldConfig;
                                }
                                finally {
                                        lastModified = fs.statSync(dir).mtimeMs;
                                }
                        }, 200);
                }
        });
};

watchAndReloadConfig(dirConfigCommands, 'change', 'configCommands', 'CONFIG COMMANDS');
watchAndReloadConfig(dirConfig, 'change', 'config', 'CONFIG', (cfg) => {
        // Re-apply env key after config reload so apiKeys.gemini is never read from disk
        if (process.env.GOOGLE_API_KEY) {
                Object.defineProperty(cfg.apiKeys, 'gemini', {
                        get: () => process.env.GOOGLE_API_KEY,
                        enumerable: false,
                        configurable: true
                });
        }
});

global.BlackBot.envGlobal = global.BlackBot.configCommands.envGlobal;
global.BlackBot.envCommands = global.BlackBot.configCommands.envCommands;
global.BlackBot.envEvents = global.BlackBot.configCommands.envEvents;

// ———————————————— LOAD LANGUAGE ———————————————— //
const getText = global.utils.getText;

// ———————————————— AUTO RESTART ———————————————— //
if (config.autoRestart) {
        const time = config.autoRestart.time;
        if (!isNaN(time) && time > 0) {
                utils.log.info("AUTO RESTART", getText("Black", "autoRestart1", utils.convertTime(time, true)));
                setTimeout(() => {
                        utils.log.info("AUTO RESTART", "Restarting...");
                        process.exit(2);
                }, time);
        }
        else if (typeof time == "string" && time.match(/^((((\d+,)+\d+|(\d+(\/|-|#)\d+)|\d+L?|\*(\/\d+)?|L(-\d+)?|\?|[A-Z]{3}(-[A-Z]{3})?) ?){5,7})$/gmi)) {
                utils.log.info("AUTO RESTART", getText("Black", "autoRestart2", time));
                const cron = require("node-cron");
                cron.schedule(time, () => {
                        utils.log.info("AUTO RESTART", "Restarting...");
                        process.exit(2);
                });
        }
}

(async () => {
        // ———————————————————— LOGIN ———————————————————— //
        require(`./bot/login/login${NODE_ENV === 'development' ? '.dev.js' : '.js'}`);
})();

