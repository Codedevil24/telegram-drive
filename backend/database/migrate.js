const fs = require("fs");
const path = require("path");

const {
    pool
} = require("../db");


/* =====================================================
   MIGRATION CONFIG
===================================================== */

const migrationsDir =
    path.join(
        __dirname,
        "migrations"
    );


/* =====================================================
   RUN MIGRATIONS
===================================================== */

async function runMigrations() {

    const client =
        await pool.connect();


    try {

        console.log(
            "\nStarting database migration...\n"
        );


        /*
            Create migration tracking table.
        */

        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (

                id SERIAL PRIMARY KEY,

                filename TEXT UNIQUE NOT NULL,

                executed_at
                    TIMESTAMPTZ NOT NULL
                    DEFAULT NOW()

            );
        `);


        /*
            Make sure migration directory exists.
        */

        if (
            !fs.existsSync(
                migrationsDir
            )
        ) {

            throw new Error(
                `Migration directory not found: ${migrationsDir}`
            );

        }


        /*
            Get SQL migration files
            in deterministic order.
        */

        const files =
            fs
                .readdirSync(
                    migrationsDir
                )
                .filter(
                    filename =>
                        filename
                            .toLowerCase()
                            .endsWith(".sql")
                )
                .sort();


        if (
            files.length === 0
        ) {

            console.log(
                "No migration files found."
            );

            return;

        }


        /*
            Execute every migration
            that hasn't already run.
        */

        for (
            const filename of files
        ) {

            const migrationStatus =
                await client.query(
                    `
                    SELECT id
                    FROM schema_migrations
                    WHERE filename = $1
                    LIMIT 1
                    `,
                    [filename]
                );


            /*
                Already executed.
            */

            if (
                migrationStatus.rows.length > 0
            ) {

                console.log(
                    `✓ ${filename} already applied`
                );

                continue;

            }


            console.log(
                `→ Running ${filename}`
            );


            const filePath =
                path.join(
                    migrationsDir,
                    filename
                );


            const sql =
                fs.readFileSync(
                    filePath,
                    "utf8"
                );


            if (
                !sql.trim()
            ) {

                throw new Error(
                    `Migration ${filename} is empty.`
                );

            }


            /*
                Every migration runs inside
                its own transaction.

                If anything fails, the complete
                migration is rolled back.
            */

            await client.query(
                "BEGIN"
            );


            try {

                await client.query(
                    sql
                );


                await client.query(
                    `
                    INSERT INTO schema_migrations (
                        filename
                    )
                    VALUES ($1)
                    `,
                    [filename]
                );


                await client.query(
                    "COMMIT"
                );


                console.log(
                    `✓ ${filename} completed`
                );

            } catch (error) {

                await client.query(
                    "ROLLBACK"
                );


                console.error(
                    `✗ ${filename} failed`
                );


                throw error;

            }

        }


        console.log(
            "\n✓ Database migration completed successfully.\n"
        );

    } finally {

        client.release();

    }

}


/* =====================================================
   START MIGRATION
===================================================== */

runMigrations()

    .catch(
        error => {

            console.error(
                "\nMigration failed:\n"
            );


            console.error(
                error
            );


            process.exitCode = 1;

        }
    )

    .finally(
        async () => {

            await pool.end();

        }
    );