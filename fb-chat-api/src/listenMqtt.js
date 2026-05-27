/* eslint-disable no-redeclare */
"use strict";
var utils = require("../utils");
var log = require("npmlog");
var mqtt = require('mqtt');
var websocket = require('websocket-stream');
var HttpsProxyAgent = require('https-proxy-agent');
const EventEmitter = require('events');
const debugSeq = false;
var identity = function () { };
var form = {};
var getSeqID = function () { };

var topics = [
    "/legacy_web",
    "/webrtc",
    "/rtc_multi",
    "/onevc",
    "/br_sr",
    "/sr_res",
    "/t_ms",
    "/thread_typing",
    "/orca_typing_notifications",
    "/notify_disconnect",
    "/orca_presence",
    "/inbox",
    "/mercury",
    "/messaging_events",
    "/orca_message_notifications",
    "/pp",
    "/webrtc_response",
    "/t_p",
    "/t_rtc",
    "/webrtc_response",
];

var pingInterval = null;
var reconnectTimeout = null;
var mqttConnected = false;
var reconnectAttempts = 0;
var MAX_RECONNECT_ATTEMPTS = 10;
var BASE_RECONNECT_DELAY = 1000;

function listenMqtt(defaultFuncs, api, ctx, globalCallback) {
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    
    var chatOn = ctx.globalOptions.online;
    var foreground = false;

    var sessionID = Math.floor(Math.random() * 9007199254740991) + 1;
    var GUID = utils.getGUID();
    
    const username = {
        u: ctx.userID,
        s: sessionID,
        chat_on: chatOn,
        fg: foreground,
        d: GUID,
        ct: 'websocket',
        aid: '219994525426954',
        aids: null,
        mqtt_sid: '',
        cp: 3,
        ecp: 10,
        st: [],
        pm: [],
        dc: '',
        no_auto_fg: true,
        gas: null,
        pack: [],
        p: null,
        php_override: ""
    };
    
    var cookies = ctx.jar.getCookies("https://www.facebook.com").join("; ");

    var host;
    if (ctx.mqttEndpoint) {
        host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${GUID}`;
    } else if (ctx.region) {
        host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLocaleLowerCase()}&sid=${sessionID}&cid=${GUID}`;
    } else {
        host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${GUID}`;
    }

    var mqttURL = new URL(host);
    
    const options = {
        clientId: 'mqttwsclient_' + Math.random().toString(36).substr(2, 9),
        protocolId: 'MQIsdp',
        protocolVersion: 3,
        username: JSON.stringify(username),
        clean: true,
        wsOptions: {
            headers: {
                'Cookie': cookies,
                'Origin': 'https://www.facebook.com',
                'User-Agent': ctx.globalOptions.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.facebook.com/',
                'Host': mqttURL.hostname,
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': '*/*',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Sec-WebSocket-Extensions': 'permessage-deflate',
                'Sec-WebSocket-Version': '13'
            },
            origin: 'https://www.facebook.com',
            protocolVersion: 13,
            binaryType: 'arraybuffer',
        },
        keepalive: 30,
        reschedulePings: true,
        reconnectPeriod: 0,
        connectTimeout: 30000,
    };

    if (typeof ctx.globalOptions.proxy != "undefined") {
        var agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
        options.wsOptions.agent = agent;
    }

    try {
        if (ctx.mqttClient) {
            try {
                ctx.mqttClient.end(true);
            } catch (e) {}
            ctx.mqttClient = null;
        }
        
        ctx.mqttClient = new mqtt.Client(_ => websocket(host, options.wsOptions), options);
        global.mqttClient = ctx.mqttClient;
    } catch (err) {
        log.error("listenMqtt", "Failed to create MQTT client: " + err.message);
        handleReconnect();
        return;
    }

    ctx.mqttClient.on('error', function (err) {
        log.error("listenMqtt", "MQTT Error: " + err.message);
        mqttConnected = false;
        if (pingInterval) clearInterval(pingInterval);
        
        if (err.message.includes('Not logged in') || err.message.includes('E_NOT_AUTHORIZED')) {
            ctx.loggedIn = false;
            globalCallback({ type: "stop_listen", error: "Not logged in" }, null);
            return;
        }
        
        handleReconnect();
    });

    ctx.mqttClient.on('connect', function () {
        log.info("listenMqtt", "MQTT Connected successfully");
        mqttConnected = true;
        reconnectAttempts = 0;
        
        topics.forEach(function(topicsub) {
            ctx.mqttClient.subscribe(topicsub, { qos: 0 }, function(err) {
                if (err) log.error("listenMqtt", "Failed to subscribe to " + topicsub + ": " + err.message);
            });
        });

        var topic;
        var queue = {
            sync_api_version: 10,
            max_deltas_able_to_process: 1000,
            delta_batch_size: 500,
            encoding: "JSON",
            entity_fbid: ctx.userID,
        };

        if (ctx.syncToken) {
            topic = "/messenger_sync_get_diffs";
            queue.last_seq_id = ctx.lastSeqId;
            queue.sync_token = ctx.syncToken;
        } else {
            topic = "/messenger_sync_create_queue";
            queue.initial_titan_sequence_id = ctx.lastSeqId;
            queue.device_params = null;
        }

        ctx.mqttClient.publish(topic, JSON.stringify(queue), { qos: 1, retain: false }, function(err) {
            if (err) log.error("listenMqtt", "Failed to publish sync queue: " + err.message);
        });

        var rTimeout = setTimeout(function () {
            log.error("listenMqtt", "Sync queue timeout");
            ctx.mqttClient.end(true);
            handleReconnect();
        }, 10000);

        ctx.tmsWait = function () {
            clearTimeout(rTimeout);
            log.info("listenMqtt", "Sync queue completed");
            if (ctx.globalOptions.emitReady) {
                globalCallback({ type: "ready", error: null });
            }
            delete ctx.tmsWait;
        };

        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(function() {
            if (ctx.mqttClient && mqttConnected) {
                ctx.mqttClient.publish('/t_p', '{}', { qos: 0, retain: false }, function(err) {
                    if (err) {
                        log.error("listenMqtt", "Ping failed: " + err.message);
                        mqttConnected = false;
                        handleReconnect();
                    }
                });
            }
        }, 30000);
    });

    ctx.mqttClient.on('message', function (topic, message, _packet) {
        try {
            var jsonMessage = JSON.parse(message);
        } catch (ex) {
            return log.error("listenMqtt", "Failed to parse message: " + ex.message);
        }
        
        if (topic === "/t_ms") {
            if (ctx.tmsWait && typeof ctx.tmsWait == "function") {
                ctx.tmsWait();
            }

            if (jsonMessage.firstDeltaSeqId && jsonMessage.syncToken) {
                ctx.lastSeqId = jsonMessage.firstDeltaSeqId;
                ctx.syncToken = jsonMessage.syncToken;
            }

            if (jsonMessage.lastIssuedSeqId) {
                ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
            }

            if (jsonMessage.deltas) {
                for (var i in jsonMessage.deltas) {
                    var delta = jsonMessage.deltas[i];
                    parseDelta(defaultFuncs, api, ctx, globalCallback, { "delta": delta });
                }
            }
        } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
            var typ = {
                type: "typ",
                isTyping: !!jsonMessage.state,
                from: jsonMessage.sender_fbid.toString(),
                threadID: utils.formatID((jsonMessage.thread || jsonMessage.sender_fbid).toString())
            };
            (function () { globalCallback(null, typ); })();
        } else if (topic === "/orca_presence") {
            if (!ctx.globalOptions.updatePresence && jsonMessage.list) {
                for (var i in jsonMessage.list) {
                    var data = jsonMessage.list[i];
                    var userID = data["u"];

                    var presence = {
                        type: "presence",
                        userID: userID.toString(),
                        timestamp: data["l"] * 1000,
                        statuses: data["p"]
                    };
                    (function () { globalCallback(null, presence); })();
                }
            }
        } else if (topic === "/t_p") {
            log.info("listenMqtt", "Ping response received");
        }
    });

    ctx.mqttClient.on('close', function () {
        log.info("listenMqtt", "MQTT Connection closed");
        mqttConnected = false;
        if (pingInterval) clearInterval(pingInterval);
        
        if (ctx.loggedIn !== false) {
            handleReconnect();
        }
    });

    ctx.mqttClient.on('offline', function () {
        log.info("listenMqtt", "MQTT Client offline");
        mqttConnected = false;
    });

    function handleReconnect() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            log.error("listenMqtt", "Max reconnection attempts reached");
            globalCallback({ type: "stop_listen", error: "Max reconnection attempts reached" }, null);
            return;
        }
        
        var delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 60000);
        reconnectAttempts++;
        
        log.info("listenMqtt", "Reconnecting in " + delay + "ms (attempt " + reconnectAttempts + "/" + MAX_RECONNECT_ATTEMPTS + ")");
        
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(function() {
            if (ctx.loggedIn !== false) {
                listenMqtt(defaultFuncs, api, ctx, globalCallback);
            }
        }, delay);
    }
}

function parseDelta(defaultFuncs, api, ctx, globalCallback, v) {
    if (v.delta.class == "NewMessage") {
        if (ctx.globalOptions.pageID && ctx.globalOptions.pageID != v.queue) return;

        (function resolveAttachmentUrl(i) {
            if (i == (v.delta.attachments || []).length) {
                let fmtMsg;
                try {
                    fmtMsg = utils.formatDeltaMessage(v);
                } catch (err) {
                    return globalCallback({
                        error: "Problem parsing message object.",
                        detail: err,
                        res: v,
                        type: "parse_error"
                    });
                }
                if (fmtMsg) {
                    if (ctx.globalOptions.autoMarkDelivery) {
                        markDelivery(ctx, api, fmtMsg.threadID, fmtMsg.messageID);
                    }
                }
                return !ctx.globalOptions.selfListen &&
                    (fmtMsg.senderID === ctx.i_userID || fmtMsg.senderID === ctx.userID) ?
                    undefined :
                    (function () { globalCallback(null, fmtMsg); })();
            } else {
                if (v.delta.attachments[i].mercury.attach_type == "photo") {
                    api.resolvePhotoUrl(
                        v.delta.attachments[i].fbid,
                        (err, url) => {
                            if (!err)
                                v.delta.attachments[i].mercury.metadata.url = url;
                            return resolveAttachmentUrl(i + 1);
                        }
                    );
                } else {
                    return resolveAttachmentUrl(i + 1);
                }
            }
        })(0);
    }

    if (v.delta.class == "ClientPayload") {
        var clientPayload = utils.decodeClientPayload(v.delta.payload);
        if (clientPayload && clientPayload.deltas) {
            for (var i in clientPayload.deltas) {
                var delta = clientPayload.deltas[i];
                if (delta.deltaMessageReaction && !!ctx.globalOptions.listenEvents) {
                    (function () {
                        globalCallback(null, {
                            type: "message_reaction",
                            threadID: (delta.deltaMessageReaction.threadKey.threadFbId ? delta.deltaMessageReaction.threadKey.threadFbId : delta.deltaMessageReaction.threadKey.otherUserFbId).toString(),
                            messageID: delta.deltaMessageReaction.messageId,
                            reaction: delta.deltaMessageReaction.reaction,
                            senderID: delta.deltaMessageReaction.senderId.toString(),
                            userID: delta.deltaMessageReaction.userId.toString()
                        });
                    })();
                } else if (delta.deltaRecallMessageData && !!ctx.globalOptions.listenEvents) {
                    (function () {
                        globalCallback(null, {
                            type: "message_unsend",
                            threadID: (delta.deltaRecallMessageData.threadKey.threadFbId ? delta.deltaRecallMessageData.threadKey.threadFbId : delta.deltaRecallMessageData.threadKey.otherUserFbId).toString(),
                            messageID: delta.deltaRecallMessageData.messageID,
                            senderID: delta.deltaRecallMessageData.senderID.toString(),
                            deletionTimestamp: delta.deltaRecallMessageData.deletionTimestamp,
                            timestamp: delta.deltaRecallMessageData.timestamp
                        });
                    })();
                } else if (delta.deltaMessageReply) {
                    var mdata = delta.deltaMessageReply.message === undefined ? [] :
                        delta.deltaMessageReply.message.data === undefined ? [] :
                            delta.deltaMessageReply.message.data.prng === undefined ? [] :
                                JSON.parse(delta.deltaMessageReply.message.data.prng);
                    var m_id = mdata.map(u => u.i);
                    var m_offset = mdata.map(u => u.o);
                    var m_length = mdata.map(u => u.l);

                    var mentions = {};
                    for (var j = 0; j < m_id.length; j++) {
                        mentions[m_id[j]] = (delta.deltaMessageReply.message.body || "").substring(m_offset[j], m_offset[j] + m_length[j]);
                    }

                    var callbackToReturn = {
                        type: "message_reply",
                        threadID: (delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId ? delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId : delta.deltaMessageReply.message.messageMetadata.threadKey.otherUserFbId).toString(),
                        messageID: delta.deltaMessageReply.message.messageMetadata.messageId,
                        senderID: delta.deltaMessageReply.message.messageMetadata.actorFbId.toString(),
                        attachments: (delta.deltaMessageReply.message.attachments || []).map(function (att) {
                            var mercury = JSON.parse(att.mercuryJSON);
                            Object.assign(att, mercury);
                            return att;
                        }).map(att => {
                            var x;
                            try {
                                x = utils._formatAttachment(att);
                            } catch (ex) {
                                x = att;
                                x.error = ex;
                                x.type = "unknown";
                            }
                            return x;
                        }),
                        args: (delta.deltaMessageReply.message.body || "").trim().split(/\s+/),
                        body: (delta.deltaMessageReply.message.body || ""),
                        isGroup: !!delta.deltaMessageReply.message.messageMetadata.threadKey.threadFbId,
                        mentions: mentions,
                        timestamp: delta.deltaMessageReply.message.messageMetadata.timestamp,
                        participantIDs: (delta.deltaMessageReply.message.messageMetadata.cid.canonicalParticipantFbids || delta.deltaMessageReply.message.participants || []).map(e => e.toString())
                    };

                    if (delta.deltaMessageReply.repliedToMessage) {
                        mdata = delta.deltaMessageReply.repliedToMessage === undefined ? [] :
                            delta.deltaMessageReply.repliedToMessage.data === undefined ? [] :
                                delta.deltaMessageReply.repliedToMessage.data.prng === undefined ? [] :
                                    JSON.parse(delta.deltaMessageReply.repliedToMessage.data.prng);
                        m_id = mdata.map(u => u.i);
                        m_offset = mdata.map(u => u.o);
                        m_length = mdata.map(u => u.l);

                        var rmentions = {};
                        for (var k = 0; k < m_id.length; k++) {
                            rmentions[m_id[k]] = (delta.deltaMessageReply.repliedToMessage.body || "").substring(m_offset[k], m_offset[k] + m_length[k]);
                        }

                        callbackToReturn.messageReply = {
                            threadID: (delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId ? delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId : delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.otherUserFbId).toString(),
                            messageID: delta.deltaMessageReply.repliedToMessage.messageMetadata.messageId,
                            senderID: delta.deltaMessageReply.repliedToMessage.messageMetadata.actorFbId.toString(),
                            attachments: delta.deltaMessageReply.repliedToMessage.attachments.map(function (att) {
                                var mercury = JSON.parse(att.mercuryJSON);
                                Object.assign(att, mercury);
                                return att;
                            }).map(att => {
                                var x;
                                try {
                                    x = utils._formatAttachment(att);
                                } catch (ex) {
                                    x = att;
                                    x.error = ex;
                                    x.type = "unknown";
                                }
                                return x;
                            }),
                            args: (delta.deltaMessageReply.repliedToMessage.body || "").trim().split(/\s+/),
                            body: delta.deltaMessageReply.repliedToMessage.body || "",
                            isGroup: !!delta.deltaMessageReply.repliedToMessage.messageMetadata.threadKey.threadFbId,
                            mentions: rmentions,
                            timestamp: delta.deltaMessageReply.repliedToMessage.messageMetadata.timestamp
                        };
                    } else if (delta.deltaMessageReply.replyToMessageId) {
                        return defaultFuncs
                            .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, {
                                "av": ctx.globalOptions.pageID,
                                "queries": JSON.stringify({
                                    "o0": {
                                        "doc_id": "2848441488556444",
                                        "query_params": {
                                            "thread_and_message_id": {
                                                "thread_id": callbackToReturn.threadID,
                                                "message_id": delta.deltaMessageReply.replyToMessageId.id,
                                            }
                                        }
                                    }
                                })
                            })
                            .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
                            .then((resData) => {
                                if (resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
                                if (resData[resData.length - 1].successful_results === 0) throw { error: "forcedFetch: there was no successful_results", res: resData };
                                var fetchData = resData[0].o0.data.message;
                                var mobj = {};
                                for (var n in fetchData.message.ranges) {
                                    mobj[fetchData.message.ranges[n].entity.id] = (fetchData.message.text || "").substr(fetchData.message.ranges[n].offset, fetchData.message.ranges[n].length);
                                }

                                callbackToReturn.messageReply = {
                                    threadID: callbackToReturn.threadID,
                                    messageID: fetchData.message_id,
                                    senderID: fetchData.message_sender.id.toString(),
                                    attachments: fetchData.message.blob_attachment.map(att => {
                                        var x;
                                        try {
                                            x = utils._formatAttachment({ blob_attachment: att });
                                        } catch (ex) {
                                            x = att;
                                            x.error = ex;
                                            x.type = "unknown";
                                        }
                                        return x;
                                    }),
                                    args: (fetchData.message.text || "").trim().split(/\s+/) || [],
                                    body: fetchData.message.text || "",
                                    isGroup: callbackToReturn.isGroup,
                                    mentions: mobj,
                                    timestamp: parseInt(fetchData.timestamp_precise)
                                };
                            })
                            .catch(err => log.error("forcedFetch", err))
                            .finally(function () {
                                if (ctx.globalOptions.autoMarkDelivery) markDelivery(ctx, api, callbackToReturn.threadID, callbackToReturn.messageID);
                                !ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID ? undefined : (function () { globalCallback(null, callbackToReturn); })();
                            });
                    } else {
                        callbackToReturn.delta = delta;
                    }

                    if (ctx.globalOptions.autoMarkDelivery) markDelivery(ctx, api, callbackToReturn.threadID, callbackToReturn.messageID);

                    return !ctx.globalOptions.selfListen && callbackToReturn.senderID === ctx.userID ? undefined : (function () { globalCallback(null, callbackToReturn); })();
                }
            }
            return;
        }
    }

    if (v.delta.class !== "NewMessage" && !ctx.globalOptions.listenEvents) return;
    
    switch (v.delta.class) {
        case "JoinableMode": {
            let fmtMsg;
            try {
                fmtMsg = utils.formatDeltaEvent(v.delta);
            } catch (err) {
                return globalCallback({
                    error: "Problem parsing message object.",
                    detail: err,
                    res: v.delta,
                    type: "parse_error"
                });
            }
            return globalCallback(null, fmtMsg);
        }
        case "AdminTextMessage":
            switch (v.delta.type) {
                case 'confirm_friend_request':
                case 'shared_album_delete':
                case 'shared_album_addition':
                case 'pin_messages_v2':
                case 'unpin_messages_v2':
                case "change_thread_theme":
                case "change_thread_nickname":
                case "change_thread_icon":
                case "change_thread_quick_reaction":
                case "change_thread_admins":
                case "group_poll":
                case "joinable_group_link_mode_change":
                case "magic_words":
                case "change_thread_approval_mode":
                case "messenger_call_log":
                case "participant_joined_group_call":
                    var fmtMsg;
                    try {
                        fmtMsg = utils.formatDeltaEvent(v.delta);
                    } catch (err) {
                        return globalCallback({
                            error: "Problem parsing message object.",
                            detail: err,
                            res: v.delta,
                            type: "parse_error"
                        });
                    }
                    return (function () { globalCallback(null, fmtMsg); })();
                default:
                    return;
            }
        case "ForcedFetch":
            if (!v.delta.threadKey) return;
            var mid = v.delta.messageId;
            var tid = v.delta.threadKey.threadFbId;
            if (mid && tid) {
                const form = {
                    "av": ctx.globalOptions.pageID,
                    "queries": JSON.stringify({
                        "o0": {
                            "doc_id": "2848441488556444",
                            "query_params": {
                                "thread_and_message_id": {
                                    "thread_id": tid.toString(),
                                    "message_id": mid,
                                }
                            }
                        }
                    })
                };

                defaultFuncs
                    .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form)
                    .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
                    .then((resData) => {
                        if (resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
                        if (resData[resData.length - 1].successful_results === 0) throw { error: "forcedFetch: there was no successful_results", res: resData };
                        var fetchData = resData[0].o0.data.message;

                        if (utils.getType(fetchData) == "Object") {
                            log.info("forcedFetch", fetchData);
                            switch (fetchData.__typename) {
                                case "ThreadImageMessage":
                                    (!ctx.globalOptions.selfListen && fetchData.message_sender.id.toString() === ctx.userID) ||
                                        !ctx.loggedIn ? undefined : (function () {
                                            globalCallback(null, {
                                                type: "change_thread_image",
                                                threadID: utils.formatID(tid.toString()),
                                                snippet: fetchData.snippet,
                                                timestamp: fetchData.timestamp_precise,
                                                author: fetchData.message_sender.id,
                                                image: {
                                                    attachmentID: fetchData.image_with_metadata && fetchData.image_with_metadata.legacy_attachment_id,
                                                    width: fetchData.image_with_metadata && fetchData.image_with_metadata.original_dimensions.x,
                                                    height: fetchData.image_with_metadata && fetchData.image_with_metadata.original_dimensions.y,
                                                    url: fetchData.image_with_metadata && fetchData.image_with_metadata.preview.uri
                                                }
                                            });
                                        })();
                                    break;
                                case "UserMessage":
                                    log.info("ff-Return", {
                                        type: "message",
                                        senderID: utils.formatID(fetchData.message_sender.id),
                                        body: fetchData.message.text || "",
                                        threadID: utils.formatID(tid.toString()),
                                        messageID: fetchData.message_id,
                                        attachments: [{
                                            type: "share",
                                            ID: fetchData.extensible_attachment.legacy_attachment_id,
                                            url: fetchData.extensible_attachment.story_attachment.url,
                                            title: fetchData.extensible_attachment.story_attachment.title_with_entities.text,
                                            description: fetchData.extensible_attachment.story_attachment.description.text,
                                            source: fetchData.extensible_attachment.story_attachment.source,
                                            image: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).uri,
                                            width: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).width,
                                            height: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).height,
                                            playable: (fetchData.extensible_attachment.story_attachment.media || {}).is_playable || false,
                                            duration: (fetchData.extensible_attachment.story_attachment.media || {}).playable_duration_in_ms || 0,
                                            subattachments: fetchData.extensible_attachment.subattachments,
                                            properties: fetchData.extensible_attachment.story_attachment.properties,
                                        }],
                                        mentions: {},
                                        timestamp: parseInt(fetchData.timestamp_precise),
                                        participantIDs: (fetchData.participants || (fetchData.messageMetadata ? fetchData.messageMetadata.cid ? fetchData.messageMetadata.cid.canonicalParticipantFbids : fetchData.messageMetadata.participantIds : []) || []),
                                        isGroup: (fetchData.message_sender.id != tid.toString())
                                    });
                                    globalCallback(null, {
                                        type: "message",
                                        senderID: utils.formatID(fetchData.message_sender.id),
                                        body: fetchData.message.text || "",
                                        threadID: utils.formatID(tid.toString()),
                                        messageID: fetchData.message_id,
                                        attachments: [{
                                            type: "share",
                                            ID: fetchData.extensible_attachment.legacy_attachment_id,
                                            url: fetchData.extensible_attachment.story_attachment.url,
                                            title: fetchData.extensible_attachment.story_attachment.title_with_entities.text,
                                            description: fetchData.extensible_attachment.story_attachment.description.text,
                                            source: fetchData.extensible_attachment.story_attachment.source,
                                            image: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).uri,
                                            width: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).width,
                                            height: ((fetchData.extensible_attachment.story_attachment.media || {}).image || {}).height,
                                            playable: (fetchData.extensible_attachment.story_attachment.media || {}).is_playable || false,
                                            duration: (fetchData.extensible_attachment.story_attachment.media || {}).playable_duration_in_ms || 0,
                                            subattachments: fetchData.extensible_attachment.subattachments,
                                            properties: fetchData.extensible_attachment.story_attachment.properties,
                                        }],
                                        mentions: {},
                                        timestamp: parseInt(fetchData.timestamp_precise),
                                        participantIDs: (fetchData.participants || (fetchData.messageMetadata ? fetchData.messageMetadata.cid ? fetchData.messageMetadata.cid.canonicalParticipantFbids : fetchData.messageMetadata.participantIds : []) || []),
                                        isGroup: (fetchData.message_sender.id != tid.toString())
                                    });
                            }
                        } else log.error("forcedFetch", fetchData);
                    })
                    .catch((err) => log.error("forcedFetch", err));
            }
            break;
        case "ThreadName":
        case "ParticipantsAddedToGroupThread":
        case "ParticipantLeftGroupThread":
            var formattedEvent;
            try {
                formattedEvent = utils.formatDeltaEvent(v.delta);
            } catch (err) {
                return globalCallback({
                    error: "Problem parsing message object.",
                    detail: err,
                    res: v.delta,
                    type: "parse_error"
                });
            }
            return (!ctx.globalOptions.selfListen && formattedEvent.author.toString() === ctx.userID) || !ctx.loggedIn ? undefined : (function () { globalCallback(null, formattedEvent); })();
    }
}

function markDelivery(ctx, api, threadID, messageID) {
    if (threadID && messageID) {
        api.markAsDelivered(threadID, messageID, (err) => {
            if (err) log.error("markAsDelivered", err);
            else {
                if (ctx.globalOptions.autoMarkRead) {
                    api.markAsRead(threadID, (err) => {
                        if (err) log.error("markAsDelivered", err);
                    });
                }
            }
        });
    }
}

module.exports = function (defaultFuncs, api, ctx) {
    let globalCallback = identity;

    getSeqID = function getSeqID() {
        ctx.t_mqttCalled = false;
        
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://www.facebook.com/',
            'Origin': 'https://www.facebook.com',
            'User-Agent': ctx.globalOptions.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
        };
        
        defaultFuncs
            .post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form, { headers })
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
            .then((resData) => {
                if (utils.getType(resData) != "Array") throw { error: "Not logged in", res: resData };
                if (resData && resData[resData.length - 1].error_results > 0) throw resData[0].o0.errors;
                if (resData[resData.length - 1].successful_results === 0) throw { error: "getSeqId: there was no successful_results", res: resData };
                if (resData[0].o0.data.viewer.message_threads.sync_sequence_id) {
                    ctx.lastSeqId = resData[0].o0.data.viewer.message_threads.sync_sequence_id;
                    listenMqtt(defaultFuncs, api, ctx, globalCallback);
                } else throw { error: "getSeqId: no sync_sequence_id found.", res: resData };
            })
            .catch((err) => {
                log.error("getSeqId", err);
                if (utils.getType(err) == "Object" && err.error === "Not logged in") ctx.loggedIn = false;
                return globalCallback(err);
            });
    };

    return function (callback) {
        class MessageEmitter extends EventEmitter {
            stopListening(callback) {
                callback = callback || (() => { });
                globalCallback = identity;
                
                if (pingInterval) clearInterval(pingInterval);
                if (reconnectTimeout) clearTimeout(reconnectTimeout);
                
                if (ctx.mqttClient) {
                    try {
                        ctx.mqttClient.unsubscribe("/webrtc");
                        ctx.mqttClient.unsubscribe("/rtc_multi");
                        ctx.mqttClient.unsubscribe("/onevc");
                        ctx.mqttClient.publish("/browser_close", "{}");
                        ctx.mqttClient.end(false, function (...data) {
                            ctx.mqttClient = undefined;
                            mqttConnected = false;
                            callback(data);
                        });
                    } catch (e) {
                        ctx.mqttClient = undefined;
                        mqttConnected = false;
                        callback();
                    }
                } else {
                    callback();
                }
            }

            async stopListeningAsync() {
                return new Promise((resolve) => {
                    this.stopListening(resolve);
                });
            }
        }

        const msgEmitter = new MessageEmitter();
        globalCallback = (callback || function (error, message) {
            if (error) {
                return msgEmitter.emit("error", error);
            }
            msgEmitter.emit("message", message);
        });

        if (!ctx.firstListen)
            ctx.lastSeqId = null;
        ctx.syncToken = undefined;
        ctx.t_mqttCalled = false;

        form = {
            "av": ctx.globalOptions.pageID,
            "queries": JSON.stringify({
                "o0": {
                    "doc_id": "3336396659757871",
                    "query_params": {
                        "limit": 1,
                        "before": null,
                        "tags": ["INBOX"],
                        "includeDeliveryReceipts": false,
                        "includeSeqID": true
                    }
                }
            })
        };

        if (!ctx.firstListen || !ctx.lastSeqId) {
            getSeqID(defaultFuncs, api, ctx, globalCallback);
        } else {
            listenMqtt(defaultFuncs, api, ctx, globalCallback);
        }

        api.stopListening = msgEmitter.stopListening;
        api.stopListeningAsync = msgEmitter.stopListeningAsync;
        return msgEmitter;
    };
};