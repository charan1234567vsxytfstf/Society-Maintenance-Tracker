const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "society-maintenance-secret";
const OVERDUE_DAYS = Number(process.env.OVERDUE_DAYS || 7);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDirectory = path.join(__dirname, "uploads");
const frontendDirectory = path.join(__dirname, "../frontend");

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

app.use("/uploads", express.static(uploadDirectory));

const db = new Database(path.join(__dirname, "society.db"));

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'resident',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        photo TEXT,
        status TEXT NOT NULL DEFAULT 'Open',
        priority TEXT NOT NULL DEFAULT 'Medium',
        is_overdue INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS complaint_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        actor_id INTEGER NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        important INTEGER DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    );
`);

async function sendEmail(to, subject, text) {
    if (
        !process.env.SMTP_HOST ||
        !process.env.SMTP_USER ||
        !process.env.SMTP_PASS
    ) {
        console.log("Email not configured:", to, subject);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: process.env.SMTP_USER,
            to,
            subject,
            text
        });

        console.log("Email sent to:", to);
    } catch (error) {
        console.error("Email error:", error.message);
    }
}

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            role: user.role,
            email: user.email
        },
        JWT_SECRET,
        { expiresIn: "1d" }
    );
}

function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    const token = header.split(" ")[1];

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access required"
        });
    }

    next();
}

function updateOverdueComplaints() {
    const complaints = db.prepare(`
        SELECT id, created_at, status
        FROM complaints
        WHERE status != 'Resolved'
    `).all();

    const now = Date.now();

    for (const complaint of complaints) {
        const created = new Date(
            complaint.created_at.replace(" ", "T") + "Z"
        ).getTime();

        const ageInDays = (now - created) / (1000 * 60 * 60 * 24);

        if (ageInDays >= OVERDUE_DAYS) {
            db.prepare(`
                UPDATE complaints
                SET is_overdue = 1
                WHERE id = ?
            `).run(complaint.id);
        }
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDirectory);
    },
    filename: function (req, file, cb) {
        const extension = path.extname(file.originalname);
        const filename =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1000000) +
            extension;

        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        const allowed = [
            "image/jpeg",
            "image/png",
            "image/jpg",
            "image/webp"
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"));
        }
    }
});

app.use(express.static(frontendDirectory));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDirectory, "index.html"));
});

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK",
        message: "Backend is running"
    });
});

app.post("/api/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must contain at least 6 characters"
            });
        }

        const existingUser = db.prepare(`
            SELECT id FROM users WHERE email = ?
        `).get(email.toLowerCase());

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = db.prepare(`
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, 'resident')
        `).run(
            name,
            email.toLowerCase(),
            hashedPassword
        );

        const user = db.prepare(`
            SELECT id, name, email, role
            FROM users
            WHERE id = ?
        `).get(result.lastInsertRowid);

        const token = createToken(user);

        res.status(201).json({
            message: "Registration successful",
            token,
            user
        });

    } catch (error) {
        res.status(500).json({
            message: "Registration failed",
            error: error.message
        });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE email = ?
        `).get(email.toLowerCase());

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const safeUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        const token = createToken(safeUser);

        res.json({
            message: "Login successful",
            token,
            user: safeUser
        });

    } catch (error) {
        res.status(500).json({
            message: "Login failed",
            error: error.message
        });
    }
});

app.get("/api/auth/me", authenticate, (req, res) => {
    const user = db.prepare(`
        SELECT id, name, email, role, created_at
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    res.json(user);
});

app.post(
    "/api/complaints",
    authenticate,
    upload.single("photo"),
    async (req, res) => {
        try {
            const { category, description } = req.body;

            if (!category || !description) {
                return res.status(400).json({
                    message: "Category and description are required"
                });
            }

            const photo = req.file
                ? `/uploads/${req.file.filename}`
                : null;

            const result = db.prepare(`
                INSERT INTO complaints
                (
                    user_id,
                    category,
                    description,
                    photo,
                    status,
                    priority
                )
                VALUES (?, ?, ?, ?, 'Open', 'Medium')
            `).run(
                req.user.id,
                category,
                description,
                photo
            );

            db.prepare(`
                INSERT INTO complaint_history
                (
                    complaint_id,
                    status,
                    actor_id,
                    note
                )
                VALUES (?, 'Open', ?, ?)
            `).run(
                result.lastInsertRowid,
                req.user.id,
                "Complaint created"
            );

            const complaint = db.prepare(`
                SELECT
                    c.*,
                    u.name AS resident_name,
                    u.email AS resident_email
                FROM complaints c
                JOIN users u ON u.id = c.user_id
                WHERE c.id = ?
            `).get(result.lastInsertRowid);

            res.status(201).json({
                message: "Complaint created successfully",
                complaint
            });

        } catch (error) {
            res.status(500).json({
                message: "Could not create complaint",
                error: error.message
            });
        }
    }
);

app.get("/api/complaints/my", authenticate, (req, res) => {
    updateOverdueComplaints();

    const complaints = db.prepare(`
        SELECT *
        FROM complaints
        WHERE user_id = ?
        ORDER BY created_at DESC
    `).all(req.user.id);

    res.json(complaints);
});

app.get(
    "/api/complaints/:id",
    authenticate,
    (req, res) => {
        const complaint = db.prepare(`
            SELECT
                c.*,
                u.name AS resident_name,
                u.email AS resident_email
            FROM complaints c
            JOIN users u ON u.id = c.user_id
            WHERE c.id = ?
        `).get(req.params.id);

        if (!complaint) {
            return res.status(404).json({
                message: "Complaint not found"
            });
        }

        if (
            req.user.role !== "admin" &&
            complaint.user_id !== req.user.id
        ) {
            return res.status(403).json({
                message: "Access denied"
            });
        }

        const history = db.prepare(`
            SELECT
                h.*,
                u.name AS actor_name
            FROM complaint_history h
            JOIN users u ON u.id = h.actor_id
            WHERE h.complaint_id = ?
            ORDER BY h.created_at ASC
        `).all(req.params.id);

        res.json({
            complaint,
            history
        });
    }
);

app.get(
    "/api/admin/complaints",
    authenticate,
    adminOnly,
    (req, res) => {
        updateOverdueComplaints();

        const {
            category,
            status,
            date
        } = req.query;

        let query = `
            SELECT
                c.*,
                u.name AS resident_name,
                u.email AS resident_email
            FROM complaints c
            JOIN users u ON u.id = c.user_id
            WHERE 1 = 1
        `;

        const params = [];

        if (category) {
            query += " AND c.category = ?";
            params.push(category);
        }

        if (status) {
            query += " AND c.status = ?";
            params.push(status);
        }

        if (date) {
            query += " AND DATE(c.created_at) = ?";
            params.push(date);
        }

        query += `
            ORDER BY
                c.is_overdue DESC,
                CASE c.priority
                    WHEN 'High' THEN 1
                    WHEN 'Medium' THEN 2
                    WHEN 'Low' THEN 3
                END,
                c.created_at DESC
        `;

        const complaints = db.prepare(query).all(...params);

        res.json(complaints);
    }
);

app.patch(
    "/api/admin/complaints/:id",
    authenticate,
    adminOnly,
    async (req, res) => {
        try {
            const { status, priority, note } = req.body;

            const complaint = db.prepare(`
                SELECT
                    c.*,
                    u.email AS resident_email
                FROM complaints c
                JOIN users u ON u.id = c.user_id
                WHERE c.id = ?
            `).get(req.params.id);

            if (!complaint) {
                return res.status(404).json({
                    message: "Complaint not found"
                });
            }

            const newStatus = status || complaint.status;
            const newPriority = priority || complaint.priority;

            if (
                !["Open", "In Progress", "Resolved"].includes(newStatus)
            ) {
                return res.status(400).json({
                    message: "Invalid status"
                });
            }

            if (
                !["Low", "Medium", "High"].includes(newPriority)
            ) {
                return res.status(400).json({
                    message: "Invalid priority"
                });
            }

            let resolvedAt = complaint.resolved_at;

            if (newStatus === "Resolved") {
                resolvedAt = new Date().toISOString();
            }

            db.prepare(`
                UPDATE complaints
                SET
                    status = ?,
                    priority = ?,
                    resolved_at = ?,
                    is_overdue = CASE
                        WHEN ? = 'Resolved' THEN 0
                        ELSE is_overdue
                    END
                WHERE id = ?
            `).run(
                newStatus,
                newPriority,
                resolvedAt,
                newStatus,
                req.params.id
            );

            if (newStatus !== complaint.status || note) {
                db.prepare(`
                    INSERT INTO complaint_history
                    (
                        complaint_id,
                        status,
                        actor_id,
                        note
                    )
                    VALUES (?, ?, ?, ?)
                `).run(
                    req.params.id,
                    newStatus,
                    req.user.id,
                    note || null
                );
            }

            if (newStatus !== complaint.status) {
                await sendEmail(
                    complaint.resident_email,
                    "Complaint Status Updated",
                    `Your complaint #${complaint.id} is now "${newStatus}".`
                );
            }

            const updatedComplaint = db.prepare(`
                SELECT *
                FROM complaints
                WHERE id = ?
            `).get(req.params.id);

            res.json({
                message: "Complaint updated successfully",
                complaint: updatedComplaint
            });

        } catch (error) {
            res.status(500).json({
                message: "Could not update complaint",
                error: error.message
            });
        }
    }
);

app.post(
    "/api/admin/notices",
    authenticate,
    adminOnly,
    async (req, res) => {
        try {
            const {
                title,
                message,
                important
            } = req.body;

            if (!title || !message) {
                return res.status(400).json({
                    message: "Title and message are required"
                });
            }

            const result = db.prepare(`
                INSERT INTO notices
                (
                    title,
                    message,
                    important,
                    created_by
                )
                VALUES (?, ?, ?, ?)
            `).run(
                title,
                message,
                important ? 1 : 0,
                req.user.id
            );

            if (important) {
                const residents = db.prepare(`
                    SELECT email
                    FROM users
                    WHERE role = 'resident'
                `).all();

                for (const resident of residents) {
                    await sendEmail(
                        resident.email,
                        "Important Society Notice",
                        `${title}\n\n${message}`
                    );
                }
            }

            const notice = db.prepare(`
                SELECT *
                FROM notices
                WHERE id = ?
            `).get(result.lastInsertRowid);

            res.status(201).json({
                message: "Notice posted successfully",
                notice
            });

        } catch (error) {
            res.status(500).json({
                message: "Could not create notice",
                error: error.message
            });
        }
    }
);

app.get("/api/notices", authenticate, (req, res) => {
    const notices = db.prepare(`
        SELECT
            n.*,
            u.name AS admin_name
        FROM notices n
        JOIN users u ON u.id = n.created_by
        ORDER BY
            n.important DESC,
            n.created_at DESC
    `).all();

    res.json(notices);
});

app.get(
    "/api/admin/dashboard",
    authenticate,
    adminOnly,
    (req, res) => {
        updateOverdueComplaints();

        const total = db.prepare(`
            SELECT COUNT(*) AS count
            FROM complaints
        `).get().count;

        const byStatus = db.prepare(`
            SELECT status, COUNT(*) AS count
            FROM complaints
            GROUP BY status
        `).all();

        const byCategory = db.prepare(`
            SELECT category, COUNT(*) AS count
            FROM complaints
            GROUP BY category
            ORDER BY count DESC
        `).all();

        const overdue = db.prepare(`
            SELECT COUNT(*) AS count
            FROM complaints
            WHERE is_overdue = 1
        `).get().count;

        const byPriority = db.prepare(`
            SELECT priority, COUNT(*) AS count
            FROM complaints
            GROUP BY priority
        `).all();

        res.json({
            total,
            overdue,
            byStatus,
            byCategory,
            byPriority
        });
    }
);

app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        message: err.message || "Internal server error"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("---------------------------------------");
    console.log("Society Maintenance Tracker API");
    console.log(`Server running on port ${PORT}`);
    console.log(`Overdue threshold: ${OVERDUE_DAYS} days`);
    console.log("---------------------------------------");
});