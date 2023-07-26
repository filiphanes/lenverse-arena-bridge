#!/usr/bin/env node

//KNX USB WS
//https://github.com/MarkPinches/knx
console.log('===============================');
console.log('   ProPresenter Arena bridge   ');
console.log('===============================');
//
require('console')
const path = require("path")
const os = require('os')
const fs = require('fs')
//
let defaultConfigFileName = 'env_default.json'
var configFilePath = 'env.json';
var config = {}
var global_connection_timer;
var request = require('request');
var past = 0;
// Connection
var arena_path_by_id = "/composition/clips/by-id";
var arena_tagged_clips_x = [];
var arena_tagged_clips_1 = [];
var arena_tagged_clips_2 = [];
var arena_tagged_clips_a = [];
var arena_tagged_clips_b = [];
var arena_tagged_clips_A = [];
var arena_tagged_clips_B = [];
var arena_tagged_clips_f = [];
var arena_tagged_clips_l = [];
var arena_tagged_clips_F = [];
var arena_tagged_clips_L = [];
var authenticated = false;
var WebSocketClient = require('websocket').client;
var client = new WebSocketClient();
var turn_ab = false;

function readConfiguration() {
    const configFileContents = fs.readFileSync(configFilePath, 'utf8')
    const config = JSON.parse(configFileContents)
    return config
}

function saveConfiguration(config) {
    fs.writeFileSync(configFilePath, JSON.stringify(config), { encoding: "utf8" });
}

function findConfigurationFile() {
    const tryPath = (pathToTry) => {
        let tryFilePath = path.join(pathToTry, defaultConfigFileName)
        // Check if file exists and is RW
        if (fs.existsSync(tryFilePath)) {
            try {
                fs.accessSync(tryFilePath, fs.constants.R_OK | fs.constants.W_OK)
                return tryFilePath
            } catch (e) {
                // Did not work, so try next
            }
        }
        // Check if directory exists and is RW (so file can be created)
        if (fs.existsSync(pathToTry)) {
            try {
                fs.accessSync(pathToTry, fs.constants.R_OK | fs.constants.W_OK)
                return pathToTry
            } catch (e) {
                // Did not work, so try next
            }
        }
        return false
    }
    let pathsToTry = [
        './',
        // @TODO Add more somewhen in the future, if necessary
    ]
    if (process.platform === 'linux') {
        pathsToTry.push(path.join(os.homedir(), ""))
    }
    if (process.platform === 'darwin') {
        pathsToTry.push(path.join(os.homedir(), 'Library/Preferences'))
    }
    if (process.platform === 'win32' || process.platform === 'win64') {
        pathsToTry.push(path.join(os.homedir(), 'AppData/Roaming'))
    }
    for (const pathToTry of pathsToTry) {
        const r = tryPath(pathToTry)
        if (r) {
            if (fs.lstatSync(r).isDirectory()) {
                return path.join(r, defaultConfigFileName)
            }
            return r
        }
    }
    throw Error('Could not find a writable configuration location.')
}
//
function run() {
    // Find config file to use
    //console.log("runn");
    if (!configFilePath) {
        configFilePath = findConfigurationFile()
        //console.log("Hmmm");
        if (!fs.existsSync(configFilePath)) {
            //console.log("jop")
            fs.cpSync(path.join(__dirname, defaultConfigFileName), configFilePath)
        }
    }
    // Save configuration method
    config = readConfiguration(configFilePath)
    console.info('Config: ', config);
    //basic requests
    client.on('connectFailed', function(error) {
        console.log('ProPresenter: Connection failed ', error.toString());
        retryConnection();
    });
    client.on('connect', function(connection) {
        pp_connected = true;
        console.log('ProPresenter: Connected');
        console.log('ProPresenter: Sending auth');
        console.log("Arena: Downloading clips id with tag", config.arena.clip_name_tag);
        getTaggedClips();
        if (!authenticated) {
            // Send authentication data
            connection.send('{"acn":"ath","ptl":610,"pwd":"' + config.propresenter.pass + '"}');
        }
        connection.on('error', function(error) {
            console.log("ProPresenter: Connection Error: " + error.toString());
        });
        connection.on('close', function() {
            console.log('ProPresenter: Connection Closed');
            retryConnection();
        });
        connection.on('message', function(message) {
            //console.log(message);
            if (message.type === 'utf8') {
                //console.log("Received: '" + message.utf8Data + "'");
                var data = JSON.parse(message.utf8Data);
                if (data.acn == "sys") {
                    //console.log(data);
                } else if (data.acn == "ath") {
                    console.log(data);
                } else if (data.acn == "fv") {
                    if (arena_tagged_clips_x.length == 0) {
                        console.log("Arena: No clips with tag", config.arena.clip_name_tag);
                        getTaggedClips();
                        return;
                    }
                    //console.log("message", data);
                    if (data.ary === undefined) {
                        console.log("ProPresenter: undefined data");
                        return;
                    }
                    var content = data.ary;
                    //console.log(content[0]);
                    var currentSlideText = "";
                    var nextSlideText = "";
                    var current_full_text = "";
                    var current_full_text_splitted = "";
                    var next_full_text = "";
                    var next_full_text_splitted = "";
                    var first_word = "";
                    var first_word_upper = "";
                    var last_word = "";
                    var last_word_upper = "";
                    //
                    var currentSlideArray = [];
                    var nextSlideArray = [];
                    var snd_obj = {};
                    var clip_id = 0;
                    var working_clips = [];
                    turn_ab = !turn_ab;
                    //
                    for (var i = 0; i < content.length; i++) {
                        //console.log(content[i]);
                        if (content[i].acn == "cs") {
                            if (content[i].txt !== undefined) {
                                //console.log("EXECUTED");
                                //
                                currentSlideText = content[i].txt;
                                //
                                currentSlideText = currentSlideText.trim();
                                //
                                currentSlideText = currentSlideText.replace(/^\x82+|\x82+$/gm, "");
                                //
                                currentSlideText = currentSlideText.replace(/^\r+|\r+$/gm, "");
                                //add br
                                currentSlideText = currentSlideText.replace(/\n|\x0B|\x0C|\u0085|\u2028|\u2029/g, "\n");
                            }
                            //console.log("ACN CS", typeof content[i].txt, content[i].txt.length, content[i].txt.trim().length);
                        }
                        if (content[i].acn == "ns") {
                            if (content[i].txt !== undefined) {
                                //console.log("EXECUTED");
                                //
                                nextSlideText = content[i].txt;
                                //
                                nextSlideText = nextSlideText.trim();
                                //
                                nextSlideText = nextSlideText.replace(/^\x82+|\x82+$/gm, "");
                                //
                                nextSlideText = nextSlideText.replace(/^\r+|\r+$/gm, "");
                                //add br
                                nextSlideText = nextSlideText.replace(/\n|\x0B|\x0C|\u0085|\u2028|\u2029/g, "\n");
                            }
                            //console.log("ACN CS", typeof content[i].txt, content[i].txt.length, content[i].txt.trim().length);
                        }
                    }
                    if (currentSlideText !== "") {
                        //console.log("DO");
                        //
                        currentSlideArray = currentSlideText.split("\r").reverse();
                        //
                        //fulltext
                        current_full_text = currentSlideArray.join("\r");
                        current_full_text_upper = current_full_text.toLocaleUpperCase();
                        //first last
                        current_full_text_splitted = current_full_text.split(' ');
                        //
                        last_word = "";
                        if (current_full_text_splitted[current_full_text_splitted.length - 1].length < 5) {
                            last_word = current_full_text_splitted[current_full_text_splitted.length - 2] + ' ' + current_full_text_splitted[current_full_text_splitted.length - 1];
                            if (current_full_text_splitted[current_full_text_splitted.length - 2] == "ma" || current_full_text_splitted[current_full_text_splitted.length - 2] == "sa") {
                                last_word = current_full_text_splitted[current_full_text_splitted.length - 1];
                            }
                            if (current_full_text_splitted[current_full_text_splitted.length - 2] == "to") {
                                last_word = current_full_text_splitted[current_full_text_splitted.length - 3] + ' ' + current_full_text_splitted[current_full_text_splitted.length - 2] + ' ' + current_full_text_splitted[current_full_text_splitted.length - 1];
                            }
                        } else {
                            last_word = current_full_text_splitted[current_full_text_splitted.length - 1];
                        }
                        last_word = last_word.replace(/^[\ \,\.\:\;\"\'\(\)\-]+/, "").replace(/[\ \,\.\:\;\"\'\(\)\-]+$/, "");
                        last_word_upper = last_word.toLocaleUpperCase();
                    }
                    if (nextSlideText !== "") {
                        //console.log("DO");
                        //
                        nextSlideArray = nextSlideText.split("\r").reverse();
                        //
                        //fulltext
                        next_full_text = nextSlideArray.join("\r");
                        //first last
                        next_full_text_splitted = next_full_text.split(' ');
                        first_word = "";
                        if (next_full_text_splitted[0].length < 5) {
                            first_word = next_full_text_splitted[0] + ' ' + next_full_text_splitted[1];
                            first_word = first_word.toLocaleUpperCase();
                        } else {
                            first_word = next_full_text_splitted[0];
                        }
                        first_word = first_word.replace(/^[\ \,\.\:\;\"\'\(\)\-]+/, "").replace(/[\ \,\.\:\;\"\'\(\)\-]+$/, "");
                        first_word_upper = first_word.toLocaleUpperCase();
                    }
                    //console.log(currentSlideText);
                    var target_url = 'http://' + config.arena.host + ':' + config.arena.port + '/api/v1' + arena_path_by_id;
                    //
                    if (turn_ab) {
                        console.log("A turn");
                    } else {
                        console.log("B turn");
                    }
                    //
                    //
                    //var index = key.split('-');
                    //currentSlideText = slideArray[parseInt(index[1], 10) - 1];
                    //currentSlideText = (currentSlideText) ? currentSlideText : "";
                    var textForThisClip = "";
                    var upload_timer = 0;
                    let now = new Date();
                    let elapsed = (now - past);
                    console.log("elapsed bef", elapsed);
                    elapsed = Math.round((elapsed / 4) * 2);
                    if (elapsed < 500) {
                        elapsed = 500;
                    }
                    if (elapsed > 5000) {
                        elapsed = 5000;
                    }
                    past = now;
                    for (var i = 0; i < arena_tagged_clips_x.length; i++) {
                        //
                        clip_id = arena_tagged_clips_x[i];
                        if (turn_ab && arena_tagged_clips_b.includes(clip_id)) {
                            //onsole.log("SKIP turn A for", clip_id);
                            continue;
                        } else if (!turn_ab && arena_tagged_clips_a.includes(clip_id)) {
                            //console.log("SKIP turn B for", clip_id);
                            continue;
                        }
                        //
                        textForThisClip = current_full_text;
                        //
                        if (arena_tagged_clips_A.includes(clip_id)) {
                            textForThisClip = current_full_text_upper;
                        }
                        if (arena_tagged_clips_B.includes(clip_id)) {
                            textForThisClip = current_full_text_upper;
                        }
                        if (arena_tagged_clips_f.includes(clip_id)) {
                            textForThisClip = first_word;
                        }
                        if (arena_tagged_clips_l.includes(clip_id)) {
                            textForThisClip = last_word;
                        }
                        if (arena_tagged_clips_F.includes(clip_id)) {
                            textForThisClip = first_word_upper;
                        }
                        if (arena_tagged_clips_L.includes(clip_id)) {
                            textForThisClip = last_word_upper;
                        }
                        //console.log("textForThisClip", textForThisClip);
                        snd_obj = { "video": { "sourceparams": { "Text": textForThisClip } } };
                        //
                        upload_timer = 0;
                        if (arena_tagged_clips_f.includes(clip_id) || arena_tagged_clips_F.includes(clip_id) || arena_tagged_clips_l.includes(clip_id) || arena_tagged_clips_L.includes(clip_id)) {
                            upload_timer = elapsed;
                        }
                        console.log("THICK", upload_timer);
                        setTimeout(function(target, id, obj) {
                            request({ url: target + '/' + id, method: 'PUT', json: obj }, function(error, response, body) {
                                //request({ url: 'http://' + config.arena.host + ':' + config.arena.port + '/api/v1' + arena_path, method: 'PUT', json: snd_obj }, function(error, response, body) {
                                //console.log(error, response, body);
                                //console.log(response.statusCode);
                                if (error) {
                                    console.log("Arena: Connection error", error);
                                    clearTagged();
                                    return;
                                }
                                if (response.statusCode == 204) {
                                    //console.log(response.statusCode, "Arena: Upload OK");
                                }
                            });
                        }, upload_timer, target_url, clip_id, snd_obj);
                        //
                        if (arena_tagged_clips_a.includes(clip_id) || arena_tagged_clips_b.includes(clip_id)) {
                            setTimeout(function(target, id, obj) {
                                request({ url: target + '/' + id + '/connect', method: 'POST', json: true }, function(error, response, body) {
                                    //request({ url: 'http://' + config.arena.host + ':' + config.arena.port + '/api/v1' + arena_path, method: 'PUT', json: snd_obj }, function(error, response, body) {
                                    //console.log(error, response, body);
                                    //console.log(response.statusCode);
                                    if (error) {
                                        console.log("Arena: Connection error", error);
                                        clearTagged();
                                        return;
                                    }
                                    if (response.statusCode == 204) {
                                        //console.log(response.statusCode, "Arena: Triggered OK");
                                    }
                                });
                            }, 50, target_url, clip_id, snd_obj);
                        }
                        //console.log("X", full_obj, "F", first_obj, "L", last_obj, "FF", first_obj, "LL", last_obj);
                    }
                } else {
                    console.log("ProPresenter: Unknown ACN", data);
                }
            }
        });
    });
    //
    connect();
    //
}

function clearTagged() {
    arena_tagged_clips_x = [];
    arena_tagged_clips_a = [];
    arena_tagged_clips_b = [];
    arena_tagged_clips_f = [];
    arena_tagged_clips_l = [];
    arena_tagged_clips_F = [];
    arena_tagged_clips_L = [];
}

function getTaggedClips(tag = "#pab") {
    console.log("getTaggedClips");
    clearTagged();
    request({ url: 'http://' + config.arena.host + ':' + config.arena.port + '/api/v1/composition', method: 'GET' }, function(error, response, body) {
        //console.log(error, response, body);
        //console.log(response.statusCode);
        if (error) {
            console.log("Arena: Connection error", error);
            return;
        }
        if (response.statusCode == 200) {
            body = JSON.parse(body);
            //console.log(response.statusCode, "Arena: Download OK", body);
            if (body.layers === undefined) {
                console.log("No layers");
                return arena_tagged_clips;
            }
            //console.log(body.layers);
            var layers = body.layers;
            var clips;
            let pattern_1 = /#pab-1/;
            let pattern_2 = /#pab-2/;
            let pattern_a = /#pab-a/;
            let pattern_b = /#pab-b/;
            let pattern_f = /#pab-f/;
            let pattern_l = /#pab-l/;
            let pattern_F = /#pab-F/;
            let pattern_L = /#pab-L/;
            for (var i = 0; i < layers.length; i++) {
                clips = layers[i].clips;
                //console.log(clips);
                for (var x = 0; x < clips.length; x++) {
                    //console.log(clips[x]);
                    if (clips[x].name.value.includes(config.arena.clip_name_tag)) {
                        let result_1 = clips[x].name.value.match(pattern_1);
                        let result_2 = clips[x].name.value.match(pattern_2);
                        let result_a = clips[x].name.value.match(pattern_a);
                        let result_b = clips[x].name.value.match(pattern_b);
                        let result_f = clips[x].name.value.match(pattern_f);
                        let result_l = clips[x].name.value.match(pattern_l);
                        let result_F = clips[x].name.value.match(pattern_F);
                        let result_L = clips[x].name.value.match(pattern_L);
                        //console.log("Restul", result_n);
                        //all clips
                        if (arena_tagged_clips_x === undefined) {
                            arena_tagged_clips_x = [];
                        }
                        arena_tagged_clips_x.push(clips[x].id);
                        //
                        if (result_1) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_1 === undefined) {
                                arena_tagged_clips_1 = [];
                            }
                            arena_tagged_clips_1.push(clips[x].id);
                        }
                        if (result_2) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_2 === undefined) {
                                arena_tagged_clips_2 = [];
                            }
                            arena_tagged_clips_2.push(clips[x].id);
                        }
                        if (result_a) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_a === undefined) {
                                arena_tagged_clips_a = [];
                            }
                            arena_tagged_clips_a.push(clips[x].id);
                        }
                        if (result_b) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_b === undefined) {
                                arena_tagged_clips_b = [];
                            }
                            arena_tagged_clips_b.push(clips[x].id);
                        }
                        if (result_f) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_f === undefined) {
                                arena_tagged_clips_f = [];
                            }
                            arena_tagged_clips_f.push(clips[x].id);
                        }
                        if (result_l) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_l === undefined) {
                                arena_tagged_clips_l = [];
                            }
                            arena_tagged_clips_l.push(clips[x].id);
                        }
                        if (result_F) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_F === undefined) {
                                arena_tagged_clips_F = [];
                            }
                            arena_tagged_clips_F.push(clips[x].id);
                        }
                        if (result_L) {
                            //result_n = parseInt(result_n[0], 10);
                            //result_n = result_n[0];
                            if (arena_tagged_clips_L === undefined) {
                                arena_tagged_clips_L = [];
                            }
                            arena_tagged_clips_L.push(clips[x].id);
                        }
                    }
                }
            }
            console.log("clips X", arena_tagged_clips_x);
            console.log("clips A", arena_tagged_clips_a);
            console.log("clips B", arena_tagged_clips_b);
            console.log("clips AA", arena_tagged_clips_a);
            console.log("clips BB", arena_tagged_clips_b);
            console.log("clips F", arena_tagged_clips_f);
            console.log("clips L", arena_tagged_clips_l);
            console.log("clips FF", arena_tagged_clips_F);
            console.log("clips LL", arena_tagged_clips_L);
        }
    });
}

function retryConnection() {
    clearTimeout(global_connection_timer);
    global_connection_timer = setTimeout(function() {
        connect();
    }, 5000);
}

function connect() {
    clearTimeout(global_connection_timer);
    config = readConfiguration(configFilePath)
    client.connect('ws://' + config.propresenter.host + ':' + config.propresenter.port + '/stagedisplay');
}
run();