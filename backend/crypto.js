const crypto = require("crypto");

require("dotenv").config();


/* =====================================================
   CONFIG
===================================================== */

const ALGORITHM =
    "aes-256-gcm";

const IV_LENGTH =
    12;

const KEY_LENGTH =
    32;


/* =====================================================
   LOAD ENCRYPTION KEY
===================================================== */

const keyHex =
    process.env.SESSION_ENCRYPTION_KEY;


if (!keyHex) {

    throw new Error(
        "SESSION_ENCRYPTION_KEY is missing from .env"
    );

}


/*
    SESSION_ENCRYPTION_KEY must be exactly
    32 random bytes represented as 64 hex characters.
*/

if (
    !/^[0-9a-fA-F]{64}$/.test(
        keyHex
    )
) {

    throw new Error(
        "SESSION_ENCRYPTION_KEY must contain exactly 64 hexadecimal characters (32 bytes)."
    );

}


const KEY =
    Buffer.from(
        keyHex,
        "hex"
    );


if (
    KEY.length !== KEY_LENGTH
) {

    throw new Error(
        "SESSION_ENCRYPTION_KEY must be exactly 32 bytes."
    );

}


/* =====================================================
   ENCRYPT
===================================================== */

function encrypt(
    plaintext
) {

    if (
        typeof plaintext !== "string"
    ) {

        throw new TypeError(
            "Encryption input must be a string."
        );

    }


    if (!plaintext) {

        throw new Error(
            "Cannot encrypt empty data."
        );

    }


    /*
        Every encryption operation gets
        a fresh random IV.
    */

    const iv =
        crypto.randomBytes(
            IV_LENGTH
        );


    const cipher =
        crypto.createCipheriv(
            ALGORITHM,
            KEY,
            iv
        );


    let encrypted =
        cipher.update(
            plaintext,
            "utf8",
            "base64"
        );


    encrypted +=
        cipher.final(
            "base64"
        );


    /*
        GCM authentication tag protects
        the encrypted data from tampering.
    */

    const authTag =
        cipher.getAuthTag();


    /*
        Format:

        version.iv.authTag.ciphertext

        Version allows us to change the
        encryption format safely in future.
    */

    return [
        "v1",
        iv.toString("base64"),
        authTag.toString("base64"),
        encrypted
    ].join(".");

}


/* =====================================================
   DECRYPT
===================================================== */

function decrypt(
    payload
) {

    if (
        typeof payload !== "string" ||
        !payload
    ) {

        throw new Error(
            "Encrypted data is required."
        );

    }


    const parts =
        payload.split(".");


    /*
        Expected:

        v1
        iv
        authTag
        ciphertext
    */

    if (
        parts.length !== 4
    ) {

        throw new Error(
            "Invalid encrypted data format."
        );

    }


    const [
        version,
        ivBase64,
        authTagBase64,
        encrypted
    ] = parts;


    if (
        version !== "v1"
    ) {

        throw new Error(
            "Unsupported encrypted data version."
        );

    }


    if (
        !ivBase64 ||
        !authTagBase64 ||
        !encrypted
    ) {

        throw new Error(
            "Encrypted data is incomplete."
        );

    }


    let iv;
    let authTag;


    try {

        iv =
            Buffer.from(
                ivBase64,
                "base64"
            );


        authTag =
            Buffer.from(
                authTagBase64,
                "base64"
            );

    } catch {

        throw new Error(
            "Invalid encrypted data encoding."
        );

    }


    if (
        iv.length !== IV_LENGTH
    ) {

        throw new Error(
            "Invalid encryption IV."
        );

    }


    if (
        authTag.length !== 16
    ) {

        throw new Error(
            "Invalid encryption authentication tag."
        );

    }


    try {

        const decipher =
            crypto.createDecipheriv(
                ALGORITHM,
                KEY,
                iv
            );


        decipher.setAuthTag(
            authTag
        );


        let decrypted =
            decipher.update(
                encrypted,
                "base64",
                "utf8"
            );


        decrypted +=
            decipher.final(
                "utf8"
            );


        return decrypted;

    } catch (error) {

        console.error(
            "Session decryption failed:",
            error.message
        );


        throw new Error(
            "Unable to decrypt stored session."
        );

    }

}


/* =====================================================
   GENERATE NEW ENCRYPTION KEY
===================================================== */

/*
    This function is intentionally NOT called
    automatically when the server starts.

    Changing the encryption key would make all
    previously stored Telegram sessions impossible
    to decrypt.

    Run it manually when creating a new environment.
*/

function generateEncryptionKey() {

    return crypto
        .randomBytes(
            KEY_LENGTH
        )
        .toString("hex");

}


/* =====================================================
   EXPORTS
===================================================== */

module.exports = {

    encrypt,

    decrypt,

    generateEncryptionKey

};