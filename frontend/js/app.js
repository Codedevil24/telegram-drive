/* =========================================================
   TELEGRAM DRIVE
   FRONTEND APPLICATION
   FOLDER MANAGEMENT V2
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


/*
    Folder navigation history.

    Example:

    My Drive
      ↓
    Documents
      ↓
    Notes

    folderPath becomes:

    [
        { id: "...", name: "Documents" },
        { id: "...", name: "Notes" }
    ]
*/

let folderPath = [];


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

    /*
        Folder V2 UI is generated dynamically.

        This means index.html does not need to be
        changed just to get rename/delete/breadcrumb
        functionality working.
    */

    setupFolderNavigationUI();

    setupFolderActionModal();


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

async function handleLogin(event) {

    event.preventDefault();

    clearAuthMessages();


    const email =
        loginEmail?.value.trim();

    const password =
        loginPassword?.value;


    if (!email || !password) {

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

async function handleSignup(event) {

    event.preventDefault();

    clearAuthMessages();


    const email =
        signupEmail?.value.trim();

    const password =
        signupPassword?.value;


    if (!email || !password) {

        showSignupMessage(
            "Please enter your email and password.",
            "error"
        );

        return;
    }


    if (password.length < 6) {

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

async function handleAuthenticatedSession(session) {

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

function updateUserUI(user) {

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

    folderPath =
        [];

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


    updateBreadcrumb();

    updateFolderBackButton();

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


        if (result.user) {

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


function normalizeStorageResult(result) {

    const source =
        result?.storage ||
        result?.data ||
        result ||
        {};


    return {

        used:
            Number(
                source.used ??
                source.usedBytes ??
                source.storageUsed ??
                0
            ) || 0,

        total:
            Number(
                source.total ??
                source.totalBytes ??
                source.storageLimit ??
                0
            ) || 0

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

        $("#storageTotalText"),

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

            /*
                Preserve existing HTML layout.

                storageUsedText currently contains only
                the "0 B" value in index.html.
            */

            if (
                element.id ===
                "storageUsedText"
            ) {

                element.textContent =
                    usedText;

            } else {

                element.textContent =
                    total > 0
                        ? `${usedText} of ${totalText}`
                        : usedText;
            }
        }
    );


    totalElements.forEach(
        element => {

            if (
                element.id ===
                "storageTotal"
            ) {

                /*
                    Sidebar header currently displays
                    total capacity.
                */

                element.textContent =
                    totalText;

            } else {

                element.textContent =
                    totalText;
            }
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
   FOLDER NAVIGATION UI
========================================================= */

/*
    We generate the small navigation controls here
    instead of forcing another HTML rewrite.

    Result:

    [← Back]  Drive / Documents / Notes
*/

function setupFolderNavigationUI() {

    const breadcrumb =
        $(".breadcrumb");


    if (!breadcrumb) {
        return;
    }


    /*
        Create root breadcrumb button.
    */

    const children =
        Array.from(
            breadcrumb.children
        );


    const driveText =
        children.find(
            element =>
                element.textContent.trim() ===
                "Drive"
        );


    if (driveText) {

        driveText.classList.add(
            "breadcrumb-root"
        );


        driveText.setAttribute(
            "role",
            "button"
        );


        driveText.setAttribute(
            "tabindex",
            "0"
        );


        driveText.title =
            "Open My Drive";


        driveText.addEventListener(
            "click",
            openRootDrive
        );


        driveText.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter" ||
                    event.key ===
                    " "
                ) {

                    event.preventDefault();

                    openRootDrive();
                }
            }
        );
    }


    /*
        Add Back button before breadcrumb.
    */

    if (
        !document.getElementById(
            "folderBackButton"
        )
    ) {

        const backButton =
            document.createElement(
                "button"
            );


        backButton.type =
            "button";


        backButton.id =
            "folderBackButton";


        backButton.className =
            "folder-back-button";


        backButton.innerHTML =
            "← Back";


        backButton.title =
            "Go to parent folder";


        backButton.addEventListener(
            "click",
            goToParentFolder
        );


        breadcrumb.parentElement?.insertBefore(
            backButton,
            breadcrumb
        );
    }


    updateFolderBackButton();
}


function updateFolderBackButton() {

    const button =
        document.getElementById(
            "folderBackButton"
        );


    if (!button) {
        return;
    }


    button.disabled =
        currentFolderId ===
        null;


    button.classList.toggle(
        "disabled",
        currentFolderId ===
        null
    );
}


/* =========================================================
   FOLDER BREADCRUMB
========================================================= */

function updateBreadcrumb() {

    const breadcrumb =
        $(".breadcrumb");


    if (!breadcrumb) {
        return;
    }


    breadcrumb.innerHTML =
        "";


    /*
        Root.
    */

    const root =
        document.createElement(
            "button"
        );


    root.type =
        "button";


    root.className =
        "breadcrumb-item breadcrumb-root";


    root.textContent =
        "Drive";


    root.title =
        "Open My Drive";


    root.addEventListener(
        "click",
        openRootDrive
    );


    breadcrumb.appendChild(
        root
    );


    /*
        Separator.
    */

    appendBreadcrumbSeparator(
        breadcrumb
    );


    /*
        My Drive.
    */

    const myDrive =
        document.createElement(
            "button"
        );


    myDrive.type =
        "button";


    myDrive.className =
        "breadcrumb-item";


    myDrive.textContent =
        "My Drive";


    myDrive.addEventListener(
        "click",
        () => {

            if (
                currentFolderId ===
                null
            ) {

                return;
            }


            openRootDrive();
        }
    );


    breadcrumb.appendChild(
        myDrive
    );


    /*
        Folder levels.
    */

    folderPath.forEach(
        (
            folder,
            index
        ) => {

            appendBreadcrumbSeparator(
                breadcrumb
            );


            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "breadcrumb-item";


            button.textContent =
                folder.name;


            button.title =
                folder.name;


            button.addEventListener(
                "click",
                () => {

                    /*
                        Clicking the current folder
                        does nothing.
                    */

                    if (
                        index ===
                        folderPath.length -
                            1
                    ) {

                        return;
                    }


                    navigateToFolderPath(
                        index
                    );
                }
            );


            breadcrumb.appendChild(
                button
            );
        }
    );


    /*
        Current folder is visually represented
        by the last breadcrumb item.

        No separate span with ID is required anymore.
    */

    updateFolderBackButton();
}


function appendBreadcrumbSeparator(
    container
) {

    const separator =
        document.createElement(
            "span"
        );


    separator.className =
        "breadcrumb-separator";


    separator.setAttribute(
        "aria-hidden",
        "true"
    );


    separator.textContent =
        "/";


    container.appendChild(
        separator
    );
}


/* =========================================================
   BUILD FOLDER PATH
========================================================= */

function buildFolderPath(
    folderId
) {

    if (!folderId) {
        return [];
    }


    const path = [];

    let current =
        folders.find(
            folder =>
                String(
                    folder.id
                ) ===
                String(
                    folderId
                )
        );


    /*
        Walk upwards using parent_id.
    */

    const visited =
        new Set();


    while (current) {

        const id =
            String(
                current.id
            );


        if (
            visited.has(
                id
            )
        ) {

            break;
        }


        visited.add(
            id
        );


        path.unshift({

            id:
                current.id,

            name:
                current.name

        });


        if (
            current.parent_id ===
            null ||
            current.parent_id ===
            undefined
        ) {

            break;
        }


        current =
            folders.find(
                folder =>
                    String(
                        folder.id
                    ) ===
                    String(
                        current.parent_id
                    )
            );
    }


    return path;
}


/* =========================================================
   NAVIGATE TO FOLDER
========================================================= */

async function navigateToFolder(
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

        showGlobalError(
            "Folder not found."
        );

        return;
    }


    currentFolderId =
        folder.id;


    folderPath =
        buildFolderPath(
            folder.id
        );


    updateDriveTitle(
        folder.name
    );


    updateBreadcrumb();

    updateFolderBackButton();

    renderFolders();


    try {

        await loadFiles();

    } catch (error) {

        console.error(
            "Unable to load folder:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to load folder."
        );
    }
}


/* =========================================================
   OPEN FOLDER
========================================================= */

async function openFolder(
    folderId
) {

    await navigateToFolder(
        folderId
    );
}


/* =========================================================
   NAVIGATE BREADCRUMB PATH
========================================================= */

async function navigateToFolderPath(
    index
) {

    if (
        index < 0 ||
        index >= folderPath.length
    ) {

        return;
    }


    const target =
        folderPath[index];


    if (!target?.id) {
        return;
    }


    await navigateToFolder(
        target.id
    );
}


/* =========================================================
   GO TO PARENT
========================================================= */

async function goToParentFolder() {

    if (
        currentFolderId ===
        null
    ) {

        return;
    }


    const currentFolder =
        folders.find(
            folder =>
                String(
                    folder.id
                ) ===
                String(
                    currentFolderId
                )
        );


    if (!currentFolder) {

        await openRootDrive();

        return;
    }


    const parentId =
        currentFolder.parent_id;


    if (
        parentId ===
        null ||
        parentId ===
        undefined
    ) {

        await openRootDrive();

        return;
    }


    await navigateToFolder(
        parentId
    );
}


/* =========================================================
   ROOT DRIVE
========================================================= */

async function openRootDrive() {

    currentFolderId =
        null;


    folderPath =
        [];


    updateDriveTitle(
        "My Drive"
    );


    updateBreadcrumb();

    updateFolderBackButton();

    renderFolders();


    try {

        await loadFiles();

    } catch (error) {

        console.error(
            "Unable to open My Drive:",
            error
        );


        showGlobalError(
            error.message ||
            "Unable to open My Drive."
        );
    }
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


    /*
        If currently inside a folder, rebuild
        breadcrumb from fresh backend data.

        This prevents renamed folders from
        showing their old names.
    */

    if (currentFolderId) {

        const currentFolderExists =
            folders.some(
                folder =>
                    String(
                        folder.id
                    ) ===
                    String(
                        currentFolderId
                    )
            );


        if (
            currentFolderExists
        ) {

            folderPath =
                buildFolderPath(
                    currentFolderId
                );

        } else {

            currentFolderId =
                null;

            folderPath =
                [];
        }
    }


    updateBreadcrumb();

    updateFolderBackButton();

    renderFolders();
}


/* =========================================================
   RENDER FOLDERS
========================================================= */

function renderFolders() {

    if (!folderGrid) {
        return;
    }


    folderGrid.innerHTML =
        "";


    const search =
        searchInput?.value
            .trim()
            .toLowerCase() ||
        "";


    let visibleFolders =
        folders.filter(
            folder => {

                const sameParent =
                    currentFolderId ===
                    null

                        ? (
                            folder.parent_id ===
                            null ||
                            folder.parent_id ===
                            undefined
                        )

                        : String(
                            folder.parent_id
                        ) ===
                        String(
                            currentFolderId
                        );


                if (!sameParent) {
                    return false;
                }


                if (!search) {
                    return true;
                }


                return String(
                    folder.name ||
                    ""
                )
                    .toLowerCase()
                    .includes(
                        search
                    );
            }
        );


    /*
        Folder count.

        If a count element exists in HTML,
        update it. Otherwise create no extra UI.
    */

    updateFolderCount(
        visibleFolders.length,
        search
    );


    if (
        !visibleFolders.length
    ) {

        folderGrid.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    ${
                        search
                            ? "🔍"
                            : "📁"
                    }
                </div>

                <h3>
                    ${
                        search
                            ? "No matching folders"
                            : "No folders yet"
                    }
                </h3>

                <p>
                    ${
                        search
                            ? "Try a different folder name."
                            : "Create a folder to organize your files."
                    }
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

                <div
                    class="folder-main"
                    role="button"
                    tabindex="0"
                    title="Open ${escapeHtml(
                        folder.name
                    )}"
                >

                    <span
                        class="folder-icon"
                        aria-hidden="true"
                    >
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
                        aria-label="Rename folder"
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
                        aria-label="Delete folder"
                    >
                        🗑️
                    </button>

                </div>

            `;


            const main =
                card.querySelector(
                    ".folder-main"
                );


            main?.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    event.stopPropagation();

                    openFolder(
                        folder.id
                    );
                }
            );


            main?.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key ===
                        "Enter" ||
                        event.key ===
                        " "
                    ) {

                        event.preventDefault();

                        openFolder(
                            folder.id
                        );
                    }
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

                        event.preventDefault();

                        event.stopPropagation();

                        openRenameFolderModal(
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

                        event.preventDefault();

                        event.stopPropagation();

                        openDeleteFolderModal(
                            button.dataset.id
                        );
                    }
                );
            }
        );
}


/* =========================================================
   FOLDER COUNT
========================================================= */

function updateFolderCount(
    count,
    searching = false
) {

    const countElements =
        $$(".section-count");


    const folderSection =
        $("#foldersTitle")
            ?.closest(
                ".drive-section"
            );


    const countElement =
        folderSection
            ?.querySelector(
                ".section-count"
            );


    if (!countElement) {
        return;
    }


    countElement.textContent =
        searching
            ? `${count} matching`
            : `${count} ${
                count === 1
                    ? "folder"
                    : "folders"
            }`;
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
   FOLDER CREATE MODAL
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
   FOLDER ACTION MODALS
========================================================= */

let folderActionModal = null;

let folderActionInput = null;

let folderActionMessage = null;

let folderActionConfirmButton = null;

let folderActionCancelButton = null;

let folderActionCloseButton = null;

let folderActionMode = null;

let folderActionFolderId = null;


/* =========================================================
   SETUP ACTION MODAL
========================================================= */

function setupFolderActionModal() {

    createFolderActionModal();


    folderActionConfirmButton?.addEventListener(
        "click",
        handleFolderActionConfirm
    );


    folderActionCancelButton?.addEventListener(
        "click",
        closeFolderActionModal
    );


    folderActionCloseButton?.addEventListener(
        "click",
        closeFolderActionModal
    );


    folderActionModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                folderActionModal
            ) {

                closeFolderActionModal();
            }
        }
    );
}


/* =========================================================
   CREATE ACTION MODAL
========================================================= */

function createFolderActionModal() {

    if (
        document.getElementById(
            "folderActionModal"
        )
    ) {

        folderActionModal =
            document.getElementById(
                "folderActionModal"
            );

        cacheFolderActionModalElements();

        return;
    }


    folderActionModal =
        document.createElement(
            "div"
        );


    folderActionModal.id =
        "folderActionModal";


    folderActionModal.className =
        "modal-overlay folder-action-modal";


    folderActionModal.setAttribute(
        "aria-hidden",
        "true"
    );


    folderActionModal.innerHTML = `

        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="folderActionTitle"
        >

            <div class="modal-header">

                <div>

                    <span
                        class="modal-eyebrow"
                        id="folderActionEyebrow"
                    >
                        DRIVE
                    </span>

                    <h2 id="folderActionTitle">
                        Folder Action
                    </h2>

                    <p id="folderActionDescription">
                        Manage this folder.
                    </p>

                </div>


                <button
                    type="button"
                    class="close-btn"
                    id="folderActionClose"
                    aria-label="Close dialog"
                >
                    &times;
                </button>

            </div>


            <div
                id="folderRenameArea"
                class="folder-action-area"
            >

                <div class="form-group">

                    <label for="folderActionInput">
                        Folder name
                    </label>

                    <input
                        type="text"
                        id="folderActionInput"
                        maxlength="255"
                        autocomplete="off"
                    >

                </div>

            </div>


            <div
                id="folderDeleteArea"
                class="folder-action-area"
                hidden
            >

                <div class="delete-warning">

                    <div class="delete-warning-icon">
                        🗑️
                    </div>

                    <div>

                        <strong>
                            Are you sure?
                        </strong>

                        <p id="folderDeleteText">
                            This action cannot be undone.
                        </p>

                    </div>

                </div>

            </div>


            <p
                id="folderActionMessage"
                class="auth-message"
                aria-live="polite"
            ></p>


            <div class="modal-actions">

                <button
                    type="button"
                    class="secondary-modal-btn"
                    id="folderActionCancel"
                >
                    Cancel
                </button>

                <button
                    type="button"
                    class="auth-submit"
                    id="folderActionConfirm"
                >
                    Confirm
                </button>

            </div>

        </div>

    `;


    document.body.appendChild(
        folderActionModal
    );


    cacheFolderActionModalElements();
}


/* =========================================================
   CACHE ACTION MODAL
========================================================= */

function cacheFolderActionModalElements() {

    folderActionInput =
        $("#folderActionInput");


    folderActionMessage =
        $("#folderActionMessage");


    folderActionConfirmButton =
        $("#folderActionConfirm");


    folderActionCancelButton =
        $("#folderActionCancel");


    folderActionCloseButton =
        $("#folderActionClose");


    folderActionModal =
        $("#folderActionModal");
}


/* =========================================================
   OPEN RENAME MODAL
========================================================= */

function openRenameFolderModal(
    folderId
) {

    const folder =
        getFolderById(
            folderId
        );


    if (!folder) {

        showGlobalError(
            "Folder not found."
        );

        return;
    }


    folderActionMode =
        "rename";


    folderActionFolderId =
        folderId;


    const title =
        $("#folderActionTitle");


    const eyebrow =
        $("#folderActionEyebrow");


    const description =
        $("#folderActionDescription");


    const renameArea =
        $("#folderRenameArea");


    const deleteArea =
        $("#folderDeleteArea");


    if (title) {

        title.textContent =
            "Rename Folder";
    }


    if (eyebrow) {

        eyebrow.textContent =
            "FOLDER";
    }


    if (description) {

        description.textContent =
            "Choose a new name for this folder.";
    }


    if (renameArea) {

        renameArea.hidden =
            false;
    }


    if (deleteArea) {

        deleteArea.hidden =
            true;
    }


    if (folderActionConfirmButton) {

        folderActionConfirmButton.textContent =
            "Rename";
    }


    if (folderActionInput) {

        folderActionInput.value =
            folder.name || "";
    }


    clearFolderActionMessage();

    showFolderActionModal();


    setTimeout(
        () => {

            folderActionInput?.focus();

            folderActionInput?.select();

        },
        50
    );
}


/* =========================================================
   OPEN DELETE MODAL
========================================================= */

function openDeleteFolderModal(
    folderId
) {

    const folder =
        getFolderById(
            folderId
        );


    if (!folder) {

        showGlobalError(
            "Folder not found."
        );

        return;
    }


    folderActionMode =
        "delete";


    folderActionFolderId =
        folderId;


    const title =
        $("#folderActionTitle");


    const eyebrow =
        $("#folderActionEyebrow");


    const description =
        $("#folderActionDescription");


    const renameArea =
        $("#folderRenameArea");


    const deleteArea =
        $("#folderDeleteArea");


    const deleteText =
        $("#folderDeleteText");


    if (title) {

        title.textContent =
            "Delete Folder";
    }


    if (eyebrow) {

        eyebrow.textContent =
            "FOLDER";
    }


    if (description) {

        description.textContent =
            "Remove this folder from your drive.";
    }


    if (renameArea) {

        renameArea.hidden =
            true;
    }


    if (deleteArea) {

        deleteArea.hidden =
            false;
    }


    if (deleteText) {

        deleteText.textContent =
            `Delete "${folder.name}"? Files directly inside it will be moved to My Drive.`;
    }


    if (folderActionConfirmButton) {

        folderActionConfirmButton.textContent =
            "Delete";


        folderActionConfirmButton.classList.add(
            "danger-confirm"
        );
    }


    clearFolderActionMessage();

    showFolderActionModal();
}


/* =========================================================
   SHOW ACTION MODAL
========================================================= */

function showFolderActionModal() {

    if (!folderActionModal) {
        return;
    }


    folderActionModal.classList.add(
        "show"
    );


    folderActionModal.setAttribute(
        "aria-hidden",
        "false"
    );
}


/* =========================================================
   CLOSE ACTION MODAL
========================================================= */

function closeFolderActionModal() {

    if (!folderActionModal) {
        return;
    }


    folderActionModal.classList.remove(
        "show"
    );


    folderActionModal.setAttribute(
        "aria-hidden",
        "true"
    );


    folderActionMode =
        null;


    folderActionFolderId =
        null;


    if (folderActionInput) {

        folderActionInput.value =
            "";
    }


    clearFolderActionMessage();


    folderActionConfirmButton?.classList.remove(
        "danger-confirm"
    );
}


/* =========================================================
   ACTION CONFIRM
========================================================= */

async function handleFolderActionConfirm() {

    if (
        !folderActionMode ||
        !folderActionFolderId
    ) {

        return;
    }


    if (
        folderActionMode ===
        "rename"
    ) {

        await performRenameFolder();

        return;
    }


    if (
        folderActionMode ===
        "delete"
    ) {

        await performDeleteFolder();
    }
}


/* =========================================================
   PERFORM RENAME
========================================================= */

async function performRenameFolder() {

    const folder =
        getFolderById(
            folderActionFolderId
        );


    if (!folder) {

        closeFolderActionModal();

        showGlobalError(
            "Folder not found."
        );

        return;
    }


    const name =
        folderActionInput?.value.trim();


    if (!name) {

        setFolderActionMessage(
            "Folder name cannot be empty.",
            "error"
        );

        folderActionInput?.focus();

        return;
    }


    if (
        name.length >
        255
    ) {

        setFolderActionMessage(
            "Folder name is too long.",
            "error"
        );

        return;
    }


    if (
        name ===
        folder.name
    ) {

        closeFolderActionModal();

        return;
    }


    const button =
        folderActionConfirmButton;


    setButtonLoading(
        button,
        true,
        "Renaming..."
    );


    try {

        await apiRequest(
            `/api/folders/${encodeURIComponent(
                folder.id
            )}`,
            {

                method:
                    "PATCH",

                body:
                    JSON.stringify(
                        {
                            name
                        }
                    )

            }
        );


        closeFolderActionModal();


        await loadFolders();


        showGlobalSuccess(
            "Folder renamed successfully."
        );


    } catch (error) {

        console.error(
            "Rename folder error:",
            error
        );


        setFolderActionMessage(
            error.message ||
            "Unable to rename folder.",
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Rename"
        );
    }
}


/* =========================================================
   PERFORM DELETE
========================================================= */

async function performDeleteFolder() {

    const folder =
        getFolderById(
            folderActionFolderId
        );


    if (!folder) {

        closeFolderActionModal();

        showGlobalError(
            "Folder not found."
        );

        return;
    }


    const folderId =
        folder.id;


    const button =
        folderActionConfirmButton;


    setButtonLoading(
        button,
        true,
        "Deleting..."
    );


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


        const deletingCurrentFolder =
            String(
                currentFolderId
            ) ===
            String(
                folderId
            );


        closeFolderActionModal();


        if (
            deletingCurrentFolder
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


        setFolderActionMessage(
            error.message ||
            "Unable to delete folder.",
            "error"
        );


    } finally {

        setButtonLoading(
            button,
            false,
            "Delete"
        );
    }
}


/* =========================================================
   ACTION MESSAGE
========================================================= */

function setFolderActionMessage(
    message,
    type
) {

    if (!folderActionMessage) {
        return;
    }


    folderActionMessage.textContent =
        message;


    folderActionMessage.className =
        `auth-message ${type}`;
}


function clearFolderActionMessage() {

    if (!folderActionMessage) {
        return;
    }


    folderActionMessage.textContent =
        "";


    folderActionMessage.className =
        "auth-message";
}


/* =========================================================
   GET FOLDER
========================================================= */

function getFolderById(
    folderId
) {

    return folders.find(
        folder =>
            String(
                folder.id
            ) ===
            String(
                folderId
            )
    );
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


    if (!files.length) {

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

                        /*
                            Folders are local data, so
                            render immediately.

                            Files still use backend search.
                        */

                        renderFolders();


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

async function handleTelegramPhone(event) {

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


        if (!result.authId) {

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

async function handleTelegramOtp(event) {

    event.preventDefault();

    clearTelegramMessages();


    if (!telegramAuthId) {

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


        if (result.requiresPassword) {

            showTelegramPasswordStep();

            return;
        }


        if (result.connected) {

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

async function handleTelegramPassword(event) {

    event.preventDefault();

    clearTelegramMessages();


    if (!telegramAuthId) {

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


        if (!result.connected) {

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
        telegramPhoneForm.hidden = false;
    }

    if (telegramOtpForm) {
        telegramOtpForm.hidden = true;
    }

    if (telegramPasswordForm) {
        telegramPasswordForm.hidden = true;
    }

    if (telegramConnectedState) {
        telegramConnectedState.hidden = true;
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
        telegramPhoneForm.hidden = true;
    }

    if (telegramOtpForm) {
        telegramOtpForm.hidden = false;
    }

    if (telegramPasswordForm) {
        telegramPasswordForm.hidden = true;
    }

    if (telegramConnectedState) {
        telegramConnectedState.hidden = true;
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
        telegramPhoneForm.hidden = true;
    }

    if (telegramOtpForm) {
        telegramOtpForm.hidden = true;
    }

    if (telegramPasswordForm) {
        telegramPasswordForm.hidden = false;
    }

    if (telegramConnectedState) {
        telegramConnectedState.hidden = true;
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
        telegramPhoneForm.hidden = true;
    }

    if (telegramOtpForm) {
        telegramOtpForm.hidden = true;
    }

    if (telegramPasswordForm) {
        telegramPasswordForm.hidden = true;
    }

    if (telegramConnectedState) {
        telegramConnectedState.hidden = false;
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


    if (connectedTelegramName) {

        connectedTelegramName.textContent =
            name;
    }


    if (connectedTelegramUsername) {

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
        urlError.textContent = "";
    }
}


/* =========================================================
   TELEGRAM IMPORT
========================================================= */

async function handleTelegramImport(event) {

    event.preventDefault();


    if (urlError) {
        urlError.textContent = "";
    }


    const url =
        telegramUrl?.value.trim();


    if (!isTelegramUrl(url)) {

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

function isTelegramUrl(url) {

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
            hostname !== "t.me" &&
            hostname !== "telegram.me"
        ) {

            return false;
        }


        const parts =
            parsed.pathname
                .split("/")
                .filter(Boolean);


        if (parts.length < 2) {
            return false;
        }


        if (parts[0] === "c") {

            if (parts.length < 3) {
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

                messageId > 0

            );
        }


        const messageId =
            Number(
                parts[1]
            );


        return (

            Number.isInteger(
                messageId
            ) &&

            messageId > 0

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


    if (!session?.access_token) {

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


    if (!response.ok) {

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

        return "Incorrect email or password.";
    }


    if (
        lower.includes(
            "email not confirmed"
        )
    ) {

        return "Please confirm your email before logging in.";
    }


    if (
        lower.includes(
            "user already registered"
        )
    ) {

        return "This email is already registered. Please log in.";
    }


    if (
        lower.includes("rate limit") ||
        lower.includes("email rate limit")
    ) {

        return "Supabase email rate limit reached. Please wait before requesting another confirmation email.";
    }


    if (
        lower.includes(
            "password should be at least"
        )
    ) {

        return "Password must be at least 6 characters.";
    }


    if (
        lower.includes(
            "signup is disabled"
        )
    ) {

        return "New account registration is currently disabled in Supabase.";
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


    if (heading) {

        heading.textContent =
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
        mime.startsWith("video/") ||
        /\.(mp4|mkv|avi|mov|webm|m4v|3gp)$/i.test(
            name
        )
    ) {

        return "🎬";
    }


    if (
        mime.startsWith("image/") ||
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
            name
        )
    ) {

        return "🖼️";
    }


    if (
        mime.includes("pdf") ||
        name.endsWith(".pdf")
    ) {

        return "📄";
    }


    if (
        mime.startsWith("audio/") ||
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


    if (value <= 0) {
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
                Math.log(value) /
                Math.log(1024)
            ),

            units.length - 1

        );


    const converted =
        value /
        Math.pow(
            1024,
            index
        );


    const decimals =
        index === 0
            ? 0
            : converted >= 10
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

        text.charAt(0).toUpperCase() +

        text.slice(1)

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


        if (
            folderActionModal?.classList.contains(
                "show"
            )
        ) {

            closeFolderActionModal();
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


        if (!session?.access_token) {

            showAuthScreen();


            throw new Error(
                "Your session has expired. Please log in again."
            );
        }


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
            mime.startsWith("video/") ||
            /\.(mp4|m4v|webm|mov|mkv|avi|3gp)$/i.test(
                name
            );


        const isImage =
            mime.startsWith("image/") ||
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(
                name
            );


        const isPdf =
            mime === "application/pdf" ||
            name.endsWith(".pdf");


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

                    <span id="fileViewerIcon">
                        🎬
                    </span>

                    <span id="fileViewerName">
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


    video.src =
        streamUrl;


    video.addEventListener(
        "error",
        () => {

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

            video.pause();

            video.removeAttribute(
                "src"
            );

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