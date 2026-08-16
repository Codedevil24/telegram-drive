"use strict";

const {
    supabase
} = require("./supabase");

require("dotenv").config();


/* =========================================================
   ADMIN CONFIGURATION
========================================================= */

/*
    Add Supabase user IDs here in .env:

    ADMIN_USER_IDS=user-id-1,user-id-2

    Never trust an admin/user ID sent by frontend.
*/

const ADMIN_USER_IDS = new Set(
    String(process.env.ADMIN_USER_IDS || "")
        .split(",")
        .map(id => id.trim())
        .filter(Boolean)
);


/* =========================================================
   GET ACCESS TOKEN
========================================================= */

function getAccessToken(req) {

    /*
        Normal API request:

        Authorization:
        Bearer <access_token>
    */

    const authorization =
        req.headers.authorization;

    if (
        authorization &&
        authorization.startsWith("Bearer ")
    ) {

        const token =
            authorization
                .substring(7)
                .trim();

        if (token) {
            return token;
        }
    }


    /*
        HTML5 <video> requests cannot reliably
        send a custom Authorization header.

        Therefore media requests can use:

        ?access_token=<supabase_access_token>

        This is required for the current
        browser video/PDF streaming implementation.
    */

    const queryToken =
        typeof req.query?.access_token === "string"
            ? req.query.access_token.trim()
            : "";

    if (queryToken) {
        return queryToken;
    }


    return null;
}


/* =========================================================
   VERIFY SUPABASE ACCESS TOKEN
========================================================= */

async function verifyAccessToken(token) {

    if (
        !token ||
        typeof token !== "string"
    ) {
        return null;
    }


    try {

        const {
            data,
            error
        } = await supabase.auth.getUser(token);


        if (
            error ||
            !data?.user
        ) {
            return null;
        }


        return data.user;

    } catch (error) {

        console.error(
            "Supabase token verification error:",
            error.message
        );

        return null;
    }
}


/* =========================================================
   REQUIRE AUTHENTICATION
========================================================= */

async function requireAuth(
    req,
    res,
    next
) {

    try {

        const token =
            getAccessToken(req);


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const user =
            await verifyAccessToken(token);


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid or expired session."

            });

        }


        /*
            IMPORTANT:

            The verified Supabase user is the
            only identity trusted by the backend.

            Protected routes should use:

                req.user.id
        */

        req.user =
            user;


        /*
            Keep verified access token available
            internally for routes that need it.

            NEVER log this token.
        */

        req.accessToken =
            token;


        next();

    } catch (error) {

        console.error(
            "Authentication middleware error:",
            error
        );


        return res.status(401).json({

            success: false,

            message:
                "Authentication failed."

        });

    }

}


/* =========================================================
   REQUIRE ADMIN
========================================================= */

/*
    Usage:

        router.get(
            "/api/admin/users",
            requireAuth,
            requireAdmin,
            handler
        );

    IMPORTANT:

    requireAdmin MUST come after requireAuth
    because it depends on req.user.
*/

function requireAdmin(
    req,
    res,
    next
) {

    try {

        if (!req.user?.id) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });

        }


        const userId =
            String(req.user.id);


        /*
            Check the verified Supabase
            user ID against server-side
            admin configuration.

            Frontend cannot override this.
        */

        if (
            !ADMIN_USER_IDS.has(userId)
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Administrator access required."

            });

        }


        /*
            Mark the request as verified admin.

            This is only an internal convenience
            flag. Authorization is already complete.
        */

        req.isAdmin = true;


        next();

    } catch (error) {

        console.error(
            "Admin authorization error:",
            error
        );


        return res.status(403).json({

            success: false,

            message:
                "Administrator authorization failed."

        });

    }

}


/* =========================================================
   STREAM AUTHENTICATION
========================================================= */

/*
    Dedicated authentication middleware for:

        <video>
        <audio>
        PDF/media streaming
        browser range requests

    Accepts:

        Authorization: Bearer TOKEN

    OR:

        ?access_token=TOKEN
*/

async function requireStreamAuth(
    req,
    res,
    next
) {

    try {

        const token =
            getAccessToken(req);


        if (!token) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required for media stream."

            });

        }


        const user =
            await verifyAccessToken(token);


        if (!user) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid or expired session."

            });

        }


        /*
            Store verified Supabase user.

            Streaming routes MUST use:

                req.user.id

            when checking file ownership.
        */

        req.user =
            user;


        /*
            Keep verified token available
            internally if the stream route
            requires it.

            NEVER log this value.
        */

        req.accessToken =
            token;


        next();

    } catch (error) {

        console.error(
            "Stream authentication error:",
            error
        );


        return res.status(401).json({

            success: false,

            message:
                "Stream authentication failed."

        });

    }

}


/* =========================================================
   CHECK ADMIN STATUS
========================================================= */

/*
    Useful for frontend/admin bootstrap:

        GET /api/admin/me

    after requireAuth.

    Example response:

        {
            success: true,
            isAdmin: true
        }
*/

function isAdminUser(userId) {

    if (!userId) {
        return false;
    }

    return ADMIN_USER_IDS.has(
        String(userId)
    );
}


/* =========================================================
   EXPORTS
========================================================= */

module.exports = {

    requireAuth,

    requireAdmin,

    requireStreamAuth,

    getAccessToken,

    verifyAccessToken,

    isAdminUser

};