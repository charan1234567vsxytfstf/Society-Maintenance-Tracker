const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
require("dotenv").config();

const db = new Database("./society.db");

async function createAdmin() {
    const name = process.env.ADMIN_NAME || "Society Admin";
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required in .env");
        process.exit(1);
    }

    const existing = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(email);

    if (existing) {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.prepare(`
            UPDATE users
            SET name = ?, password = ?, role = 'admin'
            WHERE email = ?
        `).run(name, hashedPassword, email);

        console.log("Admin account updated.");
    } else {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.prepare(`
            INSERT INTO users
            (name, email, password, role)
            VALUES (?, ?, ?, 'admin')
        `).run(name, email, hashedPassword);

        console.log("Admin account created.");
    }

    console.log(`Admin email: ${email}`);

    db.close();
}

createAdmin();