"use strict";

const {
    TelegramClient,
    Api,
    errors
} = require("telegram");

const {
    StringSession
} = require("telegram/sessions");

const bigInt =
    require("big-integer");

const crypto =
    require("crypto");

require("dotenv").config();

const {
    pool
} = require("./db");

const {
    decrypt
} = require("./crypto");


/* =========================================================
   CONFIG
========================================================= */

const apiId =
    Number(
        process.env.TELEGRAM_API_ID
    );

const apiHash =
    process.env.TELEGRAM_API_HASH;


if (
    !Number.isInteger(apiId) ||
    apiId <= 0
) {

    throw new Error(
        "TELEGRAM_API_ID is missing or invalid."
    );

}


if (
    !apiHash ||
    typeof apiHash !== "string"
) {

    throw new Error(
        "TELEGRAM_API_HASH is missing."
    );

}


const AUTH_TIMEOUT =
    10 * 60 * 1000;


/*
    Telegram upload.getFile supports
    a maximum request size of 512 KB.

    512 KB is also compatible with
    Telegram's required alignment.
*/

const STREAM_CHUNK_SIZE =
    512 * 1024;


/* =========================================================
   STATE
========================================================= */

/*
    Temporary login sessions.

    These exist only while the user is
    entering OTP / 2FA.
*/

const pendingAuth =
    new Map();

const pendingUserAuth =
    new Map();


/*
    Persistent authenticated Telegram
    clients used by the application.

    userId -> {
        client,
        account,
        lastUsedAt
    }
*/

const activeClients =
    new Map();


/*
    Prevent two simultaneous requests
    from creating two Telegram clients
    for the same application user.
*/

const clientInitLocks =
    new Map();


/* =========================================================
   CREATE TELEGRAM CLIENT
========================================================= */

function createClient(
    sessionString = ""
) {

    const session =
        new StringSession(
            sessionString || ""
        );


    const client =
        new TelegramClient(
            session,
            apiId,
            apiHash,
            {

                /*
                    Reconnect automatically when
                    Telegram/network connection drops.
                */

                connectionRetries:
                    10,

                /*
                    Retry transient Telegram
                    requests.
                */

                requestRetries:
                    3,

                /*
                    Retry failed file downloads.
                */

                downloadRetries:
                    5,

                /*
                    Delay between reconnect attempts.
                */

                retryDelay:
                    1000,

                /*
                    Keep the authenticated client
                    alive and reconnect automatically.
                */

                autoReconnect:
                    true,

                /*
                    IPv4 is preferable for this
                    server-side application.
                */

                useIPV6:
                    false,

                /*
                    Use normal TCP connection.
                */

                useWSS:
                    false,

                /*
                    Prevent excessive simultaneous
                    file downloads.
                */

                maxConcurrentDownloads:
                    2,

                /*
                    Automatically handle short
                    FloodWait errors.
                */

                floodSleepThreshold:
                    60

            }
        );


    /*
        This application does not consume
        Telegram live updates.

        GramJS has a background update/ping loop.
        Its internal TIMEOUT messages are not useful
        to the application and can flood the terminal.

        The client still performs automatic reconnects.
    */

    client.setLogLevel(
        "none"
    );


    return client;

}


/* =========================================================
   TELEGRAM LOGIN
========================================================= */

async function startTelegramLogin(
    userId,
    phoneNumber
) {

    if (!userId) {

        throw new Error(
            "Authenticated user ID is required."
        );

    }


    if (
        typeof phoneNumber !== "string" ||
        !phoneNumber.trim()
    ) {

        throw new Error(
            "Telegram phone number is required."
        );

    }


    const cleanPhone =
        phoneNumber.trim();


    /*
        Only one pending login per
        application user.
    */

    const previousAuthId =
        pendingUserAuth.get(
            userId
        );


    if (previousAuthId) {

        await cleanupPendingAuth(
            previousAuthId
        );

    }


    const client =
        createClient();


    try {

        await client.connect();


        if (!client.connected) {

            throw new Error(
                "Unable to connect to Telegram."
            );

        }


        const result =
            await client.sendCode(
                {
                    apiId,
                    apiHash
                },
                cleanPhone
            );


        if (!result?.phoneCodeHash) {

            throw new Error(
                "Telegram did not return a phone code hash."
            );

        }


        const authId =
            crypto
                .randomBytes(32)
                .toString("hex");


        const timeout =
            setTimeout(
                () => {

                    cleanupPendingAuth(
                        authId
                    ).catch(
                        error => {

                            console.error(
                                "Telegram auth cleanup error:",
                                error
                            );

                        }
                    );

                },
                AUTH_TIMEOUT
            );


        pendingAuth.set(
            authId,
            {

                authId,

                userId,

                client,

                phoneNumber:
                    cleanPhone,

                phoneCodeHash:
                    result.phoneCodeHash,

                timeout,

                createdAt:
                    Date.now()

            }
        );


        pendingUserAuth.set(
            userId,
            authId
        );


        return {
            authId
        };

    } catch (error) {

        try {

            await client.disconnect();

        } catch {}


        throw normalizeTelegramError(
            error
        );

    }

}


/* =========================================================
   GET PENDING AUTH
========================================================= */

function getPendingAuth(
    authId,
    userId
) {

    if (!authId) {

        throw new Error(
            "Telegram authentication ID is required."
        );

    }


    if (!userId) {

        throw new Error(
            "Authenticated user ID is required."
        );

    }


    const auth =
        pendingAuth.get(
            authId
        );


    if (!auth) {

        throw new Error(
            "Telegram authentication session expired. Please request a new OTP."
        );

    }


    if (
        auth.userId !== userId
    ) {

        throw new Error(
            "Unauthorized Telegram authentication session."
        );

    }


    if (
        Date.now() -
        auth.createdAt >
        AUTH_TIMEOUT
    ) {

        cleanupPendingAuth(
            authId
        ).catch(
            () => {}
        );


        throw new Error(
            "Telegram authentication session expired. Please request a new OTP."
        );

    }


    if (!auth.client) {

        throw new Error(
            "Telegram authentication client is unavailable."
        );

    }


    return auth;

}


/* =========================================================
   VERIFY TELEGRAM OTP
========================================================= */

async function verifyTelegramCode(
    userId,
    authId,
    phoneCode
) {

    const auth =
        getPendingAuth(
            authId,
            userId
        );


    if (
        typeof phoneCode !== "string" ||
        !phoneCode.trim()
    ) {

        throw new Error(
            "Telegram OTP is required."
        );

    }


    const cleanCode =
        phoneCode
            .trim()
            .replace(
                /\s+/g,
                ""
            );


    try {

        await auth.client.invoke(

            new Api.auth.SignIn({

                phoneNumber:
                    auth.phoneNumber,

                phoneCodeHash:
                    auth.phoneCodeHash,

                phoneCode:
                    cleanCode

            })

        );


        return await buildAuthenticationResult(
            auth
        );

    } catch (error) {

        if (
            isSessionPasswordNeededError(
                error
            )
        ) {

            return {

                requiresPassword:
                    true

            };

        }


        throw normalizeTelegramError(
            error
        );

    }

}


/* =========================================================
   VERIFY TELEGRAM 2FA
========================================================= */

async function verifyTelegramPassword(
    userId,
    authId,
    password
) {

    const auth =
        getPendingAuth(
            authId,
            userId
        );


    if (
        typeof password !== "string" ||
        !password
    ) {

        throw new Error(
            "Telegram 2FA password is required."
        );

    }


    try {

        await auth.client.checkPassword(
            password
        );


        return await buildAuthenticationResult(
            auth
        );

    } catch (error) {

        throw normalizeTelegramError(
            error
        );

    }

}


/* =========================================================
   BUILD AUTH RESULT
========================================================= */

async function buildAuthenticationResult(
    auth
) {

    if (!auth?.client) {

        throw new Error(
            "Telegram authentication session is invalid."
        );

    }


    try {

        const me =
            await auth.client.getMe();


        if (!me) {

            throw new Error(
                "Unable to retrieve Telegram account."
            );

        }


        const session =
            auth.client.session.save();


        if (!session) {

            throw new Error(
                "Telegram session could not be generated."
            );

        }


        return {

            authenticated:
                true,

            telegramUser: {

                id:
                    me.id?.toString(),

                username:
                    me.username ||
                    null,

                firstName:
                    me.firstName ||
                    null,

                phone:
                    me.phone ||
                    auth.phoneNumber ||
                    null

            },

            session

        };

    } catch (error) {

        throw normalizeTelegramError(
            error
        );

    }

}


/* =========================================================
   FINALIZE AUTH
========================================================= */

async function finalizeTelegramAuthentication(
    authId,
    userId
) {

    getPendingAuth(
        authId,
        userId
    );


    await cleanupPendingAuth(
        authId
    );


    return true;

}


/* =========================================================
   CLEANUP PENDING AUTH
========================================================= */

async function cleanupPendingAuth(
    authId
) {

    if (!authId) {
        return;
    }


    const auth =
        pendingAuth.get(
            authId
        );


    if (!auth) {
        return;
    }


    clearTimeout(
        auth.timeout
    );


    pendingAuth.delete(
        authId
    );


    if (
        pendingUserAuth.get(
            auth.userId
        ) === authId
    ) {

        pendingUserAuth.delete(
            auth.userId
        );

    }


    if (auth.client) {

        try {

            await auth.client.disconnect();

        } catch {}

    }

}


/* =========================================================
   GET TELEGRAM ACCOUNT
========================================================= */

async function getTelegramAccount(
    userId
) {

    if (!userId) {

        throw new Error(
            "User ID is required."
        );

    }


    const result =
        await pool.query(
            `
            SELECT
                id,
                user_id,
                telegram_user_id,
                username,
                phone,
                session_encrypted,
                created_at,
                updated_at
            FROM telegram_accounts
            WHERE user_id = $1
            LIMIT 1
            `,
            [
                userId
            ]
        );


    return (
        result.rows[0] ||
        null
    );

}


/* =========================================================
   CREATE AUTHENTICATED CLIENT
========================================================= */

async function createAuthenticatedClient(
    userId,
    account
) {

    let sessionString;


    try {

        sessionString =
            decrypt(
                account.session_encrypted
            );

    } catch (error) {

        console.error(
            "Telegram session decryption failed:",
            error
        );


        throw new Error(
            "Unable to decrypt the saved Telegram session."
        );

    }


    if (!sessionString) {

        throw new Error(
            "Saved Telegram session is empty."
        );

    }


    const client =
        createClient(
            sessionString
        );


    try {

        await client.connect();


        if (!client.connected) {

            throw new Error(
                "Telegram client could not connect."
            );

        }


        const me =
            await client.getMe();


        if (!me) {

            throw new Error(
                "Telegram account could not be restored."
            );

        }


        return {

            client,

            account

        };

    } catch (error) {

        try {

            await client.disconnect();

        } catch {}


        if (
            isInvalidSessionError(
                error
            )
        ) {

            throw new Error(
                "Saved Telegram session is no longer valid. Please reconnect Telegram."
            );

        }


        throw normalizeTelegramError(
            error
        );

    }

}


/* =========================================================
   GET / RESTORE TELEGRAM CLIENT
========================================================= */

async function getTelegramClient(
    userId
) {

    if (!userId) {

        throw new Error(
            "User ID is required."
        );

    }


    /*
        First check cached client.
    */

    const cached =
        activeClients.get(
            userId
        );


    if (
        cached?.client?.connected
    ) {

        cached.lastUsedAt =
            Date.now();


        return {

            client:
                cached.client,

            account:
                cached.account

        };

    }


    /*
        Remove stale cached client.
    */

    if (cached) {

        activeClients.delete(
            userId
        );


        try {

            await cached.client.disconnect();

        } catch {}

    }


    /*
        If another request is already
        creating the client, wait for it.
    */

    const existingLock =
        clientInitLocks.get(
            userId
        );


    if (existingLock) {

        return existingLock;

    }


    const initPromise =
        (async () => {

            /*
                Double-check cache after
                waiting for possible race.
            */

            const secondCheck =
                activeClients.get(
                    userId
                );


            if (
                secondCheck?.client?.connected
            ) {

                secondCheck.lastUsedAt =
                    Date.now();


                return {

                    client:
                        secondCheck.client,

                    account:
                        secondCheck.account

                };

            }


            const account =
                await getTelegramAccount(
                    userId
                );


            if (!account) {

                throw new Error(
                    "Telegram account is not connected."
                );

            }


            if (
                !account.session_encrypted
            ) {

                throw new Error(
                    "Telegram session is missing."
                );

            }


            const result =
                await createAuthenticatedClient(
                    userId,
                    account
                );


            activeClients.set(
                userId,
                {

                    client:
                        result.client,

                    account:
                        result.account,

                    lastUsedAt:
                        Date.now()

                }
            );


            return result;

        })();


    clientInitLocks.set(
        userId,
        initPromise
    );


    try {

        return await initPromise;

    } finally {

        if (
            clientInitLocks.get(
                userId
            ) === initPromise
        ) {

            clientInitLocks.delete(
                userId
            );

        }

    }

}


/* =========================================================
   RESOLVE TELEGRAM ENTITY
========================================================= */

async function resolveTelegramEntity(
    client,
    chatId
) {

    const normalizedChatId =
        String(
            chatId ?? ""
        ).trim();


    if (!normalizedChatId) {

        return null;

    }


    /*
        Stored channel ID:

            -100123456789
    */

    if (
        /^-100\d+$/.test(
            normalizedChatId
        )
    ) {

        try {

            return await client.getEntity(

                new Api.PeerChannel({

                    channelId:
                        bigInt(
                            normalizedChatId.substring(
                                4
                            )
                        )

                })

            );

        } catch {}

    }


    /*
        Stored channel ID:

            123456789
    */

    if (
        /^\d+$/.test(
            normalizedChatId
        )
    ) {

        const channelId =
            bigInt(
                normalizedChatId
            );


        try {

            const entity =
                await client.getEntity(

                    new Api.PeerChannel({

                        channelId

                    })

                );


            if (entity) {

                return entity;

            }

        } catch {}


        try {

            const entity =
                await client.getEntity(
                    channelId
                );


            if (entity) {

                return entity;

            }

        } catch {}


        try {

            const entity =
                await client.getEntity(
                    bigInt(
                        `-100${normalizedChatId}`
                    )
                );


            if (entity) {

                return entity;

            }

        } catch {}

    }


    /*
        Username / other peer.
    */

    try {

        return await client.getEntity(
            normalizedChatId
        );

    } catch {

        return null;

    }

}


/* =========================================================
   GET TELEGRAM MESSAGE
========================================================= */

async function getTelegramMessageForFile(
    client,
    telegramChatId,
    telegramMessageId
) {

    if (!client) {

        throw new Error(
            "Telegram client is required."
        );

    }


    if (
        telegramChatId === null ||
        telegramChatId === undefined
    ) {

        throw new Error(
            "Telegram chat ID is missing."
        );

    }


    if (
        telegramMessageId === null ||
        telegramMessageId === undefined
    ) {

        throw new Error(
            "Telegram message ID is missing."
        );

    }


    const chatId =
        String(
            telegramChatId
        ).trim();


    const messageId =
        Number(
            telegramMessageId
        );


    if (!chatId) {

        throw new Error(
            "Invalid Telegram chat ID."
        );

    }


    if (
        !Number.isSafeInteger(
            messageId
        ) ||
        messageId <= 0
    ) {

        throw new Error(
            "Invalid Telegram message ID."
        );

    }


    const entity =
        await resolveTelegramEntity(
            client,
            chatId
        );


    if (!entity) {

        throw new Error(
            "Telegram channel/chat could not be resolved. Make sure the connected Telegram account has access to the original message."
        );

    }


    const messages =
        await client.getMessages(
            entity,
            {
                ids:
                    messageId
            }
        );


    const message =
        Array.isArray(messages)
            ? messages[0]
            : messages;


    if (!message) {

        throw new Error(
            "Telegram message could not be found."
        );

    }


    if (!message.media) {

        throw new Error(
            "This Telegram message does not contain downloadable media."
        );

    }


    return message;

}


/* =========================================================
   MEDIA SIZE
========================================================= */

function getTelegramMediaSize(
    message
) {

    if (!message) {

        return 0;

    }


    const candidates = [

        message?.file?.size,

        message?.media?.document?.size

    ];


    for (
        const value
        of candidates
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            continue;

        }


        try {

            const size =

                typeof value === "object" &&
                typeof value.toJSNumber === "function"

                    ? value.toJSNumber()

                    : Number(
                        value
                    );


            if (
                Number.isSafeInteger(
                    size
                ) &&
                size > 0
            ) {

                return size;

            }

        } catch {}

    }


    /*
        Photo fallback.
    */

    const photoSizes =
        message?.media?.photo?.sizes;


    if (
        Array.isArray(
            photoSizes
        )
    ) {

        for (
            let index =
                photoSizes.length - 1;

            index >= 0;

            index--
        ) {

            const size =
                Number(
                    photoSizes[index]?.size
                );


            if (
                Number.isSafeInteger(
                    size
                ) &&
                size > 0
            ) {

                return size;

            }

        }

    }


    return 0;

}


/* =========================================================
   MIME TYPE
========================================================= */

function getTelegramMediaMimeType(
    message
) {

    if (!message) {

        return null;

    }


    return (

        message?.file?.mimeType ||

        message?.media?.document?.mimeType ||

        null

    );

}


/* =========================================================
   MEDIA NAME
========================================================= */

function getTelegramMediaName(
    message
) {

    if (!message) {

        return null;

    }


    if (
        message?.file?.name
    ) {

        return message.file.name;

    }


    const attributes =
        message?.media?.document?.attributes ||
        [];


    const filename =
        attributes.find(
            attribute =>
                attribute?.className ===
                "DocumentAttributeFilename"
        );


    if (
        filename?.fileName
    ) {

        return filename.fileName;

    }


    if (
        message?.video
    ) {

        return (
            `telegram-${message.id}.mp4`
        );

    }


    return null;

}


/* =========================================================
   TELEGRAM MEDIA FILE ID
========================================================= */

function getTelegramMediaFileId(
    message
) {

    try {

        if (
            message?.media?.document?.id !==
            undefined
        ) {

            return message
                .media
                .document
                .id
                .toString();

        }


        if (
            message?.file?.id !==
            undefined
        ) {

            return message
                .file
                .id
                .toString();

        }

    } catch {}


    return null;

}


/* =========================================================
   MEDIA DURATION
========================================================= */

function getTelegramMediaDuration(
    message
) {

    try {

        const attributes =
            message?.media?.document?.attributes ||
            [];


        const videoAttribute =
            attributes.find(
                attribute =>
                    attribute?.className ===
                    "DocumentAttributeVideo"
            );


        if (
            videoAttribute?.duration !==
            undefined &&
            videoAttribute?.duration !==
            null
        ) {

            const duration =
                Number(
                    videoAttribute.duration
                );


            if (
                Number.isFinite(
                    duration
                ) &&
                duration >= 0
            ) {

                return Math.round(
                    duration
                );

            }

        }

    } catch {}


    return null;

}


/* =========================================================
   TELEGRAM CHAT ID
========================================================= */

function getTelegramChatId(
    message
) {

    try {

        if (
            message?.chatId !==
            undefined &&
            message?.chatId !==
            null
        ) {

            return String(
                message.chatId
            );

        }


        const peer =
            message?.peerId;


        if (
            peer?.channelId !==
            undefined
        ) {

            return String(
                peer.channelId
            );

        }


        if (
            peer?.chatId !==
            undefined
        ) {

            return String(
                peer.chatId
            );

        }


        if (
            peer?.userId !==
            undefined
        ) {

            return String(
                peer.userId
            );

        }

    } catch {}


    return null;

}


/* =========================================================
   TELEGRAM DOWNLOAD ITERATOR
========================================================= */

function createTelegramDownloadIterator(
    client,
    message,
    start = 0,
    end = null
) {

    if (!client) {

        throw new Error(
            "Telegram client is required."
        );

    }


    if (!message?.media) {

        throw new Error(
            "Telegram message does not contain downloadable media."
        );

    }


    let safeStart =
        Number(
            start
        );


    if (
        !Number.isSafeInteger(
            safeStart
        ) ||
        safeStart < 0
    ) {

        safeStart = 0;

    }


    const mediaSize =
        getTelegramMediaSize(
            message
        );


    let safeEnd =
        null;


    if (
        end !== null &&
        end !== undefined
    ) {

        const numericEnd =
            Number(
                end
            );


        if (
            Number.isSafeInteger(
                numericEnd
            ) &&
            numericEnd >= safeStart
        ) {

            safeEnd =
                numericEnd;

        }

    }


    if (
        safeEnd === null &&
        mediaSize > safeStart
    ) {

        safeEnd =
            mediaSize - 1;

    }


    /*
        Invalid range.
    */

    if (
        mediaSize > 0 &&
        safeStart >= mediaSize
    ) {

        return {

            async *[Symbol.asyncIterator]() {}

        };

    }


    const requestedBytes =
        safeEnd !== null

            ? safeEnd -
              safeStart +
              1

            : null;


    const limit =
        requestedBytes !== null

            ? Math.ceil(
                requestedBytes /
                STREAM_CHUNK_SIZE
            )

            : undefined;


    /*
        IMPORTANT:

        GramJS iterDownload expects the
        big-integer package's object.

        Native BigInt is NOT compatible.

        This fixes:

            offset.divide is not a function
    */

    const options = {

        file:
            message.media,

        offset:
            bigInt(
                safeStart
            ),

        requestSize:
            STREAM_CHUNK_SIZE,

        chunkSize:
            STREAM_CHUNK_SIZE

    };


    if (
        limit !== undefined
    ) {

        options.limit =
            limit;

    }


    if (
        mediaSize > 0
    ) {

        options.fileSize =
            bigInt(
                mediaSize
            );

    }


    /*
        Allow GramJS to refresh a file
        reference when possible.
    */

    if (
        message?.inputChat &&
        Number.isSafeInteger(
            Number(
                message.id
            )
        )
    ) {

        options.msgData = [

            message.inputChat,

            Number(
                message.id
            )

        ];

    }


    const iterator =
        client.iterDownload(
            options
        );


    return {

        async *[Symbol.asyncIterator]() {

            let remaining =
                requestedBytes;


            for await (
                const chunk
                of iterator
            ) {

                if (!chunk) {

                    continue;

                }


                let buffer =
                    Buffer.isBuffer(
                        chunk
                    )

                        ? chunk

                        : Buffer.from(
                            chunk
                        );


                /*
                    Never return more bytes
                    than the HTTP Range requested.
                */

                if (
                    remaining !== null
                ) {

                    if (
                        remaining <= 0
                    ) {

                        break;

                    }


                    if (
                        buffer.length >
                        remaining
                    ) {

                        buffer =
                            buffer.subarray(
                                0,
                                remaining
                            );

                    }


                    remaining -=
                        buffer.length;

                }


                if (
                    buffer.length > 0
                ) {

                    yield buffer;

                }


                if (
                    remaining !== null &&
                    remaining <= 0
                ) {

                    break;

                }

            }

        }

    };

}


/* =========================================================
   STREAM ALIAS
========================================================= */

function createTelegramFileStream(
    client,
    message,
    start = 0,
    end = null
) {

    return createTelegramDownloadIterator(
        client,
        message,
        start,
        end
    );

}


/* =========================================================
   WITH TELEGRAM CLIENT
========================================================= */

async function withTelegramClient(
    userId,
    callback
) {

    if (
        typeof callback !== "function"
    ) {

        throw new Error(
            "Telegram client callback is required."
        );

    }


    const result =
        await getTelegramClient(
            userId
        );


    const cached =
        activeClients.get(
            userId
        );


    if (cached) {

        cached.lastUsedAt =
            Date.now();

    }


    try {

        return await callback(
            result.client,
            result.account
        );

    } catch (error) {

        /*
            Do not keep a dead Telegram
            client in memory.
        */

        if (
            isInvalidSessionError(
                error
            )
        ) {

            await invalidateTelegramClient(
                userId
            );

        }


        throw error;

    }

}


/* =========================================================
   INVALIDATE CLIENT
========================================================= */

async function invalidateTelegramClient(
    userId
) {

    const cached =
        activeClients.get(
            userId
        );


    if (!cached) {

        return;

    }


    activeClients.delete(
        userId
    );


    try {

        await cached.client.disconnect();

    } catch {}

}


/* =========================================================
   DISCONNECT TELEGRAM ACCOUNT
========================================================= */

async function disconnectTelegram(
    userId
) {

    if (!userId) {

        throw new Error(
            "User ID is required."
        );

    }


    /*
        Cancel pending login.
    */

    const pendingAuthId =
        pendingUserAuth.get(
            userId
        );


    if (pendingAuthId) {

        await cleanupPendingAuth(
            pendingAuthId
        );

    }


    /*
        Close cached authenticated client.
    */

    await invalidateTelegramClient(
        userId
    );


    /*
        Remove stored Telegram account.
    */

    await pool.query(
        `
        DELETE FROM telegram_accounts
        WHERE user_id = $1
        `,
        [
            userId
        ]
    );


    return true;

}


/* =========================================================
   CLOSE ALL CLIENTS
========================================================= */

async function closeAllTelegramClients() {

    const clients =
        [
            ...activeClients.values()
        ];


    activeClients.clear();


    for (
        const entry
        of clients
    ) {

        try {

            await entry.client.disconnect();

        } catch {}

    }


    const authIds =
        [
            ...pendingAuth.keys()
        ];


    for (
        const authId
        of authIds
    ) {

        try {

            await cleanupPendingAuth(
                authId
            );

        } catch {}

    }

}


/* =========================================================
   ERROR HELPERS
========================================================= */

function isSessionPasswordNeededError(
    error
) {

    return (
        error instanceof
        errors.SessionPasswordNeededError
    );

}


function isInvalidSessionError(
    error
) {

    const message =
        String(
            error?.message ||
            error?.errorMessage ||
            error ||
            ""
        ).toUpperCase();


    return (

        message.includes(
            "SESSION_REVOKED"
        ) ||

        message.includes(
            "AUTH_KEY_UNREGISTERED"
        ) ||

        message.includes(
            "AUTH_KEY_INVALID"
        )

    );

}


/* =========================================================
   NORMALIZE TELEGRAM ERROR
========================================================= */

function normalizeTelegramError(
    error
) {

    if (!error) {

        return new Error(
            "Telegram request failed."
        );

    }


    const message =
        String(
            error.message ||
            error.errorMessage ||
            error
        );


    const upper =
        message.toUpperCase();


    if (
        upper.includes(
            "PHONE_NUMBER_INVALID"
        )
    ) {

        return new Error(
            "The Telegram phone number is invalid."
        );

    }


    if (
        upper.includes(
            "PHONE_NUMBER_BANNED"
        )
    ) {

        return new Error(
            "This Telegram phone number is banned."
        );

    }


    if (
        upper.includes(
            "PHONE_CODE_INVALID"
        )
    ) {

        return new Error(
            "The Telegram OTP is incorrect."
        );

    }


    if (
        upper.includes(
            "PHONE_CODE_EXPIRED"
        )
    ) {

        return new Error(
            "The Telegram OTP has expired. Please request a new code."
        );

    }


    if (
        upper.includes(
            "PHONE_CODE_EMPTY"
        )
    ) {

        return new Error(
            "Please enter the Telegram OTP."
        );

    }


    if (
        upper.includes(
            "PASSWORD_HASH_INVALID"
        )
    ) {

        return new Error(
            "The Telegram 2FA password is incorrect."
        );

    }


    if (
        upper.includes(
            "FLOOD_WAIT"
        )
    ) {

        const seconds =
            extractFloodWaitSeconds(
                message
            );


        return new Error(

            seconds !== null

                ? `Telegram rate limit reached. Please wait ${formatWaitTime(seconds)} before trying again.`

                : "Telegram rate limit reached. Please wait before trying again."

        );

    }


    if (
        upper.includes(
            "SESSION_REVOKED"
        )
    ) {

        return new Error(
            "The Telegram session was revoked. Please reconnect Telegram."
        );

    }


    if (
        upper.includes(
            "AUTH_KEY_UNREGISTERED"
        )
    ) {

        return new Error(
            "The Telegram session is no longer valid. Please reconnect Telegram."
        );

    }


    if (
        upper.includes(
            "FILE_REFERENCE_EXPIRED"
        )
    ) {

        return new Error(
            "The Telegram file reference expired. Please refresh the file and try again."
        );

    }


    if (
        upper.includes(
            "CHANNEL_PRIVATE"
        )
    ) {

        return new Error(
            "This Telegram channel is private or inaccessible."
        );

    }


    if (
        upper.includes(
            "USERNAME_NOT_OCCUPIED"
        )
    ) {

        return new Error(
            "The Telegram channel or username was not found."
        );

    }


    if (
        upper.includes(
            "MESSAGE_ID_INVALID"
        )
    ) {

        return new Error(
            "The Telegram message could not be found."
        );

    }


    return new Error(
        message ||
        "Telegram request failed."
    );

}


/* =========================================================
   FLOOD WAIT
========================================================= */

function extractFloodWaitSeconds(
    message
) {

    const match =
        String(
            message
        ).match(
            /FLOOD_WAIT[_ ]?(\d+)/i
        );


    if (!match) {

        return null;

    }


    const seconds =
        Number(
            match[1]
        );


    return Number.isFinite(
        seconds
    )
        ? seconds
        : null;

}


function formatWaitTime(
    seconds
) {

    if (
        seconds < 60
    ) {

        return (
            `${seconds} seconds`
        );

    }


    const minutes =
        Math.ceil(
            seconds / 60
        );


    if (
        minutes < 60
    ) {

        return (
            `${minutes} minute${minutes === 1 ? "" : "s"}`
        );

    }


    const hours =
        Math.ceil(
            minutes / 60
        );


    return (
        `${hours} hour${hours === 1 ? "" : "s"}`
    );

}


/* =========================================================
   PROCESS SHUTDOWN
========================================================= */

process.once(
    "SIGINT",
    () => {

        closeAllTelegramClients()
            .catch(
                error => {

                    console.error(
                        "Telegram shutdown error:",
                        error
                    );

                }
            )
            .finally(
                () => {

                    process.exit(
                        0
                    );

                }
            );

    }
);


process.once(
    "SIGTERM",
    () => {

        closeAllTelegramClients()
            .catch(
                error => {

                    console.error(
                        "Telegram shutdown error:",
                        error
                    );

                }
            )
            .finally(
                () => {

                    process.exit(
                        0
                    );

                }
            );

    }
);


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    startTelegramLogin,

    verifyTelegramCode,

    verifyTelegramPassword,

    finalizeTelegramAuthentication,

    getTelegramAccount,

    getTelegramClient,

    getTelegramMessageForFile,

    getTelegramMediaSize,

    getTelegramMediaMimeType,

    getTelegramMediaName,

    getTelegramMediaFileId,

    getTelegramMediaDuration,

    getTelegramChatId,

    createTelegramDownloadIterator,

    createTelegramFileStream,

    withTelegramClient,

    disconnectTelegram

};