"use strict";

const express = require("express");

const {
    pool
} = require("../db");


const router =
    express.Router();


/* =========================================================
   HELPERS
========================================================= */

function isUuid(value) {

    return (
        typeof value === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(value)
    );

}


/* =========================================================
   ADMIN - CURRENT ADMIN
========================================================= */

router.get(
    "/me",
    async (req, res) => {

        return res.json({

            success: true,

            isAdmin: true,

            user: {

                id:
                    req.user.id,

                email:
                    req.user.email || null

            }

        });

    }
);


/* =========================================================
   ADMIN - DASHBOARD STATS
========================================================= */

router.get(
    "/stats",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM auth.users
                        ) AS total_users,

                        (
                            SELECT COUNT(*)
                            FROM files
                        ) AS total_files,

                        (
                            SELECT COALESCE(
                                SUM(size),
                                0
                            )
                            FROM files
                        ) AS total_storage_bytes,

                        (
                            SELECT COUNT(*)
                            FROM folders
                        ) AS total_folders,

                        (
                            SELECT COUNT(*)
                            FROM telegram_accounts
                        ) AS connected_telegram_accounts
                    `
                );


            const stats =
                result.rows[0] || {};


            return res.json({

                success: true,

                stats: {

                    totalUsers:
                        Number(
                            stats.total_users || 0
                        ),

                    totalFiles:
                        Number(
                            stats.total_files || 0
                        ),

                    totalFolders:
                        Number(
                            stats.total_folders || 0
                        ),

                    connectedTelegramAccounts:
                        Number(
                            stats.connected_telegram_accounts || 0
                        ),

                    totalStorageBytes:
                        Number(
                            stats.total_storage_bytes || 0
                        )

                }

            });

        } catch (error) {

            console.error(
                "Admin stats error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load admin statistics."

            });

        }

    }
);


/* =========================================================
   ADMIN - USERS
========================================================= */

router.get(
    "/users",
    async (req, res) => {

        try {

            const search =
                typeof req.query.search === "string"
                    ? req.query.search.trim()
                    : "";


            const requestedPage =
                Number(
                    req.query.page || 1
                );


            const requestedLimit =
                Number(
                    req.query.limit || 25
                );


            const page =
                Number.isInteger(
                    requestedPage
                ) &&
                requestedPage > 0
                    ? requestedPage
                    : 1;


            const limit =
                Number.isInteger(
                    requestedLimit
                )
                    ? Math.min(
                        Math.max(
                            requestedLimit,
                            1
                        ),
                        100
                    )
                    : 25;


            const offset =
                (
                    page - 1
                ) *
                limit;


            const values = [];


            let where =
                "";


            if (search) {

                values.push(
                    `%${search}%`
                );


                where = `
                    WHERE
                        COALESCE(
                            u.email,
                            ''
                        ) ILIKE $1

                        OR

                        u.id::text ILIKE $1
                `;

            }


            const countResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) AS total

                    FROM auth.users u

                    ${where}
                    `,
                    values
                );


            const total =
                Number(
                    countResult.rows[0]?.total || 0
                );


            const dataValues = [
                ...values,
                limit,
                offset
            ];


            const limitParam =
                dataValues.length - 1;


            const offsetParam =
                dataValues.length;


            /*
                IMPORTANT:

                File/folder/Telegram counts are calculated
                separately so JOIN multiplication does not
                produce incorrect counts or storage values.
            */

            const result =
                await pool.query(
                    `
                    SELECT

                        u.id,
                        u.email,
                        u.created_at,
                        u.last_sign_in_at,
                        u.email_confirmed_at,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM files f
                                WHERE f.user_id = u.id
                            ),
                            0
                        ) AS file_count,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM folders fo
                                WHERE fo.user_id = u.id
                            ),
                            0
                        ) AS folder_count,

                        COALESCE(
                            (
                                SELECT SUM(f2.size)
                                FROM files f2
                                WHERE f2.user_id = u.id
                            ),
                            0
                        ) AS storage_bytes,

                        COALESCE(
                            (
                                SELECT COUNT(*)
                                FROM telegram_accounts ta
                                WHERE ta.user_id = u.id
                            ),
                            0
                        ) AS telegram_account_count

                    FROM auth.users u

                    ${where}

                    ORDER BY
                        u.created_at DESC

                    LIMIT $${limitParam}

                    OFFSET $${offsetParam}
                    `,
                    dataValues
                );


            return res.json({

                success: true,

                users:
                    result.rows.map(
                        user => ({

                            id:
                                user.id,

                            email:
                                user.email || null,

                            createdAt:
                                user.created_at,

                            lastSignInAt:
                                user.last_sign_in_at,

                            emailConfirmedAt:
                                user.email_confirmed_at,

                            fileCount:
                                Number(
                                    user.file_count || 0
                                ),

                            folderCount:
                                Number(
                                    user.folder_count || 0
                                ),

                            storageBytes:
                                Number(
                                    user.storage_bytes || 0
                                ),

                            telegramAccountCount:
                                Number(
                                    user.telegram_account_count || 0
                                )

                        })
                    ),

                pagination: {

                    page,

                    limit,

                    total,

                    totalPages:
                        Math.ceil(
                            total / limit
                        )

                }

            });

        } catch (error) {

            console.error(
                "Admin users error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load users."

            });

        }

    }
);


/* =========================================================
   ADMIN - USER DETAILS
========================================================= */

router.get(
    "/users/:id",
    async (req, res) => {

        try {

            const userId =
                req.params.id;


            if (
                !isUuid(userId)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid user ID."

                });

            }


            const userResult =
                await pool.query(
                    `
                    SELECT

                        id,
                        email,
                        created_at,
                        last_sign_in_at,
                        email_confirmed_at

                    FROM auth.users

                    WHERE id = $1

                    LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                userResult.rows.length === 0
            ) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            const statsResult =
                await pool.query(
                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM files
                            WHERE user_id = $1
                        ) AS file_count,

                        (
                            SELECT COUNT(*)
                            FROM folders
                            WHERE user_id = $1
                        ) AS folder_count,

                        (
                            SELECT COALESCE(
                                SUM(size),
                                0
                            )
                            FROM files
                            WHERE user_id = $1
                        ) AS storage_bytes,

                        (
                            SELECT COUNT(*)
                            FROM telegram_accounts
                            WHERE user_id = $1
                        ) AS telegram_account_count
                    `,
                    [
                        userId
                    ]
                );


            const user =
                userResult.rows[0];


            const stats =
                statsResult.rows[0] || {};


            return res.json({

                success: true,

                user: {

                    id:
                        user.id,

                    email:
                        user.email || null,

                    createdAt:
                        user.created_at,

                    lastSignInAt:
                        user.last_sign_in_at,

                    emailConfirmedAt:
                        user.email_confirmed_at

                },

                stats: {

                    fileCount:
                        Number(
                            stats.file_count || 0
                        ),

                    folderCount:
                        Number(
                            stats.folder_count || 0
                        ),

                    storageBytes:
                        Number(
                            stats.storage_bytes || 0
                        ),

                    telegramAccountCount:
                        Number(
                            stats.telegram_account_count || 0
                        )

                }

            });

        } catch (error) {

            console.error(
                "Admin user details error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load user details."

            });

        }

    }
);


/* =========================================================
   ADMIN - USER FILES
========================================================= */

router.get(
    "/users/:id/files",
    async (req, res) => {

        try {

            const userId =
                req.params.id;


            if (
                !isUuid(userId)
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid user ID."

                });

            }


            const result =
                await pool.query(
                    `
                    SELECT

                        f.id,
                        f.folder_id,

                        f.telegram_account_id,
                        f.telegram_chat_id,
                        f.telegram_message_id,

                        f.name,
                        f.size,
                        f.mime_type,
                        f.thumbnail_file_id,
                        f.duration,

                        f.created_at,
                        f.updated_at

                    FROM files f

                    WHERE f.user_id = $1

                    ORDER BY
                        f.created_at DESC
                    `,
                    [
                        userId
                    ]
                );


            return res.json({

                success: true,

                files:
                    result.rows.map(
                        file => ({

                            id:
                                file.id,

                            folderId:
                                file.folder_id,

                            telegramAccountId:
                                file.telegram_account_id,

                            telegramChatId:
                                file.telegram_chat_id !== null
                                    ? String(
                                        file.telegram_chat_id
                                    )
                                    : null,

                            telegramMessageId:
                                file.telegram_message_id !== null
                                    ? String(
                                        file.telegram_message_id
                                    )
                                    : null,

                            name:
                                file.name,

                            size:
                                Number(
                                    file.size || 0
                                ),

                            mimeType:
                                file.mime_type,

                            thumbnailFileId:
                                file.thumbnail_file_id,

                            duration:
                                file.duration,

                            createdAt:
                                file.created_at,

                            updatedAt:
                                file.updated_at

                        })
                    )

            });

        } catch (error) {

            console.error(
                "Admin user files error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load user files."

            });

        }

    }
);


/* =========================================================
   ADMIN - ALL FILES
========================================================= */

router.get(
    "/files",
    async (req, res) => {

        try {

            const search =
                typeof req.query.search === "string"
                    ? req.query.search.trim()
                    : "";


            const userId =
                typeof req.query.userId === "string"
                    ? req.query.userId.trim()
                    : "";


            const requestedPage =
                Number(
                    req.query.page || 1
                );


            const requestedLimit =
                Number(
                    req.query.limit || 50
                );


            const page =
                Number.isInteger(
                    requestedPage
                ) &&
                requestedPage > 0
                    ? requestedPage
                    : 1;


            const limit =
                Number.isInteger(
                    requestedLimit
                )
                    ? Math.min(
                        Math.max(
                            requestedLimit,
                            1
                        ),
                        100
                    )
                    : 50;


            const offset =
                (
                    page - 1
                ) *
                limit;


            const values = [];


            const conditions = [];


            if (search) {

                values.push(
                    `%${search}%`
                );


                conditions.push(
                    `f.name ILIKE $${values.length}`
                );

            }


            if (userId) {

                if (
                    !isUuid(userId)
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Invalid user ID."

                    });

                }


                values.push(
                    userId
                );


                conditions.push(
                    `f.user_id = $${values.length}`
                );

            }


            const where =
                conditions.length
                    ? `WHERE ${conditions.join(" AND ")}`
                    : "";


            const countResult =
                await pool.query(
                    `
                    SELECT
                        COUNT(*) AS total

                    FROM files f

                    ${where}
                    `,
                    values
                );


            const total =
                Number(
                    countResult.rows[0]?.total || 0
                );


            const dataValues = [
                ...values,
                limit,
                offset
            ];


            const limitParam =
                dataValues.length - 1;


            const offsetParam =
                dataValues.length;


            const result =
                await pool.query(
                    `
                    SELECT

                        f.id,
                        f.user_id,

                        u.email AS user_email,

                        f.folder_id,
                        f.telegram_account_id,
                        f.telegram_chat_id,
                        f.telegram_message_id,
                        f.telegram_file_id,

                        f.name,
                        f.size,
                        f.mime_type,
                        f.thumbnail_file_id,
                        f.duration,

                        f.created_at,
                        f.updated_at

                    FROM files f

                    LEFT JOIN auth.users u
                        ON u.id = f.user_id

                    ${where}

                    ORDER BY
                        f.created_at DESC

                    LIMIT $${limitParam}

                    OFFSET $${offsetParam}
                    `,
                    dataValues
                );


            return res.json({

                success: true,

                files:
                    result.rows.map(
                        file => ({

                            id:
                                file.id,

                            userId:
                                file.user_id,

                            userEmail:
                                file.user_email || null,

                            folderId:
                                file.folder_id,

                            telegramAccountId:
                                file.telegram_account_id,

                            telegramChatId:
                                file.telegram_chat_id !== null
                                    ? String(
                                        file.telegram_chat_id
                                    )
                                    : null,

                            telegramMessageId:
                                file.telegram_message_id !== null
                                    ? String(
                                        file.telegram_message_id
                                    )
                                    : null,

                            telegramFileId:
                                file.telegram_file_id,

                            name:
                                file.name,

                            size:
                                Number(
                                    file.size || 0
                                ),

                            mimeType:
                                file.mime_type,

                            thumbnailFileId:
                                file.thumbnail_file_id,

                            duration:
                                file.duration,

                            createdAt:
                                file.created_at,

                            updatedAt:
                                file.updated_at

                        })
                    ),

                pagination: {

                    page,

                    limit,

                    total,

                    totalPages:
                        Math.ceil(
                            total / limit
                        )

                }

            });

        } catch (error) {

            console.error(
                "Admin files error:",
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
   ADMIN - DELETE FILE RECORD
========================================================= */

/*
    IMPORTANT:

    This deletes only the file record from
    Telegram Drive.

    It does NOT delete the original Telegram
    message/file.
*/

router.delete(
    "/files/:id",
    async (req, res) => {

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


            const result =
                await pool.query(
                    `
                    DELETE FROM files

                    WHERE id = $1

                    RETURNING
                        id,
                        user_id,
                        name
                    `,
                    [
                        fileId
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

                message:
                    "File record deleted successfully.",

                file:
                    result.rows[0]

            });

        } catch (error) {

            console.error(
                "Admin delete file error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to delete file."

            });

        }

    }
);


/* =========================================================
   ADMIN - FOLDERS
========================================================= */

router.get(
    "/folders",
    async (req, res) => {

        try {

            const userId =
                typeof req.query.userId === "string"
                    ? req.query.userId.trim()
                    : "";


            const values = [];


            let where =
                "";


            if (userId) {

                if (
                    !isUuid(userId)
                ) {

                    return res.status(400).json({

                        success: false,

                        message:
                            "Invalid user ID."

                    });

                }


                values.push(
                    userId
                );


                where =
                    "WHERE f.user_id = $1";

            }


            const result =
                await pool.query(
                    `
                    SELECT

                        f.id,
                        f.user_id,

                        u.email AS user_email,

                        f.parent_id,
                        f.name,

                        f.created_at,
                        f.updated_at,

                        (
                            SELECT COUNT(*)
                            FROM files file_count
                            WHERE
                                file_count.folder_id = f.id
                        ) AS file_count

                    FROM folders f

                    LEFT JOIN auth.users u
                        ON u.id = f.user_id

                    ${where}

                    ORDER BY
                        f.created_at DESC
                    `,
                    values
                );


            return res.json({

                success: true,

                folders:
                    result.rows.map(
                        folder => ({

                            id:
                                folder.id,

                            userId:
                                folder.user_id,

                            userEmail:
                                folder.user_email || null,

                            parentId:
                                folder.parent_id,

                            name:
                                folder.name,

                            fileCount:
                                Number(
                                    folder.file_count || 0
                                ),

                            createdAt:
                                folder.created_at,

                            updatedAt:
                                folder.updated_at

                        })
                    )

            });

        } catch (error) {

            console.error(
                "Admin folders error:",
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
   ADMIN - TELEGRAM ACCOUNTS
========================================================= */

router.get(
    "/telegram-accounts",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT

                        ta.id,
                        ta.user_id,

                        u.email AS user_email,

                        ta.telegram_user_id,
                        ta.username,
                        ta.phone,

                        ta.created_at,
                        ta.updated_at

                    FROM telegram_accounts ta

                    LEFT JOIN auth.users u
                        ON u.id = ta.user_id

                    ORDER BY
                        ta.created_at DESC
                    `
                );


            return res.json({

                success: true,

                accounts:
                    result.rows.map(
                        account => ({

                            id:
                                account.id,

                            userId:
                                account.user_id,

                            userEmail:
                                account.user_email || null,

                            telegramUserId:
                                account.telegram_user_id !== null
                                    ? String(
                                        account.telegram_user_id
                                    )
                                    : null,

                            username:
                                account.username || null,

                            phone:
                                account.phone || null,

                            createdAt:
                                account.created_at,

                            updatedAt:
                                account.updated_at

                        })
                    )

            });

        } catch (error) {

            console.error(
                "Admin Telegram accounts error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load Telegram accounts."

            });

        }

    }
);


/* =========================================================
   ADMIN - RECENT ACTIVITY
========================================================= */

router.get(
    "/activity",
    async (req, res) => {

        try {

            /*
                There is currently no dedicated
                activity_logs table in the database.

                So for now, recent file imports are
                returned as activity.
            */

            const result =
                await pool.query(
                    `
                    SELECT

                        f.id,
                        f.name,
                        f.size,
                        f.created_at,
                        f.user_id,

                        u.email AS user_email

                    FROM files f

                    LEFT JOIN auth.users u
                        ON u.id = f.user_id

                    ORDER BY
                        f.created_at DESC

                    LIMIT 20
                    `
                );


            return res.json({

                success: true,

                activity:
                    result.rows.map(
                        item => ({

                            id:
                                item.id,

                            type:
                                "file_import",

                            name:
                                item.name,

                            size:
                                Number(
                                    item.size || 0
                                ),

                            userId:
                                item.user_id,

                            userEmail:
                                item.user_email || null,

                            createdAt:
                                item.created_at

                        })
                    )

            });

        } catch (error) {

            console.error(
                "Admin activity error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Unable to load admin activity."

            });

        }

    }
);


/* =========================================================
   EXPORT
========================================================= */

module.exports =
    router;