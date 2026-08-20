const API_URL =
    window.location.hostname === "localhost"
        ? "http://localhost:5000/api"
        : `${window.location.origin}/api`;

let token = localStorage.getItem("societyToken");
let currentUser = JSON.parse(localStorage.getItem("societyUser") || "null");

function getServerBaseUrl() {
    return window.location.hostname === "localhost"
        ? "http://localhost:5000"
        : window.location.origin;
}

function showLogin() {
    document.getElementById("loginForm").classList.remove("hidden");
    document.getElementById("registerForm").classList.add("hidden");

    document.getElementById("loginTab").classList.add("active");
    document.getElementById("registerTab").classList.remove("active");
}

function showRegister() {
    document.getElementById("loginForm").classList.add("hidden");
    document.getElementById("registerForm").classList.remove("hidden");

    document.getElementById("loginTab").classList.remove("active");
    document.getElementById("registerTab").classList.add("active");
}

function showPage(page) {
    document.getElementById("authPage").classList.add("hidden");
    document.getElementById("residentPage").classList.add("hidden");
    document.getElementById("adminPage").classList.add("hidden");

    document.getElementById(page).classList.remove("hidden");
}

function logout() {
    localStorage.removeItem("societyToken");
    localStorage.removeItem("societyUser");

    token = null;
    currentUser = null;

    showPage("authPage");
    showLogin();
}

async function apiRequest(endpoint, options = {}) {
    const config = {
        ...options,
        headers: {
            ...(options.headers || {})
        }
    };

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);

    let data;

    try {
        data = await response.json();
    } catch {
        data = {};
    }

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

document.getElementById("loginForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const message = document.getElementById("loginMessage");

    try {
        message.textContent = "Logging in...";
        message.style.color = "";

        const data = await apiRequest("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: document.getElementById("loginEmail").value,
                password: document.getElementById("loginPassword").value
            })
        });

        token = data.token;
        currentUser = data.user;

        localStorage.setItem("societyToken", token);
        localStorage.setItem("societyUser", JSON.stringify(currentUser));

        message.textContent = "";

        openDashboard();

    } catch (error) {
        message.textContent = error.message;
        message.style.color = "#dc2626";
    }
});

document.getElementById("registerForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const message = document.getElementById("registerMessage");

    try {
        message.textContent = "Creating account...";
        message.style.color = "";

        const data = await apiRequest("/auth/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: document.getElementById("registerName").value,
                email: document.getElementById("registerEmail").value,
                password: document.getElementById("registerPassword").value
            })
        });

        token = data.token;
        currentUser = data.user;

        localStorage.setItem("societyToken", token);
        localStorage.setItem("societyUser", JSON.stringify(currentUser));

        message.textContent = "";

        openDashboard();

    } catch (error) {
        message.textContent = error.message;
        message.style.color = "#dc2626";
    }
});

function openDashboard() {
    if (!currentUser) {
        showPage("authPage");
        return;
    }

    if (currentUser.role === "admin") {
        document.getElementById("adminName").textContent =
            currentUser.name;

        showPage("adminPage");

        loadAdminDashboard();
        loadAdminComplaints();

    } else {
        document.getElementById("residentName").textContent =
            currentUser.name;

        showPage("residentPage");

        loadResidentComplaints();
        loadNotices();
    }
}

async function loadResidentComplaints() {
    try {
        const complaints = await apiRequest("/complaints/my");

        const container =
            document.getElementById("residentComplaints");

        document.getElementById("residentTotal").textContent =
            complaints.length;

        document.getElementById("residentOpen").textContent =
            complaints.filter(c => c.status === "Open").length;

        document.getElementById("residentProgress").textContent =
            complaints.filter(c => c.status === "In Progress").length;

        document.getElementById("residentResolved").textContent =
            complaints.filter(c => c.status === "Resolved").length;

        if (complaints.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    No complaints yet.
                </div>
            `;
            return;
        }

        container.innerHTML = complaints.map(complaint => {

            const statusClass =
                complaint.status === "Open"
                    ? "badge-open"
                    : complaint.status === "In Progress"
                        ? "badge-progress"
                        : "badge-resolved";

            const priorityClass =
                complaint.priority === "High"
                    ? "badge-high"
                    : complaint.priority === "Medium"
                        ? "badge-medium"
                        : "badge-low";

            return `
                <div class="complaint-item">

                    <div class="complaint-top">

                        <div>
                            <div class="complaint-title">
                                #${complaint.id} - ${escapeHtml(complaint.category)}
                            </div>

                            <span class="badge ${statusClass}">
                                ${complaint.status}
                            </span>

                            <span class="badge ${priorityClass}">
                                ${complaint.priority}
                            </span>

                            ${complaint.is_overdue
                                ? `<span class="badge badge-overdue">Overdue</span>`
                                : ""
                            }

                        </div>

                        <small>
                            ${formatDate(complaint.created_at)}
                        </small>

                    </div>

                    <p class="complaint-description">
                        ${escapeHtml(complaint.description)}
                    </p>

                    <button
                        class="view-btn"
                        onclick="viewComplaint(${complaint.id})"
                    >
                        View Details & History
                    </button>

                </div>
            `;

        }).join("");

    } catch (error) {
        document.getElementById("residentComplaints").innerHTML =
            `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
}

async function viewComplaint(id) {
    try {
        const data = await apiRequest(`/complaints/${id}`);

        const complaint = data.complaint;
        const history = data.history;

        const photo = complaint.photo
            ? `
                <img
                    class="complaint-photo"
                    src="${getServerBaseUrl()}${complaint.photo}"
                    alt="Complaint photo"
                >
            `
            : "";

        document.getElementById("complaintDetails").innerHTML = `
            <div class="complaint-item">

                <h3>
                    Complaint #${complaint.id}
                </h3>

                <p>
                    <strong>Category:</strong>
                    ${escapeHtml(complaint.category)}
                </p>

                <p>
                    <strong>Status:</strong>
                    ${escapeHtml(complaint.status)}
                </p>

                <p>
                    <strong>Priority:</strong>
                    ${escapeHtml(complaint.priority)}
                </p>

                <p>
                    <strong>Description:</strong>
                    ${escapeHtml(complaint.description)}
                </p>

                ${photo}

                <hr style="margin:20px 0">

                <h3>Status History</h3>

                ${
                    history.length
                        ? history.map(item => `
                            <div class="history-item">

                                <strong>
                                    ${escapeHtml(item.status)}
                                </strong>

                                <span>
                                    Updated by:
                                    ${escapeHtml(item.actor_name)}
                                </span>

                                ${
                                    item.note
                                        ? `<p>${escapeHtml(item.note)}</p>`
                                        : ""
                                }

                                <small>
                                    ${formatDate(item.created_at)}
                                </small>

                            </div>
                        `).join("")
                        : `<div class="empty-state">No history available.</div>`
                }

            </div>
        `;

        document
            .getElementById("detailsModal")
            .classList.remove("hidden");

    } catch (error) {
        alert(error.message);
    }
}

function closeDetailsModal() {
    document
        .getElementById("detailsModal")
        .classList.add("hidden");
}

function openComplaintModal() {
    document
        .getElementById("complaintModal")
        .classList.remove("hidden");
}

function closeComplaintModal() {
    document
        .getElementById("complaintModal")
        .classList.add("hidden");
}

document.getElementById("complaintForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const message =
        document.getElementById("complaintMessage");

    try {
        message.textContent = "Submitting complaint...";
        message.style.color = "";

        const formData = new FormData();

        formData.append(
            "category",
            document.getElementById("complaintCategory").value
        );

        formData.append(
            "description",
            document.getElementById("complaintDescription").value
        );

        const photo =
            document.getElementById("complaintPhoto").files[0];

        if (photo) {
            formData.append("photo", photo);
        }

        await apiRequest("/complaints", {
            method: "POST",
            body: formData
        });

        message.textContent =
            "Complaint submitted successfully.";

        message.style.color = "#16a34a";

        document.getElementById("complaintForm").reset();

        await loadResidentComplaints();

        setTimeout(() => {
            closeComplaintModal();
            message.textContent = "";
        }, 1000);

    } catch (error) {
        message.textContent = error.message;
        message.style.color = "#dc2626";
    }
});

async function loadNotices() {
    try {
        const notices = await apiRequest("/notices");

        const container =
            document.getElementById("residentNotices");

        if (!notices.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No notices available.
                </div>
            `;
            return;
        }

        container.innerHTML = notices.map(notice => `
            <div class="notice-item ${notice.important ? "important" : ""}">

                <h3>
                    ${notice.important ? "📌 " : ""}
                    ${escapeHtml(notice.title)}
                </h3>

                <p>
                    ${escapeHtml(notice.message)}
                </p>

                <span class="notice-date">
                    ${formatDate(notice.created_at)}
                </span>

            </div>
        `).join("");

    } catch (error) {
        document.getElementById("residentNotices").innerHTML =
            `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
}

async function loadAdminDashboard() {
    try {
        const data =
            await apiRequest("/admin/dashboard");

        document.getElementById("adminTotal").textContent =
            data.total;

        document.getElementById("adminOverdue").textContent =
            data.overdue;

        const open =
            data.byStatus.find(x => x.status === "Open");

        const progress =
            data.byStatus.find(x => x.status === "In Progress");

        document.getElementById("adminOpen").textContent =
            open ? open.count : 0;

        document.getElementById("adminProgress").textContent =
            progress ? progress.count : 0;

        renderStatusChart(data.byStatus);
        renderCategoryChart(data.byCategory);

    } catch (error) {
        console.error(error);
    }
}

function renderStatusChart(data) {
    const container =
        document.getElementById("statusChart");

    if (!data.length) {
        container.innerHTML =
            `<div class="empty-state">No data available.</div>`;
        return;
    }

    const max =
        Math.max(...data.map(item => item.count));

    container.innerHTML =
        data.map(item => {

            const percentage =
                Math.max(10, (item.count / max) * 100);

            return `
                <div class="chart-row">

                    <div class="chart-label">
                        <span>${escapeHtml(item.status)}</span>
                        <strong>${item.count}</strong>
                    </div>

                    <div
                        class="chart-bar"
                        style="width:${percentage}%"
                    ></div>

                </div>
            `;

        }).join("");
}

function renderCategoryChart(data) {
    const container =
        document.getElementById("categoryChart");

    if (!data.length) {
        container.innerHTML =
            `<div class="empty-state">No data available.</div>`;
        return;
    }

    const max =
        Math.max(...data.map(item => item.count));

    container.innerHTML =
        data.map(item => {

            const percentage =
                Math.max(10, (item.count / max) * 100);

            return `
                <div class="chart-row">

                    <div class="chart-label">
                        <span>${escapeHtml(item.category)}</span>
                        <strong>${item.count}</strong>
                    </div>

                    <div
                        class="chart-bar"
                        style="width:${percentage}%"
                    ></div>

                </div>
            `;

        }).join("");
}

async function loadAdminComplaints() {
    try {
        const category =
            document.getElementById("filterCategory").value;

        const status =
            document.getElementById("filterStatus").value;

        const date =
            document.getElementById("filterDate").value;

        const params = new URLSearchParams();

        if (category) {
            params.append("category", category);
        }

        if (status) {
            params.append("status", status);
        }

        if (date) {
            params.append("date", date);
        }

        const query =
            params.toString()
                ? `?${params.toString()}`
                : "";

        const complaints =
            await apiRequest(`/admin/complaints${query}`);

        const container =
            document.getElementById("adminComplaints");

        if (!complaints.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No complaints found.
                </div>
            `;
            return;
        }

        container.innerHTML =
            complaints.map(complaint => {

                const statusClass =
                    complaint.status === "Open"
                        ? "badge-open"
                        : complaint.status === "In Progress"
                            ? "badge-progress"
                            : "badge-resolved";

                const priorityClass =
                    complaint.priority === "High"
                        ? "badge-high"
                        : complaint.priority === "Medium"
                            ? "badge-medium"
                            : "badge-low";

                return `
                    <div class="admin-complaint">

                        <div class="complaint-top">

                            <div>

                                <h3>
                                    #${complaint.id}
                                    -
                                    ${escapeHtml(complaint.category)}
                                </h3>

                                <p>
                                    Resident:
                                    <strong>
                                        ${escapeHtml(complaint.resident_name)}
                                    </strong>
                                </p>

                                <p class="complaint-description">
                                    ${escapeHtml(complaint.description)}
                                </p>

                                <span class="badge ${statusClass}">
                                    ${complaint.status}
                                </span>

                                <span class="badge ${priorityClass}">
                                    ${complaint.priority}
                                </span>

                                ${
                                    complaint.is_overdue
                                        ? `<span class="badge badge-overdue">Overdue</span>`
                                        : ""
                                }

                            </div>

                            <small>
                                ${formatDate(complaint.created_at)}
                            </small>

                        </div>

                        <div class="admin-actions">

                            <select
                                id="status-${complaint.id}"
                            >
                                <option
                                    ${complaint.status === "Open" ? "selected" : ""}
                                >
                                    Open
                                </option>

                                <option
                                    ${complaint.status === "In Progress" ? "selected" : ""}
                                >
                                    In Progress
                                </option>

                                <option
                                    ${complaint.status === "Resolved" ? "selected" : ""}
                                >
                                    Resolved
                                </option>

                            </select>

                            <select
                                id="priority-${complaint.id}"
                            >

                                <option
                                    ${complaint.priority === "Low" ? "selected" : ""}
                                >
                                    Low
                                </option>

                                <option
                                    ${complaint.priority === "Medium" ? "selected" : ""}
                                >
                                    Medium
                                </option>

                                <option
                                    ${complaint.priority === "High" ? "selected" : ""}
                                >
                                    High
                                </option>

                            </select>

                            <input
                                id="note-${complaint.id}"
                                placeholder="Optional note"
                            >

                            <button
                                class="secondary-btn"
                                onclick="updateComplaint(${complaint.id})"
                            >
                                Update
                            </button>

                            <button
                                class="view-btn"
                                onclick="viewComplaint(${complaint.id})"
                            >
                                History
                            </button>

                        </div>

                    </div>
                `;

            }).join("");

    } catch (error) {
        document.getElementById("adminComplaints").innerHTML =
            `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
}

async function updateComplaint(id) {
    try {
        const status =
            document.getElementById(`status-${id}`).value;

        const priority =
            document.getElementById(`priority-${id}`).value;

        const note =
            document.getElementById(`note-${id}`).value;

        await apiRequest(`/admin/complaints/${id}`, {
            method: "PATCH",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                status,
                priority,
                note
            })
        });

        alert("Complaint updated successfully.");

        await loadAdminDashboard();
        await loadAdminComplaints();

    } catch (error) {
        alert(error.message);
    }
}

document.getElementById("noticeForm").addEventListener("submit", async function (event) {
    event.preventDefault();

    const result =
        document.getElementById("noticeMessageResult");

    try {
        await apiRequest("/admin/notices", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                title:
                    document.getElementById("noticeTitle").value,

                message:
                    document.getElementById("noticeMessage").value,

                important:
                    document.getElementById("noticeImportant").checked
            })
        });

        result.textContent =
            "Notice posted successfully.";

        result.style.color = "#16a34a";

        document.getElementById("noticeForm").reset();

    } catch (error) {
        result.textContent = error.message;
        result.style.color = "#dc2626";
    }
});

function formatDate(value) {
    if (!value) {
        return "";
    }

    return new Date(
        value.replace(" ", "T") + "Z"
    ).toLocaleString();
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

if (token && currentUser) {
    openDashboard();
} else {
    showPage("authPage");
}