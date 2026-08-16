const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const envPath =
    path.join(__dirname, ".env");


let env = "";

if (fs.existsSync(envPath)) {

    env =
        fs.readFileSync(
            envPath,
            "utf8"
        );

}


function generateSessionKey() {

    const keyName =
        "SESSION_ENCRYPTION_KEY";


    const exists =
        new RegExp(
            `^${keyName}=`,
            "m"
        ).test(env);


    if (exists) {

        console.log(
            "SESSION_ENCRYPTION_KEY already exists."
        );

        return;

    }


    const secret =
        crypto
            .randomBytes(32)
            .toString("hex");


    env +=
        `\n${keyName}=${secret}\n`;


    console.log(
        "SESSION_ENCRYPTION_KEY generated."
    );

}


generateSessionKey();


fs.writeFileSync(
    envPath,
    env
);


console.log(
    "Secret setup completed."
);