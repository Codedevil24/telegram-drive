"use strict";

const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const {
    pool,
    testDatabase
} = require("./db");

const {
    supabase
} = require("./supabase");

const {
    requireAuth,
    requireAdmin,
    requireStreamAuth
} = require("./authMiddleware");

const {
    encrypt
} = require("./crypto");

const {
    startTelegramLogin,
    verifyTelegramCode,
    verifyTelegramPassword,
    finalizeTelegramAuthentication,
    getTelegramAccount,
    getTelegramMessageForFile,
    getTelegramMediaSize,
    getTelegramMediaMimeType,
    getTelegramMediaName,
    createTelegramDownloadIterator,
    withTelegramClient,
    disconnectTelegram
} = require("./telegram");

const adminRoutes =
    require("./routes/admin");

/* =========================================================
   APP CONFIG
========================================================= */

const app =
    express();

const PORT =
    Number(
        process.env.PORT || 5000
    );


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    cors({
        origin: true,
        credentials: true
    })
);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    "/api/admin",
    requireAuth,
    requireAdmin,
    adminRoutes
);


/* =========================================================
   FRONTEND
========================================================= */

const frontendPath =
    path.join(
        __dirname,
        "../frontend"
    );


app.use(
    express.static(
        frontendPath
    )
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );


            return res.json({

                success: true,

                message:
                    "Telegram Drive API is running.",

                database:
                    "connected"

            });

        } catch (error) {

            console.error(
                "Health check error:",
                error
            );


            return res.status(503).json({

                success: false,

                message:
                    "API is running but database is unavailable."

            });

        }

    }
);


/* =========================================================
   FRONTEND CONFIG
========================================================= */

app.get(
    "/api/config",
    (req, res) => {

        const supabaseUrl =
            process.env.SUPABASE_URL;

        const supabasePublishableKey =
            process.env.SUPABASE_PUBLISHABLE_KEY;


        if (
            !supabaseUrl ||
            !supabasePublishableKey
        ) {

            return res.status(500).json({

                success: false,

                message:
                    "Supabase configuration is missing."

            });

        }


        return res.json({

            success: true,

            config: {

                supabaseUrl,

                supabasePublishableKey

            }

        });

    }
);


/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/me",
    requireAuth,
    async (req, res) => {

        try {

            const user =
                req.user;


            return res.json({

                success: true,

                user: {

                    id:
                        user.id,

                    email:
                        user.email || null,

                    createdAt:
                        user.created_at || null

                }

            });

        } catch (error) {

            console.error(
                "Current user error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load user."

            });

        }

    }
);


/* =========================================================
   FOLDERS - LIST
========================================================= */

app.get(
    "/api/folders",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        parent_id,
                        name,
                        created_at,
                        updated_at
                    FROM folders
                    WHERE user_id = $1
                    ORDER BY
                        name ASC,
                        created_at ASC
                    `,
                    [
                        req.user.id
                    ]
                );


            return res.json({

                success: true,

                folders:
                    result.rows

            });

        } catch (error) {

            console.error(
                "Load folders error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load folders."

            });

        }

    }
);


/* =========================================================
   FOLDERS - CREATE
========================================================= */

app.post(
    "/api/folders",
    requireAuth,
    async (req, res) => {

        try {

            const name =
                typeof req.body?.name === "string"
                    ? req.body.name.trim()
                    : "";


            const parentId =
                req.body?.parentId ||
                req.body?.parent_id ||
                null;


            if (!name) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Folder name is required."

                });

            }


            if (
                name.length > 255
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Folder name cannot exceed 255 characters."

                });

            }


            if (parentId) {

                const parent =
                    await pool.query(
                        `
                        SELECT id
                        FROM folders
                        WHERE
                            id = $1
                            AND user_id = $2
                        LIMIT 1
                        `,
                        [
                            parentId,
                            req.user.id
                        ]
                    );


                if (
                    parent.rows.length === 0
                ) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "Parent folder not found."

                    });

                }

            }


            const duplicate =
                await pool.query(
                    `
                    SELECT id
                    FROM folders
                    WHERE
                        user_id = $1
                        AND LOWER(name) = LOWER($2)
                        AND parent_id IS NOT DISTINCT FROM $3
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        name,
                        parentId
                    ]
                );


            if (
                duplicate.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "A folder with this name already exists here."

                });

            }


            const result =
                await pool.query(
                    `
                    INSERT INTO folders (
                        user_id,
                        parent_id,
                        name
                    )
                    VALUES (
                        $1,
                        $2,
                        $3
                    )
                    RETURNING
                        id,
                        user_id,
                        parent_id,
                        name,
                        created_at,
                        updated_at
                    `,
                    [
                        req.user.id,
                        parentId,
                        name
                    ]
                );


            return res.status(201).json({

                success: true,

                folder:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "Create folder error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to create folder."

            });

        }

    }
);


/* =========================================================
   FOLDERS - RENAME
========================================================= */

app.patch(
    "/api/folders/:id",
    requireAuth,
    async (req, res) => {

        try {

            const folderId =
                req.params.id;


            const name =
                typeof req.body?.name === "string"
                    ? req.body.name.trim()
                    : "";


            if (!name) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Folder name is required."

                });

            }


            if (
                name.length > 255
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Folder name cannot exceed 255 characters."

                });

            }


            const existing =
                await pool.query(
                    `
                    SELECT
                        id,
                        parent_id
                    FROM folders
                    WHERE
                        id = $1
                        AND user_id = $2
                    LIMIT 1
                    `,
                    [
                        folderId,
                        req.user.id
                    ]
                );


            if (
                existing.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Folder not found."

                });

            }


            const parentId =
                existing.rows[0].parent_id;


            const duplicate =
                await pool.query(
                    `
                    SELECT id
                    FROM folders
                    WHERE
                        user_id = $1
                        AND LOWER(name) = LOWER($2)
                        AND id <> $3
                        AND parent_id IS NOT DISTINCT FROM $4
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        name,
                        folderId,
                        parentId
                    ]
                );


            if (
                duplicate.rows.length > 0
            ) {

                return res.status(409).json({

                    success: false,

                    message:
                        "A folder with this name already exists here."

                });

            }


            const result =
                await pool.query(
                    `
                    UPDATE folders
                    SET
                        name = $1
                    WHERE
                        id = $2
                        AND user_id = $3
                    RETURNING
                        id,
                        user_id,
                        parent_id,
                        name,
                        created_at,
                        updated_at
                    `,
                    [
                        name,
                        folderId,
                        req.user.id
                    ]
                );


            return res.json({

                success: true,

                folder:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "Rename folder error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to rename folder."

            });

        }

    }
);


/* =========================================================
   FOLDERS - DELETE
========================================================= */

app.delete(
    "/api/folders/:id",
    requireAuth,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const folderId =
                req.params.id;


            await client.query(
                "BEGIN"
            );


            const folder =
                await client.query(
                    `
                    SELECT id
                    FROM folders
                    WHERE
                        id = $1
                        AND user_id = $2
                    LIMIT 1
                    `,
                    [
                        folderId,
                        req.user.id
                    ]
                );


            if (
                folder.rows.length === 0
            ) {

                await client.query(
                    "ROLLBACK"
                );


                return res.status(404).json({

                    success: false,

                    message:
                        "Folder not found."

                });

            }


            /*
                Preserve files.

                Deleting a folder moves its files
                back to root.
            */

            await client.query(
                `
                UPDATE files
                SET
                    folder_id = NULL,
                    updated_at = NOW()
                WHERE
                    folder_id = $1
                    AND user_id = $2
                `,
                [
                    folderId,
                    req.user.id
                ]
            );


            await client.query(
                `
                DELETE FROM folders
                WHERE
                    id = $1
                    AND user_id = $2
                `,
                [
                    folderId,
                    req.user.id
                ]
            );


            await client.query(
                "COMMIT"
            );


            return res.json({

                success: true,

                message:
                    "Folder deleted successfully."

            });

        } catch (error) {

            try {

                await client.query(
                    "ROLLBACK"
                );

            } catch {}


            console.error(
                "Delete folder error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to delete folder."

            });

        } finally {

            client.release();

        }

    }
);


/* =========================================================
   FILES - LIST
========================================================= */

app.get(
    "/api/files",
    requireAuth,
    async (req, res) => {

        try {

            const folderId =
                req.query.folderId ||
                req.query.folder_id ||
                null;


            const search =
                typeof req.query.search === "string"
                    ? req.query.search.trim()
                    : "";


            const values = [
                req.user.id
            ];


            let query = `
                SELECT
                    id,
                    user_id,
                    folder_id,
                    telegram_account_id,
                    telegram_chat_id,
                    telegram_message_id,
                    telegram_file_id,
                    name,
                    size,
                    mime_type,
                    thumbnail_file_id,
                    duration,
                    created_at,
                    updated_at
                FROM files
                WHERE user_id = $1
            `;


            if (
                !folderId ||
                folderId === "root"
            ) {

                query += `
                    AND folder_id IS NULL
                `;

            } else {

                values.push(
                    folderId
                );


                query += `
                    AND folder_id = $${values.length}
                `;

            }


            if (search) {

                values.push(
                    `%${search}%`
                );


                query += `
                    AND name ILIKE $${values.length}
                `;

            }


            query += `
                ORDER BY
                    created_at DESC
            `;


            const result =
                await pool.query(
                    query,
                    values
                );


            return res.json({

                success: true,

                files:
                    result.rows

            });

        } catch (error) {

            console.error(
                "Load files error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load files."

            });

        }

    }
);


/* =========================================================
   FILE DETAILS
========================================================= */

app.get(
    "/api/files/:id",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        folder_id,
                        telegram_account_id,
                        telegram_chat_id,
                        telegram_message_id,
                        telegram_file_id,
                        name,
                        size,
                        mime_type,
                        thumbnail_file_id,
                        duration,
                        created_at,
                        updated_at
                    FROM files
                    WHERE
                        id = $1
                        AND user_id = $2
                    LIMIT 1
                    `,
                    [
                        req.params.id,
                        req.user.id
                    ]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "File not found."

                });

            }


            return res.json({

                success: true,

                file:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "Get file error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load file."

            });

        }

    }
);


/* =========================================================
   FILE STREAM
========================================================= */

/*
    IMPORTANT:

    Do NOT use requireAuth here.

    HTML5 <video> does not reliably send our
    custom Authorization header.

    requireStreamAuth accepts:

        Authorization: Bearer TOKEN

    OR:

        ?access_token=TOKEN
*/

app.get(
    "/api/files/:id/stream",
    requireStreamAuth,
    streamTelegramFile
);


/*
    HEAD is useful for media metadata requests.
*/

app.head(
    "/api/files/:id/stream",
    requireStreamAuth,
    streamTelegramFile
);


/* =========================================================
   TELEGRAM FILE STREAM
========================================================= */

async function streamTelegramFile(
    req,
    res
) {

    let clientDisconnected =
        false;


    try {

        const fileId =
            req.params.id;


        if (
            !isUuid(fileId)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid file ID."

            });

        }


        /*
            File ownership check.

            Even with a valid Supabase token,
            the user can only access their own file.
        */

        const fileResult =
            await pool.query(
                `
                SELECT
                    id,
                    user_id,
                    folder_id,
                    telegram_account_id,
                    telegram_chat_id,
                    telegram_message_id,
                    telegram_file_id,
                    name,
                    size,
                    mime_type,
                    duration
                FROM files
                WHERE
                    id = $1
                    AND user_id = $2
                LIMIT 1
                `,
                [
                    fileId,
                    req.user.id
                ]
            );


        if (
            fileResult.rows.length === 0
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "File not found."

            });

        }


        const file =
            fileResult.rows[0];


        if (
            !file.telegram_account_id ||
            file.telegram_chat_id === null ||
            file.telegram_message_id === null
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "This file does not contain valid Telegram source information."

            });

        }


        /*
            Restore Telegram client.

            We use the authenticated Supabase user,
            never a user ID supplied by the browser.
        */

        const telegramAccount =
            await getTelegramAccount(
                req.user.id
            );


        if (!telegramAccount) {

            return res.status(409).json({

                success: false,

                message:
                    "Telegram account is not connected."

            });

        }


        /*
            Ensure this file belongs to the
            connected Telegram account.
        */

        if (
            String(
                telegramAccount.id
            ) !==
            String(
                file.telegram_account_id
            )
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "This file belongs to a different Telegram account."

            });

        }


        /*
            Restore client through helper.

            withTelegramClient automatically
            disconnects it after the request.
        */

        await withTelegramClient(
            req.user.id,
            async (
                telegramClient
            ) => {

                /*
                    If browser already disconnected,
                    do not make unnecessary Telegram calls.
                */

                if (
                    clientDisconnected ||
                    res.destroyed
                ) {

                    return;

                }


                /*
                    Locate original Telegram message.
                */

                const message =
                    await getTelegramMessageForFile(
                        telegramClient,
                        file.telegram_chat_id,
                        file.telegram_message_id
                    );


                /*
                    IMPORTANT:

                    Use Telegram's actual media size.

                    The database value may be stale or may
                    have been saved incorrectly in an older
                    import.
                */

                const telegramSize =
                    getTelegramMediaSize(
                        message
                    );


                const databaseSize =
                    parseSafeFileSize(
                        file.size
                    );


                const totalSize =
                    telegramSize > 0
                        ? telegramSize
                        : databaseSize;


                if (
                    !Number.isSafeInteger(
                        totalSize
                    ) ||
                    totalSize <= 0
                ) {

                    throw new Error(
                        "Unable to determine Telegram media size."
                    );

                }


                /*
                    Determine MIME type.

                    Telegram metadata first,
                    database second,
                    filename fallback third.
                */

                const telegramMimeType =
                    getTelegramMediaMimeType(
                        message
                    );


                const contentType =
                    getSafeMimeType(
                        telegramMimeType ||
                        file.mime_type ||
                        guessMimeType(
                            file.name
                        )
                    );


                /*
                    Parse Range.

                    Examples:

                    bytes=0-1023
                    bytes=0-
                    bytes=-500
                */

                const rangeHeader =
                    req.headers.range;


                let start =
                    0;

                let end =
                    totalSize - 1;

                let partial =
                    false;


                if (
                    rangeHeader
                ) {

                    const range =
                        parseRangeHeader(
                            rangeHeader,
                            totalSize
                        );


                    if (
                        !range
                    ) {

                        res.setHeader(
                            "Content-Range",
                            `bytes */${totalSize}`
                        );


                        return res.status(
                            416
                        ).end();

                    }


                    start =
                        range.start;

                    end =
                        range.end;

                    partial =
                        true;

                }


                const contentLength =
                    end -
                    start +
                    1;


                /*
                    Response headers.
                */

                res.setHeader(
                    "Accept-Ranges",
                    "bytes"
                );


                res.setHeader(
                    "Content-Type",
                    contentType
                );


                res.setHeader(
                    "Content-Length",
                    String(
                        contentLength
                    )
                );


                res.setHeader(
                    "Cache-Control",
                    "private, no-cache, no-store, must-revalidate"
                );


                res.setHeader(
                    "Content-Disposition",
                    buildInlineContentDisposition(
                        file.name
                    )
                );


                /*
                    CORS is especially useful when the
                    frontend is served from another origin.
                */

                res.setHeader(
                    "Access-Control-Allow-Origin",
                    "*"
                );


                res.setHeader(
                    "Access-Control-Expose-Headers",
                    "Accept-Ranges, Content-Length, Content-Range, Content-Type, Content-Disposition"
                );


                if (
                    partial
                ) {

                    res.status(
                        206
                    );


                    res.setHeader(
                        "Content-Range",
                        `bytes ${start}-${end}/${totalSize}`
                    );

                } else {

                    res.status(
                        200
                    );

                }


                /*
                    HEAD request:

                    Send headers only.
                */

                if (
                    req.method === "HEAD"
                ) {

                    return res.end();

                }


                /*
                    Browser may cancel the current request
                    when seeking.

                    That is NORMAL.

                    Do not treat it as a server error.
                */

                const onRequestClose =
                    () => {

                        clientDisconnected =
                            true;

                    };


                req.once(
                    "close",
                    onRequestClose
                );


                /*
                    Telegram chunk iterator.

                    It will request only the range that
                    the browser asked for.
                */

                const iterator =
                    createTelegramDownloadIterator(
                        telegramClient,
                        message,
                        start,
                        end
                    );


                let bytesWritten =
                    0;


                for await (
                    const chunk
                    of iterator
                ) {

                    if (
                        clientDisconnected ||
                        res.destroyed ||
                        res.writableEnded
                    ) {

                        break;

                    }


                    if (
                        !chunk ||
                        chunk.length === 0
                    ) {

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
                        Never send more bytes than
                        Content-Length.
                    */

                    const remaining =
                        contentLength -
                        bytesWritten;


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


                    const canContinue =
                        res.write(
                            buffer
                        );


                    bytesWritten +=
                        buffer.length;


                    if (
                        !canContinue
                    ) {

                        await waitForDrain(
                            res
                        );

                    }


                    if (
                        bytesWritten >=
                        contentLength
                    ) {

                        break;

                    }

                }


                if (
                    !clientDisconnected &&
                    !res.destroyed &&
                    !res.writableEnded
                ) {

                    res.end();

                }

            }
        );

    } catch (error) {

        console.error(
            "Telegram stream error:",
            error
        );


        /*
            If the browser cancelled the request,
            do not send another response.
        */

        if (
            res.headersSent ||
            res.destroyed ||
            req.destroyed
        ) {

            return;

        }


        return res.status(
            getStreamErrorStatus(
                error
            )
        ).json({

            success: false,

            message:
                getStreamErrorMessage(
                    error
                )

        });

    }

}


/* =========================================================
   TELEGRAM ACCOUNT
========================================================= */

app.get(
    "/api/telegram/account",
    requireAuth,
    async (req, res) => {

        try {

            const account =
                await getTelegramAccount(
                    req.user.id
                );


            if (!account) {

                return res.json({

                    success: true,

                    connected: false,

                    account: null

                });

            }


            return res.json({

                success: true,

                connected: true,

                account: {

                    id:
                        account.id,

                    telegramUserId:
                        account.telegram_user_id?.toString(),

                    username:
                        account.username || null,

                    phone:
                        account.phone || null,

                    createdAt:
                        account.created_at,

                    updatedAt:
                        account.updated_at

                }

            });

        } catch (error) {

            console.error(
                "Telegram account status error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load Telegram account."

            });

        }

    }
);


/* =========================================================
   TELEGRAM AUTH - START
========================================================= */

app.post(
    "/api/telegram/auth/start",
    requireAuth,
    async (req, res) => {

        try {

            const phoneNumber =
                typeof req.body?.phoneNumber === "string"
                    ? req.body.phoneNumber.trim()
                    : "";


            if (!phoneNumber) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Telegram phone number is required."

                });

            }


            const result =
                await startTelegramLogin(
                    req.user.id,
                    phoneNumber
                );


            return res.json({

                success: true,

                authId:
                    result.authId,

                message:
                    "Telegram verification code sent."

            });

        } catch (error) {

            console.error(
                "Telegram auth start error:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    getTelegramErrorMessage(
                        error
                    )

            });

        }

    }
);


/* =========================================================
   TELEGRAM AUTH - VERIFY OTP
========================================================= */

app.post(
    "/api/telegram/auth/verify",
    requireAuth,
    async (req, res) => {

        try {

            const authId =
                typeof req.body?.authId === "string"
                    ? req.body.authId.trim()
                    : "";


            const phoneCode =
                typeof req.body?.phoneCode === "string"
                    ? req.body.phoneCode.trim()
                    : String(
                        req.body?.phoneCode || ""
                    ).trim();


            if (
                !authId ||
                !phoneCode
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Authentication ID and OTP are required."

                });

            }


            const result =
                await verifyTelegramCode(
                    req.user.id,
                    authId,
                    phoneCode
                );


            if (
                result?.requiresPassword
            ) {

                return res.json({

                    success: true,

                    requiresPassword:
                        true

                });

            }


            const account =
                await saveTelegramAccount(
                    req.user.id,
                    result.telegramUser,
                    result.session
                );


            await finalizeTelegramAuthentication(
                authId,
                req.user.id
            );


            return res.json({

                success: true,

                connected: true,

                requiresPassword:
                    false,

                account

            });

        } catch (error) {

            console.error(
                "Telegram OTP verification error:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    getTelegramErrorMessage(
                        error
                    )

            });

        }

    }
);


/* =========================================================
   TELEGRAM AUTH - 2FA
========================================================= */

app.post(
    "/api/telegram/auth/password",
    requireAuth,
    async (req, res) => {

        try {

            const authId =
                typeof req.body?.authId === "string"
                    ? req.body.authId.trim()
                    : "";


            const password =
                typeof req.body?.password === "string"
                    ? req.body.password
                    : "";


            if (
                !authId ||
                !password
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Authentication ID and password are required."

                });

            }


            const result =
                await verifyTelegramPassword(
                    req.user.id,
                    authId,
                    password
                );


            const account =
                await saveTelegramAccount(
                    req.user.id,
                    result.telegramUser,
                    result.session
                );


            await finalizeTelegramAuthentication(
                authId,
                req.user.id
            );


            return res.json({

                success: true,

                connected: true,

                account

            });

        } catch (error) {

            console.error(
                "Telegram 2FA verification error:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    getTelegramErrorMessage(
                        error
                    )

            });

        }

    }
);


/* =========================================================
   SAVE TELEGRAM ACCOUNT
========================================================= */

async function saveTelegramAccount(
    userId,
    telegramUser,
    session
) {

    if (
        !telegramUser?.id
    ) {

        throw new Error(
            "Telegram user information is missing."
        );

    }


    if (
        !session
    ) {

        throw new Error(
            "Telegram session is missing."
        );

    }


    const encryptedSession =
        encrypt(
            session
        );


    const result =
        await pool.query(
            `
            INSERT INTO telegram_accounts (
                user_id,
                telegram_user_id,
                username,
                phone,
                session_encrypted,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                NOW(),
                NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET

                telegram_user_id =
                    EXCLUDED.telegram_user_id,

                username =
                    EXCLUDED.username,

                phone =
                    EXCLUDED.phone,

                session_encrypted =
                    EXCLUDED.session_encrypted,

                updated_at =
                    NOW()

            RETURNING
                id,
                telegram_user_id,
                username,
                phone,
                created_at,
                updated_at
            `,
            [
                userId,
                telegramUser.id,
                telegramUser.username || null,
                telegramUser.phone || null,
                encryptedSession
            ]
        );


    return result.rows[0];

}


/* =========================================================
   TELEGRAM DISCONNECT
========================================================= */

app.delete(
    "/api/telegram/account",
    requireAuth,
    async (req, res) => {

        try {

            await disconnectTelegram(
                req.user.id
            );


            return res.json({

                success: true,

                connected: false,

                message:
                    "Telegram account disconnected."

            });

        } catch (error) {

            console.error(
                "Telegram disconnect error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to disconnect Telegram."

            });

        }

    }
);


/* =========================================================
   TELEGRAM IMPORT
========================================================= */

app.post(
    "/api/telegram/import",
    requireAuth,
    async (req, res) => {

        try {

            const url =
                typeof req.body?.url === "string"
                    ? req.body.url.trim()
                    : "";


            const folderId =
                req.body?.folderId ||
                req.body?.folder_id ||
                null;


            if (!url) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Telegram URL is required."

                });

            }


            const parsed =
                parseTelegramUrl(
                    url
                );


            if (!parsed) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid Telegram post URL."

                });

            }


            if (folderId) {

                const folder =
                    await pool.query(
                        `
                        SELECT id
                        FROM folders
                        WHERE
                            id = $1
                            AND user_id = $2
                        LIMIT 1
                        `,
                        [
                            folderId,
                            req.user.id
                        ]
                    );


                if (
                    folder.rows.length === 0
                ) {

                    return res.status(404).json({

                        success: false,

                        message:
                            "Destination folder not found."

                    });

                }

            }


            const account =
                await getTelegramAccount(
                    req.user.id
                );


            if (!account) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Connect your Telegram account first."

                });

            }


            const telegramResult =
                await withTelegramClient(
                    req.user.id,
                    async (
                        client,
                        telegramAccount
                    ) => {

                        let entity;


                        if (
                            parsed.type === "public"
                        ) {

                            entity =
                                await client.getEntity(
                                    parsed.username
                                );

                        } else {

                            entity =
                                await resolvePrivateTelegramChannel(
                                    client,
                                    parsed.channelId
                                );

                        }


                        if (!entity) {

                            throw new Error(
                                "Telegram channel could not be resolved."
                            );

                        }


                        const messages =
                            await client.getMessages(
                                entity,
                                {
                                    ids:
                                        parsed.messageId
                                }
                            );


                        const message =
                            Array.isArray(messages)
                                ? messages[0]
                                : messages;


                        if (!message) {

                            throw new Error(
                                "Telegram message was not found."
                            );

                        }


                        return {

                            account:
                                telegramAccount,

                            message

                        };

                    }
                );


            const message =
                telegramResult.message;


            const fileName =
                getTelegramMediaName(
                    message
                ) ||
                `telegram-${parsed.messageId}`;


            const size =
                getTelegramMediaSize(
                    message
                );


            const mimeType =
                getTelegramMediaMimeType(
                    message
                );


            const telegramFileId =
                getTelegramDocumentId(
                    message
                );


            const duration =
                getTelegramDuration(
                    message
                );


            const chatId =
                getTelegramChatId(
                    message
                );


            if (
                chatId === null
            ) {

                throw new Error(
                    "Unable to determine Telegram chat ID."
                );

            }


            /*
                Avoid duplicate imports.
            */

            const existing =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        folder_id,
                        telegram_account_id,
                        telegram_chat_id,
                        telegram_message_id,
                        telegram_file_id,
                        name,
                        size,
                        mime_type,
                        thumbnail_file_id,
                        duration,
                        created_at,
                        updated_at
                    FROM files
                    WHERE
                        user_id = $1
                        AND telegram_account_id = $2
                        AND telegram_chat_id = $3
                        AND telegram_message_id = $4
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        account.id,
                        chatId,
                        parsed.messageId
                    ]
                );


            if (
                existing.rows.length > 0
            ) {

                return res.json({

                    success: true,

                    alreadyExists:
                        true,

                    file:
                        existing.rows[0]

                });

            }


            const result =
                await pool.query(
                    `
                    INSERT INTO files (
                        user_id,
                        folder_id,
                        telegram_account_id,
                        telegram_chat_id,
                        telegram_message_id,
                        telegram_file_id,
                        name,
                        size,
                        mime_type,
                        duration,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7,
                        $8,
                        $9,
                        $10,
                        NOW(),
                        NOW()
                    )
                    RETURNING
                        id,
                        user_id,
                        folder_id,
                        telegram_account_id,
                        telegram_chat_id,
                        telegram_message_id,
                        telegram_file_id,
                        name,
                        size,
                        mime_type,
                        thumbnail_file_id,
                        duration,
                        created_at,
                        updated_at
                    `,
                    [
                        req.user.id,
                        folderId,
                        account.id,
                        chatId,
                        parsed.messageId,
                        telegramFileId,
                        fileName,
                        size,
                        mimeType,
                        duration
                    ]
                );


            return res.status(201).json({

                success: true,

                alreadyExists:
                    false,

                message:
                    "Telegram file imported successfully.",

                file:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "Telegram import error:",
                error
            );


            return res.status(400).json({

                success: false,

                message:
                    getTelegramErrorMessage(
                        error
                    )

            });

        }

    }
);


/* =========================================================
   STORAGE
========================================================= */

app.get(
    "/api/storage",
    requireAuth,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        COALESCE(
                            SUM(size),
                            0
                        ) AS used_bytes
                    FROM files
                    WHERE user_id = $1
                    `,
                    [
                        req.user.id
                    ]
                );


            const usedBytes =
                Number(
                    result.rows[0]?.used_bytes || 0
                );


            const quotaBytes =
                15 *
                1024 *
                1024 *
                1024;


            const usedPercentage =
                Math.min(
                    100,
                    (
                        usedBytes /
                        quotaBytes
                    ) * 100
                );


            return res.json({

                success: true,

                storage: {

                    usedBytes,

                    quotaBytes,

                    usedPercentage:
                        Number(
                            usedPercentage.toFixed(2)
                        )

                }

            });

        } catch (error) {

            console.error(
                "Storage error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to calculate storage."

            });

        }

    }
);


/* =========================================================
   TELEGRAM URL PARSER
========================================================= */

function parseTelegramUrl(
    url
) {

    try {

        const parsed =
            new URL(
                url
            );


        const hostname =
            parsed.hostname.toLowerCase();


        if (
            hostname !== "t.me" &&
            hostname !== "telegram.me"
        ) {

            return null;

        }


        const parts =
            parsed.pathname
                .split("/")
                .filter(Boolean);


        if (
            parts.length < 2
        ) {

            return null;

        }


        /*
            Private channel:

            https://t.me/c/123456789/55
        */

        if (
            parts[0].toLowerCase() === "c"
        ) {

            if (
                parts.length < 3
            ) {

                return null;

            }


            const channelId =
                Number(
                    parts[1]
                );


            const messageId =
                Number(
                    parts[2]
                );


            if (
                !Number.isSafeInteger(
                    channelId
                ) ||
                channelId <= 0
            ) {

                return null;

            }


            if (
                !Number.isSafeInteger(
                    messageId
                ) ||
                messageId <= 0
            ) {

                return null;

            }


            return {

                type:
                    "private",

                channelId,

                messageId

            };

        }


        /*
            Public channel:

            https://t.me/channelname/55
        */

        const username =
            parts[0];


        const messageId =
            Number(
                parts[1]
            );


        if (
            !username ||
            !Number.isSafeInteger(
                messageId
            ) ||
            messageId <= 0
        ) {

            return null;

        }


        return {

            type:
                "public",

            username,

            messageId

        };

    } catch {

        return null;

    }

}


/* =========================================================
   PRIVATE TELEGRAM CHANNEL
========================================================= */

async function resolvePrivateTelegramChannel(
    client,
    channelId
) {

    const numericId =
        BigInt(
            String(
                channelId
            )
        );


    /*
        First try -100xxxxxxxxxx style ID.
    */

    try {

        return await client.getEntity(
            BigInt(
                `-100${channelId}`
            )
        );

    } catch {}


    /*
        Then try PeerChannel.
    */

    try {

        const {
            Api
        } =
            require("telegram");


        return await client.getEntity(
            new Api.PeerChannel({

                channelId:
                    numericId

            })
        );

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

        const peer =
            message?.peerId;


        if (
            peer?.channelId !== undefined
        ) {

            return String(
                peer.channelId
            );

        }


        if (
            peer?.chatId !== undefined
        ) {

            return String(
                peer.chatId
            );

        }


        if (
            peer?.userId !== undefined
        ) {

            return String(
                peer.userId
            );

        }

    } catch {}


    return null;

}


/* =========================================================
   TELEGRAM DOCUMENT ID
========================================================= */

function getTelegramDocumentId(
    message
) {

    try {

        const document =
            message?.media?.document;


        if (
            document?.id !== undefined
        ) {

            return document.id.toString();

        }


        if (
            message?.file?.id !== undefined
        ) {

            return message.file.id.toString();

        }

    } catch {}


    return null;

}


/* =========================================================
   TELEGRAM DURATION
========================================================= */

function getTelegramDuration(
    message
) {

    try {

        const attributes =
            message?.media?.document?.attributes ||
            [];


        const video =
            attributes.find(
                attribute =>
                    attribute?.className ===
                    "DocumentAttributeVideo"
            );


        if (
            video?.duration !== undefined
        ) {

            const duration =
                Number(
                    video.duration
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
   SAFE FILE SIZE
========================================================= */

function parseSafeFileSize(
    value
) {

    const size =
        Number(
            value
        );


    if (
        !Number.isSafeInteger(
            size
        ) ||
        size < 0
    ) {

        return 0;

    }


    return size;

}


/* =========================================================
   RANGE PARSER
========================================================= */

function parseRangeHeader(
    header,
    totalSize
) {

    if (
        typeof header !== "string"
    ) {

        return null;

    }


    const match =
        header.match(
            /^bytes=(\d*)-(\d*)$/
        );


    if (
        !match
    ) {

        return null;

    }


    const startPart =
        match[1];


    const endPart =
        match[2];


    /*
        bytes=-500
    */

    if (
        !startPart &&
        endPart
    ) {

        const suffixLength =
            Number(
                endPart
            );


        if (
            !Number.isSafeInteger(
                suffixLength
            ) ||
            suffixLength <= 0
        ) {

            return null;

        }


        const start =
            Math.max(
                0,
                totalSize -
                    suffixLength
            );


        return {

            start,

            end:
                totalSize - 1

        };

    }


    const start =
        Number(
            startPart
        );


    if (
        !Number.isSafeInteger(
            start
        ) ||
        start < 0 ||
        start >= totalSize
    ) {

        return null;

    }


    let end =
        totalSize - 1;


    if (
        endPart
    ) {

        const requestedEnd =
            Number(
                endPart
            );


        if (
            !Number.isSafeInteger(
                requestedEnd
            ) ||
            requestedEnd < start
        ) {

            return null;

        }


        end =
            Math.min(
                requestedEnd,
                totalSize - 1
            );

    }


    return {

        start,

        end

    };

}


/* =========================================================
   MIME TYPE
========================================================= */

function getSafeMimeType(
    mimeType
) {

    if (
        typeof mimeType === "string" &&
        mimeType.trim()
    ) {

        return mimeType
            .trim()
            .split(";")[0];

    }


    return "application/octet-stream";

}


/* =========================================================
   MIME FALLBACK
========================================================= */

function guessMimeType(
    filename
) {

    const name =
        String(
            filename || ""
        ).toLowerCase();


    if (
        name.endsWith(".mp4")
    ) {

        return "video/mp4";

    }


    if (
        name.endsWith(".mov")
    ) {

        return "video/quicktime";

    }


    if (
        name.endsWith(".webm")
    ) {

        return "video/webm";

    }


    if (
        name.endsWith(".mkv")
    ) {

        return "video/x-matroska";

    }


    if (
        name.endsWith(".avi")
    ) {

        return "video/x-msvideo";

    }


    if (
        name.endsWith(".m4v")
    ) {

        return "video/x-m4v";

    }


    if (
        name.endsWith(".mp3")
    ) {

        return "audio/mpeg";

    }


    if (
        name.endsWith(".m4a")
    ) {

        return "audio/mp4";

    }


    if (
        name.endsWith(".wav")
    ) {

        return "audio/wav";

    }


    if (
        name.endsWith(".jpg") ||
        name.endsWith(".jpeg")
    ) {

        return "image/jpeg";

    }


    if (
        name.endsWith(".png")
    ) {

        return "image/png";

    }


    if (
        name.endsWith(".gif")
    ) {

        return "image/gif";

    }


    return "application/octet-stream";

}


/* =========================================================
   CONTENT DISPOSITION
========================================================= */

function buildInlineContentDisposition(
    filename
) {

    const clean =
        typeof filename === "string" &&
        filename.trim()
            ? filename.trim()
            : "telegram-file";


    const ascii =
        clean
            .replace(
                /[\r\n"]/g,
                ""
            )
            .replace(
                /[/\\]/g,
                "_"
            )
            .replace(
                /[^\x20-\x7E]/g,
                "_"
            );


    const encoded =
        encodeURIComponent(
            clean
        );


    return (
        `inline; filename="${ascii}"; filename*=UTF-8''${encoded}`
    );

}


/* =========================================================
   BACKPRESSURE
========================================================= */

function waitForDrain(
    stream
) {

    return new Promise(
        resolve => {

            if (
                stream.destroyed ||
                stream.writableEnded
            ) {

                resolve();

                return;

            }


            const cleanup =
                () => {

                    stream.removeListener(
                        "drain",
                        onDrain
                    );

                    stream.removeListener(
                        "close",
                        onClose
                    );

                    stream.removeListener(
                        "error",
                        onError
                    );

                };


            const onDrain =
                () => {

                    cleanup();

                    resolve();

                };


            const onClose =
                () => {

                    cleanup();

                    resolve();

                };


            const onError =
                () => {

                    cleanup();

                    resolve();

                };


            stream.once(
                "drain",
                onDrain
            );

            stream.once(
                "close",
                onClose
            );

            stream.once(
                "error",
                onError
            );

        }
    );

}


/* =========================================================
   UUID VALIDATION
========================================================= */

function isUuid(
    value
) {

    return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(
                value
            )
    );

}


/* =========================================================
   STREAM ERROR STATUS
========================================================= */

function getStreamErrorStatus(
    error
) {

    const message =
        String(
            error?.message ||
            ""
        ).toLowerCase();


    if (
        message.includes(
            "not found"
        )
    ) {

        return 404;

    }


    if (
        message.includes(
            "not connected"
        ) ||
        message.includes(
            "session"
        )
    ) {

        return 401;

    }


    if (
        message.includes(
            "different telegram account"
        ) ||
        message.includes(
            "unauthorized"
        ) ||
        message.includes(
            "access denied"
        )
    ) {

        return 403;

    }


    return 502;

}


/* =========================================================
   STREAM ERROR MESSAGE
========================================================= */

function getStreamErrorMessage(
    error
) {

    const message =
        String(
            error?.message ||
            ""
        );


    if (
        message
    ) {

        return message;

    }


    return "Unable to stream Telegram media.";

}


/* =========================================================
   TELEGRAM ERROR MESSAGE
========================================================= */

function getTelegramErrorMessage(
    error
) {

    const message =
        String(
            error?.message ||
            ""
        );


    const lower =
        message.toLowerCase();


    if (
        lower.includes(
            "phone_number_invalid"
        )
    ) {

        return "The Telegram phone number is invalid.";

    }


    if (
        lower.includes(
            "phone_number_banned"
        )
    ) {

        return "This Telegram phone number is banned.";

    }


    if (
        lower.includes(
            "phone_code_invalid"
        )
    ) {

        return "The Telegram verification code is incorrect.";

    }


    if (
        lower.includes(
            "phone_code_expired"
        )
    ) {

        return "The Telegram verification code has expired.";

    }


    if (
        lower.includes(
            "password_hash_invalid"
        )
    ) {

        return "The Telegram 2FA password is incorrect.";

    }


    if (
        lower.includes(
            "flood_wait"
        )
    ) {

        return "Telegram rate limit reached. Please wait before trying again.";

    }


    if (
        lower.includes(
            "channel_private"
        )
    ) {

        return "This Telegram channel is private or inaccessible.";

    }


    if (
        lower.includes(
            "username_not_occupied"
        )
    ) {

        return "The Telegram channel or username was not found.";

    }


    if (
        lower.includes(
            "message_id_invalid"
        )
    ) {

        return "The Telegram message could not be found.";

    }


    return (
        message ||
        "Telegram operation failed."
    );

}


/* =========================================================
   SPA FALLBACK
========================================================= */

app.use(
    (req, res, next) => {

        if (
            req.path.startsWith(
                "/api/"
            )
        ) {

            return res.status(404).json({

                success: false,

                message:
                    "API endpoint not found."

            });

        }


        return res.sendFile(
            path.join(
                frontendPath,
                "index.html"
            ),
            error => {

                if (
                    error
                ) {

                    next(
                        error
                    );

                }

            }
        );

    }
);


/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            "Unhandled server error:",
            error
        );


        if (
            res.headersSent
        ) {

            return next(
                error
            );

        }


        return res.status(500).json({

            success: false,

            message:
                "Internal server error."

        });

    }
);


/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

    try {

        await testDatabase();


        app.listen(
            PORT,
            () => {

                console.log(
                    `✓ Server running on http://localhost:${PORT}`
                );

            }
        );

    } catch (error) {

        console.error(
            "Failed to start server:",
            error
        );


        process.exit(
            1
        );

    }

}


startServer();