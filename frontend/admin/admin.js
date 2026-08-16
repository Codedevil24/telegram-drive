"use strict";

/*
    =========================================================
    TELEGRAM DRIVE
    ADMIN PANEL
    =========================================================

    Responsibilities:

    - Supabase session handling
    - Admin authentication
    - Admin API requests
    - Dashboard statistics
    - Users
    - Files
    - Folders
    - Telegram accounts
    - Activity
    - User details
    - File deletion
    - Sidebar/navigation
    - Logout
*/


/* =========================================================
   CONFIG
========================================================= */

let SUPABASE_URL = "";

let SUPABASE_PUBLISHABLE_KEY = "";



/* =========================================================
   STATE
========================================================= */

let supabaseClient = null;

let currentSession = null;

let currentUser = null;

let currentSection = "dashboard";

let usersPage = 1;

let filesPage = 1;

let usersSearch = "";

let filesSearch = "";

let pendingConfirmAction = null;


/* =========================================================
   DOM HELPERS
========================================================= */

function $(selector) {

    return document.querySelector(selector);

}


function $all(selector) {

    return Array.from(
        document.querySelectorAll(selector)
    );

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeAdmin
);


async function initializeAdmin() {

    try {

        bindEvents();

        showLoading(true);

        /*
            Wait until the Supabase CDN script
            has loaded.
        */

        await waitForSupabase();


/* =========================================================
   LOAD SUPABASE CONFIG FROM BACKEND
========================================================= */

const configResponse =
    await fetch("/api/config", {
        method: "GET",
        headers: {
            Accept: "application/json"
        }
    });


const configResult =
    await configResponse.json();


if (
    !configResponse.ok ||
    !configResult?.success ||
    !configResult?.config?.supabaseUrl ||
    !configResult?.config?.supabasePublishableKey
) {

    throw new Error(
        configResult?.message ||
        "Unable to load Supabase configuration."
    );

}


SUPABASE_URL =
    configResult.config.supabaseUrl;


SUPABASE_PUBLISHABLE_KEY =
    configResult.config.supabasePublishableKey;


/*
    Create Supabase browser client.
*/

supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        }
    );


        /*
            Get current session.
        */

        const {
            data,
            error
        } =
            await supabaseClient
                .auth
                .getSession();


        if (error) {
            throw error;
        }


        currentSession =
            data?.session || null;


        currentUser =
            currentSession?.user || null;


        /*
            No authenticated user.
        */

        if (!currentSession || !currentUser) {

            redirectToLogin();

            return;

        }


        /*
            Verify admin access through
            the protected backend.

            NEVER trust frontend-only admin checks.
        */

        const adminResult =
            await adminRequest(
                "/me"
            );


        if (
            !adminResult?.success ||
            !adminResult?.isAdmin
        ) {

            showFatalError(
                "Administrator access required."
            );

            setTimeout(
                () => {
                    redirectToDrive();
                },
                1800
            );

            return;

        }


        /*
            Display admin identity.
        */

        updateAdminProfile();


        /*
            Load dashboard.
        */

        await loadDashboard();


        /*
            Watch for authentication changes.
        */

        supabaseClient
            .auth
            .onAuthStateChange(
                (
                    event,
                    session
                ) => {

                    currentSession =
                        session || null;

                    currentUser =
                        session?.user || null;


                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        redirectToLogin();

                    }

                }
            );


    } catch (error) {

        console.error(
            "Admin initialization error:",
            error
        );


        showFatalError(
            getErrorMessage(
                error,
                "Unable to initialize admin panel."
            )
        );

    } finally {

        showLoading(false);

    }

}


/* =========================================================
   WAIT FOR SUPABASE CDN
========================================================= */

function waitForSupabase() {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            if (
                window.supabase &&
                typeof window.supabase.createClient ===
                    "function"
            ) {

                resolve();

                return;

            }


            let attempts = 0;

            const maxAttempts = 100;

            const interval =
                setInterval(
                    () => {

                        attempts++;


                        if (
                            window.supabase &&
                            typeof window.supabase.createClient ===
                                "function"
                        ) {

                            clearInterval(
                                interval
                            );

                            resolve();

                            return;

                        }


                        if (
                            attempts >=
                            maxAttempts
                        ) {

                            clearInterval(
                                interval
                            );

                            reject(
                                new Error(
                                    "Supabase library failed to load."
                                )
                            );

                        }

                    },
                    50
                );

        }
    );

}


/* =========================================================
   EVENT BINDINGS
========================================================= */

function bindEvents() {

    /*
        Sidebar
    */

    $("#sidebarToggleBtn")
        ?.addEventListener(
            "click",
            openSidebar
        );


    $("#sidebarCloseBtn")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    $("#sidebarOverlay")
        ?.addEventListener(
            "click",
            closeSidebar
        );


    /*
        Navigation
    */

    $all(".nav-item")
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const section =
                            button.dataset.section;

                        if (section) {

                            navigateToSection(
                                section
                            );

                        }

                    }
                );

            }
        );


    /*
        Quick actions and "View all"
    */

    $all(
        "[data-section-link]"
    )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        const section =
                            element.dataset.sectionLink;

                        if (section) {

                            navigateToSection(
                                section
                            );

                        }

                    }
                );

            }
        );


    /*
        Refresh
    */

    $("#refreshButton")
        ?.addEventListener(
            "click",
            refreshCurrentSection
        );


    /*
        Logout
    */

    $("#adminLogoutBtn")
        ?.addEventListener(
            "click",
            logoutAdmin
        );


    /*
        User search
    */

    $("#userSearchButton")
        ?.addEventListener(
            "click",
            () => {

                usersSearch =
                    (
                        $("#userSearchInput")
                            ?.value ||
                        ""
                    )
                    .trim();

                usersPage = 1;

                loadUsers();

            }
        );


    $("#userSearchInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    $("#userSearchButton")
                        ?.click();

                }

            }
        );


    /*
        File search
    */

    $("#fileSearchButton")
        ?.addEventListener(
            "click",
            () => {

                filesSearch =
                    (
                        $("#fileSearchInput")
                            ?.value ||
                        ""
                    )
                    .trim();

                filesPage = 1;

                loadFiles();

            }
        );


    $("#fileSearchInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    $("#fileSearchButton")
                        ?.click();

                }

            }
        );


    /*
        Error close
    */

    $("#closeErrorButton")
        ?.addEventListener(
            "click",
            hideError
        );


    /*
        Modal close buttons
    */

    $all(
        "[data-close-modal]"
    )
        .forEach(
            element => {

                element.addEventListener(
                    "click",
                    () => {

                        closeModal(
                            element.dataset.closeModal
                        );

                    }
                );

            }
        );


    /*
        ESC closes sidebar/modal.
    */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key !==
                "Escape"
            ) {
                return;
            }


            closeSidebar();


            $all(".modal:not([hidden])")
                .forEach(
                    modal => {

                        closeModal(
                            modal.id
                        );

                    }
                );

        }
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

async function navigateToSection(
    section
) {

    const validSections = [
        "dashboard",
        "users",
        "files",
        "folders",
        "telegram",
        "activity"
    ];


    if (
        !validSections.includes(
            section
        )
    ) {

        return;

    }


    currentSection =
        section;


    /*
        Update nav buttons.
    */

    $all(".nav-item")
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                        section
                );

            }
        );


    /*
        Show requested section.
    */

    $all(
        "[data-section-content]"
    )
        .forEach(
            content => {

                const isActive =
                    content.dataset.sectionContent ===
                    section;


                content.hidden =
                    !isActive;


                content.classList.toggle(
                    "active",
                    isActive
                );

            }
        );


    /*
        Update heading.
    */

    updatePageHeading(
        section
    );


    /*
        Close mobile sidebar.
    */

    closeSidebar();


    /*
        Load data.
    */

    try {

        showLoading(true);


        switch (section) {

            case "dashboard":

                await loadDashboard();

                break;


            case "users":

                await loadUsers();

                break;


            case "files":

                await loadFiles();

                break;


            case "folders":

                await loadFolders();

                break;


            case "telegram":

                await loadTelegramAccounts();

                break;


            case "activity":

                await loadActivity();

                break;

        }

    } catch (error) {

        console.error(
            `Failed to load ${section}:`,
            error
        );


        showError(
            getErrorMessage(
                error,
                `Unable to load ${section}.`
            )
        );

    } finally {

        showLoading(false);

    }

}


/* =========================================================
   PAGE HEADINGS
========================================================= */

function updatePageHeading(
    section
) {

    const headings = {

        dashboard: {
            title: "Dashboard",
            subtitle:
                "Overview of your Telegram Drive"
        },

        users: {
            title: "Users",
            subtitle:
                "View and manage registered users"
        },

        files: {
            title: "Files",
            subtitle:
                "Browse files stored by users"
        },

        folders: {
            title: "Folders",
            subtitle:
                "View folders across the platform"
        },

        telegram: {
            title: "Telegram Accounts",
            subtitle:
                "Monitor connected Telegram accounts"
        },

        activity: {
            title: "Activity",
            subtitle:
                "Recent activity across Telegram Drive"
        }

    };


    const config =
        headings[section] ||
        headings.dashboard;


    const title =
        $("#pageTitle");


    const subtitle =
        $("#pageSubtitle");


    if (title) {
        title.textContent =
            config.title;
    }


    if (subtitle) {
        subtitle.textContent =
            config.subtitle;
    }

}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard() {

    const [
        statsResult,
        activityResult
    ] =
        await Promise.all([
            adminRequest("/stats"),
            adminRequest(
                "/activity?limit=6"
            )
        ]);


    if (
        statsResult?.success
    ) {

        renderStats(
            statsResult.stats ||
            {}
        );

    }


    if (
        activityResult?.success
    ) {

        renderActivity(
            $("#dashboardActivity"),
            activityResult.activity ||
            activityResult.activities ||
            []
        );

    }

}


/* =========================================================
   RENDER STATS
========================================================= */

function renderStats(
    stats
) {

    setText(
        "#statTotalUsers",
        formatNumber(
            stats.totalUsers
        )
    );


    setText(
        "#statTotalFiles",
        formatNumber(
            stats.totalFiles
        )
    );


    setText(
        "#statStorage",
        formatBytes(
            stats.totalStorageBytes ??
            stats.storageBytes ??
            0
        )
    );


    setText(
        "#statTotalFolders",
        formatNumber(
            stats.totalFolders
        )
    );


    setText(
        "#statTelegramAccounts",
        formatNumber(
            stats.connectedTelegramAccounts ??
            stats.totalTelegramAccounts ??
            0
        )
    );

}


/* =========================================================
   USERS
========================================================= */

async function loadUsers() {

    const query =
        new URLSearchParams();


    query.set(
        "page",
        String(usersPage)
    );


    query.set(
        "limit",
        "20"
    );


    if (usersSearch) {

        query.set(
            "search",
            usersSearch
        );

    }


    const result =
        await adminRequest(
            `/users?${query.toString()}`
        );


    if (!result?.success) {

        throw new Error(
            result?.message ||
            "Unable to load users."
        );

    }


    const users =
        result.users ||
        result.data ||
        [];


    renderUsers(
        users
    );


    renderPagination(
        $("#usersPagination"),
        result,
        usersPage,
        page => {

            usersPage =
                page;

            loadUsers();

        }
    );

}


/* =========================================================
   RENDER USERS
========================================================= */

function renderUsers(
    users
) {

    const tbody =
        $("#usersTableBody");


    if (!tbody) {
        return;
    }


    if (
        !Array.isArray(users) ||
        users.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-placeholder"
                >
                    No users found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        users
            .map(
                user => {

                    const userId =
                        user.id ||
                        user.user_id ||
                        "";


                    const email =
                        user.email ||
                        user.user_email ||
                        "Unknown";


                    const files =
                        user.file_count ??
                        user.files_count ??
                        0;


                    const storage =
                        user.storage_bytes ??
                        user.total_storage_bytes ??
                        0;


                    const telegram =
                        user.telegram_account_count ??
                        user.telegram_accounts_count ??
                        0;


                    const created =
                        user.created_at ||
                        user.createdAt;


                    return `

                        <tr>

                            <td>

                                <div class="table-user">

                                    <div class="table-avatar">

                                        ${escapeHtml(
                                            getInitial(
                                                email
                                            )
                                        )}

                                    </div>


                                    <div class="table-user-info">

                                        <strong>
                                            ${escapeHtml(
                                                email
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHtml(
                                                userId
                                            )}
                                        </small>

                                    </div>

                                </div>

                            </td>


                            <td>
                                ${formatDate(
                                    created
                                )}
                            </td>


                            <td>
                                ${formatNumber(
                                    files
                                )}
                            </td>


                            <td>
                                ${formatBytes(
                                    storage
                                )}
                            </td>


                            <td>

                                ${
                                    Number(
                                        telegram
                                    ) > 0

                                    ? `
                                        <span class="status-badge success">
                                            ● Connected
                                        </span>
                                    `

                                    : `
                                        <span class="status-badge warning">
                                            ● None
                                        </span>
                                    `
                                }

                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="table-action-button"
                                    data-user-id="${escapeHtml(
                                        userId
                                    )}"
                                    data-action="view-user"
                                >
                                    View
                                </button>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");


    /*
        Event delegation.
    */

    tbody
        .querySelectorAll(
            '[data-action="view-user"]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openUserDetails(
                            button.dataset.userId
                        );

                    }
                );

            }
        );

}


/* =========================================================
   USER DETAILS
========================================================= */

async function openUserDetails(
    userId
) {

    if (!userId) {
        return;
    }


    openModal(
        "userModal"
    );


    const body =
        $("#userModalBody");


    if (!body) {
        return;
    }


    body.innerHTML = `

        <div class="modal-loading">

            <div class="loading-spinner"></div>

            <span>
                Loading user...
            </span>

        </div>

    `;


    try {

        const [
            userResult,
            filesResult
        ] =
            await Promise.all([
                adminRequest(
                    `/users/${encodeURIComponent(
                        userId
                    )}`
                ),

                adminRequest(
                    `/users/${encodeURIComponent(
                        userId
                    )}/files?limit=10`
                )
            ]);


        const user =
            userResult?.user ||
            userResult?.data ||
            userResult;


        const files =
            filesResult?.files ||
            filesResult?.data ||
            [];


        renderUserDetails(
            user,
            files
        );


    } catch (error) {

        console.error(
            "User details error:",
            error
        );


        body.innerHTML = `

            <div class="empty-state">

                <span class="empty-icon">
                    !
                </span>

                <h3>
                    Unable to load user
                </h3>

                <p>
                    ${escapeHtml(
                        getErrorMessage(
                            error,
                            "Unknown error."
                        )
                    )}
                </p>

            </div>

        `;

    }

}


/* =========================================================
   RENDER USER DETAILS
========================================================= */

function renderUserDetails(
    user,
    files
) {

    const body =
        $("#userModalBody");


    if (!body) {
        return;
    }


    if (!user) {

        body.innerHTML = `

            <div class="empty-state">

                <span class="empty-icon">
                    !
                </span>

                <h3>
                    User not found
                </h3>

            </div>

        `;

        return;

    }


    const email =
        user.email ||
        user.user_email ||
        "Unknown";


    const userId =
        user.id ||
        user.user_id ||
        "";


    const created =
        user.created_at ||
        user.createdAt;


    const fileCount =
        user.file_count ??
        user.files_count ??
        files.length;


    const storage =
        user.storage_bytes ??
        user.total_storage_bytes ??
        0;


    body.innerHTML = `

        <div class="detail-grid">


            <div class="detail-card">

                <span>
                    Email
                </span>

                <strong>
                    ${escapeHtml(
                        email
                    )}
                </strong>

            </div>


            <div class="detail-card">

                <span>
                    Created
                </span>

                <strong>
                    ${formatDate(
                        created
                    )}
                </strong>

            </div>


            <div class="detail-card">

                <span>
                    Files
                </span>

                <strong>
                    ${formatNumber(
                        fileCount
                    )}
                </strong>

            </div>


            <div class="detail-card">

                <span>
                    Storage
                </span>

                <strong>
                    ${formatBytes(
                        storage
                    )}
                </strong>

            </div>


            <div class="detail-card">

                <span>
                    User ID
                </span>

                <strong>
                    ${escapeHtml(
                        userId
                    )}
                </strong>

            </div>


        </div>


        <h3 class="detail-section-title">
            Recent Files
        </h3>


        ${
            Array.isArray(files) &&
            files.length

            ? `

                <div class="activity-list">

                    ${
                        files
                            .map(
                                file => `

                                    <div class="activity-item">

                                        <div class="activity-icon">
                                            ▣
                                        </div>


                                        <div class="activity-info">

                                            <strong>
                                                ${escapeHtml(
                                                    file.name ||
                                                    "Unnamed file"
                                                )}
                                            </strong>

                                            <small>
                                                ${formatBytes(
                                                    file.size ||
                                                    0
                                                )}
                                            </small>

                                        </div>

                                    </div>

                                `
                            )
                            .join("")
                    }

                </div>

            `

            : `

                <div class="empty-state compact">

                    <span class="empty-icon">
                        ▣
                    </span>

                    <p>
                        No files found.
                    </p>

                </div>

            `
        }

    `;

}


/* =========================================================
   FILES
========================================================= */

async function loadFiles() {

    const query =
        new URLSearchParams();


    query.set(
        "page",
        String(filesPage)
    );


    query.set(
        "limit",
        "20"
    );


    if (filesSearch) {

        query.set(
            "search",
            filesSearch
        );

    }


    const result =
        await adminRequest(
            `/files?${query.toString()}`
        );


    if (!result?.success) {

        throw new Error(
            result?.message ||
            "Unable to load files."
        );

    }


    const files =
        result.files ||
        result.data ||
        [];


    renderFiles(
        files
    );


    renderPagination(
        $("#filesPagination"),
        result,
        filesPage,
        page => {

            filesPage =
                page;

            loadFiles();

        }
    );

}


/* =========================================================
   RENDER FILES
========================================================= */

function renderFiles(
    files
) {

    const tbody =
        $("#filesTableBody");


    if (!tbody) {
        return;
    }


    if (
        !Array.isArray(files) ||
        files.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="table-placeholder"
                >
                    No files found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        files
            .map(
                file => {

                    const id =
                        file.id ||
                        "";


                    const name =
                        file.name ||
                        "Unnamed file";


                    const userEmail =
                        file.user_email ||
                        file.email ||
                        "Unknown user";


                    const mime =
                        file.mime_type ||
                        "Unknown";


                    const size =
                        file.size ||
                        0;


                    const created =
                        file.created_at ||
                        file.createdAt;


                    return `

                        <tr>

                            <td>

                                <div class="table-file">

                                    <div class="file-type-icon">
                                        ${getFileIcon(
                                            mime,
                                            name
                                        )}
                                    </div>


                                    <div class="file-info">

                                        <strong>
                                            ${escapeHtml(
                                                name
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHtml(
                                                mime
                                            )}
                                        </small>

                                    </div>

                                </div>

                            </td>


                            <td>
                                ${escapeHtml(
                                    userEmail
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    mime
                                )}
                            </td>


                            <td>
                                ${formatBytes(
                                    size
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    created
                                )}
                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="table-action-button"
                                    data-file-id="${escapeHtml(
                                        id
                                    )}"
                                    data-file-name="${escapeHtml(
                                        name
                                    )}"
                                    data-action="delete-file"
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>

                    `;

                }
            )
            .join("");


    tbody
        .querySelectorAll(
            '[data-action="delete-file"]'
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        confirmDeleteFile(
                            button.dataset.fileId,
                            button.dataset.fileName
                        );

                    }
                );

            }
        );

}


/* =========================================================
   DELETE FILE CONFIRMATION
========================================================= */

function confirmDeleteFile(
    fileId,
    fileName
) {

    if (!fileId) {
        return;
    }


    $("#confirmModalTitle")
        .textContent =
        "Delete file?";


    $("#confirmModalMessage")
        .textContent =
        `Delete "${fileName || "this file"}" from the database? This action cannot be undone.`;


    pendingConfirmAction =
        async () => {

            await deleteFile(
                fileId
            );

        };


    openModal(
        "confirmModal"
    );


    const button =
        $("#confirmActionButton");


    if (!button) {
        return;
    }


    /*
        Remove previous listener by
        replacing the node.
    */

    const newButton =
        button.cloneNode(
            true
        );


    button.replaceWith(
        newButton
    );


    newButton.addEventListener(
        "click",
        async () => {

            if (
                typeof pendingConfirmAction !==
                "function"
            ) {
                return;
            }


            newButton.disabled =
                true;


            try {

                await pendingConfirmAction();

                closeModal(
                    "confirmModal"
                );

                pendingConfirmAction =
                    null;

            } catch (error) {

                console.error(
                    "Delete confirmation error:",
                    error
                );


                showError(
                    getErrorMessage(
                        error,
                        "Unable to delete file."
                    )
                );

            } finally {

                newButton.disabled =
                    false;

            }

        }
    );

}


/* =========================================================
   DELETE FILE
========================================================= */

async function deleteFile(
    fileId
) {

    const result =
        await adminRequest(
            `/files/${encodeURIComponent(
                fileId
            )}`,
            {
                method:
                    "DELETE"
            }
        );


    if (!result?.success) {

        throw new Error(
            result?.message ||
            "Unable to delete file."
        );

    }


    showSuccess(
        "File deleted successfully."
    );


    await loadFiles();

    await loadDashboard();

}


/* =========================================================
   FOLDERS
========================================================= */

async function loadFolders() {

    const result =
        await adminRequest(
            "/folders?limit=100"
        );


    if (!result?.success) {

        throw new Error(
            result?.message ||
            "Unable to load folders."
        );

    }


    const folders =
        result.folders ||
        result.data ||
        [];


    renderFolders(
        folders
    );

}


/* =========================================================
   RENDER FOLDERS
========================================================= */

function renderFolders(
    folders
) {

    const tbody =
        $("#foldersTableBody");


    if (!tbody) {
        return;
    }


    if (
        !Array.isArray(folders) ||
        folders.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-placeholder"
                >
                    No folders found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        folders
            .map(
                folder => {

                    return `

                        <tr>

                            <td>

                                <div class="table-file">

                                    <div class="file-type-icon">
                                        □
                                    </div>

                                    <div class="file-info">

                                        <strong>
                                            ${escapeHtml(
                                                folder.name ||
                                                "Unnamed folder"
                                            )}
                                        </strong>

                                        <small>
                                            ${escapeHtml(
                                                folder.id ||
                                                ""
                                            )}
                                        </small>

                                    </div>

                                </div>

                            </td>


                            <td>
                                ${escapeHtml(
                                    folder.user_email ||
                                    folder.email ||
                                    "Unknown"
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    folder.parent_name ||
                                    folder.parent_id ||
                                    "Root"
                                )}
                            </td>


                            <td>
                                ${formatNumber(
                                    folder.file_count ??
                                    0
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    folder.created_at
                                )}
                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   TELEGRAM ACCOUNTS
========================================================= */

async function loadTelegramAccounts() {

    const result =
        await adminRequest(
            "/telegram-accounts?limit=100"
        );


    if (!result?.success) {

        throw new Error(
            result?.message ||
            "Unable to load Telegram accounts."
        );

    }


    const accounts =
        result.accounts ||
        result.telegramAccounts ||
        result.data ||
        [];


    renderTelegramAccounts(
        accounts
    );

}


/* =========================================================
   RENDER TELEGRAM ACCOUNTS
========================================================= */

function renderTelegramAccounts(
    accounts
) {

    const tbody =
        $("#telegramTableBody");


    if (!tbody) {
        return;
    }


    if (
        !Array.isArray(accounts) ||
        accounts.length === 0
    ) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="table-placeholder"
                >
                    No Telegram accounts found.
                </td>

            </tr>

        `;

        return;

    }


    tbody.innerHTML =
        accounts
            .map(
                account => {

                    const username =
                        account.username
                            ? `@${account.username}`
                            : "—";


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    account.user_email ||
                                    account.email ||
                                    account.user_id ||
                                    "Unknown"
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    String(
                                        account.telegram_user_id ??
                                        "—"
                                    )
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    username
                                )}
                            </td>


                            <td>
                                ${escapeHtml(
                                    account.phone ||
                                    "—"
                                )}
                            </td>


                            <td>
                                ${formatDate(
                                    account.created_at
                            )}
                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   ACTIVITY
========================================================= */

async function loadActivity() {

    const result =
        await adminRequest(
            "/activity?limit=100"
        );


    if (!result?.success) {

        throw new Error(
            result?.message ||
            "Unable to load activity."
        );

    }


    const activity =
        result.activity ||
        result.activities ||
        result.data ||
        [];


    renderActivity(
        $("#activityList"),
        activity
    );

}


/* =========================================================
   RENDER ACTIVITY
========================================================= */

function renderActivity(
    container,
    activity
) {

    if (!container) {
        return;
    }


    if (
        !Array.isArray(activity) ||
        activity.length === 0
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <span class="empty-icon">
                    ◷
                </span>

                <h3>
                    No activity yet
                </h3>

                <p>
                    Recent platform activity will appear here.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        activity
            .map(
                item => {

                    const title =
                        item.title ||
                        item.action ||
                        item.event ||
                        "Activity";


                    const description =
                        item.description ||
                        item.message ||
                        item.user_email ||
                        "";


                    const timestamp =
                        item.created_at ||
                        item.timestamp ||
                        item.createdAt;


                    return `

                        <div class="activity-item">

                            <div class="activity-icon">
                                ◷
                            </div>


                            <div class="activity-info">

                                <strong>
                                    ${escapeHtml(
                                        title
                                    )}
                                </strong>

                                <small>
                                    ${escapeHtml(
                                        description
                                    )}
                                </small>

                            </div>


                            <span class="activity-time">
                                ${formatRelativeTime(
                                    timestamp
                                )}
                            </span>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   PAGINATION
========================================================= */

function renderPagination(
    container,
    result,
    currentPage,
    onPageChange
) {

    if (!container) {
        return;
    }


    const totalPages =
        Number(
            result?.totalPages ??
            result?.pagination?.totalPages ??
            1
        );


    const total =
        Number(
            result?.total ??
            result?.pagination?.total ??
            0
        );


    const limit =
        Number(
            result?.limit ??
            result?.pagination?.limit ??
            20
        );


    if (
        totalPages <= 1 &&
        total <= limit
    ) {

        container.innerHTML = "";

        return;

    }


    let html = "";


    html += `

        <span class="pagination-info">
            ${escapeHtml(
                `${total} items`
            )}
        </span>

    `;


    if (
        currentPage > 1
    ) {

        html += `

            <button
                type="button"
                class="pagination-button"
                data-page="${currentPage - 1}"
            >
                ‹
            </button>

        `;

    }


    const start =
        Math.max(
            1,
            currentPage - 2
        );


    const end =
        Math.min(
            totalPages,
            currentPage + 2
        );


    for (
        let page = start;
        page <= end;
        page++
    ) {

        html += `

            <button
                type="button"
                class="pagination-button ${
                    page === currentPage
                        ? "active"
                        : ""
                }"
                data-page="${page}"
            >
                ${page}
            </button>

        `;

    }


    if (
        currentPage < totalPages
    ) {

        html += `

            <button
                type="button"
                class="pagination-button"
                data-page="${currentPage + 1}"
            >
                ›
            </button>

        `;

    }


    container.innerHTML =
        html;


    container
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const page =
                            Number(
                                button.dataset.page
                            );


                        if (
                            Number.isInteger(
                                page
                            ) &&
                            page > 0
                        ) {

                            onPageChange(
                                page
                            );

                        }

                    }
                );

            }
        );

}


/* =========================================================
   ADMIN API REQUEST
========================================================= */

async function adminRequest(
    endpoint,
    options = {}
) {

    /*
        Make sure we have a valid session.
    */

    if (
        !supabaseClient
    ) {

        throw new Error(
            "Supabase client is not initialized."
        );

    }


    /*
        Refresh/read current session.
    */

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .getSession();


    if (error) {
        throw error;
    }


    const session =
        data?.session;


    if (
        !session?.access_token
    ) {

        throw new Error(
            "Your session has expired. Please sign in again."
        );

    }


    /*
        Build headers.
    */

    const headers = {
        Accept:
            "application/json",

        Authorization:
            `Bearer ${session.access_token}`
    };


    /*
        Add Content-Type only when
        a request body exists.
    */

    if (
        options.body &&
        !headers["Content-Type"]
    ) {

        headers["Content-Type"] =
            "application/json";

    }


    const response =
        await fetch(
            `/api/admin${endpoint}`,
            {
                ...options,
                headers: {
                    ...headers,
                    ...(options.headers || {})
                }
            }
        );


    /*
        Read response safely.
    */

    let result = null;

    const contentType =
        response.headers.get(
            "content-type"
        ) || "";


    if (
        contentType.includes(
            "application/json"
        )
    ) {

        result =
            await response.json();

    } else {

        const text =
            await response.text();


        result = {

            success:
                response.ok,

            message:
                text ||
                response.statusText

        };

    }


    /*
        Authentication failure.
    */

    if (
        response.status === 401
    ) {

        showError(
            result?.message ||
            "Your session has expired."
        );


        setTimeout(
            redirectToLogin,
            1000
        );


        throw new Error(
            result?.message ||
            "Authentication required."
        );

    }


    /*
        Admin permission failure.
    */

    if (
        response.status === 403
    ) {

        throw new Error(
            result?.message ||
            "Administrator access required."
        );

    }


    /*
        Other HTTP errors.
    */

    if (
        !response.ok
    ) {

        throw new Error(
            result?.message ||
            `Request failed with status ${response.status}.`
        );

    }


    return result;

}


/* =========================================================
   REFRESH
========================================================= */

async function refreshCurrentSection() {

    try {

        showLoading(true);


        switch (
            currentSection
        ) {

            case "dashboard":

                await loadDashboard();

                break;


            case "users":

                await loadUsers();

                break;


            case "files":

                await loadFiles();

                break;


            case "folders":

                await loadFolders();

                break;


            case "telegram":

                await loadTelegramAccounts();

                break;


            case "activity":

                await loadActivity();

                break;

        }


        showSuccess(
            "Data refreshed."
        );


    } catch (error) {

        console.error(
            "Refresh error:",
            error
        );


        showError(
            getErrorMessage(
                error,
                "Unable to refresh data."
            )
        );

    } finally {

        showLoading(false);

    }

}


/* =========================================================
   PROFILE
========================================================= */

function updateAdminProfile() {

    if (!currentUser) {
        return;
    }


    const email =
        currentUser.email ||
        "Administrator";


    setText(
        "#adminEmail",
        email
    );


    setText(
        "#adminAvatar",
        getInitial(
            email
        )
    );

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutAdmin() {

    try {

        showLoading(true);


        if (
            supabaseClient
        ) {

            await supabaseClient
                .auth
                .signOut();

        }


        redirectToLogin();


    } catch (error) {

        console.error(
            "Logout error:",
            error
        );


        showError(
            "Unable to sign out."
        );

    } finally {

        showLoading(false);

    }

}


/* =========================================================
   SIDEBAR
========================================================= */

function openSidebar() {

    $("#adminSidebar")
        ?.classList
        .add("open");


    $("#sidebarOverlay")
        ?.classList
        .add("visible");

}


function closeSidebar() {

    $("#adminSidebar")
        ?.classList
        .remove("open");


    $("#sidebarOverlay")
        ?.classList
        .remove("visible");

}


/* =========================================================
   MODALS
========================================================= */

function openModal(
    modalId
) {

    const modal =
        document.getElementById(
            modalId
        );


    if (!modal) {
        return;
    }


    modal.hidden =
        false;


    document.body.style.overflow =
        "hidden";

}


function closeModal(
    modalId
) {

    const modal =
        document.getElementById(
            modalId
        );


    if (!modal) {
        return;
    }


    modal.hidden =
        true;


    if (
        $all(
            ".modal:not([hidden])"
        ).length === 0
    ) {

        document.body.style.overflow =
            "";

    }

}


/* =========================================================
   LOADING
========================================================= */

function showLoading(
    visible
) {

    const element =
        $("#globalLoading");


    if (!element) {
        return;
    }


    element.hidden =
        !visible;


    const refreshIcon =
        $("#refreshIcon");


    if (
        refreshIcon
    ) {

        refreshIcon.style.display =
            visible
                ? "inline-block"
                : "";

    }

}


/* =========================================================
   ERROR
========================================================= */

function showError(
    message
) {

    const alert =
        $("#adminError");


    const text =
        $("#adminErrorMessage");


    if (!alert || !text) {
        return;
    }


    text.textContent =
        message ||
        "Something went wrong.";


    alert.hidden =
        false;


    /*
        Automatically hide after a few seconds.
    */

    clearTimeout(
        showError.timeout
    );


    showError.timeout =
        setTimeout(
            hideError,
            6000
        );

}


function hideError() {

    const alert =
        $("#adminError");


    if (alert) {

        alert.hidden =
            true;

    }

}


/* =========================================================
   SUCCESS MESSAGE
========================================================= */

function showSuccess(
    message
) {

    /*
        Reuse alert container for now.

        We don't create another UI system
        just for success messages.
    */

    const alert =
        $("#adminError");


    const text =
        $("#adminErrorMessage");


    if (!alert || !text) {
        return;
    }


    text.textContent =
        message ||
        "Success.";


    alert.classList.remove(
        "error-alert"
    );


    alert.style.background =
        "var(--success-soft)";


    alert.style.borderColor =
        "rgba(53, 211, 154, 0.2)";


    alert.style.color =
        "var(--success)";


    alert.hidden =
        false;


    clearTimeout(
        showSuccess.timeout
    );


    showSuccess.timeout =
        setTimeout(
            () => {

                alert.hidden =
                    true;


                alert.classList.add(
                    "error-alert"
                );


                alert.style.background =
                    "";


                alert.style.borderColor =
                    "";


                alert.style.color =
                    "";

            },
            3000
        );

}


/* =========================================================
   FATAL ERROR
========================================================= */

function showFatalError(
    message
) {

    showError(
        message
    );

}


/* =========================================================
   REDIRECTS
========================================================= */

function redirectToLogin() {

    /*
        Your main application handles login.
        Sending the user to the main page lets
        the existing login UI handle the session.
    */

    window.location.href =
        "../index.html";

}


function redirectToDrive() {

    window.location.href =
        "../index.html";

}


/* =========================================================
   TEXT
========================================================= */

function setText(
    selector,
    value
) {

    const element =
        $(selector);


    if (element) {

        element.textContent =
            value ?? "—";

    }

}


/* =========================================================
   FORMAT NUMBER
========================================================= */

function formatNumber(
    value
) {

    const number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return "0";

    }


    return new Intl.NumberFormat(
        "en-IN"
    ).format(
        number
    );

}


/* =========================================================
   FORMAT BYTES
========================================================= */

function formatBytes(
    bytes
) {

    const value =
        Number(bytes);


    if (
        !Number.isFinite(
            value
        ) ||
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


    const exponent =
        Math.min(
            Math.floor(
                Math.log(value) /
                Math.log(1024)
            ),
            units.length - 1
        );


    const amount =
        value /
        Math.pow(
            1024,
            exponent
        );


    const precision =
        exponent === 0
            ? 0
            : amount >= 100
                ? 0
                : amount >= 10
                    ? 1
                    : 2;


    return `${amount.toFixed(
        precision
    )} ${units[exponent]}`;

}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return new Intl.DateTimeFormat(
        "en-IN",
        {
            dateStyle:
                "medium",
            timeStyle:
                "short"
        }
    ).format(
        date
    );

}


/* =========================================================
   RELATIVE TIME
========================================================= */

function formatRelativeTime(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    const diff =
        Date.now() -
        date.getTime();


    const seconds =
        Math.floor(
            diff / 1000
        );


    if (
        seconds < 10
    ) {

        return "Just now";

    }


    if (
        seconds < 60
    ) {

        return `${seconds}s ago`;

    }


    const minutes =
        Math.floor(
            seconds / 60
        );


    if (
        minutes < 60
    ) {

        return `${minutes}m ago`;

    }


    const hours =
        Math.floor(
            minutes / 60
        );


    if (
        hours < 24
    ) {

        return `${hours}h ago`;

    }


    const days =
        Math.floor(
            hours / 24
        );


    if (
        days < 30
    ) {

        return `${days}d ago`;

    }


    return formatDate(
        value
    );

}


/* =========================================================
   INITIAL
========================================================= */

function getInitial(
    value
) {

    const text =
        String(
            value ||
            ""
        )
        .trim();


    if (!text) {
        return "A";
    }


    return text
        .charAt(0)
        .toUpperCase();

}


/* =========================================================
   FILE ICON
========================================================= */

function getFileIcon(
    mime,
    name
) {

    const type =
        String(
            mime ||
            ""
        )
        .toLowerCase();


    const filename =
        String(
            name ||
            ""
        )
        .toLowerCase();


    if (
        type.includes(
            "video"
        )
    ) {

        return "▶";

    }


    if (
        type.includes(
            "audio"
        )
    ) {

        return "♫";

    }


    if (
        type.includes(
            "pdf"
        ) ||
        filename.endsWith(
            ".pdf"
        )
    ) {

        return "P";

    }


    if (
        type.includes(
            "image"
        )
    ) {

        return "▧";

    }


    if (
        type.includes(
            "zip"
        ) ||
        type.includes(
            "compressed"
        ) ||
        filename.endsWith(
            ".zip"
        )
    ) {

        return "Z";

    }


    return "▣";

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
   ERROR MESSAGE
========================================================= */

function getErrorMessage(
    error,
    fallback
) {

    if (
        error instanceof Error &&
        error.message
    ) {

        return error.message;

    }


    if (
        typeof error ===
            "string" &&
        error
    ) {

        return error;

    }


    return (
        fallback ||
        "Something went wrong."
    );

}