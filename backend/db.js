"use strict";

const { Pool } = require("pg");
require("dotenv").config();

/* =========================================================
   DATABASE CONFIG
========================================================= */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env");
}

/* =========================================================
   POSTGRESQL CONNECTION POOL
========================================================= */

const pool = new Pool({
    connectionString: DATABASE_URL,

    ssl: {
        rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30_000,

    connectionTimeoutMillis: 10_000
});

/* =========================================================
   POOL ERROR HANDLER
========================================================= */

pool.on("error", (error) => {
    console.error(
        "Unexpected PostgreSQL pool error:",
        error
    );
});

/* =========================================================
   DATABASE HEALTH CHECK
========================================================= */

async function testDatabase() {
    const result = await pool.query(
        "SELECT NOW() AS current_time"
    );

    console.log(
        "✓ Database connected:",
        result.rows[0].current_time
    );

    return true;
}

/* =========================================================
   GRACEFUL DATABASE SHUTDOWN
========================================================= */

async function closeDatabase() {
    try {
        await pool.end();

        console.log(
            "✓ Database connection pool closed."
        );
    } catch (error) {
        console.error(
            "Error closing database pool:",
            error
        );
    }
}

/* =========================================================
   PROCESS SHUTDOWN
========================================================= */

async function handleShutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down...`);

    await closeDatabase();

    process.exit(0);
}

process.once(
    "SIGINT",
    () => handleShutdown("SIGINT")
);

process.once(
    "SIGTERM",
    () => handleShutdown("SIGTERM")
);

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
    pool,
    testDatabase,
    closeDatabase
};