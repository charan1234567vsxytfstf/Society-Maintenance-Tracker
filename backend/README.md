# Society Maintenance Tracker

A full-stack web application for managing apartment society maintenance complaints, notices, priorities, status history, overdue complaints, photo uploads, email notifications, and administrative reporting.

## Features

### Resident
- Register and login
- Raise maintenance complaints
- Select complaint category
- Add complaint description
- Upload an optional complaint photo
- View personal complaints
- View complete complaint status history
- View complaint priority and overdue status
- View society notices
- Receive email notifications for complaint status changes
- Receive email notifications for important notices

### Admin
- Secure admin login
- View all complaints
- Filter complaints by category, status, and date
- Set complaint priority
- Update complaint status
- Add status update notes
- Track complaint history
- Detect overdue complaints
- Post society notices
- Mark notices as important
- View dashboard statistics
- View complaints by status and category
- View overdue complaint count

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript

### Backend
- Node.js
- Express.js
- JWT authentication
- bcryptjs
- Multer
- Nodemailer

### Database
- SQLite
- better-sqlite3

## Project Structure

```text
Society-Maintenance-Tracker/
│
├── backend/
│   ├── middleware/
│   ├── routes/
│   ├── uploads/
│   ├── utils/
│   ├── .env.example
│   ├── server.js
│   ├── create-admin.js
│   ├── package.json
│   └── package-lock.json
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── README.md
└── SYSTEM_DESIGN.md