/* =========================================================
   TELEGRAM DRIVE
   FRONTEND APPLICATION
   COMPLETE UPDATED VERSION
========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

let supabaseClient = null;

let currentSession = null;
let currentUser = null;

let currentFolderId = null;

let folders = [];
let files = [];

let storageInfo = {
    used: 0,
    total: 0
};

let telegramAuthId = null;


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = selector =>
    document.querySelector(selector);

const $$ = selector =>
    document.querySelectorAll(selector);


/* =========================================================
   DOM ELEMENTS
========================================================= */

const app =
    $("#app");

const authScreen =
    $("#authScreen");


/* =========================================================
   AUTH ELEMENTS
========================================================= */

const loginPanel =
    $("#loginPanel");

const signupPanel =
    $("#signupPanel");

const loginForm =
    $("#loginForm");

const signupForm =
    $("#signupForm");

const loginEmail =
    $("#loginEmail");

const loginPassword =
    $("#loginPassword");

const signupEmail =
    $("#signupEmail");

const signupPassword =
    $("#signupPassword");

const loginMessage =
    $("#loginMessage");

const signupMessage =
    $("#signupMessage");

const showLoginButton =
    $("#showLogin");

const showSignupButton =
    $("#showSignup");

const logoutButton =
    $("#logoutButton");

const sidebarUserEmail =
    $("#sidebarUserEmail");


/* =========================================================
   DRIVE ELEMENTS
========================================================= */

const searchInput =
    $("#searchInput");

const newButton =
    $("#newButton");

const createFolderButton =
    $("#createFolderButton");

const folderGrid =
    $("#folderGrid");

const fileGrid =
    $("#fileGrid");


/* =========================================================
   TELEGRAM IMPORT
========================================================= */

const addTelegramLinkButton =
    $("#addTelegramLinkButton");

const telegramModal =
    $("#telegramModal");

const closeModalButton =
    $("#closeModal");

const telegramForm =
    $("#telegramForm");

const telegramUrl =
    $("#telegramUrl");

const urlError =
    $("#urlError");


/* =========================================================
   TELEGRAM AUTH
========================================================= */

const connectTelegramButton =
    $("#connectTelegramButton");

const telegramConnectionText =
    $("#telegramConnectionText");

const telegramConnectModal =
    $("#telegramConnectModal");

const closeTelegramConnectModalButton =
    $("#closeTelegramConnectModal");

const telegramPhoneForm =
    $("#telegramPhoneForm");

const telegramPhone =
    $("#telegramPhone");

const telegramPhoneMessage =
    $("#telegramPhoneMessage");

const sendTelegramOtpButton =
    $("#sendTelegramOtpButton");

const telegramOtpForm =
    $("#telegramOtpForm");

const telegramOtp =
    $("#telegramOtp");

const telegramOtpMessage =
    $("#telegramOtpMessage");

const verifyTelegramOtpButton =
    $("#verifyTelegramOtpButton");

const backToTelegramPhone =
    $("#backToTelegramPhone");

const telegramPasswordForm =
    $("#telegramPasswordForm");

const telegramPassword =
    $("#telegramPassword");

const telegramPasswordMessage =
    $("#telegramPasswordMessage");

const verifyTelegramPasswordButton =
    $("#verifyTelegramPasswordButton");

const telegramConnectedState =
    $("#telegramConnectedState");

const connectedTelegramName =
    $("#connectedTelegramName");

const connectedTelegramUsername =
    $("#connectedTelegramUsername");

const closeConnectedTelegramButton =
    $("#closeConnectedTelegramButton");

const disconnectTelegramButton =
    $("#disconnectTelegramButton");


/* =========================================================
   FOLDER MODAL
========================================================= */

const folderModal =
    $("#folderModal");

const closeFolderModalButton =
    $("#closeFolderModal");

const folderForm =
    $("#folderForm");

const folderName =
    $("#folderName");

const folderMessage =
    $("#folderMessage");


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    setupAuthSwitch();

    setupAuthForms();

    setupLogout();

    setupFolderEvents();

    setupFolderModal();

    setupSearch();

    setupSidebarNavigation();

    setupTelegramEvents();


    try {

        await initializeSupabase();


        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {
            throw error;
        }


        if (data?.session) {

            await handleAuthenticatedSession(
                data.session
            );

        } else {

            resetApplicationState();

            showLoginPanel();

            showAuthScreen();
        }


    } catch (error) {

        console.error(
            "Application initialization failed:",
            error
        );


        resetApplicationState();

        showLoginPanel();

        showAuthScreen();


        showGlobalError(
            error.message ||
            "Unable to initialize application."
        );
    }
}


/* =========================================================
   SUPABASE
========================================================= */

async function initializeSupabase() {

    const response =
        await fetch(
            "/api/config"
        );


    const result =
        await safeJson(
            response
        );


    if (
        !response.ok ||
        !result.success
    ) {

        throw new Error(
            result.message ||
            "Unable to load Supabase configuration."
        );
    }


    const supabaseUrl =
        result.config?.supabaseUrl;

    const supabaseKey =
        result.config?.supabasePublishableKey;


    if (
        !supabaseUrl ||
        !supabaseKey
    ) {

        throw new Error(
            "Supabase configuration is incomplete."
        );
    }


    if (
        !window.supabase?.createClient
    ) {

        throw new Error(
            "Supabase JavaScript library failed to load."
        );
    }


    supabaseClient =
        window.supabase.createClient(
            supabaseUrl,
            supabaseKey,
            {

                auth: {

                    autoRefreshToken:
                        true,

                    persistSession:
                        true,

                    detectSessionInUrl:
                        false

                }

            }
        );


    supabaseClient.auth.onAuthStateChange(
        (
            event,
            session
        ) => {

            currentSession =
                session || null;

            currentUser =
                session?.user || null;


            if (
                session?.user
            ) {

                updateUserUI(
                    session.user
                );
            }


            if (
                event ===
                "SIGNED_OUT"
            ) {

                resetApplicationState();

                showLoginPanel();

                showAuthScreen();
            }

        }
    );
}


/* =========================================================
   AUTH SWITCH
========================================================= */

function setupAuthSwitch() {

    showSignupButton?.addEventListener(
        "click",
        showSignupPanel
    );


    showLoginButton?.addEventListener(
        "click",
        showLoginPanel
    );
}


function showLoginPanel() {

    if (loginPanel) {

        loginPanel.hidden =
            false;
    }


    if (signupPanel) {

        signupPanel.hidden =
            true;
    }


    clearAuthMessages();


    setTimeout(
        () =>
            loginEmail?.focus(),
        50
    );
}


function showSignupPanel() {

    if (loginPanel) {

        loginPanel.hidden =
            true;
    }


    if (signupPanel) {

        signupPanel.hidden =
            false;
    }


    clearAuthMessages();


    setTimeout(
        () =>
            signupEmail?.focus(),
        50
    );
}


/* =========================================================
   AUTH FORMS
========================================================= */

function setupAuthForms() {

    loginForm?.addEventListener(
        "submit",
        handleLogin
    );


    signupForm?.addEventListener(
        "submit",
        handleSignup
    );
}


/* =========================================================
   LOGIN
========================================================= */

async function handleLogin(
    event
) {

    event.preventDefault();

    clearAuthMessages();


    const email =
        loginEmail?.value.trim();

    const password =
        loginPassword?.value;


    if (
        !email ||
        !password
    ) {

        showLoginMessage(
            "Please enter your email and password.",
            "error"
        );

        return;
    }


    const button =
        loginForm?.querySelector(
            "button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Logging in..."
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signInWithPassword(
                {
                    email,
                    password
                }
            );


        if (error) {
            throw error;
        }


        if (!data?.session) {

            throw new Error(
                "Login succeeded but no active session was created."
            );
        }


        await handleAuthenticatedSession(
            data.session
        );


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        showLoginMessage(
            getAuthErrorMessage(error),
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Login"
        );
    }
}


/* =========================================================
   SIGNUP
========================================================= */

async function handleSignup(
    event
) {

    event.preventDefault();

    clearAuthMessages();


    const email =
        signupEmail?.value.trim();

    const password =
        signupPassword?.value;


    if (
        !email ||
        !password
    ) {

        showSignupMessage(
            "Please enter your email and password.",
            "error"
        );

        return;
    }


    if (
        password.length < 6
    ) {

        showSignupMessage(
            "Password must be at least 6 characters.",
            "error"
        );

        return;
    }


    const button =
        signupForm?.querySelector(
            "button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Creating account..."
    );


    try {

        const {
            data,
            error
        } =
            await supabaseClient.auth.signUp(
                {
                    email,
                    password
                }
            );


        if (error) {
            throw error;
        }


        if (!data?.session) {

            showSignupMessage(
                "Account created. Please confirm your email, then log in.",
                "success"
            );


            signupForm?.reset();

            return;
        }


        await handleAuthenticatedSession(
            data.session
        );


    } catch (error) {

        console.error(
            "Signup error:",
            error
        );


        showSignupMessage(
            getAuthErrorMessage(error),
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Create Account"
        );
    }
}


/* =========================================================
   AUTHENTICATED SESSION
========================================================= */

async function handleAuthenticatedSession(
    session
) {

    if (!session?.user) {

        throw new Error(
            "Invalid authentication session."
        );
    }


    currentSession =
        session;

    currentUser =
        session.user;


    updateUserUI(
        currentUser
    );


    hideAuthScreen();

    showApp();


    try {

        await loadUserData();

    } catch (error) {

        console.error(
            "User data loading failed:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to load your drive."
        );
    }


    /*
        Telegram is optional.
        Drive must continue working
        even if Telegram account loading fails.
    */

    try {

        await loadTelegramAccount();

    } catch (error) {

        console.error(
            "Telegram account loading failed:",
            error
        );
    }
}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI(
    user
) {

    if (!sidebarUserEmail) {
        return;
    }


    sidebarUserEmail.textContent =
        user?.email ||
        "Account";
}


/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

    logoutButton?.addEventListener(
        "click",
        logout
    );
}


async function logout() {

    try {

        if (supabaseClient) {

            const {
                error
            } =
                await supabaseClient.auth.signOut();


            if (error) {
                throw error;
            }
        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );


        showGlobalError(
            "Unable to logout completely."
        );
    }


    resetApplicationState();

    showLoginPanel();

    showAuthScreen();
}


/* =========================================================
   RESET STATE
========================================================= */

function resetApplicationState() {

    currentSession =
        null;

    currentUser =
        null;

    currentFolderId =
        null;

    telegramAuthId =
        null;


    folders =
        [];

    files =
        [];


    storageInfo = {

        used:
            0,

        total:
            0

    };


    if (folderGrid) {

        folderGrid.innerHTML =
            "";
    }


    if (fileGrid) {

        fileGrid.innerHTML =
            "";
    }


    updateDriveTitle(
        "My Drive"
    );


    updateStorageUI();
}


/* =========================================================
   USER DATA
========================================================= */

async function loadUserData() {

    const tasks = [

        loadCurrentUser(),

        loadFolders(),

        loadFiles(),

        loadStorage()

    ];


    const results =
        await Promise.allSettled(
            tasks
        );


    const foldersFailed =
        results[1]?.status ===
        "rejected";

    const filesFailed =
        results[2]?.status ===
        "rejected";


    /*
        Storage is optional.

        Only fail the whole drive when both
        folders and files failed.
    */

    results.forEach(
        result => {

            if (
                result.status ===
                "rejected"
            ) {

                console.error(
                    "User data task failed:",
                    result.reason
                );
            }

        }
    );


    if (
        foldersFailed &&
        filesFailed
    ) {

        throw (
            results[1].reason ||
            results[2].reason
        );
    }
}


/* =========================================================
   CURRENT USER
========================================================= */

async function loadCurrentUser() {

    try {

        const result =
            await apiRequest(
                "/api/me"
            );


        if (
            result.user
        ) {

            currentUser =
                result.user;


            updateUserUI(
                result.user
            );
        }

    } catch (error) {

        if (
            error.status !==
            404
        ) {

            console.error(
                "Unable to load current user:",
                error
            );
        }
    }
}


/* =========================================================
   STORAGE
========================================================= */

async function loadStorage() {

    try {

        const result =
            await apiRequest(
                "/api/storage"
            );


        storageInfo =
            normalizeStorageResult(
                result
            );


        updateStorageUI();


        return storageInfo;

    } catch (error) {

        /*
            Storage endpoint is optional.
        */

        updateStorageFromFiles();


        if (
            error.status !==
            404
        ) {

            console.error(
                "Storage loading failed:",
                error
            );
        }


        return storageInfo;
    }
}


function normalizeStorageResult(
    result
) {

    const source =
        result?.storage ||
        result?.data ||
        result ||
        {};


    const used =
        Number(
            source.used ??
            source.usedBytes ??
            source.storageUsed ??
            0
        ) || 0;


    const total =
        Number(
            source.total ??
            source.totalBytes ??
            source.storageLimit ??
            0
        ) || 0;


    return {

        used,

        total

    };
}


function updateStorageUI() {

    const used =
        Number(
            storageInfo.used
        ) || 0;


    const total =
        Number(
            storageInfo.total
        ) || 0;


    const percentage =
        total > 0
            ? Math.min(
                100,
                (used / total) * 100
            )
            : 0;


    const usedElements = [

        $("#storageUsed"),

        $("#storageUsedText"),

        $("#storageText"),

        $("[data-storage-used]")

    ].filter(Boolean);


    const totalElements = [

        $("#storageTotal"),

        $("[data-storage-total]")

    ].filter(Boolean);


    const bars = [

        $("#storageBar"),

        $("#storageProgress"),

        $("[data-storage-progress]")

    ].filter(Boolean);


    const usedText =
        formatBytes(
            used
        );


    const totalText =
        total > 0
            ? formatBytes(total)
            : "Unlimited";


    usedElements.forEach(
        element => {

            element.textContent =
                total > 0
                    ? `${usedText} of ${totalText}`
                    : usedText;
        }
    );


    totalElements.forEach(
        element => {

            element.textContent =
                totalText;
        }
    );


    bars.forEach(
        element => {

            element.style.width =
                `${percentage}%`;


            element.setAttribute(
                "aria-valuenow",
                String(
                    Math.round(
                        percentage
                    )
                )
            );
        }
    );
}


function updateStorageFromFiles() {

    const used =
        files.reduce(
            (
                total,
                file
            ) => {

                return (
                    total +
                    (
                        Number(
                            file?.size
                        ) || 0
                    )
                );

            },
            0
        );


    storageInfo.used =
        used;


    updateStorageUI();
}


/* =========================================================
   FOLDERS
========================================================= */

async function loadFolders() {

    const result =
        await apiRequest(
            "/api/folders"
        );


    folders =
        Array.isArray(
            result.folders
        )
            ? result.folders
            : [];


    renderFolders();
}


function renderFolders() {

    if (!folderGrid) {
        return;
    }


    folderGrid.innerHTML =
        "";


    const visibleFolders =
        folders.filter(
            folder => {

                if (
                    currentFolderId ===
                    null
                ) {

                    return (
                        folder.parent_id ===
                        null ||
                        folder.parent_id ===
                        undefined
                    );
                }


                return (
                    String(
                        folder.parent_id
                    ) ===
                    String(
                        currentFolderId
                    )
                );

            }
        );


    if (
        !visibleFolders.length
    ) {

        folderGrid.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📁
                </div>

                <h3>
                    No folders yet
                </h3>

                <p>
                    Create a folder to organize your files.
                </p>

            </div>

        `;

        return;
    }


    visibleFolders.forEach(
        folder => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "folder";


            card.dataset.folderId =
                folder.id;


            card.innerHTML = `

                <div class="folder-main">

                    <span class="folder-icon">
                        📁
                    </span>

                    <span class="folder-name">
                        ${escapeHtml(
                            folder.name
                        )}
                    </span>

                </div>

                <div class="folder-actions">

                    <button
                        type="button"
                        class="folder-action rename-folder"
                        data-id="${escapeHtml(
                            folder.id
                        )}"
                        title="Rename folder"
                    >
                        ✏️
                    </button>

                    <button
                        type="button"
                        class="folder-action delete-folder"
                        data-id="${escapeHtml(
                            folder.id
                        )}"
                        title="Delete folder"
                    >
                        🗑️
                    </button>

                </div>

            `;


            card.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            ".folder-action"
                        )
                    ) {

                        return;
                    }


                    openFolder(
                        folder.id
                    );
                }
            );


            folderGrid.appendChild(
                card
            );
        }
    );


    folderGrid
        .querySelectorAll(
            ".rename-folder"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        renameFolder(
                            button.dataset.id
                        );
                    }
                );
            }
        );


    folderGrid
        .querySelectorAll(
            ".delete-folder"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    event => {

                        event.stopPropagation();

                        deleteFolder(
                            button.dataset.id
                        );
                    }
                );
            }
        );
}


/* =========================================================
   OPEN FOLDER
========================================================= */

async function openFolder(
    folderId
) {

    currentFolderId =
        folderId;


    const folder =
        folders.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    folderId
                )
        );


    updateDriveTitle(
        folder?.name ||
        "Folder"
    );


    renderFolders();


    try {

        await loadFiles();

    } catch (error) {

        console.error(
            "Unable to load folder files:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to load folder."
        );
    }
}


/* =========================================================
   ROOT DRIVE
========================================================= */

async function openRootDrive() {

    currentFolderId =
        null;


    updateDriveTitle(
        "My Drive"
    );


    renderFolders();


    await loadFiles();
}


/* =========================================================
   CREATE FOLDER
========================================================= */

async function createFolder() {

    const name =
        folderName?.value.trim();


    if (!name) {

        setFolderMessage(
            "Please enter a folder name.",
            "error"
        );

        return;
    }


    const button =
        folderForm?.querySelector(
            "button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Creating..."
    );


    try {

        await apiRequest(
            "/api/folders",
            {

                method:
                    "POST",

                body:
                    JSON.stringify(
                        {

                            name,

                            parentId:
                                currentFolderId

                        }
                    )

            }
        );


        closeFolderModal();


        await loadFolders();

        await loadFiles();

        await loadStorage();


        showGlobalSuccess(
            "Folder created successfully."
        );


    } catch (error) {

        console.error(
            "Create folder error:",
            error
        );


        setFolderMessage(
            error.message ||
            "Unable to create folder.",
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Create Folder"
        );
    }
}


/* =========================================================
   RENAME FOLDER
========================================================= */

async function renameFolder(
    folderId
) {

    const folder =
        folders.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    folderId
                )
        );


    if (!folder) {
        return;
    }


    const name =
        window.prompt(
            "Enter new folder name:",
            folder.name
        );


    if (
        name ===
        null
    ) {

        return;
    }


    const cleanName =
        name.trim();


    if (!cleanName) {

        showGlobalError(
            "Folder name cannot be empty."
        );

        return;
    }


    try {

        await apiRequest(
            `/api/folders/${encodeURIComponent(
                folderId
            )}`,
            {

                method:
                    "PATCH",

                body:
                    JSON.stringify(
                        {
                            name:
                                cleanName
                        }
                    )

            }
        );


        await loadFolders();


        showGlobalSuccess(
            "Folder renamed successfully."
        );


    } catch (error) {

        console.error(
            "Rename folder error:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to rename folder."
        );
    }
}


/* =========================================================
   DELETE FOLDER
========================================================= */

async function deleteFolder(
    folderId
) {

    const folder =
        folders.find(
            item =>
                String(
                    item.id
                ) ===
                String(
                    folderId
                )
        );


    if (!folder) {
        return;
    }


    const confirmed =
        window.confirm(
            `Delete "${folder.name}"?\n\nFiles directly inside it will be moved to My Drive.`
        );


    if (!confirmed) {
        return;
    }


    try {

        await apiRequest(
            `/api/folders/${encodeURIComponent(
                folderId
            )}`,
            {

                method:
                    "DELETE"

            }
        );


        if (
            String(
                currentFolderId
            ) ===
            String(
                folderId
            )
        ) {

            await openRootDrive();

        } else {

            await loadFolders();

            await loadFiles();
        }


        await loadStorage();


        showGlobalSuccess(
            "Folder deleted successfully."
        );


    } catch (error) {

        console.error(
            "Delete folder error:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to delete folder."
        );
    }
}


/* =========================================================
   FOLDER EVENTS
========================================================= */

function setupFolderEvents() {

    newButton?.addEventListener(
        "click",
        openFolderModal
    );


    createFolderButton?.addEventListener(
        "click",
        openFolderModal
    );
}


/* =========================================================
   FOLDER MODAL
========================================================= */

function setupFolderModal() {

    folderForm?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            createFolder();
        }
    );


    closeFolderModalButton?.addEventListener(
        "click",
        closeFolderModal
    );


    folderModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                folderModal
            ) {

                closeFolderModal();
            }
        }
    );
}


function openFolderModal() {

    folderModal?.classList.add(
        "show"
    );


    clearFolderMessage();


    if (folderName) {

        folderName.value =
            "";


        setTimeout(
            () =>
                folderName.focus(),
            50
        );
    }
}


function closeFolderModal() {

    folderModal?.classList.remove(
        "show"
    );


    folderForm?.reset();


    clearFolderMessage();
}


function setFolderMessage(
    message,
    type
) {

    if (!folderMessage) {
        return;
    }


    folderMessage.textContent =
        message;


    folderMessage.className =
        `auth-message ${type}`;
}


function clearFolderMessage() {

    if (!folderMessage) {
        return;
    }


    folderMessage.textContent =
        "";


    folderMessage.className =
        "auth-message";
}


/* =========================================================
   FILES
========================================================= */

async function loadFiles() {

    const params =
        new URLSearchParams();


    params.set(
        "folderId",
        currentFolderId ||
        "root"
    );


    const search =
        searchInput?.value.trim();


    if (search) {

        params.set(
            "search",
            search
        );
    }


    const result =
        await apiRequest(
            `/api/files?${params.toString()}`
        );


    files =
        Array.isArray(
            result.files
        )
            ? result.files
            : [];


    renderFiles();


    if (
        !storageInfo.total
    ) {

        updateStorageFromFiles();
    }
}


/* =========================================================
   RENDER FILES
========================================================= */

function renderFiles() {

    if (!fileGrid) {

        console.error(
            "fileGrid not found"
        );

        return;
    }


    fileGrid.innerHTML =
        "";


    if (
        !files.length
    ) {

        fileGrid.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📄
                </div>

                <h3>
                    No files here
                </h3>

                <p>
                    Imported Telegram files will appear here.
                </p>

            </div>

        `;

        return;
    }


    files.forEach(
        file => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "file-card";


            card.dataset.fileId =
                file.id ||
                "";


            card.innerHTML = `

                <div class="file-icon">
                    ${getFileIcon(
                        file
                    )}
                </div>

                <h3>
                    ${escapeHtml(
                        file.name ||
                        "Unnamed file"
                    )}
                </h3>

                <p>
                    ${formatBytes(
                        file.size
                    )}
                </p>

            `;


            /*
                Only one activation path for mouse/touch.

                The previous pointerdown diagnostic
                listener was unnecessary and could make
                interaction confusing.
            */

            card.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    openFileViewer(
                        file
                    );
                }
            );


            card.setAttribute(
                "role",
                "button"
            );


            card.setAttribute(
                "tabindex",
                "0"
            );


            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter" ||
                        event.key ===
                        " "
                    ) {

                        event.preventDefault();

                        openFileViewer(
                            file
                        );
                    }
                }
            );


            fileGrid.appendChild(
                card
            );
        }
    );
}


/* =========================================================
   SEARCH
========================================================= */

function setupSearch() {

    if (!searchInput) {
        return;
    }


    let timer =
        null;


    searchInput.addEventListener(
        "input",
        () => {

            clearTimeout(
                timer
            );


            timer =
                setTimeout(
                    async () => {

                        try {

                            await loadFiles();

                        } catch (error) {

                            console.error(
                                "Search error:",
                                error
                            );
                        }

                    },
                    300
                );
        }
    );
}


/* =========================================================
   SIDEBAR NAVIGATION
========================================================= */

function setupSidebarNavigation() {

    $$(".sidebar-nav a")
        .forEach(
            link => {

                link.addEventListener(
                    "click",
                    async event => {

                        event.preventDefault();


                        $$(".sidebar-nav a")
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );


                        link.classList.add(
                            "active"
                        );


                        const view =
                            link.dataset.view;


                        if (
                            view ===
                            "drive"
                        ) {

                            try {

                                await openRootDrive();

                            } catch (error) {

                                showGlobalError(
                                    error.message ||
                                    "Unable to open My Drive."
                                );
                            }

                            return;
                        }


                        showGlobalError(
                            `${capitalize(
                                view
                            )} view is coming next.`
                        );
                    }
                );
            }
        );
}


/* =========================================================
   TELEGRAM EVENTS
========================================================= */

function setupTelegramEvents() {

    connectTelegramButton?.addEventListener(
        "click",
        openTelegramConnectModal
    );


    closeTelegramConnectModalButton?.addEventListener(
        "click",
        closeTelegramConnectModal
    );


    telegramConnectModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                telegramConnectModal
            ) {

                closeTelegramConnectModal();
            }
        }
    );


    telegramPhoneForm?.addEventListener(
        "submit",
        handleTelegramPhone
    );


    telegramOtpForm?.addEventListener(
        "submit",
        handleTelegramOtp
    );


    telegramPasswordForm?.addEventListener(
        "submit",
        handleTelegramPassword
    );


    backToTelegramPhone?.addEventListener(
        "click",
        showTelegramPhoneStep
    );


    closeConnectedTelegramButton?.addEventListener(
        "click",
        closeTelegramConnectModal
    );


    disconnectTelegramButton?.addEventListener(
        "click",
        disconnectTelegram
    );


    addTelegramLinkButton?.addEventListener(
        "click",
        openTelegramImportModal
    );


    closeModalButton?.addEventListener(
        "click",
        closeTelegramImportModal
    );


    telegramModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                telegramModal
            ) {

                closeTelegramImportModal();
            }
        }
    );


    telegramForm?.addEventListener(
        "submit",
        handleTelegramImport
    );
}


/* =========================================================
   TELEGRAM ACCOUNT
========================================================= */

async function loadTelegramAccount() {

    try {

        const result =
            await apiRequest(
                "/api/telegram/account"
            );


        if (
            result.connected &&
            result.account
        ) {

            showTelegramConnectedState(
                result.account
            );


            setTelegramConnectionButton(
                true
            );

        } else {

            setTelegramConnectionButton(
                false
            );
        }

    } catch (error) {

        if (
            error.status !==
            404
        ) {

            console.error(
                "Telegram account status error:",
                error
            );
        }


        setTelegramConnectionButton(
            false
        );
    }
}


/* =========================================================
   TELEGRAM CONNECT MODAL
========================================================= */

function openTelegramConnectModal() {

    telegramConnectModal?.classList.add(
        "show"
    );


    if (
        telegramConnectionText?.dataset.connected ===
        "true"
    ) {

        showTelegramConnectedState();

    } else {

        resetTelegramAuthFlow();
    }
}


function closeTelegramConnectModal() {

    telegramConnectModal?.classList.remove(
        "show"
    );
}


/* =========================================================
   TELEGRAM AUTH RESET
========================================================= */

function resetTelegramAuthFlow() {

    telegramAuthId =
        null;


    if (telegramPhoneForm) {

        telegramPhoneForm.hidden =
            false;
    }


    if (telegramOtpForm) {

        telegramOtpForm.hidden =
            true;
    }


    if (telegramPasswordForm) {

        telegramPasswordForm.hidden =
            true;
    }


    if (telegramConnectedState) {

        telegramConnectedState.hidden =
            true;
    }


    clearTelegramMessages();


    setTimeout(
        () =>
            telegramPhone?.focus(),
        50
    );
}


/* =========================================================
   TELEGRAM PHONE
========================================================= */

async function handleTelegramPhone(
    event
) {

    event.preventDefault();

    clearTelegramMessages();


    const phoneNumber =
        telegramPhone?.value.trim();


    if (!phoneNumber) {

        setTelegramMessage(
            telegramPhoneMessage,
            "Please enter your Telegram phone number.",
            "error"
        );

        return;
    }


    const button =
        sendTelegramOtpButton;


    setButtonLoading(
        button,
        true,
        "Sending OTP..."
    );


    try {

        const result =
            await apiRequest(
                "/api/telegram/auth/start",
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify(
                            {
                                phoneNumber
                            }
                        )

                }
            );


        if (
            !result.authId
        ) {

            throw new Error(
                "Telegram authentication session was not created."
            );
        }


        telegramAuthId =
            result.authId;


        showTelegramOtpStep();


        setTelegramMessage(
            telegramOtpMessage,
            result.message ||
            "Telegram verification code sent.",
            "success"
        );


    } catch (error) {

        console.error(
            "Telegram phone authentication error:",
            error
        );


        setTelegramMessage(
            telegramPhoneMessage,
            error.message ||
            "Unable to send Telegram OTP.",
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Send OTP"
        );
    }
}


/* =========================================================
   TELEGRAM OTP
========================================================= */

async function handleTelegramOtp(
    event
) {

    event.preventDefault();

    clearTelegramMessages();


    if (
        !telegramAuthId
    ) {

        setTelegramMessage(
            telegramOtpMessage,
            "Telegram authentication session is missing. Please start again.",
            "error"
        );


        showTelegramPhoneStep();

        return;
    }


    const phoneCode =
        telegramOtp?.value.trim();


    if (!phoneCode) {

        setTelegramMessage(
            telegramOtpMessage,
            "Please enter the Telegram verification code.",
            "error"
        );

        return;
    }


    const button =
        verifyTelegramOtpButton;


    setButtonLoading(
        button,
        true,
        "Verifying..."
    );


    try {

        const result =
            await apiRequest(
                "/api/telegram/auth/verify",
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify(
                            {

                                authId:
                                    telegramAuthId,

                                phoneCode

                            }
                        )

                }
            );


        if (
            result.requiresPassword
        ) {

            showTelegramPasswordStep();

            return;
        }


        if (
            result.connected
        ) {

            showTelegramConnectedState(
                result.account
            );


            setTelegramConnectionButton(
                true
            );


            telegramAuthId =
                null;


            showGlobalSuccess(
                "Telegram connected successfully."
            );


            return;
        }


        throw new Error(
            "Telegram authentication did not complete."
        );


    } catch (error) {

        console.error(
            "Telegram OTP verification error:",
            error
        );


        setTelegramMessage(
            telegramOtpMessage,
            error.message ||
            "Unable to verify Telegram OTP.",
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Verify OTP"
        );
    }
}


/* =========================================================
   TELEGRAM 2FA
========================================================= */

async function handleTelegramPassword(
    event
) {

    event.preventDefault();

    clearTelegramMessages();


    if (
        !telegramAuthId
    ) {

        setTelegramMessage(
            telegramPasswordMessage,
            "Telegram authentication session is missing. Please start again.",
            "error"
        );


        showTelegramPhoneStep();

        return;
    }


    const password =
        telegramPassword?.value;


    if (!password) {

        setTelegramMessage(
            telegramPasswordMessage,
            "Please enter your Telegram 2FA password.",
            "error"
        );

        return;
    }


    const button =
        verifyTelegramPasswordButton;


    setButtonLoading(
        button,
        true,
        "Connecting..."
    );


    try {

        const result =
            await apiRequest(
                "/api/telegram/auth/password",
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify(
                            {

                                authId:
                                    telegramAuthId,

                                password

                            }
                        )

                }
            );


        if (
            !result.connected
        ) {

            throw new Error(
                "Telegram connection was not completed."
            );
        }


        showTelegramConnectedState(
            result.account
        );


        setTelegramConnectionButton(
            true
        );


        telegramAuthId =
            null;


        showGlobalSuccess(
            "Telegram connected successfully."
        );


    } catch (error) {

        console.error(
            "Telegram 2FA error:",
            error
        );


        setTelegramMessage(
            telegramPasswordMessage,
            error.message ||
            "Unable to verify Telegram 2FA password.",
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Connect Telegram"
        );
    }
}


/* =========================================================
   TELEGRAM STEPS
========================================================= */

function showTelegramPhoneStep() {

    if (telegramPhoneForm) {

        telegramPhoneForm.hidden =
            false;
    }


    if (telegramOtpForm) {

        telegramOtpForm.hidden =
            true;
    }


    if (telegramPasswordForm) {

        telegramPasswordForm.hidden =
            true;
    }


    if (telegramConnectedState) {

        telegramConnectedState.hidden =
            true;
    }


    clearTelegramMessages();


    setTimeout(
        () =>
            telegramPhone?.focus(),
        50
    );
}


function showTelegramOtpStep() {

    if (telegramPhoneForm) {

        telegramPhoneForm.hidden =
            true;
    }


    if (telegramOtpForm) {

        telegramOtpForm.hidden =
            false;
    }


    if (telegramPasswordForm) {

        telegramPasswordForm.hidden =
            true;
    }


    if (telegramConnectedState) {

        telegramConnectedState.hidden =
            true;
    }


    clearTelegramMessages();


    setTimeout(
        () =>
            telegramOtp?.focus(),
        50
    );
}


function showTelegramPasswordStep() {

    if (telegramPhoneForm) {

        telegramPhoneForm.hidden =
            true;
    }


    if (telegramOtpForm) {

        telegramOtpForm.hidden =
            true;
    }


    if (telegramPasswordForm) {

        telegramPasswordForm.hidden =
            false;
    }


    if (telegramConnectedState) {

        telegramConnectedState.hidden =
            true;
    }


    clearTelegramMessages();


    setTimeout(
        () =>
            telegramPassword?.focus(),
        50
    );
}


function showTelegramConnectedState(
    account = null
) {

    if (telegramPhoneForm) {

        telegramPhoneForm.hidden =
            true;
    }


    if (telegramOtpForm) {

        telegramOtpForm.hidden =
            true;
    }


    if (telegramPasswordForm) {

        telegramPasswordForm.hidden =
            true;
    }


    if (telegramConnectedState) {

        telegramConnectedState.hidden =
            false;
    }


    if (!account) {
        return;
    }


    const name =
        account.username
            ? `@${account.username}`
            : (
                account.first_name ||
                account.firstName ||
                "Telegram Account"
            );


    const username =
        account.username
            ? `@${account.username}`
            : (
                account.phone ||
                "Connected"
            );


    if (
        connectedTelegramName
    ) {

        connectedTelegramName.textContent =
            name;
    }


    if (
        connectedTelegramUsername
    ) {

        connectedTelegramUsername.textContent =
            username;
    }
}


function setTelegramConnectionButton(
    connected
) {

    if (!telegramConnectionText) {
        return;
    }


    telegramConnectionText.dataset.connected =
        connected
            ? "true"
            : "false";


    telegramConnectionText.textContent =
        connected
            ? "Telegram Connected"
            : "Connect Telegram";
}


/* =========================================================
   TELEGRAM MESSAGES
========================================================= */

function clearTelegramMessages() {

    [

        telegramPhoneMessage,

        telegramOtpMessage,

        telegramPasswordMessage

    ].forEach(
        element => {

            if (!element) {
                return;
            }


            element.textContent =
                "";


            element.className =
                "auth-message";
        }
    );
}


function setTelegramMessage(
    element,
    message,
    type
) {

    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.className =
        `auth-message ${type}`;
}


/* =========================================================
   DISCONNECT TELEGRAM
========================================================= */

async function disconnectTelegram() {

    const confirmed =
        window.confirm(
            "Disconnect your Telegram account from Telegram Drive?"
        );


    if (!confirmed) {
        return;
    }


    const button =
        disconnectTelegramButton;


    setButtonLoading(
        button,
        true,
        "Disconnecting..."
    );


    try {

        await apiRequest(
            "/api/telegram/account",
            {

                method:
                    "DELETE"

            }
        );


        setTelegramConnectionButton(
            false
        );


        resetTelegramAuthFlow();


        closeTelegramConnectModal();


        showGlobalSuccess(
            "Telegram account disconnected."
        );


    } catch (error) {

        console.error(
            "Telegram disconnect error:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to disconnect Telegram."
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Disconnect Telegram"
        );
    }
}


/* =========================================================
   TELEGRAM IMPORT MODAL
========================================================= */

function openTelegramImportModal() {

    telegramModal?.classList.add(
        "show"
    );


    setTimeout(
        () =>
            telegramUrl?.focus(),
        50
    );
}


function closeTelegramImportModal() {

    telegramModal?.classList.remove(
        "show"
    );


    telegramForm?.reset();


    if (urlError) {

        urlError.textContent =
            "";
    }
}


/* =========================================================
   TELEGRAM IMPORT
========================================================= */

async function handleTelegramImport(
    event
) {

    event.preventDefault();


    if (urlError) {

        urlError.textContent =
            "";
    }


    const url =
        telegramUrl?.value.trim();


    if (
        !isTelegramUrl(
            url
        )
    ) {

        if (urlError) {

            urlError.textContent =
                "Please enter a valid Telegram post URL.";
        }

        return;
    }


    const button =
        telegramForm?.querySelector(
            "button[type='submit']"
        );


    setButtonLoading(
        button,
        true,
        "Adding..."
    );


    try {

        const result =
            await apiRequest(
                "/api/telegram/import",
                {

                    method:
                        "POST",

                    body:
                        JSON.stringify(
                            {

                                url,

                                folderId:
                                    currentFolderId

                            }
                        )

                }
            );


        closeTelegramImportModal();


        showGlobalSuccess(
            result.message ||
            "Telegram file added successfully."
        );


        await loadFiles();

        await loadStorage();


    } catch (error) {

        console.error(
            "Telegram import error:",
            error
        );


        if (urlError) {

            urlError.textContent =
                error.message ||
                "Unable to add Telegram link.";
        }


    } finally {

        setButtonLoading(
            button,
            false,
            "Add to My Drive"
        );
    }
}


/* =========================================================
   TELEGRAM URL VALIDATION
========================================================= */

function isTelegramUrl(
    url
) {

    if (
        typeof url !==
        "string" ||
        !url.trim()
    ) {

        return false;
    }


    try {

        const parsed =
            new URL(
                url
            );


        const hostname =
            parsed.hostname.toLowerCase();


        if (
            hostname !==
            "t.me" &&
            hostname !==
            "telegram.me"
        ) {

            return false;
        }


        const parts =
            parsed.pathname
                .split("/")
                .filter(Boolean);


        if (
            parts.length <
            2
        ) {

            return false;
        }


        /*
            Private Telegram link:

            t.me/c/chat/message
        */

        if (
            parts[0] ===
            "c"
        ) {

            if (
                parts.length <
                3
            ) {

                return false;
            }


            const chatId =
                parts[1];


            const messageId =
                Number(
                    parts[2]
                );


            return (

                /^\d+$/.test(
                    chatId
                ) &&

                Number.isInteger(
                    messageId
                ) &&

                messageId >
                    0

            );
        }


        /*
            Public Telegram link:

            t.me/channel/message
        */

        const messageId =
            Number(
                parts[1]
            );


        return (

            Number.isInteger(
                messageId
            ) &&

            messageId >
                0

        );

    } catch {

        return false;
    }
}


/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    if (!supabaseClient) {

        throw new Error(
            "Supabase has not been initialized."
        );
    }


    const {
        data,
        error
    } =
        await supabaseClient.auth.getSession();


    if (error) {
        throw error;
    }


    const session =
        data?.session;


    if (
        !session?.access_token
    ) {

        showAuthScreen();


        const authError =
            new Error(
                "Your session has expired. Please log in again."
            );


        authError.status =
            401;


        throw authError;
    }


    currentSession =
        session;


    currentUser =
        session.user;


    const headers = {

        ...(options.headers || {}),

        Authorization:
            `Bearer ${session.access_token}`,

        "Content-Type":
            "application/json"

    };


    const response =
        await fetch(
            endpoint,
            {

                ...options,

                headers

            }
        );


    const result =
        await safeJson(
            response
        );


    if (
        response.status ===
        401
    ) {

        try {

            await supabaseClient.auth.signOut();

        } catch (signOutError) {

            console.error(
                "Automatic sign out failed:",
                signOutError
            );
        }


        const authError =
            new Error(
                "Your session has expired. Please log in again."
            );


        authError.status =
            401;


        throw authError;
    }


    if (
        !response.ok
    ) {

        const requestError =
            new Error(
                result.message ||
                `Request failed with status ${response.status}.`
            );


        requestError.status =
            response.status;


        requestError.data =
            result;


        throw requestError;
    }


    return result;
}


/* =========================================================
   SAFE JSON
========================================================= */

async function safeJson(
    response
) {

    const text =
        await response.text();


    if (!text) {
        return {};
    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return {

            success:
                false,

            message:
                "Server returned an invalid response."

        };
    }
}


/* =========================================================
   AUTH SCREEN
========================================================= */

function showAuthScreen() {

    if (authScreen) {

        authScreen.style.display =
            "flex";
    }


    if (app) {

        app.style.display =
            "none";
    }
}


function hideAuthScreen() {

    if (authScreen) {

        authScreen.style.display =
            "none";
    }
}


function showApp() {

    if (app) {

        app.style.display =
            "flex";
    }
}


/* =========================================================
   AUTH MESSAGES
========================================================= */

function clearAuthMessages() {

    if (loginMessage) {

        loginMessage.textContent =
            "";

        loginMessage.className =
            "auth-message";
    }


    if (signupMessage) {

        signupMessage.textContent =
            "";

        signupMessage.className =
            "auth-message";
    }
}


function showLoginMessage(
    message,
    type = "error"
) {

    if (!loginMessage) {
        return;
    }


    loginMessage.textContent =
        message;


    loginMessage.className =
        `auth-message ${type}`;
}


function showSignupMessage(
    message,
    type = "error"
) {

    if (!signupMessage) {
        return;
    }


    signupMessage.textContent =
        message;


    signupMessage.className =
        `auth-message ${type}`;
}


/* =========================================================
   AUTH ERROR
========================================================= */

function getAuthErrorMessage(
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
            "invalid login credentials"
        )
    ) {

        return (
            "Incorrect email or password."
        );
    }


    if (
        lower.includes(
            "email not confirmed"
        )
    ) {

        return (
            "Please confirm your email before logging in."
        );
    }


    if (
        lower.includes(
            "user already registered"
        )
    ) {

        return (
            "This email is already registered. Please log in."
        );
    }


    if (
        lower.includes(
            "rate limit"
        ) ||
        lower.includes(
            "email rate limit"
        )
    ) {

        return (
            "Supabase email rate limit reached. Please wait before requesting another confirmation email."
        );
    }


    if (
        lower.includes(
            "password should be at least"
        )
    ) {

        return (
            "Password must be at least 6 characters."
        );
    }


    if (
        lower.includes(
            "signup is disabled"
        )
    ) {

        return (
            "New account registration is currently disabled in Supabase."
        );
    }


    return (
        message ||
        "Authentication failed."
    );
}


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
    button,
    loading,
    text
) {

    if (!button) {
        return;
    }


    if (loading) {

        if (
            !button.dataset.originalText
        ) {

            button.dataset.originalText =
                button.textContent.trim();
        }


        button.disabled =
            true;


        button.classList.add(
            "loading"
        );


        button.textContent =
            text;


    } else {

        button.disabled =
            false;


        button.classList.remove(
            "loading"
        );


        button.textContent =
            button.dataset.originalText ||
            text;


        delete button.dataset.originalText;
    }
}


/* =========================================================
   DRIVE TITLE
========================================================= */

function updateDriveTitle(
    title
) {

    const heading =
        $(".content-header h1");


    const breadcrumb =
        $("#breadcrumbCurrent");


    if (heading) {

        heading.textContent =
            title;
    }


    if (breadcrumb) {

        breadcrumb.textContent =
            title;
    }
}


/* =========================================================
   FILE ICON
========================================================= */

function getFileIcon(
    file
) {

    const mime =
        String(
            file?.mime_type ||
            ""
        ).toLowerCase();


    const name =
        String(
            file?.name ||
            ""
        ).toLowerCase();


    if (
        mime.startsWith(
            "video/"
        ) ||
        /\.(mp4|mkv|avi|mov|webm|m4v|3gp)$/i.test(
            name
        )
    ) {

        return "🎬";
    }


    if (
        mime.startsWith(
            "image/"
        ) ||
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
            name
        )
    ) {

        return "🖼️";
    }


    if (
        mime.includes(
            "pdf"
        ) ||
        name.endsWith(
            ".pdf"
        )
    ) {

        return "📄";
    }


    if (
        mime.startsWith(
            "audio/"
        ) ||
        /\.(mp3|wav|m4a|flac|ogg)$/i.test(
            name
        )
    ) {

        return "🎵";
    }


    if (
        /\.(zip|rar|7z|tar|gz)$/i.test(
            name
        )
    ) {

        return "🗜️";
    }


    return "📄";
}


/* =========================================================
   FORMAT BYTES
========================================================= */

function formatBytes(
    bytes
) {

    const value =
        Number(
            bytes
        ) || 0;


    if (
        value <= 0
    ) {

        return "0 B";
    }


    const units = [

        "B",

        "KB",

        "MB",

        "GB",

        "TB"

    ];


    const index =
        Math.min(

            Math.floor(
                Math.log(
                    value
                ) /
                Math.log(
                    1024
                )
            ),

            units.length -
                1

        );


    const converted =
        value /
        Math.pow(
            1024,
            index
        );


    const decimals =
        index ===
        0

            ? 0

            : converted >=
                10

                ? 0

                : 1;


    return `${converted.toFixed(
        decimals
    )} ${units[index]}`;
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   TOAST
========================================================= */

function showGlobalError(
    message
) {

    showToast(
        message,
        "error"
    );
}


function showGlobalSuccess(
    message
) {

    showToast(
        message,
        "success"
    );
}


function showToast(
    message,
    type
) {

    let container =
        $("#toastContainer");


    if (!container) {

        container =
            document.createElement(
                "div"
            );


        container.id =
            "toastContainer";


        container.className =
            "toast-container";


        document.body.appendChild(
            container
        );
    }


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.textContent =
        message;


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.style.opacity =
                "0";


            toast.style.transform =
                "translateY(10px)";


            setTimeout(
                () =>
                    toast.remove(),
                250
            );

        },
        3500
    );
}


/* =========================================================
   CAPITALIZE
========================================================= */

function capitalize(
    value
) {

    const text =
        String(
            value ||
            ""
        );


    return (

        text.charAt(
            0
        ).toUpperCase() +

        text.slice(
            1
        )

    );
}


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {

            return;
        }


        if (
            telegramModal?.classList.contains(
                "show"
            )
        ) {

            closeTelegramImportModal();
        }


        if (
            telegramConnectModal?.classList.contains(
                "show"
            )
        ) {

            closeTelegramConnectModal();
        }


        if (
            folderModal?.classList.contains(
                "show"
            )
        ) {

            closeFolderModal();
        }


        const viewer =
            document.getElementById(
                "fileViewer"
            );


        if (
            viewer?.classList.contains(
                "show"
            )
        ) {

            closeFileViewer();
        }

    }
);


/* =========================================================
   FILE VIEWER
   NATIVE STREAMING
========================================================= */

async function openFileViewer(
    file
) {

    if (
        !file ||
        !file.id
    ) {

        showGlobalError(
            "Unable to open this file."
        );

        return;
    }


    try {

        if (!supabaseClient) {

            throw new Error(
                "Supabase has not been initialized."
            );
        }


        const {
            data,
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {
            throw error;
        }


        const session =
            data?.session;


        if (
            !session?.access_token
        ) {

            showAuthScreen();


            throw new Error(
                "Your session has expired. Please log in again."
            );
        }


        /*
            IMPORTANT:

            Do NOT fetch the complete Telegram
            file into a Blob.

            The browser media element directly
            requests the backend stream.

            Browser sends HTTP Range requests
            automatically.
        */

        const streamUrl =
            `/api/files/${encodeURIComponent(
                file.id
            )}/stream` +
            `?access_token=${encodeURIComponent(
                session.access_token
            )}`;


        showFileViewerLoading(
            file
        );


        const mime =
            String(
                file.mime_type ||
                ""
            ).toLowerCase();


        const name =
            String(
                file.name ||
                ""
            ).toLowerCase();


        const isVideo =
            mime.startsWith(
                "video/"
            ) ||
            /\.(mp4|m4v|webm|mov|mkv|avi|3gp)$/i.test(
                name
            );


        const isImage =
            mime.startsWith(
                "image/"
            ) ||
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
                name
            );


        const isPdf =
            mime ===
            "application/pdf" ||
            name.endsWith(
                ".pdf"
            );


        if (isVideo) {

            showVideoViewer(
                file,
                streamUrl
            );

            return;
        }


        if (isImage) {

            showImageViewer(
                file,
                streamUrl
            );

            return;
        }


        if (isPdf) {

            showPdfViewer(
                file,
                streamUrl
            );

            return;
        }


        showGenericFileViewer(
            file,
            streamUrl
        );


    } catch (error) {

        console.error(
            "File viewer error:",
            error
        );


        closeFileViewer();


        showGlobalError(
            error.message ||
            "Unable to open this file."
        );
    }
}


/* =========================================================
   CREATE FILE VIEWER
========================================================= */

function createFileViewer() {

    let viewer =
        document.getElementById(
            "fileViewer"
        );


    if (viewer) {

        return viewer;
    }


    viewer =
        document.createElement(
            "div"
        );


    viewer.id =
        "fileViewer";


    viewer.className =
        "file-viewer";


    viewer.innerHTML = `

        <div class="file-viewer-backdrop"></div>

        <div class="file-viewer-dialog">

            <div class="file-viewer-header">

                <div class="file-viewer-title">

                    <span
                        id="fileViewerIcon"
                    >
                        🎬
                    </span>

                    <span
                        id="fileViewerName"
                    >
                        File
                    </span>

                </div>


                <button
                    type="button"
                    class="file-viewer-close"
                    id="fileViewerClose"
                    aria-label="Close"
                >
                    ×
                </button>

            </div>


            <div
                class="file-viewer-content"
                id="fileViewerContent"
            ></div>

        </div>

    `;


    document.body.appendChild(
        viewer
    );


    viewer
        .querySelector(
            "#fileViewerClose"
        )
        ?.addEventListener(
            "click",
            closeFileViewer
        );


    viewer
        .querySelector(
            ".file-viewer-backdrop"
        )
        ?.addEventListener(
            "click",
            closeFileViewer
        );


    return viewer;
}


/* =========================================================
   VIEWER LOADING
========================================================= */

function showFileViewerLoading(
    file
) {

    const viewer =
        createFileViewer();


    const name =
        viewer.querySelector(
            "#fileViewerName"
        );


    const content =
        viewer.querySelector(
            "#fileViewerContent"
        );


    if (name) {

        name.textContent =
            file.name ||
            "Telegram file";
    }


    if (content) {

        content.innerHTML = `

            <div class="file-viewer-loading">

                <div class="viewer-spinner"></div>

                <p>
                    Loading ${escapeHtml(
                        file.name ||
                        "file"
                    )}...
                </p>

            </div>

        `;
    }


    viewer.classList.add(
        "show"
    );
}


/* =========================================================
   VIDEO VIEWER
========================================================= */

function showVideoViewer(
    file,
    streamUrl
) {

    const viewer =
        createFileViewer();


    const name =
        viewer.querySelector(
            "#fileViewerName"
        );


    const content =
        viewer.querySelector(
            "#fileViewerContent"
        );


    if (name) {

        name.textContent =
            file.name ||
            "Telegram Video";
    }


    if (content) {

        content.innerHTML = `

            <div class="video-viewer-wrapper">

                <video
                    id="telegramVideoPlayer"
                    class="telegram-video-player"
                    controls
                    playsinline
                    preload="metadata"
                >
                    Your browser does not support
                    HTML5 video.
                </video>

            </div>


            <div class="video-viewer-info">

                <div>

                    <strong>
                        ${escapeHtml(
                            file.name ||
                            "Telegram Video"
                        )}
                    </strong>

                    <span>
                        ${formatBytes(
                            file.size
                        )}
                    </span>

                </div>

            </div>

        `;
    }


    viewer.classList.add(
        "show"
    );


    const video =
        viewer.querySelector(
            "#telegramVideoPlayer"
        );


    if (!video) {
        return;
    }


    /*
        IMPORTANT:

        Set src directly instead of putting the
        stream URL inside innerHTML.

        This avoids unnecessary HTML parsing
        and gives us a clean media lifecycle.
    */

    video.src =
        streamUrl;


    video.addEventListener(
        "loadedmetadata",
        () => {

            /*
                Metadata is loaded.

                Do not call play() automatically.
                Let the user/browser controls decide.
            */

        },
        {
            once:
                true
        }
    );


    video.addEventListener(
        "error",
        () => {

            /*
                Closing the viewer causes the
                video source to be cleared.

                Ignore that expected error.
            */

            if (
                !viewer.classList.contains(
                    "show"
                )
            ) {

                return;
            }


            console.error(
                "Video playback error:",
                video.error
            );


            showGlobalError(
                "Unable to stream this video. Check the server stream endpoint and HTTP Range support."
            );

        },
        {
            once:
                true
        }
    );


    /*
        Start the native media loading process.

        Browser will automatically send Range
        requests to the backend.
    */

    video.load();
}


/* =========================================================
   IMAGE VIEWER
========================================================= */

function showImageViewer(
    file,
    streamUrl
) {

    const viewer =
        createFileViewer();


    const name =
        viewer.querySelector(
            "#fileViewerName"
        );


    const content =
        viewer.querySelector(
            "#fileViewerContent"
        );


    if (name) {

        name.textContent =
            file.name ||
            "Telegram Image";
    }


    if (content) {

        content.innerHTML = `

            <div class="image-viewer-wrapper">

                <img
                    src="${escapeHtml(
                        streamUrl
                    )}"
                    alt="${escapeHtml(
                        file.name ||
                        "Telegram image"
                    )}"
                    class="telegram-image-preview"
                >

            </div>


            <div class="video-viewer-info">

                <strong>
                    ${escapeHtml(
                        file.name ||
                        "Telegram image"
                    )}
                </strong>

                <span>
                    ${formatBytes(
                        file.size
                    )}
                </span>

            </div>

        `;
    }


    viewer.classList.add(
        "show"
    );
}


/* =========================================================
   PDF VIEWER
========================================================= */

function showPdfViewer(
    file,
    streamUrl
) {

    const viewer =
        createFileViewer();


    const name =
        viewer.querySelector(
            "#fileViewerName"
        );


    const content =
        viewer.querySelector(
            "#fileViewerContent"
        );


    if (name) {

        name.textContent =
            file.name ||
            "PDF";
    }


    if (content) {

        content.innerHTML = `

            <iframe
                src="${escapeHtml(
                    streamUrl
                )}"
                class="telegram-pdf-preview"
                title="${escapeHtml(
                    file.name ||
                    "PDF"
                )}"
            ></iframe>

        `;
    }


    viewer.classList.add(
        "show"
    );
}


/* =========================================================
   GENERIC FILE VIEWER
========================================================= */

function showGenericFileViewer(
    file,
    streamUrl
) {

    const viewer =
        createFileViewer();


    const name =
        viewer.querySelector(
            "#fileViewerName"
        );


    const content =
        viewer.querySelector(
            "#fileViewerContent"
        );


    if (name) {

        name.textContent =
            file.name ||
            "Telegram file";
    }


    if (content) {

        content.innerHTML = `

            <div class="generic-file-viewer">

                <div class="generic-file-icon">

                    ${getFileIcon(
                        file
                    )}

                </div>


                <h2>

                    ${escapeHtml(
                        file.name ||
                        "Telegram file"
                    )}

                </h2>


                <p>

                    ${formatBytes(
                        file.size
                    )}

                </p>


                <a
                    class="viewer-download-button"
                    href="${escapeHtml(
                        streamUrl
                    )}"
                    download="${escapeHtml(
                        file.name ||
                        "telegram-file"
                    )}"
                >
                    Download File
                </a>

            </div>

        `;
    }


    viewer.classList.add(
        "show"
    );
}


/* =========================================================
   CLOSE FILE VIEWER
========================================================= */

function closeFileViewer() {

    const viewer =
        document.getElementById(
            "fileViewer"
        );


    if (!viewer) {
        return;
    }


    const video =
        viewer.querySelector(
            "#telegramVideoPlayer"
        );


    if (video) {

        try {

            /*
                Stop playback first.
            */

            video.pause();


            /*
                Remove source.

                This is important because otherwise
                the browser may continue making Range
                requests after the viewer closes.
            */

            video.removeAttribute(
                "src"
            );


            /*
                Clear the media resource.
            */

            video.load();

        } catch {}
    }


    viewer.classList.remove(
        "show"
    );


    const content =
        viewer.querySelector(
            "#fileViewerContent"
        );


    if (content) {

        content.innerHTML =
            "";
    }
}