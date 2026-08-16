const {
    createClient
} = require("@supabase/supabase-js");

require("dotenv").config();


/* =====================================================
   SUPABASE CONFIG
===================================================== */

const supabaseUrl =
    process.env.SUPABASE_URL;

const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY;


if (!supabaseUrl) {

    throw new Error(
        "SUPABASE_URL is missing from .env"
    );

}


if (!supabasePublishableKey) {

    throw new Error(
        "SUPABASE_PUBLISHABLE_KEY is missing from .env"
    );

}


/* =====================================================
   SUPABASE CLIENT
===================================================== */

const supabase =
    createClient(
        supabaseUrl,
        supabasePublishableKey,
        {
            auth: {

                /*
                    Backend is not responsible for
                    maintaining a browser session.

                    Frontend sends the current access
                    token with every protected request.
                */

                autoRefreshToken: false,

                persistSession: false,

                detectSessionInUrl: false

            }
        }
    );


/* =====================================================
   EXPORT
===================================================== */

module.exports = {
    supabase
};